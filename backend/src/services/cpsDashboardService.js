const { Op, fn, col, literal } = require('sequelize');
const { CpsChannel, CpsDailyMetric, CpsAlertEvent } = require('../models');

function parseIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number).filter(Boolean);
  return String(value).split(',').map(Number).filter(Boolean);
}

function dimWhere(channelIds, productIds) {
  const where = { deleted_at: null };
  const channels = parseIds(channelIds);
  const products = parseIds(productIds);

  if (channels.length) where.channel_id = { [Op.in]: channels };
  if (products.length) where.product_id = { [Op.in]: products };

  return where;
}

function toDateString(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function addDays(value, days) {
  const date = typeof value === 'string' ? parseDate(value) : new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

function inclusiveDaySpan(start, end) {
  return Math.floor((parseDate(end) - parseDate(start)) / 86400000) + 1;
}

function getQuarterEnd(year, quarter) {
  const endMonth = quarter * 3;
  return toDateString(new Date(year, endMonth, 0));
}

const AGG_ATTRS = [
  [fn('COALESCE', fn('SUM', col('actual_count')), 0), 'actual_count'],
  [fn('COALESCE', fn('SUM', col('actual_amount')), 0), 'actual_amount'],
  [fn('COALESCE', fn('SUM', col('effective_count')), 0), 'effective_count'],
  [fn('COALESCE', fn('SUM', col('effective_amount')), 0), 'effective_amount'],
  [fn('COALESCE', fn('SUM', col('new_sign_count')), 0), 'new_sign'],
  [fn('COALESCE', fn('SUM', col('renewal_count')), 0), 'renewal'],
  [fn('COALESCE', fn('SUM', col('new_refund_count')), 0), 'new_refund'],
  [fn('COALESCE', fn('SUM', col('renewal_refund_count')), 0), 'renewal_refund'],
  [fn('COALESCE', fn('SUM', col('after_sale_refund_count')), 0), 'after_sale_refund'],
  [fn('COALESCE', fn('SUM', col('complaint_count')), 0), 'complaints'],
  [fn('COALESCE', fn('SUM', literal('new_sign_count + renewal_count')), 0), 'total_deals'],
];

async function aggregate(where) {
  const rows = await CpsDailyMetric.findAll({
    where,
    attributes: AGG_ATTRS,
    raw: true,
  });
  const row = rows[0] || {};
  const totalDeals = Number(row.total_deals || 0);
  const refunds = Number(row.new_refund || 0) + Number(row.renewal_refund || 0);

  return {
    actual_count: Number(row.actual_count) || 0,
    actual_amount: Number(row.actual_amount) || 0,
    effective_count: Number(row.effective_count) || 0,
    effective_amount: Number(row.effective_amount) || 0,
    new_sign: Number(row.new_sign) || 0,
    renewal: Number(row.renewal) || 0,
    new_refund: Number(row.new_refund) || 0,
    renewal_refund: Number(row.renewal_refund) || 0,
    after_sale_refund: Number(row.after_sale_refund) || 0,
    complaints: Number(row.complaints) || 0,
    refund_rate: totalDeals > 0 ? refunds / totalDeals : 0,
    complaint_rate: totalDeals > 0 ? Number(row.complaints || 0) / totalDeals : 0,
  };
}

async function getChannelAmounts(where) {
  const rows = await CpsDailyMetric.findAll({
    where,
    attributes: [
      'channel_id',
      [fn('COALESCE', fn('SUM', col('actual_amount')), 0), 'amount'],
      [fn('COALESCE', fn('SUM', col('actual_count')), 0), 'count'],
      [fn('COALESCE', fn('SUM', col('new_sign_count')), 0), 'new_sign'],
      [fn('COALESCE', fn('SUM', col('renewal_count')), 0), 'renewal'],
      [fn('COALESCE', fn('SUM', literal('new_refund_count + renewal_refund_count')), 0), 'refunds'],
      [fn('COALESCE', fn('SUM', col('complaint_count')), 0), 'complaints'],
    ],
    include: [{ model: CpsChannel, as: 'channel', attributes: ['id', 'name', 'code'] }],
    group: ['CpsDailyMetric.channel_id', 'channel.id', 'channel.name', 'channel.code'],
    raw: true,
    nest: true,
  });

  return rows.map(row => {
    const newSign = Number(row.new_sign) || 0;
    const renewal = Number(row.renewal) || 0;
    const refunds = Number(row.refunds) || 0;
    const deals = newSign + renewal;
    return {
      channel_id: Number(row.channel_id),
      channel_name: row.channel?.name || `渠道${row.channel_id}`,
      channel_code: row.channel?.code || '',
      amount: Number(row.amount) || 0,
      count: Number(row.count) || 0,
      new_sign: newSign,
      renewal,
      refunds,
      complaints: Number(row.complaints) || 0,
      refund_rate: deals > 0 ? refunds / deals : 0,
    };
  });
}

async function getTopChannels(periodWhere, compareWhere, limit = 5) {
  const [currentRows, compareRows] = await Promise.all([
    getChannelAmounts(periodWhere),
    compareWhere ? getChannelAmounts(compareWhere) : Promise.resolve([]),
  ]);

  const compareMap = new Map(compareRows.map(row => [row.channel_id, row]));

  return currentRows
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map(row => {
      const compare = compareMap.get(row.channel_id);
      const compareAmount = Number(compare?.amount) || 0;
      return {
        ...row,
        amount_delta: row.amount - compareAmount,
        amount_delta_pct: compareAmount > 0 ? (row.amount - compareAmount) / compareAmount : null,
      };
    });
}

function getTrendLimit(granularity) {
  if (granularity === 'month') return 12;
  if (granularity === 'week') return 12;
  return 30;
}

function getWeekKey(value) {
  const date = new Date(`${value}T00:00:00Z`);
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const dayOffset = Math.floor((date - start) / 86400000);
  const week = Math.ceil((dayOffset + start.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function bucketTrend(rows, granularity, limit) {
  if (granularity === 'day') {
    return limit ? rows.slice(-limit) : rows;
  }

  const buckets = new Map();
  for (const row of rows) {
    const key = granularity === 'month' ? row.date.slice(0, 7) : getWeekKey(row.date);
    const current = buckets.get(key) || {
      date: key,
      amount: 0,
      count: 0,
      new_sign: 0,
      renewal: 0,
      refund: 0,
      complaints: 0,
    };

    current.amount += row.amount;
    current.count += row.count;
    current.new_sign += row.new_sign;
    current.renewal += row.renewal;
    current.refund += row.refund;
    current.complaints += row.complaints;
    buckets.set(key, current);
  }

  const result = Array.from(buckets.values());
  return limit ? result.slice(-limit) : result;
}

async function getDashboard(query = {}) {
  const { start_date, end_date, channel_ids, product_ids, granularity = 'day' } = query;

  const baseDim = dimWhere(channel_ids, product_ids);
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const yesterday = toDateString(new Date(Date.now() - 86400000));
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  const quarterStart = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01`;
  const quarterEnd = getQuarterEnd(year, quarter);

  const usePeriodFilter = !!(start_date && end_date);
  const periodWhere = usePeriodFilter ? { ...baseDim, stat_date: { [Op.between]: [start_date, end_date] } } : baseDim;
  let compareWhere = null;
  if (usePeriodFilter) {
    const span = inclusiveDaySpan(start_date, end_date);
    const compareEnd = addDays(start_date, -1);
    const compareStart = addDays(compareEnd, -span + 1);
    compareWhere = { ...baseDim, stat_date: { [Op.between]: [compareStart, compareEnd] } };
  }

  const [period, yearly, quarterly, daily, total, topChannels] = await Promise.all([
    aggregate(periodWhere),
    aggregate({ ...baseDim, stat_date: { [Op.between]: [yearStart, yearEnd] } }),
    aggregate({ ...baseDim, stat_date: { [Op.between]: [quarterStart, quarterEnd] } }),
    aggregate({ ...baseDim, stat_date: yesterday }),
    aggregate(baseDim),
    getTopChannels(periodWhere, compareWhere),
  ]);

  const trendRaw = await CpsDailyMetric.findAll({
    where: periodWhere,
    attributes: [
      'stat_date',
      [fn('SUM', col('actual_amount')), 'amount'],
      [fn('SUM', col('actual_count')), 'count'],
      [fn('SUM', col('new_sign_count')), 'new_sign'],
      [fn('SUM', col('renewal_count')), 'renewal'],
      [fn('SUM', literal('new_refund_count + renewal_refund_count')), 'refund'],
      [fn('SUM', col('complaint_count')), 'complaints'],
    ],
    group: ['stat_date'],
    order: [['stat_date', 'ASC']],
    raw: true,
  });

  const dailyTrend = trendRaw.map(row => ({
    date: row.stat_date,
    amount: Number(row.amount) || 0,
    count: Number(row.count) || 0,
    new_sign: Number(row.new_sign) || 0,
    renewal: Number(row.renewal) || 0,
    refund: Number(row.refund) || 0,
    complaints: Number(row.complaints) || 0,
  }));
  const trend = bucketTrend(dailyTrend, granularity, null);

  const alertWhere = { status: 'open' };
  const channels = parseIds(channel_ids);
  const products = parseIds(product_ids);
  if (channels.length) alertWhere.channel_id = { [Op.in]: channels };
  if (products.length) alertWhere.product_id = { [Op.in]: products };
  // 预警数跟随看板时间窗口，不统计窗口外的历史遗留 open 事件
  if (usePeriodFilter) {
    alertWhere.stat_date = { [Op.between]: [start_date, end_date] };
  }

  const [alertCount, channelCount] = await Promise.all([
    CpsAlertEvent.count({ where: alertWhere }),
    CpsChannel.count({ where: { status: 'active' } }),
  ]);

  return {
    period,
    yearly,
    quarterly,
    daily,
    total,
    trend,
    top_channels: topChannels,
    alert_count: alertCount,
    channel_count: channelCount,
    period_range: usePeriodFilter ? { start: start_date, end: end_date } : null,
    fixed_ranges: {
      yearly: { start: yearStart, end: yearEnd },
      quarterly: { start: quarterStart, end: quarterEnd },
      daily: { date: yesterday },
    },
    granularity,
  };
}

module.exports = { getDashboard };
