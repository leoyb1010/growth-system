const { Op, fn, col, literal } = require('sequelize');
const { CpsChannel, CpsProduct, CpsDailyMetric, CpsAlertEvent, sequelize } = require('../models');
const cpsCalc = require('./cpsCalcService');

async function getDashboard(query = {}) {
  const { start_date, end_date, channel_ids, product_ids } = query;
  
  // Helper: build channel/product filter SQL
  const buildSqlFilter = (prefix = '') => {
    const conditions = ['deleted_at IS NULL'];
    const params = [];
    if (start_date && end_date) { conditions.push('stat_date BETWEEN ? AND ?'); params.push(start_date, end_date); }
    const chIds = parseIds(channel_ids);
    if (chIds.length) { conditions.push(`channel_id IN (${chIds.map(() => '?').join(',')})`); params.push(...chIds); }
    const prIds = parseIds(product_ids);
    if (prIds.length) { conditions.push(`product_id IN (${prIds.map(() => '?').join(',')})`); params.push(...prIds); }
    return { where: conditions.join(' AND '), params };
  };

  const filter = buildSqlFilter();
  const cb = (sql) => sequelize.query(sql, { replacements: filter.params, type: sequelize.QueryTypes.SELECT });

  // ── 全部汇总 ──
  const [total] = await cb(`SELECT
    COALESCE(SUM(new_sign_count),0) as new_sign, COALESCE(SUM(renewal_count),0) as renewal,
    COALESCE(SUM(new_refund_count),0) as new_refund, COALESCE(SUM(renewal_refund_count),0) as renewal_refund,
    COALESCE(SUM(after_sale_refund_count),0) as after_sale_refund,
    COALESCE(SUM(complaint_count),0) as complaints,
    COALESCE(SUM(effective_count),0) as effective_count,
    COALESCE(SUM(effective_amount),0) as effective_amount,
    COALESCE(SUM(new_sign_amount),0) as new_sign_amount,
    COALESCE(SUM(renewal_amount),0) as renewal_amount,
    COALESCE(SUM(actual_count),0) as actual_count,
    COALESCE(SUM(actual_amount),0) as actual_amount
    FROM cps_daily_metrics WHERE ${filter.where}`);

  const all = total[0] || {};

  // ── 年度 (current year) ──
  const year = new Date().getFullYear().toString();
  const yFilter = { ...filter };
  yFilter.where += ` AND strftime('%Y', stat_date) = '${year}'`;
  const [yearly] = await cb(`SELECT
    COALESCE(SUM(effective_count),0) as effective_count, COALESCE(SUM(effective_amount),0) as effective_amount,
    COALESCE(SUM(new_refund_count),0) as new_refund, COALESCE(SUM(new_sign_count),0) as new_sign,
    COALESCE(SUM(renewal_count),0) as renewal
    FROM cps_daily_metrics WHERE ${yFilter.where}`);

  // ── 当季 ──
  const m = new Date().getMonth() + 1;
  const q = Math.ceil(m / 3);
  const quarterFilter = { ...filter };
  quarterFilter.where += ` AND CAST(strftime('%m', stat_date) AS INTEGER) BETWEEN ${(q-1)*3+1} AND ${q*3} AND strftime('%Y', stat_date) = '${year}'`;
  const [quarterly] = await cb(`SELECT
    COALESCE(SUM(effective_count),0) as effective_count, COALESCE(SUM(effective_amount),0) as effective_amount,
    COALESCE(SUM(new_refund_count),0) as new_refund, COALESCE(SUM(new_sign_count),0) as new_sign,
    COALESCE(SUM(renewal_count),0) as renewal, COALESCE(SUM(complaint_count),0) as complaints,
    COALESCE(SUM(new_sign_count+renewal_count),0) as total_deals
    FROM cps_daily_metrics WHERE ${quarterFilter.where}`);

  // ── 昨日 T-1 ──
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dFilter = { ...filter };
  dFilter.where += ` AND stat_date = '${yesterday}'`;
  const [daily] = await cb(`SELECT
    COALESCE(SUM(effective_count),0) as effective_count, COALESCE(SUM(effective_amount),0) as effective_amount,
    COALESCE(SUM(new_refund_count),0) as new_refund, COALESCE(SUM(new_sign_count),0) as new_sign,
    COALESCE(SUM(renewal_count),0) as renewal, COALESCE(SUM(complaint_count),0) as complaints
    FROM cps_daily_metrics WHERE ${dFilter.where}`);

  // ── 预警 + 渠道数 ──
  const alertCount = await CpsAlertEvent.count({ where: { status: 'open' } });
  const channelCount = await CpsChannel.count({ where: { status: 'active' } });

  // ── 趋势（60天） ──
  const trendRaw = await cb(`SELECT strftime('%Y-%m-%d', stat_date) as date,
    COALESCE(SUM(effective_amount),0) as effective_amt,
    COALESCE(SUM(new_sign_count),0) as new_sign,
    COALESCE(SUM(renewal_count),0) as renewal,
    COALESCE(SUM(complaint_count),0) as complaints
    FROM cps_daily_metrics WHERE ${filter.where}
    GROUP BY date ORDER BY date ASC LIMIT 60`);
  const trend = trendRaw.map(r => ({
    date: r.date, effective_amount: Number(r.effective_amt),
    new_sign: Number(r.new_sign), renewal: Number(r.renewal),
    complaints: Number(r.complaints),
  }));

  return {
    all: { new_sign: all.new_sign, renewal: all.renewal, new_refund: all.new_refund, renewal_refund: all.renewal_refund, effective_count: all.effective_count, effective_amount: all.effective_amount, new_sign_amount: all.new_sign_amount, renewal_amount: all.renewal_amount, complaints: all.complaints, after_sale_refund: all.after_sale_refund },
    yearly: yearly[0] || {},
    quarterly: { ...(quarterly[0] || {}), refund_rate: (quarterly[0] || {}).total_deals > 0 ? ((quarterly[0].new_refund || 0) / quarterly[0].total_deals) : 0 },
    daily: daily[0] || {},
    alert_count: alertCount, channel_count: channelCount,
    trend,
    date_range: { start: start_date || '', end: end_date || '' },
  };
}

function parseIds(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(Number).filter(Boolean);
  return String(v).split(',').map(Number).filter(Boolean);
}

module.exports = { getDashboard };
