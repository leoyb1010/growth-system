#!/bin/bash
# Growth System 生产环境启动脚本
# 使用方式: ./start-prod.sh

cd "$(dirname "$0")"

# 生产环境变量
export NODE_ENV=production
export DB_DIALECT=sqlite
export PORT=3001

# JWT_SECRET: 生产环境必须用强密钥
# 如果没有设置环境变量，使用默认值（请在正式部署时更换）
export JWT_SECRET=${JWT_SECRET:-"growth-secret-key-2026-PROD-$(date +%s)"}

# AI 助手配置
export AI_LLM_PROVIDER=deepseek
export AI_LLM_API_KEY=sk-10a301079153469cb7a3e37d65b02219
export AI_LLM_MODEL=deepseek-chat
export AI_LLM_BASE_URL=https://api.deepseek.com

echo "========================================="
echo "  Growth System 生产环境启动"
echo "========================================="
echo "NODE_ENV:    $NODE_ENV"
echo "DB_DIALECT:  $DB_DIALECT"
echo "PORT:        $PORT"
echo "JWT_SECRET:  ${JWT_SECRET:0:10}..."
echo "========================================="

# 检查前端 build 是否存在
if [ ! -d "frontend/build" ]; then
  echo "前端 build 不存在，开始构建..."
  (cd frontend && npm install && npm run build)
fi

# 使用 pm2 启动（如果已安装），否则直接 node
if command -v pm2 &> /dev/null; then
  echo "使用 pm2 启动..."
  cd backend
  # pm2 delete + start 避免 restart 导致的 SQLITE_READONLY 问题
  pm2 delete growth-system 2>/dev/null || true
  pm2 start src/app.js --name growth-system || true
  pm2 save
  echo "pm2 启动完成。使用 'pm2 logs growth-system' 查看日志"
else
  echo "使用 node 启动..."
  cd backend
  node src/app.js
fi
