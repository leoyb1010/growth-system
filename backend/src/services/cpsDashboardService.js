const { Op, fn, col, literal } = require('sequelize');
const { CpsChannel, CpsProduct, CpsDailyMetric, CpsAlertEvent, sequelize } = require('../models');
const cpsCalc = require('./cpsCalcService');

async function getDashboard(query = {}) {
  const { start_date, end_date, channel_ids, product_ids } = query;
  const where = {};
  if (start_date && end_date) where.stat_date = { [Op.between]: [start_date, end_date] };
  if (channel_ids) where.channel_id = parseIds(channel_ids).length ? { [Op.in]: parseIds(channel_ids) } : undefined;
  if (product_ids) where.product_id = parseIds(product_ids).length ? { [Op.in]: parseIds(product_ids) } : undefined;
  Object.keys(where).forEach(k => where[k] === undefined && delete where[k]);

  const rows = await CpsDailyMetric.findAll({ where, include: [
    { model: CpsChannel, as: 'channel', attributes: ['id', 'name', 'code'] },
    { model: CpsProduct, as: 'product', attributes: ['id', 'name', 'code', 'unit_price'] }
  ], order: [['stat_date', 'DESC']] });

  const summary = cpsCalc.sumMetrics(rows);
  const alertCount = await CpsAlertEvent.count({ where: { status: 'open' } });
  const channelCount = await CpsChannel.count({ where: { status: 'active' } });
  const productCount = await CpsProduct.count({ where: { status: 'active' } });

  const dailyRaw = await CpsDailyMetric.findAll({
    attributes: ['stat_date', [fn('SUM', col('effective_amount')), 'amt']],
    where: Object.keys(where).length ? where : undefined,
    group: ['stat_date'], order: [['stat_date', 'ASC']], limit: 60,
  });

  const trend = dailyRaw.map(r => ({ date: r.stat_date, amount: Number(r.getDataValue('amt')) || 0 }));

  return {
    summary: { ...summary, refund_rate: cpsCalc.rate(summary.new_refund_count + summary.renewal_refund_count, summary.new_sign_count + summary.renewal_count), complaint_rate: cpsCalc.rate(summary.complaint_count, summary.new_sign_count + summary.renewal_count) },
    alert_count: alertCount,
    channel_count: channelCount,
    product_count: productCount,
    trend: trend.slice(-30),
    date_range: { start: start_date || dailyRaw[0]?.stat_date || '', end: end_date || dailyRaw[dailyRaw.length-1]?.stat_date || '' }
  };
}

function parseIds(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(Number).filter(Boolean);
  return String(v).split(',').map(Number).filter(Boolean);
}

module.exports = { getDashboard };
