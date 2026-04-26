#!/bin/bash
# Growth System 生产环境启动脚本
# 使用方式: ./start-prod.sh
#
# 安全要求：
# - JWT_SECRET 必须在 .env 或环境变量中设置，否则启动失败
# - AI 配置从 backend/.env 读取，不再硬编码在此脚本中

cd "$(dirname "$0")"

# 加载 backend/.env 中的环境变量（如果存在）
if [ -f "backend/.env" ]; then
  set -a
  source backend/.env
  set +a
  echo "已加载 backend/.env"
fi

# 生产环境变量（.env 未覆盖时使用）
export NODE_ENV=${NODE_ENV:-production}
export DB_DIALECT=${DB_DIALECT:-sqlite}
export PORT=${PORT:-3001}

# JWT_SECRET: 生产环境必须显式设置
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "growth-secret-key-2026" ]; then
  echo "❌ 错误：生产环境必须设置强 JWT_SECRET"
  echo "   请在 backend/.env 中添加：JWT_SECRET=$(openssl rand -hex 32)"
  echo "   或通过环境变量传入：JWT_SECRET=xxx ./start-prod.sh"
  exit 1
fi

# AI 助手配置：如果未设置 API Key，AI 功能降级为 mock
if [ -n "$AI_LLM_API_KEY" ]; then
  export AI_LLM_PROVIDER=${AI_LLM_PROVIDER:-deepseek}
  export AI_LLM_MODEL=${AI_LLM_MODEL:-deepseek-chat}
  export AI_LLM_BASE_URL=${AI_LLM_BASE_URL:-https://api.deepseek.com}
else
  export AI_LLM_PROVIDER=mock
  echo "⚠️  AI_LLM_API_KEY 未设置，AI 功能降级为 mock 模式"
fi

echo "========================================="
echo "  Growth System 生产环境启动"
echo "========================================="
echo "NODE_ENV:         $NODE_ENV"
echo "DB_DIALECT:       $DB_DIALECT"
echo "PORT:             $PORT"
echo "JWT_SECRET:       ${JWT_SECRET:0:10}..."
echo "AI_LLM_PROVIDER:  $AI_LLM_PROVIDER"
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
  # ⚠️ 必须显式 export AI 环境变量，pm2 start 只继承当前 shell 环境
  export AI_LLM_PROVIDER="${AI_LLM_PROVIDER}"
  export AI_LLM_API_KEY="${AI_LLM_API_KEY}"
  export AI_LLM_MODEL="${AI_LLM_MODEL}"
  export AI_LLM_BASE_URL="${AI_LLM_BASE_URL}"
  pm2 delete growth-system 2>/dev/null || true
  pm2 start src/app.js --name growth-system || true
  pm2 save
  echo "pm2 启动完成。使用 'pm2 logs growth-system' 查看日志"
else
  echo "使用 node 启动..."
  cd backend
  node src/app.js
fi
