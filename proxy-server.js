const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 3456;
const API_PORT = 3001;

// 代理 /api 到后端
app.use('/api', createProxyMiddleware({
  target: `http://localhost:${API_PORT}/api`,
  changeOrigin: true,
  pathRewrite: {
    '^/api': ''
  },
  logLevel: 'silent'
}));

// serve 前端静态文件
app.use(express.static(path.join(__dirname, 'frontend/build')));

// SPA 回退
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`代理服务器已启动: http://localhost:${PORT}`);
  console.log(`前端 -> localhost:${PORT}`);
  console.log(`API  -> localhost:${PORT}/api -> localhost:${API_PORT}/api`);
});
