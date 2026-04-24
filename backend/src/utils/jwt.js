const jwt = require('jsonwebtoken');

const DEFAULT_JWT_SECRET = 'growth-secret-key-2026';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 生产环境必须设置强 JWT_SECRET，否则阻止启动
if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEFAULT_JWT_SECRET) {
  throw new Error(
    '❌ 生产环境安全拦截：JWT_SECRET 使用了默认值，请设置强随机密钥。\n' +
    '   生成命令：openssl rand -hex 32\n' +
    '   在 .env 中设置：JWT_SECRET=<生成的密钥>'
  );
}

// 开发环境使用默认值时打印警告
if (process.env.NODE_ENV !== 'production' && JWT_SECRET === DEFAULT_JWT_SECRET) {
  console.warn('⚠️  警告：JWT_SECRET 使用默认值，请在生产环境中更换为强随机密钥');
}

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { generateToken, verifyToken, JWT_SECRET };
