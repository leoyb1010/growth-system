const dayjs = require('dayjs');
const cpsDashboardService = require('../../services/cpsDashboardService');

async function buildDailyContext(statDate) {
  const date = statDate || dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  const dashboard = await cpsDashboardService.getDashboard({
    granularity: 'day',
    start_date: dayjs(date).subtract(14, 'day').format('YYYY-MM-DD'),
    end_date: date,
  });

  return {
    stat_date: date,
    summary: dashboard.summary,
    trend_14d: dashboard.trend,
    matrix: dashboard.matrix,
    alerts_active: dashboard.alerts_active,
  };
}

async function buildPeriodContext(params) {
  const dashboard = await cpsDashboardService.getDashboard(params);
  return {
    params,
    summary: dashboard.summary,
    trend: dashboard.trend,
    matrix: dashboard.matrix,
    alerts_active: dashboard.alerts_active,
  };
}

module.exports = {
  buildDailyContext,
  buildPeriodContext,
};
