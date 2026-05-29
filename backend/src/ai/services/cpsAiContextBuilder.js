const dayjs = require('dayjs');
const { Op, fn, col, literal } = require('sequelize');
const cpsDashboardService = require('../../services/cpsDashboardService');
const { CpsDailyMetric, CpsProduct } = require('../../models');

function pct(value) {
  if (value === null || value === undefined) return null;
  return Number((Number(value) * 100).toFixed(2));
}

function amount(value) {
  return Number(Number(value || 0).toFixed(2));
}

function refundCount(period = {}) {
  return Number(period.new_refund || 0) + Number(period.renewal_refund || 0);
}

function buildExecutiveSignals(dashboard) {
  const period = dashboard.period || {};
  const day = dashboard.day_over_day || {};
  const topChannels = dashboard.top_channels || [];
  const refunds = refundCount(period);
  const deals = Number(period.new_sign || 0) + Number(period.renewal || 0);

  return {
    period_actual_amount: amount(period.actual_amount),
    period_actual_count: Number(period.actual_count || 0),
    effective_amount: amount(period.effective_amount),
    refund_count: refunds,
    refund_rate_pct: deals > 0 ? pct(refunds / deals) : 0,
    complaint_count: Number(period.complaints || 0),
    complaint_rate_pct: pct(period.complaint_rate || 0),
    day_amount_delta: amount(day.actual_amount_delta),
    day_amount_delta_pct: pct(day.actual_amount_delta_pct),
    day_count_delta: Number(day.actual_count_delta || 0),
    day_refund_delta: Number(day.refund_count_delta || 0),
    alert_count: Number(dashboard.alert_count || 0),
    top_channel: topChannels[0] ? {
      name: topChannels[0].channel_name,
      amount: amount(topChannels[0].amount),
      amount_delta_pct: pct(topChannels[0].amount_delta_pct),
      refund_rate_pct: pct(topChannels[0].refund_rate || 0),
    } : null,
  };
}

function buildRuleFindings(dashboard, products = []) {
  const signals = buildExecutiveSignals(dashboard);
  const findings = [];

  if (signals.day_amount_delta_pct !== null && signals.day_amount_delta_pct <= -20) {
    findings.push({ level: 'high', type: 'revenue_drop', text: `日实收环比下降${Math.abs(signals.day_amount_delta_pct)}%，需要确认渠道或产品是否异常` });
  }
  if (signals.refund_rate_pct >= 8) {
    findings.push({ level: 'high', type: 'refund_rate', text: `周期退款率${signals.refund_rate_pct}%，需要复查用户质量和链路告知` });
  } else if (signals.refund_rate_pct >= 5) {
    findings.push({ level: 'medium', type: 'refund_rate', text: `周期退款率${signals.refund_rate_pct}%，建议关注退款结构` });
  }
  if (signals.complaint_rate_pct >= 1) {
    findings.push({ level: 'critical', type: 'complaint_rate', text: `客诉率${signals.complaint_rate_pct}%，超过1%红线` });
  } else if (signals.complaint_rate_pct >= 0.8) {
    findings.push({ level: 'high', type: 'complaint_rate', text: `客诉率${signals.complaint_rate_pct}%，接近1%红线` });
  }

  products.filter(p => p.refund_rate_pct >= 8 || p.complaint_rate_pct >= 1).slice(0, 5).forEach(p => {
    findings.push({
      level: p.complaint_rate_pct >= 1 ? 'critical' : 'high',
      type: 'product_risk',
      text: `${p.product_name}退款率${p.refund_rate_pct}%、客诉率${p.complaint_rate_pct}%，需要单独复盘`,
    });
  });

  if (findings.length === 0) {
    findings.push({ level: 'low', type: 'stable', text: '未发现退款率/客诉率/日环比的硬性异常，建议关注增长来源是否可持续' });
  }

  return findings;
}

async function getProductBreakdown(where) {
  const rows = await CpsDailyMetric.findAll({
    where,
    attributes: [
      'product_id',
      [fn('COALESCE', fn('SUM', col('actual_amount')), 0), 'amount'],
      [fn('COALESCE', fn('SUM', col('actual_count')), 0), 'count'],
      [fn('COALESCE', fn('SUM', col('new_sign_count')), 0), 'new_sign'],
      [fn('COALESCE', fn('SUM', col('renewal_count')), 0), 'renewal'],
      [fn('COALESCE', fn('SUM', literal('new_refund_count + renewal_refund_count')), 0), 'refunds'],
      [fn('COALESCE', fn('SUM', col('complaint_count')), 0), 'complaints'],
    ],
    include: [{ model: CpsProduct, as: 'product', attributes: ['id', 'name', 'code'] }],
    group: ['CpsDailyMetric.product_id', 'product.id', 'product.name', 'product.code'],
    raw: true,
    nest: true,
  });

  return rows.map(row => {
    const deals = Number(row.new_sign || 0) + Number(row.renewal || 0);
    const complaints = Number(row.complaints || 0);
    const refunds = Number(row.refunds || 0);
    return {
      product_id: Number(row.product_id),
      product_name: row.product?.name || `产品${row.product_id}`,
      amount: amount(row.amount),
      count: Number(row.count || 0),
      new_sign: Number(row.new_sign || 0),
      renewal: Number(row.renewal || 0),
      refunds,
      complaints,
      refund_rate_pct: deals > 0 ? pct(refunds / deals) : 0,
      complaint_rate_pct: deals > 0 ? pct(complaints / deals) : 0,
    };
  }).sort((a, b) => b.amount - a.amount).slice(0, 8);
}

function buildMetricWhere(params = {}) {
  const where = { deleted_at: null };
  if (params.start_date && params.end_date) where.stat_date = { [Op.between]: [params.start_date, params.end_date] };
  if (params.channel_ids) where.channel_id = { [Op.in]: String(params.channel_ids).split(',').map(Number).filter(Boolean) };
  if (params.product_ids) where.product_id = { [Op.in]: String(params.product_ids).split(',').map(Number).filter(Boolean) };
  return where;
}

async function buildDailyContext(statDate, params = {}) {
  const date = statDate || dayjs().subtract(1, 'day').format('YYYY-MM-DD');
  const query = {
    granularity: 'day',
    start_date: dayjs(date).subtract(14, 'day').format('YYYY-MM-DD'),
    end_date: date,
    channel_ids: params.channel_ids,
    product_ids: params.product_ids,
  };
  const dashboard = await cpsDashboardService.getDashboard(query);
  const product_breakdown = await getProductBreakdown(buildMetricWhere(query));

  return {
    stat_date: date,
    query,
    executive_signals: buildExecutiveSignals(dashboard),
    rule_findings: buildRuleFindings(dashboard, product_breakdown),
    period: dashboard.period,
    day_over_day: dashboard.day_over_day,
    top_channels: dashboard.top_channels,
    product_breakdown,
    trend_14d: (dashboard.trend || []).slice(-14),
    alert_count: dashboard.alert_count,
  };
}

async function buildPeriodContext(params = {}) {
  const dashboard = await cpsDashboardService.getDashboard(params);
  const product_breakdown = await getProductBreakdown(buildMetricWhere(params));
  return {
    params,
    period_range: dashboard.period_range,
    executive_signals: buildExecutiveSignals(dashboard),
    rule_findings: buildRuleFindings(dashboard, product_breakdown),
    period: dashboard.period,
    day_over_day: dashboard.day_over_day,
    top_channels: dashboard.top_channels,
    product_breakdown,
    trend: dashboard.trend,
    alert_count: dashboard.alert_count,
    fixed_ranges: dashboard.fixed_ranges,
  };
}

module.exports = {
  buildDailyContext,
  buildPeriodContext,
};
