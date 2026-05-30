const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 3456;
const API_PORT = 58931;

// 代理 /api 到后端
app.use('/api', createProxyMiddleware({
  target: `http://localhost:${API_PORT}/api`,
  changeOrigin: true,
  pathRewrite: {
    '^/api': ''
  },
  logLevel: 'silent'
}));

// serve 前端静态文件（Vite 构建产物）
// 注意：proxy-server.js 和 backend/src/app.js 都包含了前端静态文件服务逻辑。
// TODO：统一由一处（proxy-server 或 app.js）负责静态文件服务，避免重复和版本不一致。
// /assets/* — Vite 带 content hash 的文件，长缓存 1 年
app.use('/assets', express.static(path.join(__dirname, 'frontend/build/assets'), {
  immutable: true,
  maxAge: '365d'
}));
// 其他静态资源（favicon、manifest 等），短缓存
app.use(express.static(path.join(__dirname, 'frontend/build'), {
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// SPA 回退
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/build/index.html'));
});

app.listen(PORT, () => {
  console.log(`代理服务器已启动: http://localhost:${PORT}`);
  console.log(`前端 -> localhost:${PORT}`);
  console.log(`API  -> localhost:${PORT}/api -> localhost:${API_PORT}/api`);
});
