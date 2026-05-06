const { Op, fn, col, literal } = require('sequelize');
const { CpsChannel, CpsProduct, CpsDailyMetric, CpsAlertEvent, sequelize } = require('../models');
const cpsCalc = require('./cpsCalcService');

async function getDashboard(query = {}) {
  const { start_date, end_date, channel_ids, product_ids, granularity } = query;
  const where = {};
  if (start_date && end_date) where.stat_date = { [Op.between]: [start_date, end_date] };
  if (channel_ids) { const ids = parseIds(channel_ids); if (ids.length) where.channel_id = { [Op.in]: ids }; }
  if (product_ids) { const ids = parseIds(product_ids); if (ids.length) where.product_id = { [Op.in]: ids }; }

  const rows = await CpsDailyMetric.findAll({ where, include: [
    { model: CpsChannel, as: 'channel', attributes: ['id', 'name', 'code'] },
    { model: CpsProduct, as: 'product', attributes: ['id', 'name', 'code', 'unit_price'] }
  ], order: [['stat_date', 'DESC']] });

  const summary = cpsCalc.sumMetrics(rows);
  const alertCount = await CpsAlertEvent.count({ where: { status: 'open' } });
  const channelCount = await CpsChannel.count({ where: { status: 'active' } });
  const productCount = await CpsProduct.count({ where: { status: 'active' } });

  // 7日滚动客诉率：近7天投诉/近7天(新签+续费)
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const [rollingData] = await sequelize.query(
    `SELECT COALESCE(SUM(complaint_count),0) as complaints, COALESCE(SUM(new_sign_count+renewal_count),0) as total
     FROM cps_daily_metrics WHERE stat_date BETWEEN ? AND ? AND deleted_at IS NULL`,
    { replacements: [sevenDaysAgo, today], type: sequelize.QueryTypes.SELECT }
  );
  const complaintRate7d = rollingData?.total > 0 ? Number(rollingData.complaints / rollingData.total).toFixed(6) : 0;

  // Trend with granularity
  const granularityMap = { day: '%Y-%m-%d', week: '%Y-%W', month: '%Y-%m', quarter: '%Y-Q', half_year: '%Y-H' };
  const dateFmt = granularityMap[granularity] || granularityMap.day;

  const trendRaw = await sequelize.query(
    `SELECT strftime('${dateFmt}', stat_date) as period,
      COALESCE(SUM(effective_amount),0) as effective_amt,
      COALESCE(SUM(new_sign_count),0) as new_sign,
      COALESCE(SUM(renewal_count),0) as renewal,
      COALESCE(SUM(new_refund_count+renewal_refund_count),0) as refunds,
      COALESCE(SUM(new_sign_count+renewal_count),0) as total_deals,
      COALESCE(SUM(complaint_count),0) as complaints
     FROM cps_daily_metrics WHERE deleted_at IS NULL
     ${Object.keys(where).length ? 'AND stat_date BETWEEN ? AND ?' : ''}
     GROUP BY period ORDER BY period ASC LIMIT 60`,
    { replacements: Object.keys(where).length ? [start_date, end_date] : [], type: sequelize.QueryTypes.SELECT }
  );

  const trend = trendRaw.map(r => ({
    date: r.period,
    effective_amount: Number(r.effective_amt) || 0,
    new_sign_count: Number(r.new_sign) || 0,
    renewal_count: Number(r.renewal) || 0,
    refund_count: Number(r.refunds) || 0,
    complaint_count: Number(r.complaints) || 0,
  }));

  // Alert events active for AI context
  const alertsActive = await CpsAlertEvent.findAll({
    where: { status: 'open' }, order: [['created_at', 'DESC']], limit: 20,
    include: [{ model: CpsChannel, as: 'channel', attributes: ['name'] }, { model: CpsProduct, as: 'product', attributes: ['name'] }]
  });

  // Channel x Product matrix for AI context
  const matrix = rows.reduce((acc, r) => {
    const ch = r.channel?.name || '?'; const pr = r.product?.name || '?';
    if (!acc[ch]) acc[ch] = {};
    acc[ch][pr] = (acc[ch][pr] || 0) + Number(r.get('effective_amount'));
    return acc;
  }, {});

  return {
    summary: {
      ...summary,
      refund_rate: cpsCalc.rate(summary.new_refund_count + summary.renewal_refund_count, summary.new_sign_count + summary.renewal_count),
      complaint_rate: cpsCalc.rate(summary.complaint_count, summary.new_sign_count + summary.renewal_count),
      complaint_rate_7d: Number(complaintRate7d),
      alerts_active: alertCount,
    },
    alert_count: alertCount,
    alerts_active: alertsActive.map(a => a.toJSON()),
    channel_count: channelCount, product_count: productCount,
    trend: trend.slice(-30),
    matrix,
    date_range: { start: start_date || rows[rows.length-1]?.stat_date || '', end: end_date || rows[0]?.stat_date || '' }
  };
}

function parseIds(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(Number).filter(Boolean);
  return String(v).split(',').map(Number).filter(Boolean);
}

module.exports = { getDashboard };
