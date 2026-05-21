const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { RefreshToken } = require('../models');
const { JWT_SECRET } = require('../utils/jwt');
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// 互斥锁：防止同一用户的 refresh token 并发轮转竞态
const refreshLocks = new Map();
function acquireRefreshLock(userId) {
  if (refreshLocks.has(userId)) return refreshLocks.get(userId);
  let release;
  const lock = new Promise(resolve => { release = resolve; });
  refreshLocks.set(userId, lock);
  return { promise: lock, release: () => { refreshLocks.delete(userId); release(); } };
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function getRoleLevel(role) {
  return (role === 'admin' || role === 'super_admin')
    ? 0
    : (role === 'dept_manager' || role === 'dept' || role === 'cps_admin')
      ? 1
      : 2;
}

function generateAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      dept_id: user.dept_id,
      roleLevel: getRoleLevel(user.role),
      token_version: user.token_version || 0
    },
    JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
}

async function generateRefreshToken(user) {
  const token = crypto.randomBytes(64).toString('hex');
  await RefreshToken.create({
    user_id: user.id,
    token: hashToken(token),
    expires_at: new Date(Date.now() + REFRESH_EXPIRES_MS),
    revoked: false
  });
  return token;
}

async function verifyAndRotateRefreshToken(token) {
  const tokenHash = hashToken(token);
  let stored = await RefreshToken.findOne({ where: { token: tokenHash, revoked: false } });
  if (!stored) {
    // Legacy compatibility: older rows stored refresh tokens in plaintext.
    stored = await RefreshToken.findOne({ where: { token, revoked: false } });
  }
  if (!stored) return null;
  if (new Date(stored.expires_at) < new Date()) {
    await stored.update({ revoked: true });
    return null;
  }

  // 并发安全：按 userId 加锁，防止同一用户并发刷新导致竞态
  const userId = stored.user_id;
  const existing = refreshLocks.get(userId);
  if (existing) {
    // 已有进行中的轮转，等待前一个完成
    await existing;
    return null; // 前一个请求已轮转完毕，本次 token 已失效
  }
  const lock = acquireRefreshLock(userId);
  try {
    // 重新查询：可能已被前一个并发请求处理
    const recheck = await RefreshToken.findOne({ where: { token: tokenHash, revoked: false } });
    if (!recheck) return null;

    // 轮转：旧 token 失效，生成新的
    await recheck.update({ revoked: true });

    const { User } = require('../models');
    const user = await User.findByPk(userId);
    if (!user || user.status !== 'active') return null;

    const newToken = crypto.randomBytes(64).toString('hex');
    await RefreshToken.create({
      user_id: user.id,
      token: hashToken(newToken),
      expires_at: new Date(Date.now() + REFRESH_EXPIRES_MS),
      revoked: false
    });

    return { user, refreshToken: newToken };
  } finally {
    lock.release();
  }
}

async function revokeAllUserTokens(userId) {
  await RefreshToken.update(
    { revoked: true },
    { where: { user_id: userId, revoked: false } }
  );
}

module.exports = { generateAccessToken, generateRefreshToken, verifyAndRotateRefreshToken, revokeAllUserTokens, hashToken };
