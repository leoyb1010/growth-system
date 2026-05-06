const { Op } = require('sequelize');
const { CpsDailyMetric, CpsChannel, CpsProduct, CpsAlertRule, CpsAlertEvent } = require('../models');
const cpsCalc = require('./cpsCalcService');

function todayStr() { const d = new Date(); return d.toISOString().slice(0, 10); }

function shouldTrigger(value, operator, threshold) {
  const v = Number(value), t = Number(threshold);
  switch (operator) { case '>': return v > t; case '>=': return v >= t; case '<': return v < t; case '<=': return v <= t; case '==': return v === t; default: return v >= t; }
}

async function raiseAlert(payload) {
  const exists = await CpsAlertEvent.findOne({ where: { rule_code: payload.rule_code, stat_date: payload.stat_date || null, channel_id: payload.channel_id || null, product_id: payload.product_id || null, status: 'open' } });
  if (exists) return exists;
  return CpsAlertEvent.create({ rule_id: payload.rule_id, rule_code: payload.rule_code, level: payload.level || 'warning', stat_date: payload.stat_date, channel_id: payload.channel_id, product_id: payload.product_id, metric: payload.metric, metric_value: Number(payload.metric_value) || 0, threshold_value: Number(payload.threshold_value) || 0, title: payload.title, message: payload.message, suggestion: payload.suggestion || '', status: 'open' });
}

async function checkAlertsForDate(date) {
  const rules = await CpsAlertRule.findAll({ where: { enabled: true } });
  const events = [];

  for (const rule of rules) {
    try {
      const where = { stat_date: date || new Date().toISOString().slice(0, 10) };
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
