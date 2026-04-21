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

// 限流
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 1000, // 每个IP最多1000请求
  message: { code: 429, data: null, message: '请求过于频繁，请稍后再试' }
});
app.use(limiter);

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : ['http://localhost:3000'],
  credentials: true
}));

// 解析请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件（导出文件、周报文件）
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/weekly-reports', express.static(path.join(__dirname, '../weekly-reports')));

// API 路由
app.use('/api', routes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ code: 0, data: { status: 'ok', time: new Date().toISOString() }, message: '服务正常' });
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

    // 同步模型（开发环境自动建表，生产环境建议用迁移）
    const dialect = process.env.DB_DIALECT || 'postgres';
    if (process.env.NODE_ENV !== 'production') {
      // SQLite 不支持 alter: true（外键约束会导致重建失败），用 force: false 只创建不存在的表
      const syncOptions = dialect === 'sqlite' ? { force: false } : { alter: true };
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
