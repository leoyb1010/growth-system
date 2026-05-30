// 从 backend/.env 加载环境变量（置于最顶部，确保 config/database、aiLLMProvider 等在 require 时即可读到）
// override:true 让 backend/.env 成为唯一配置真源，避免 pm2 在首次启动时烤死的旧变量（如失效的 API Key）与 .env 漂移
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), override: true });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const { sequelize, Department, User } = require('./models');
const routes = require('./routes');
const { initCronJobs } = require('./services/cronService');
const { initCpsCron } = require('./services/cpsCronService');
const { dbWriteGuard, dbReadOnlyGuard, checkDbWritable, periodicCheck } = require('./middleware/dbHealthCheck');

const app = express();
const PORT = process.env.PORT || 58931;

// 安全中间件
app.use(helmet({
  hsts: {
    maxAge: 31536000,        // 1年（与 leonote.top 对齐）
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  frameguard: { action: 'deny' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    }
  }
}));

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

// 限流 - 注册接口：防批量注册滥用
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 3, // 最多3次注册尝试
  message: { code: 429, data: null, message: '注册请求过于频繁，请稍后再试' }
});

// 限流 - AI 接口：防滥用（LLM调用有成本）
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 20, // 最多20次AI请求
  message: { code: 429, data: null, message: 'AI请求过于频繁，请稍后再试' }
});

// 限流 - AI 流式接口：更严格的限制（长连接消耗更大）
const aiStreamLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 流式接口最多10次/分钟
  message: { code: 429, data: null, message: 'AI流式请求过于频繁，请稍后再试' }
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

// DB 写入守卫：写操作前检查 SQLITE_READONLY 状态
app.use(dbWriteGuard);

// 静态文件（导出文件、周报文件）—— 已移除直接静态服务，改为 API 鉴权下载
// 旧方式：app.use('/uploads', express.static(...)) — 任何人知道URL就能下载
// 新方式：通过 /api/files/exports/:filename 和 /api/files/weekly-reports/:filename 鉴权后下载

// API 路由（传入精细化限流器）
app.use('/api', routes({
  loginLimiter,
  registerLimiter,
  aiLimiter,
  aiStreamLimiter,
  importLimiter
}));

// 健康检查（含 DB 写入状态）
app.get('/health', async (req, res) => {
  const { isDbReadOnly, checkDbWritable } = require('./middleware/dbHealthCheck');
  const llmProvider = require('./ai/services/aiLLMProvider');
  let dbWritable = true;
  try {
    dbWritable = !isDbReadOnly();
  } catch (e) { /* ignore */ }
  const aiStatus = llmProvider.getStatus();

  res.json({
    code: 0,
    data: {
      status: dbWritable ? 'ok' : 'degraded',
      db_writable: dbWritable,
      ai_llm: aiStatus,
      time: new Date().toISOString()
    },
    message: dbWritable ? '服务正常' : '数据库只读，写入功能不可用'
  });
});

// 前端静态文件托管（Vite 构建产物）
// 注意：此逻辑与根目录 proxy-server.js 重复。TODO：统一静态文件服务位置，消除双写。
const frontendBuildPath = path.join(__dirname, '../../frontend/build');

// /assets/* — Vite 带 content hash 的文件（如 index-_NPr1ogI.js），可长缓存 1 年
// CF 边缘缓存 + 浏览器强缓存 = 静态资源秒开
app.use('/assets', express.static(path.join(frontendBuildPath, 'assets'), {
  immutable: true,
  maxAge: '365d',
  setHeaders: (res, filePath) => {
    // .map 文件（source map）：不缓存，避免暴露源码
    if (filePath.endsWith('.map')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// /icons, /favicon.ico, /manifest.webmanifest 等其他前端静态资源，短缓存 1 小时
// 注意：index.html 由下方专用路由处理（no-cache），这里排除它
app.use(express.static(frontendBuildPath, {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// index.html 不缓存，确保每次都获取最新的 JS hash
app.get('/', (req, res) => {
  const indexPath = path.join(frontendBuildPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not built');
  }
});
// SPA 回退：所有非 API、非静态文件的 GET 请求返回 index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/weekly-reports/')) {
    return next();
  }
  const indexPath = path.join(frontendBuildPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(indexPath);
  } else {
    next();
  }
});

// 错误处理
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? '上传文件不能超过10MB'
      : '文件上传失败';
    return res.status(400).json({ code: 1, data: null, message });
  }
  next(err);
});
// 第一层：SQLITE_READONLY 专用拦截（在通用 500 之前）
app.use(dbReadOnlyGuard);
// 第二层：通用错误兜底
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    code: 1,
    data: null,
    message: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误'
  });
});

// ASO 产品幂等种子：确保词典/echo/翻译官默认存在
async function seedAsoProducts() {
  try {
    const { AsoProduct } = require('./models');
    const seeds = [
      { code: 'dict', name: '词典', aliases: ['网易有道词典', '有道词典'] },
      { code: 'echo', name: 'echo', aliases: ['Echo'] },
      { code: 'translator', name: '翻译官', aliases: ['有道翻译官', '翻译官'] },
    ];

    for (const item of seeds) {
      const [product] = await AsoProduct.findOrCreate({
        where: { code: item.code },
        defaults: {
          code: item.code,
          name: item.name,
          status: 'active',
          remark: `aliases=${item.aliases.join(',')}`,
        },
      });

      if (product.name !== item.name || product.status !== 'active') {
        await product.update({ name: item.name, status: 'active' });
      }
    }
  } catch (err) {
    console.error('ASO产品种子初始化失败:', err.message);
  }
}

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
      const isProduction = process.env.NODE_ENV === 'production';
      const allowInsecureSeed = process.env.ALLOW_INSECURE_DEFAULT_SEED === 'true';
      const configuredSeedPassword = process.env.DEFAULT_SEED_PASSWORD;
      const defaultPassword = configuredSeedPassword || (
        allowInsecureSeed && !isProduction
          ? '123456'
          : require('crypto').randomBytes(16).toString('hex')
      );
      const defaultHash = await bcrypt.hash(defaultPassword, 10);
      const mustChangePassword = true;
      await User.bulkCreate([
        { id: 1, username: 'admin', name: '管理员', role: 'admin', dept_id: null, password_hash: defaultHash, must_change_password: mustChangePassword },
        { id: 2, username: 'expand', name: '拓展组账号', role: 'dept', dept_id: 1, password_hash: defaultHash, must_change_password: mustChangePassword },
        { id: 3, username: 'ops', name: '运营组账号', role: 'dept', dept_id: 2, password_hash: defaultHash, must_change_password: mustChangePassword },
      ]);
      if (configuredSeedPassword) {
        console.log('种子数据：已插入 3 个默认用户（使用 DEFAULT_SEED_PASSWORD，首次登录必须改密）');
      } else if (allowInsecureSeed && !isProduction) {
        console.log('种子数据：已插入 3 个默认用户（开发显式开启 123456，首次登录必须改密）');
      } else {
        console.log('种子数据：已插入 3 个默认用户（密码已随机化，首次登录必须改密）');
      }
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

        // 主动写入测试（比 PRAGMA 更可靠地检测 SQLITE_READONLY）
        const writable = await checkDbWritable();
        if (!writable) {
          console.error('❌❌❌ 致命错误：数据库只读（SQLITE_READONLY）！');
          console.error('❌ 这通常是因为 pm2 restart 没有释放旧连接。');
          console.error('❌ 解决方法：pm2 delete growth-system && cd backend && DB_DIALECT=sqlite NODE_ENV=development pm2 start src/app.js --name growth-system');
          process.exit(1);
        }
        console.log('[DB] ✅ SQLite 写入测试通过');
      }
    } catch (dbWriteErr) {
      if (dbWriteErr.original && dbWriteErr.original.code === 'SQLITE_READONLY') {
        console.error('❌❌❌ 致命错误：数据库只读（SQLITE_READONLY）！');
        console.error('❌ 这通常是因为 pm2 restart 没有释放旧连接。');
        console.error('❌ 解决方法：pm2 delete growth-system && cd backend && DB_DIALECT=sqlite NODE_ENV=development pm2 start src/app.js --name growth-system');
        process.exit(1);
      }
      console.warn('[DB] 写入自检警告（非致命）:', dbWriteErr.message);
    }

    // 同步模型：始终以 force:false 运行，确保新增表被创建且不影响已有表
    // SQLite: force:false 只创建不存在的表
    // PostgreSQL: 生产环境 force:false（不修改已有表结构），开发环境 alter:true（自动添加新列）
    const dialect = process.env.DB_DIALECT || 'postgres';
    const syncOptions = (dialect === 'sqlite' || process.env.NODE_ENV === 'production')
      ? { force: false }
      : { alter: true };
    await sequelize.sync(syncOptions);
    console.log('数据库模型同步完成');

    // 种子数据：确保部门和初始用户存在
    await seedDatabase();

    // ASO 种子：确保词典/echo/翻译官默认存在
    await seedAsoProducts();

    // 启动定时任务
    initCronJobs();
    initCpsCron();

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
