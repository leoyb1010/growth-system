const { Op, fn, col, literal } = require('sequelize');
const { AsoProduct, AsoDailyKeywordMetric, AsoProductBaselineMetric } = require('../models');

function parseIds(value) {
  if (value === null || value === undefined || value === '') return [];
  if (Array.isArray(value)) return value.map(Number).filter(Boolean);
  return String(value).split(',').map(Number).filter(Boolean);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function rankDelta(current, compare) {
  if (current == null || compare == null) return null;
  const d = Number(compare) - Number(current);
  return d;
}

async function getDateMetrics(date, productWhere) {
  const metricWhere = { stat_date: date, ...productWhere, deleted_at: null };

  const agg = await AsoDailyKeywordMetric.findAll({
    where: metricWhere,
    attributes: [
      [fn('COUNT', fn('DISTINCT', col('keyword_id'))), 'optimized_keywords'],
      [fn('SUM', literal("CASE WHEN is_t1 THEN 1 ELSE 0 END")), 't1_keywords'],
      [fn('SUM', literal("CASE WHEN is_t3 THEN 1 ELSE 0 END")), 't3_keywords'],
      [fn('COALESCE', fn('SUM', col('today_volume')), 0), 'total_volume'],
      [fn('COALESCE', fn('SUM', col('cost_amount')), 0), 'total_cost'],
    ],
    raw: true,
  });

  const a = agg[0] || {};

  const baseline = await AsoProductBaselineMetric.findOne({
    where: { stat_date: date, ...productWhere },
    order: [['stat_date', 'DESC']],
    raw: true,
  });

  return {
    optimized_keywords: Number(a.optimized_keywords) || 0,
    t1_keywords: Number(a.t1_keywords) || 0,
    t3_keywords: Number(a.t3_keywords) || 0,
    total_volume: Number(a.total_volume) || 0,
    total_cost: Number(a.total_cost) || 0,
    overall_rank: baseline?.overall_rank ?? null,
    category_rank: baseline?.category_rank ?? null,
    has_data: Number(a.optimized_keywords) > 0 || !!baseline,
  };
}

async function getDashboard(query = {}) {
  const { date, compare_date, start_date, end_date, product_ids } = query;

  const productWhere = {};
  const prodIds = parseIds(product_ids);
  if (prodIds.length) productWhere.product_id = { [Op.in]: prodIds };

  // 单日对比模式：今天 vs 昨天
  if (date && compare_date) {
    const selectedDate = String(date).slice(0, 10);
    const compareDate = String(compare_date).slice(0, 10);

    const [current, compare] = await Promise.all([
      getDateMetrics(selectedDate, productWhere),
      getDateMetrics(compareDate, productWhere),
    ]);

    const delta = {
      optimized_keywords: current.optimized_keywords - compare.optimized_keywords,
      t1_keywords: current.t1_keywords - compare.t1_keywords,
      t3_keywords: current.t3_keywords - compare.t3_keywords,
      overall_rank: rankDelta(current.overall_rank, compare.overall_rank),
      category_rank: rankDelta(current.category_rank, compare.category_rank),
      total_volume: current.total_volume - compare.total_volume,
      total_cost: current.total_cost - compare.total_cost,
    };

    return {
      mode: 'compare',
      selected_date: selectedDate,
      compare_date: compareDate,
      current,
      compare,
      delta,
    };
  }

  // 兼容旧版区间聚合模式
  const dateWhere = {};
  if (start_date && end_date) {
    dateWhere.stat_date = { [Op.between]: [start_date, end_date] };
  }

  const metricWhere = { ...dateWhere, ...productWhere, deleted_at: null };

  const keywordAgg = await AsoDailyKeywordMetric.findAll({
    where: metricWhere,
    attributes: [
      [fn('COUNT', fn('DISTINCT', col('keyword_id'))), 'optimized_keywords'],
      [fn('SUM', literal("CASE WHEN is_t3 THEN 1 ELSE 0 END")), 't3_rows'],
      [fn('SUM', literal("CASE WHEN is_t1 THEN 1 ELSE 0 END")), 't1_rows'],
      [fn('COALESCE', fn('SUM', col('today_volume')), 0), 'total_volume'],
      [fn('COALESCE', fn('SUM', col('cost_amount')), 0), 'total_cost'],
    ],
    raw: true,
  });

  const agg = keywordAgg[0] || {};
  const optimizedKeywords = Number(agg.optimized_keywords) || 0;
  const t3Rows = Number(agg.t3_rows) || 0;
  const t1Rows = Number(agg.t1_rows) || 0;

  const t3KeywordCount = await AsoDailyKeywordMetric.count({
    where: { ...metricWhere, is_t3: true },
    distinct: true,
    col: 'keyword_id',
  });

  const t1_2KeywordCount = await AsoDailyKeywordMetric.count({
    where: { ...metricWhere, current_rank: { [Op.gte]: 1, [Op.lte]: 2 } },
    distinct: true,
    col: 'keyword_id',
  });

  const summary = {
    optimized_keywords: optimizedKeywords,
    t3_keywords: t3KeywordCount,
    t3_rate: optimizedKeywords > 0 ? Number((t3KeywordCount / optimizedKeywords).toFixed(4)) : 0,
    t1_2_keywords: t1_2KeywordCount,
    t1_2_rate: optimizedKeywords > 0 ? Number((t1_2KeywordCount / optimizedKeywords).toFixed(4)) : 0,
    total_volume: Number(agg.total_volume) || 0,
    total_cost: Number(agg.total_cost) || 0,
  };

  const baselineWhere = { ...productWhere };
  if (start_date && end_date) {
    baselineWhere.stat_date = { [Op.between]: [start_date, end_date] };
  }
  const baselines = await AsoProductBaselineMetric.findAll({
    where: baselineWhere,
    order: [['stat_date', 'ASC']],
    raw: true,
  });

  const trendRows = await AsoDailyKeywordMetric.findAll({
    where: metricWhere,
    attributes: [
      'stat_date',
      [fn('COUNT', fn('DISTINCT', col('keyword_id'))), 'keyword_count'],
      [fn('SUM', literal("CASE WHEN is_t3 THEN 1 ELSE 0 END")), 't3_count'],
      [fn('COALESCE', fn('SUM', col('today_volume')), 0), 'volume'],
      [fn('AVG', col('current_rank')), 'avg_rank'],
    ],
    group: ['stat_date'],
    order: [['stat_date', 'ASC']],
    raw: true,
  });

  const trend = trendRows.map(row => ({
    date: row.stat_date,
    t3_keywords: Number(row.t3_count) || 0,
    total_volume: Number(row.volume) || 0,
    avg_rank: row.avg_rank ? Number(Number(row.avg_rank).toFixed(1)) : null,
  }));

  return {
    mode: 'range',
    summary,
    baseline: baselines,
    trend,
  };
}

module.exports = { getDashboard };
