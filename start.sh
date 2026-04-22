#!/bin/bash
# 增长组业务管理系统一键启动脚本
# 前端+后端同端口（3001），无需额外代理

cd "$(dirname "$0")"

export DB_DIALECT=sqlite
export NODE_ENV=development

echo "🚀 启动增长组业务管理系统..."
echo "   后端端口: 3001 (同时托管前端静态文件)"
echo "   访问地址: http://localhost:3001"

node backend/src/app.js
