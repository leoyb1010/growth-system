const crypto = require('crypto');
const { AgentIdentity, User, Department } = require('../models');

const bindCodes = new Map();

function minutes(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function makeCode() {
  return String(crypto.randomInt(100000, 999999));
}

function makeAgentToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function cleanupExpiredCodes() {
  const now = Date.now();
  for (const [code, item] of bindCodes.entries()) {
    if (item.expiresAt <= now) bindCodes.delete(code);
  }
}

function createBindCode(user) {
  cleanupExpiredCodes();
  const code = makeCode();
  const ttlMinutes = minutes('AGENT_BIND_CODE_TTL_MINUTES', 10);
  bindCodes.set(code, {
    userId: user.id,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
  });
  return { code, expiresInMinutes: ttlMinutes };
}

async function completeBind({ code, provider, externalUserId, externalUsername }) {
  cleanupExpiredCodes();
  const item = bindCodes.get(String(code));
  if (!item) {
    throw new Error('绑定码无效或已过期');
  }

  const user = await User.findByPk(item.userId);
  if (!user || user.status !== 'active') {
    throw new Error('绑定的系统账号不可用');
  }

  const agentToken = makeAgentToken();
  const [identity] = await AgentIdentity.findOrCreate({
    where: { provider, external_user_id: String(externalUserId) },
    defaults: {
      provider,
      external_user_id: String(externalUserId),
      external_username: externalUsername || null,
      user_id: user.id,
      status: 'active',
      agent_token_hash: hashToken(agentToken),
    }
  });

  if (!identity.isNewRecord) {
    await identity.update({
      external_username: externalUsername || identity.external_username,
      user_id: user.id,
      status: 'active',
      agent_token_hash: hashToken(agentToken),
    });
  }

  bindCodes.delete(String(code));
  return { identity, agentToken, user };
}

async function resolveIdentity({ provider, externalUserId, agentToken }) {
  const identity = await AgentIdentity.findOne({
    where: { provider, external_user_id: String(externalUserId), status: 'active' },
    include: [{ model: User, include: [{ model: Department, attributes: ['id', 'name'] }] }]
  });
  if (!identity) return null;
  if (identity.agent_token_hash && hashToken(agentToken || '') !== identity.agent_token_hash) {
    return null;
  }
  await identity.update({ last_used_at: new Date() });
  return identity;
}

module.exports = {
  createBindCode,
  completeBind,
  resolveIdentity,
  hashToken,
};
