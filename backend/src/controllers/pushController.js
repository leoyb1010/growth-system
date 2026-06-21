const { DeviceToken } = require('../models');
const { success, error } = require('../utils/response');
const apns = require('../services/apnsService');
const pushService = require('../services/pushService');

/** 注册/更新当前用户的设备推送 token（登录后由 App 调用，幂等 upsert） */
async function registerDevice(req, res) {
  try {
    const { token, platform = 'ios', bundle_id, app_env } = req.body || {};
    if (!token || String(token).length < 8) return error(res, '无效的设备 token');

    const existing = await DeviceToken.findOne({ where: { token } });
    if (existing) {
      await existing.update({
        user_id: req.user.id,
        platform,
        bundle_id: bundle_id || existing.bundle_id,
        app_env: app_env || existing.app_env,
        active: true,
        last_seen_at: new Date(),
      });
    } else {
      await DeviceToken.create({
        user_id: req.user.id, token, platform, bundle_id, app_env, active: true, last_seen_at: new Date(),
      });
    }
    return success(res, { registered: true, push_enabled: apns.isConfigured() });
  } catch (err) {
    console.error('registerDevice error:', err);
    return error(res, err.message || '设备注册失败');
  }
}

/** 注销设备 token（登出时调用） */
async function unregisterDevice(req, res) {
  try {
    const token = req.body?.token || req.query?.token;
    if (!token) return error(res, '缺少 token');
    await DeviceToken.update({ active: false }, { where: { token, user_id: req.user.id } });
    return success(res, { unregistered: true });
  } catch (err) {
    console.error('unregisterDevice error:', err);
    return error(res, err.message || '设备注销失败');
  }
}

/** 给自己发一条测试推送（验证端到端链路用，仅本人） */
async function testPush(req, res) {
  try {
    if (!apns.isConfigured()) return success(res, { skipped: true, reason: 'APNs 未配置（缺少凭证环境变量）' });
    const result = await pushService.sendToUser(req.user.id, {
      title: '推送测试',
      body: '这是一条来自增长系统的测试通知 ✅',
      data: { type: 'test' },
    });
    return success(res, result);
  } catch (err) {
    console.error('testPush error:', err);
    return error(res, err.message || '测试推送失败');
  }
}

module.exports = { registerDevice, unregisterDevice, testPush };
