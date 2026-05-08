const { Op, fn, col, literal } = require('sequelize');
const { AsoProduct, AsoDailyKeywordMetric, AsoProductBaselineMetric } = require('../models');

function parseIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number).filter(Boolean);
  return String(value).split(',').map(Number).filter(Boolean);
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

async function getDashboard(query = {}) {
  const { start_date, end_date, product_ids } = query;

  const productWhere = {};
  const prodIds = parseIds(product_ids);
  if (prodIds.length) productWhere.product_id = { [Op.in]: prodIds };

  const dateWhere = {};
  if (start_date && end_date) {
    dateWhere.stat_date = { [Op.between]: [start_date, end_date] };
  }

  const metricWhere = { ...dateWhere, ...productWhere, deleted_at: null };

  // 累计关键词表现
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

  // T3到榜词数：有过T3记录的去重关键词
  const t3KeywordCount = await AsoDailyKeywordMetric.count({
    where: { ...metricWhere, is_t3: true },
    distinct: true,
    col: 'keyword_id',
  });

  // T1-2到榜词数
  const t1KeywordCount = await AsoDailyKeywordMetric.count({
    where: { ...metricWhere, is_t1: true },
    distinct: true,
    col: 'keyword_id',
  });

  const summary = {
    optimized_keywords: optimizedKeywords,
    t3_keywords: t3KeywordCount,
    t3_rate: optimizedKeywords > 0 ? Number((t3KeywordCount / optimizedKeywords).toFixed(4)) : 0,
    t1_2_keywords: t1KeywordCount,
    t1_2_rate: optimizedKeywords > 0 ? Number((t1KeywordCount / optimizedKeywords).toFixed(4)) : 0,
    total_volume: Number(agg.total_volume) || 0,
    total_cost: Number(agg.total_cost) || 0,
  };

  // 产品基础指标
  const baselineWhere = { ...productWhere };
  if (start_date && end_date) {
    baselineWhere.stat_date = { [Op.between]: [start_date, end_date] };
  }
  const baselines = await AsoProductBaselineMetric.findAll({
    where: baselineWhere,
    order: [['stat_date', 'ASC']],
    raw: true,
  });

  // 趋势
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
    summary,
    baseline: baselines,
    trend,
  };
}

module.exports = { getDashboard };
