const dayjs = require('dayjs');
const asoDashboardService = require('../../services/asoDashboardService');

async function buildDailyContext(params = {}) {
  const date = params.date || dayjs().format('YYYY-MM-DD');
  const compareDate = params.compare_date || dayjs(date).subtract(1, 'day').format('YYYY-MM-DD');
  const trendStart = dayjs(date).subtract(6, 'day').format('YYYY-MM-DD');

  const [compare, trend] = await Promise.all([
    asoDashboardService.getDashboard({ date, compare_date: compareDate, product_ids: params.product_ids }),
    asoDashboardService.getDashboard({ start_date: trendStart, end_date: date, product_ids: params.product_ids }),
  ]);

  return {
    date,
    compare_date: compareDate,
    current: compare.current,
    compare: compare.compare,
    delta: compare.delta,
    trend: trend.trend,
    keyword_changes: trend.keyword_changes,
    summary: trend.summary,
  };
}

module.exports = { buildDailyContext };
