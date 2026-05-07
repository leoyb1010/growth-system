const { Op, fn, col } = require('sequelize');
const { CpsChannel, CpsProduct, CpsDailyMetric, CpsAlertEvent, sequelize } = require('../models');

async function getDashboard(query = {}) {
  const { start_date, end_date, channel_ids, product_ids } = query;

  const buildFilter = () => {
    const c = ['deleted_at IS NULL'];
    const p = [];
    if (start_date && end_date) { c.push('stat_date BETWEEN ? AND ?'); p.push(start_date, end_date); }
    const ch = parseIds(channel_ids); if (ch.length) { c.push(`channel_id IN (${ch.map(()=>'?').join(',')})`); p.push(...ch); }
    const pr = parseIds(product_ids); if (pr.length) { c.push(`product_id IN (${pr.map(()=>'?').join(',')})`); p.push(...pr); }
    return { where: c.join(' AND '), params: p };
  };
  const filter = buildFilter();
  const q = (s) => sequelize.query(s, { replacements: filter.params, type: sequelize.QueryTypes.SELECT });
  const sumFields = `COALESCE(SUM(actual_count),0) as actual_count, COALESCE(SUM(actual_amount),0) as actual_amount,
    COALESCE(SUM(new_refund_count),0) as new_refund, COALESCE(SUM(new_sign_count),0) as new_sign,
    COALESCE(SUM(renewal_count),0) as renewal, COALESCE(SUM(complaint_count),0) as complaints,
    COALESCE(SUM(effective_count),0) as effective_count, COALESCE(SUM(effective_amount),0) as effective_amount,
    COALESCE(SUM(new_sign_count+renewal_count),0) as total_deals`;

  const [all] = await q(`SELECT ${sumFields} FROM cps_daily_metrics WHERE ${filter.where}`);
  const total = all[0] || {};

  const year = new Date().getFullYear().toString();
  const [yearly] = await q(`SELECT actual_count, actual_amount, new_refund, new_sign, renewal FROM (SELECT ${sumFields} FROM cps_daily_metrics WHERE ${filter.where} AND strftime('%Y',stat_date)='${year}')`);

  const m = new Date().getMonth() + 1, qn = Math.ceil(m/3);
  const [quarterly] = await q(`SELECT actual_count, actual_amount, new_refund, new_sign, renewal, complaints, total_deals FROM (SELECT ${sumFields} FROM cps_daily_metrics WHERE ${filter.where} AND CAST(strftime('%m',stat_date) AS INTEGER) BETWEEN ${(qn-1)*3+1} AND ${qn*3} AND strftime('%Y',stat_date)='${year}')`);

  const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
  const [daily] = await q(`SELECT actual_count, actual_amount, new_refund, new_sign, renewal, complaints FROM (SELECT ${sumFields} FROM cps_daily_metrics WHERE ${filter.where} AND stat_date='${yesterday}')`);

  const alertCount = await CpsAlertEvent.count({ where: { status: 'open' } });
  const channelCount = await CpsChannel.count({ where: { status: 'active' } });

  const trendRaw = await q(`SELECT strftime('%Y-%m-%d',stat_date) as date,
    COALESCE(SUM(actual_amount),0) as amt, COALESCE(SUM(new_sign_count),0) as ns,
    COALESCE(SUM(renewal_count),0) as rn, COALESCE(SUM(complaint_count),0) as cp
    FROM cps_daily_metrics WHERE ${filter.where} GROUP BY date ORDER BY date ASC LIMIT 60`);
  const trend = trendRaw.map(r => ({ date: r.date, amount: Number(r.amt), new_sign: Number(r.ns), renewal: Number(r.rn), complaints: Number(r.cp) }));

  return {
    all: { actual_count: total.actual_count, actual_amount: total.actual_amount, effective_count: total.effective_count, effective_amount: total.effective_amount, new_sign: total.new_sign, renewal: total.renewal, new_refund: total.new_refund, complaints: total.complaints },
    yearly: yearly[0] || {}, quarterly: { ...(quarterly[0] || {}), refund_rate: (quarterly[0]||{}).total_deals > 0 ? ((quarterly[0].new_refund||0) / quarterly[0].total_deals) : 0 }, daily: daily[0] || {},
    alert_count: alertCount, channel_count: channelCount, trend,
    date_range: { start: start_date || '', end: end_date || '' },
  };
}

function parseIds(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(Number).filter(Boolean);
  return String(v).split(',').map(Number).filter(Boolean);
}

module.exports = { getDashboard };
