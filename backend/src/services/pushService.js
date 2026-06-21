/**
 * 推送编排：把"给某用户/某些用户推送"翻译成"查活跃设备 token → APNs 发送 → 失活死 token"。
 * 全部 best-effort：任何异常都吞掉并记日志，绝不影响调用方主流程（如告警写库）。
 */
const { Op } = require('sequelize');
const { DeviceToken } = require('../models');
const apns = require('./apnsService');

async function sendToUsers(userIds, notification) {
  try {
    const ids = (Array.isArray(userIds) ? userIds : [userIds]).map(Number).filter(Boolean);
    if (!ids.length) return { sent: 0, skipped: true };
    if (!apns.isConfigured()) return { sent: 0, skipped: true };

    const rows = await DeviceToken.findAll({
      where: { user_id: { [Op.in]: ids }, active: true, platform: 'ios' },
      attributes: ['token'],
      raw: true,
    });
    const tokens = rows.map(r => r.token);
    if (!tokens.length) return { sent: 0, skipped: true };

    const res = await apns.sendToTokens(tokens, notification);
    if (res.invalidTokens?.length) {
      await DeviceToken.update({ active: false }, { where: { token: { [Op.in]: res.invalidTokens } } }).catch(() => {});
    }
    return res;
  } catch (err) {
    console.error('pushService.sendToUsers 失败(已忽略):', err.message);
    return { sent: 0, error: err.message };
  }
}

function sendToUser(userId, notification) {
  return sendToUsers([userId], notification);
}

module.exports = { sendToUser, sendToUsers };
