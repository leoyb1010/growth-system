const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { RefreshToken } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'growth-secret-key-2026';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, name: user.name, role: user.role, dept_id: user.dept_id, roleLevel: user.role, token_version: user.token_version },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

async function generateRefreshToken(user) {
  const token = crypto.randomBytes(64).toString('hex');
  await RefreshToken.create({
    user_id: user.id,
    token,
    expires_at: new Date(Date.now() + REFRESH_EXPIRES_MS),
    revoked: false
  });
  return token;
}

async function verifyAndRotateRefreshToken(token) {
  const stored = await RefreshToken.findOne({ where: { token, revoked: false } });
  if (!stored) return null;
  if (new Date(stored.expires_at) < new Date()) {
    await stored.update({ revoked: true });
    return null;
  }

  // 轮转：旧 token 失效，生成新的
  await stored.update({ revoked: true });

  const { User } = require('../models');
  const user = await User.findByPk(stored.user_id);
  if (!user || user.status !== 'active') return null;

  const newToken = crypto.randomBytes(64).toString('hex');
  await RefreshToken.create({
    user_id: user.id,
    token: newToken,
    expires_at: new Date(Date.now() + REFRESH_EXPIRES_MS),
    revoked: false
  });

  return { user, refreshToken: newToken };
}

async function revokeAllUserTokens(userId) {
  await RefreshToken.update(
    { revoked: true },
    { where: { user_id: userId, revoked: false } }
  );
}

module.exports = { generateAccessToken, generateRefreshToken, verifyAndRotateRefreshToken, revokeAllUserTokens };
