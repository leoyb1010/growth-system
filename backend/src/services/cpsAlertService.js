const { Op } = require('sequelize');
const { CpsDailyMetric, CpsChannel, CpsProduct, CpsAlertRule, CpsAlertEvent, User } = require('../models');
const cpsCalc = require('./cpsCalcService');
const pushService = require('./pushService');
const { todayString } = require('../utils/businessDate');

// 预警推送收件人（严格按数据范围，避免越权）：
//  - 管理员(super_admin/admin) 与 全量 CPS 角色(cps_admin/cps_ops) → 全部预警
//  - 渠道用户(cps_role=channel_user，受限于本渠道) → 仅其绑定渠道的预警
// 注意：不能用 cps_role != null，否则会把渠道用户也广播进来 → 收到他渠道预警(越权)。
async function notifyAlert(evt) {
  try {
    const where = {
      status: 'active',
      [Op.or]: [
        { role: { [Op.in]: ['admin', 'super_admin'] } },
        { cps_role: { [Op.in]: ['cps_admin', 'cps_ops'] } },
        ...(evt.channel_id ? [{ cps_channel_id: evt.channel_id }] : []),
      ],
    };
    const users = await User.findAll({ where, attributes: ['id'], raw: true });
    if (!users.length) return;
    await pushService.sendToUsers(users.map(u => u.id), {
      title: evt.title || 'CPS 预警',
      body: evt.message || '出现新的 CPS 预警',
      data: { type: 'cps_alert', alert_id: evt.id, channel_id: evt.channel_id, level: evt.level },
      collapseId: `cps_alert_${evt.rule_code}_${evt.channel_id || 'all'}`,
    });
  } catch (e) {
    console.error('notifyAlert 失败(已忽略):', e.message);
  }
}

function shouldTrigger(value, operator, threshold) {
  const v = Number(value), t = Number(threshold);
  switch (operator) { case '>': return v > t; case '>=': return v >= t; case '<': return v < t; case '<=': return v <= t; case '==': return v === t; default: return v >= t; }
}

async function raiseAlert(payload) {
  // 查重：同规则+同日期+同渠道+同产品，任意状态都算已存在（不管open/ack/closed）
  const exists = await CpsAlertEvent.findOne({ where: {
    rule_code: payload.rule_code,
    stat_date: payload.stat_date || null,
    channel_id: payload.channel_id ?? null,
    product_id: payload.product_id ?? null,
  } });
  if (exists) return exists;
  const evt = await CpsAlertEvent.create({ rule_id: payload.rule_id, rule_code: payload.rule_code, level: payload.level || 'warning', stat_date: payload.stat_date, channel_id: payload.channel_id, product_id: payload.product_id, metric: payload.metric, metric_value: Number(payload.metric_value) || 0, threshold_value: Number(payload.threshold_value) || 0, title: payload.title, message: payload.message, suggestion: payload.suggestion || '', status: 'open' });
  // 仅新建事件时推送（去重已在上方保证），best-effort、不阻塞、绝不影响告警写库
  notifyAlert(evt).catch((e) => console.error('notifyAlert 未捕获(已忽略):', e?.message));
  return evt;
}

async function checkAlertsForDate(date) {
  const rules = await CpsAlertRule.findAll({ where: { enabled: true } });
  const events = [];

  for (const rule of rules) {
    try {
      const where = { stat_date: date || todayString() };
      if (rule.scope_type === 'channel' && rule.scope_json) {
        try { where.channel_id = { [Op.in]: JSON.parse(rule.scope_json) }; } catch(e) {}
      }
      const rows = await CpsDailyMetric.findAll({ where, include: [
        { model: CpsChannel, as: 'channel', attributes: ['id', 'name'] },
        { model: CpsProduct, as: 'product', attributes: ['id', 'name'] }
      ]});

      for (const row of rows) {
        const withRates = cpsCalc.attachRates(row.toJSON());
        const value = withRates[rule.metric];
        if (value === undefined) continue;

        if (rule.min_base_value && Number(withRates.new_sign_count + withRates.renewal_count) < Number(rule.min_base_value)) continue;
        if (!shouldTrigger(value, rule.operator, rule.threshold_value)) continue;

        const title = `[${rule.name}] ${row.channel?.name || '?'} / ${row.product?.name || '?'}`;
        const message = `${rule.metric}=${Number(value).toFixed(4)}, 阈值${rule.operator}${rule.threshold_value}`;
        const evt = await raiseAlert({ rule_id: rule.id, rule_code: rule.code, level: rule.level, stat_date: row.stat_date, channel_id: row.channel_id, product_id: row.product_id, metric: rule.metric, metric_value: value, threshold_value: rule.threshold_value, title, message, suggestion: rule.remark || '' });
        events.push(evt);
      }
    } catch (e) { console.error(`[CPS Alert] rule ${rule.code} error:`, e.message); }
  }
  return events;
}

module.exports = { checkAlertsForDate, raiseAlert, shouldTrigger };
