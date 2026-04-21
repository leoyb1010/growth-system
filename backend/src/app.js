const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { sequelize } = require('./models');
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

// 数据库连接并启动服务
async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    // 同步模型（开发环境自动建表，生产环境建议用迁移）
    if (process.env.NODE_ENV !== 'production') {
      await sequelize.sync({ alter: true });
      console.log('数据库模型同步完成');
    }

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
