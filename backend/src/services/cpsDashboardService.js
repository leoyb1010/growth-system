const { Op, fn, col, literal, where } = require('sequelize');
const { CpsChannel, CpsProduct, CpsDailyMetric, CpsAlertEvent, sequelize } = require('../models');

async function getDashboard(query = {}) {
  const { start_date, end_date, channel_ids, product_ids } = query;

  const buildWhere = (extra = null) => {
    const w = { deleted_at: null };
    if (start_date && end_date) w.stat_date = { [Op.between]: [start_date, end_date] };
    const ch = parseIds(channel_ids); if (ch.length) w.channel_id = { [Op.in]: ch };
    const pr = parseIds(product_ids); if (pr.length) w.product_id = { [Op.in]: pr };
    if (extra && Array.isArray(extra)) extra.forEach(e => Object.assign(w, e));
    return w;
  };

  const now = new Date();
  const year = now.getFullYear();
  const qn = Math.ceil((now.getMonth() + 1) / 3);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const quarterStart = `${year}-${String((qn-1)*3+1).padStart(2,'0')}-01`;
  const yearStart = `${year}-01-01`;

  const aggr = async (whereClause) => {
    const r = await CpsDailyMetric.findAll({
      where: whereClause,
      attributes: [
        [fn('COALESCE', fn('SUM', col('actual_count')), 0), 'ac'],
        [fn('COALESCE', fn('SUM', col('actual_amount')), 0), 'aa'],
        [fn('COALESCE', fn('SUM', col('new_refund_count')), 0), 'nr'],
        [fn('COALESCE', fn('SUM', col('new_sign_count')), 0), 'ns'],
        [fn('COALESCE', fn('SUM', col('renewal_count')), 0), 'rn'],
        [fn('COALESCE', fn('SUM', col('complaint_count')), 0), 'cp'],
        [fn('COALESCE', fn('SUM', literal('new_sign_count + renewal_count')), 0), 'td'],
      ],
      raw: true,
    });
    return r[0] || {};
  };

  const all = await aggr(buildWhere());
  const yearly = await aggr(buildWhere([{ stat_date: { [Op.gte]: yearStart } }]));
  const quarterly = await aggr(buildWhere([{ stat_date: { [Op.gte]: quarterStart } }, { stat_date: { [Op.lte]: `${year}-12-31` } }]));
  const daily = await aggr(buildWhere([{ stat_date: yesterday }]));

  const alertCount = await CpsAlertEvent.count({ where: { status: 'open' } });
  const channelCount = await CpsChannel.count({ where: { status: 'active' } });

  const trendWhere = buildWhere();
  const trendRaw = await CpsDailyMetric.findAll({
    where: trendWhere,
    attributes: [
      'stat_date',
      [fn('SUM', col('actual_amount')), 'amt'],
      [fn('SUM', col('new_sign_count')), 'ns'],
      [fn('SUM', col('renewal_count')), 'rn'],
      [fn('SUM', col('complaint_count')), 'cp'],
    ],
    group: ['stat_date'],
    order: [['stat_date', 'ASC']],
    limit: 60,
    raw: true,
  });
  const trend = trendRaw.map(r => ({ date: r.stat_date, amount: Number(r.amt) || 0, new_sign: Number(r.ns) || 0, renewal: Number(r.rn) || 0, complaints: Number(r.cp) || 0 }));

  return {
    all: { actual_count: Number(all.ac)||0, actual_amount: Number(all.aa)||0, new_sign: Number(all.ns)||0, renewal: Number(all.rn)||0, new_refund: Number(all.nr)||0, complaints: Number(all.cp)||0 },
    yearly: { actual_count: Number(yearly.ac)||0, actual_amount: Number(yearly.aa)||0, new_sign: Number(yearly.ns)||0, renewal: Number(yearly.rn)||0, new_refund: Number(yearly.nr)||0 },
    quarterly: { actual_count: Number(quarterly.ac)||0, actual_amount: Number(quarterly.aa)||0, new_sign: Number(quarterly.ns)||0, renewal: Number(quarterly.rn)||0, new_refund: Number(quarterly.nr)||0, refund_rate: Number(quarterly.td)>0 ? Number(quarterly.nr||0)/Number(quarterly.td) : 0, complaints: Number(quarterly.cp)||0 },
    daily: { actual_count: Number(daily.ac)||0, actual_amount: Number(daily.aa)||0, new_sign: Number(daily.ns)||0, renewal: Number(daily.rn)||0, new_refund: Number(daily.nr)||0, complaints: Number(daily.cp)||0 },
    alert_count: alertCount, channel_count: channelCount, trend,
  };
}

function parseIds(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(Number).filter(Boolean);
  return String(v).split(',').map(Number).filter(Boolean);
}

module.exports = { getDashboard };
