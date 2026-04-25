const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const bcrypt = require('bcryptjs');

const { sequelize, Department, User } = require('./models');
const routes = require('./routes');
const { initCronJobs } = require('./services/cronService');

const app = express();
const PORT = process.env.PORT || 3001;

// 安全中间件
app.use(helmet());

// 信任 Cloudflare Tunnel 代理，使限流器能正确识别真实 IP
app.set('trust proxy', 1);

// 限流 - 全局默认
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 每个IP最多1000请求
  message: { code: 429, data: null, message: '请求过于频繁，请稍后再试' }
});
app.use(limiter);

// 限流 - 登录接口：防暴力破解
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 5, // 最多5次登录尝试
  message: { code: 429, data: null, message: '登录尝试过于频繁，请1分钟后再试' }
});

// 限流 - AI 接口：防滥用（LLM调用有成本）
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 20, // 最多20次AI请求
  message: { code: 429, data: null, message: 'AI请求过于频繁，请稍后再试' }
});

// 限流 - 导入接口：防批量冲击
const importLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 最多10次导入
  message: { code: 429, data: null, message: '导入操作过于频繁，请稍后再试' }
});

// CORS（同源模式无需跨域，仅开发环境需要）
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000', 'http://localhost:3456'],
  credentials: true
}));

// 解析请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件（导出文件、周报文件）
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/weekly-reports', express.static(path.join(__dirname, '../weekly-reports')));

// API 路由（传入精细化限流器）
app.use('/api', routes({
  loginLimiter,
  aiLimiter,
  importLimiter
}));

// 健康检查
app.get('/health', (req, res) => {
  res.json({ code: 0, data: { status: 'ok', time: new Date().toISOString() }, message: '服务正常' });
});

// 前端静态文件托管（生产模式：后端直接 serve 前端 build 产物）
const frontendBuildPath = path.join(__dirname, '../../frontend/build');
app.use(express.static(frontendBuildPath));
// SPA 回退：所有非 API、非静态文件的 GET 请求返回 index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/weekly-reports/')) {
    return next();
  }
  const indexPath = path.join(frontendBuildPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    next();
  }
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    code: 1,
    data: null,
    message: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误'
  });
});

// 种子数据初始化
async function seedDatabase() {
  try {
    // 部门种子数据
    const deptCount = await Department.count();
    if (deptCount === 0) {
      await Department.bulkCreate([
        { id: 1, name: '拓展组' },
        { id: 2, name: '运营组' },
      ]);
      console.log('种子数据：已插入 2 个部门');
    }

    // 用户种子数据
    const userCount = await User.count();
    if (userCount === 0) {
      const defaultHash = await bcrypt.hash('123456', 10);
      await User.bulkCreate([
        { id: 1, username: 'admin', name: '管理员', role: 'admin', dept_id: null, password_hash: defaultHash },
        { id: 2, username: 'expand', name: '拓展组账号', role: 'dept', dept_id: 1, password_hash: defaultHash },
        { id: 3, username: 'ops', name: '运营组账号', role: 'dept', dept_id: 2, password_hash: defaultHash },
      ]);
      console.log('种子数据：已插入 3 个默认用户（密码均为 123456）');
    }
  } catch (err) {
    console.error('种子数据初始化失败:', err.message);
  }
}

// 数据库连接并启动服务
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    // ⚠️ 关键自检：验证数据库写入权限（检测 SQLITE_READONLY 问题）
    try {
      const dialect = process.env.DB_DIALECT || 'postgres';
      if (dialect === 'sqlite') {
        await sequelize.query('PRAGMA journal_mode=WAL');
        const [results] = await sequelize.query('PRAGMA journal_mode');
        console.log(`[DB] SQLite journal_mode: ${results[0]?.journal_mode || 'unknown'}`);
        // 性能+安全加固：NORMAL 模式在 WAL 下安全，比 FULL 快 10-50 倍
        await sequelize.query('PRAGMA synchronous=NORMAL');
        // 并发等待：5 秒内重试而不是立即报 SQLITE_BUSY
        await sequelize.query('PRAGMA busy_timeout=5000');
        // 额外优化：WAL 自动检查点设为 1000 页（默认 1000，显式设置便于维护）
        await sequelize.query('PRAGMA wal_autocheckpoint=1000');
        console.log('[DB] SQLite PRAGMA加固完成: synchronous=NORMAL, busy_timeout=5000ms');
      }
    } catch (dbWriteErr) {
      if (dbWriteErr.original && dbWriteErr.original.code === 'SQLITE_READONLY') {
        console.error('❌❌❌ 致命错误：数据库只读（SQLITE_READONLY）！');
        console.error('❌ 这通常是因为 pm2 restart 没有释放旧连接。');
        console.error('❌ 解决方法：pm2 delete growth-system && pm2 start src/app.js --name growth-system');
        process.exit(1);
      }
      console.warn('[DB] 写入自检警告（非致命）:', dbWriteErr.message);
    }

    // 同步模型（开发环境自动建表，生产环境建议用迁移）
    const dialect = process.env.DB_DIALECT || 'postgres';
    if (process.env.NODE_ENV !== 'production') {
      // SQLite: force:false 只创建不存在的表 | PostgreSQL: 生产环境 force:false，开发环境 alter:true
      const syncOptions = (dialect === 'sqlite' || process.env.NODE_ENV === 'production')
        ? { force: false }
        : { alter: true };
      await sequelize.sync(syncOptions);
      console.log('数据库模型同步完成');
    }

    // 种子数据：确保部门和初始用户存在
    await seedDatabase();

    // 启动定时任务
    initCronJobs();

    app.listen(PORT, () => {
      console.log(`增长组业务管理系统后端服务已启动，端口: ${PORT}`);
      console.log(`环境: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
