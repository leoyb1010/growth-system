const dayjs = require('dayjs');
const { success, error } = require('../../utils/response');
const cpsAiContextBuilder = require('../services/cpsAiContextBuilder');
const cpsPromptBuilder = require('../services/cpsAiPromptBuilder');
const cpsForecastService = require('../../services/cpsForecastService');
const aiLLMProvider = require('../services/aiLLMProvider');
const aiCache = require('../../services/aiCacheService');

// CPS AI 结果缓存 TTL（秒）：同一日期/筛选维度的分析在窗口内秒回，避免重复 10s+ 的 LLM 调用
const CPS_AI_TTL = 300;

/**
 * 解析生效的 CPS 筛选条件，并强制套用数据范围（与 cpsController.getDashboard 一致）。
 * cps_channel 账号只能分析自己绑定的渠道，忽略前端传入的 channel_ids，避免越权看到其它渠道数据。
 */
function resolveCpsScope(req) {
  const body = req.body || {};
  const filters = {
    channel_ids: body.channel_ids || null,
    product_ids: body.product_ids || null,
  };
  if (req.dataScope?.type === 'cps_channel' && req.dataScope.value) {
    filters.channel_ids = String(req.dataScope.value);
  }
  // scopeTag 纳入缓存 key，确保不同数据范围的用户绝不命中彼此的缓存
  const scopeTag = req.dataScope?.type === 'cps_channel' ? `ch:${req.dataScope.value}` : (req.dataScope?.type || 'all');
  return { filters, scopeTag };
}

function fallbackPeriodAnalysis(ctx) {
  const s = ctx.executive_signals || {};
  const findings = ctx.rule_findings || [];
  const top = s.top_channel;
  return {
    headline: findings.some(f => ['critical', 'high'].includes(f.level)) ? 'CPS存在需处理风险' : 'CPS整体无硬性异常',
    risk_level: findings.some(f => f.level === 'critical') ? 'critical' : findings.some(f => f.level === 'high') ? 'high' : findings.some(f => f.level === 'medium') ? 'medium' : 'low',
    performance: `周期实收${s.period_actual_amount || 0}，签约${s.period_actual_count || 0}单，退款${s.refund_count || 0}笔，退款率${s.refund_rate_pct || 0}%，客诉${s.complaint_count || 0}件。${top ? `贡献最高渠道为${top.name}，实收${top.amount}。` : ''}`,
    diagnosis: findings.map(f => ({ topic: f.type, finding: f.text, evidence: f.text, impact: f.level === 'low' ? '保持观察' : '需要业务复盘' })),
    channel_ranking: top ? [{ channel: top.name, conclusion: '当前贡献最高', reason: `实收${top.amount}，退款率${top.refund_rate_pct || 0}%`, action: '确认增长质量和可持续性' }] : [],
    product_ranking: (ctx.product_breakdown || []).slice(0, 3).map(p => ({ product: p.product_name, conclusion: '产品贡献/风险观察', reason: `实收${p.amount}，退款率${p.refund_rate_pct}%，客诉率${p.complaint_rate_pct}%`, action: p.refund_rate_pct >= 8 || p.complaint_rate_pct >= 1 ? '优先复盘链路告知和用户质量' : '保持观察' })),
    risk_focus: findings.filter(f => f.level !== 'low').map(f => ({ scope: f.type, risk: f.text, evidence: f.text, suggestion: '会后指定负责人复盘并给出处理动作' })),
    next_period_actions: [{ owner: '运营', action: '复盘TOP渠道和高退款/高客诉产品，输出下周期调整建议', priority: 'P1', check_metric: '实收、退款率、客诉率' }],
    meeting_questions: findings.map(f => f.text),
    isMock: true,
  };
}

async function dailyInsight(req, res) {
  try {
    const statDate = req.body?.stat_date || dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const { filters, scopeTag } = resolveCpsScope(req);
    const cacheKey = aiCache.createCacheKey('cps_daily_insight', { statDate, ...filters, scopeTag });
    const cached = await aiCache.getCached(cacheKey);
    if (cached) return success(res, { ...cached, cached: true });

    const ctx = await cpsAiContextBuilder.buildDailyContext(statDate, { ...req.body, ...filters });
    const fallback = fallbackPeriodAnalysis(ctx);
    if (!aiLLMProvider.isAvailable()) return success(res, fallback);
    try {
      const prompt = cpsPromptBuilder.buildDailyInsightPrompt(ctx);
      const result = await aiLLMProvider.chat({ prompt, user: req.user, taskType: 'cps_daily_insight', responseFormat: false, fallback, maxTokens: 4000 });
      if (result && !result.isMock) aiCache.setCached(cacheKey, 'cps_daily_insight', result, CPS_AI_TTL).catch(() => {});
      return success(res, result || fallback);
    } catch (llmErr) {
      // LLM 临时不可用：降级为规则分析，绝不把错误抛给前端
      console.error('CPS dailyInsight LLM 降级:', llmErr.message);
      return success(res, { ...fallback, degraded: true });
    }
  } catch (err) {
    console.error('CPS dailyInsight error:', err);
    return error(res, err.message || 'AI 日洞察失败');
  }
}

async function periodAnalysis(req, res) {
  try {
    const body = req.body || {};
    const { filters, scopeTag } = resolveCpsScope(req);
    const cacheKey = aiCache.createCacheKey('cps_period_analysis', {
      start_date: body.start_date || null,
      end_date: body.end_date || null,
      granularity: body.granularity || null,
      ...filters,
      scopeTag,
    });
    const cached = await aiCache.getCached(cacheKey);
    if (cached) return success(res, { ...cached, cached: true });

    const ctx = await cpsAiContextBuilder.buildPeriodContext({ ...body, ...filters });
    const fallback = fallbackPeriodAnalysis(ctx);
    if (!aiLLMProvider.isAvailable()) return success(res, fallback);
    try {
      const prompt = cpsPromptBuilder.buildPeriodAnalysisPrompt(ctx);
      const result = await aiLLMProvider.chat({ prompt, user: req.user, taskType: 'cps_period_analysis', responseFormat: false, fallback, maxTokens: 4000 });
      if (result && !result.isMock) aiCache.setCached(cacheKey, 'cps_period_analysis', result, CPS_AI_TTL).catch(() => {});
      return success(res, result || fallback);
    } catch (llmErr) {
      console.error('CPS periodAnalysis LLM 降级:', llmErr.message);
      return success(res, { ...fallback, degraded: true });
    }
  } catch (err) {
    console.error('CPS periodAnalysis error:', err);
    return error(res, err.message || 'AI 周期分析失败');
  }
}

function fmtYi(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return String(Math.round(n));
}

// 规则降级：LLM 不可用时，直接用预测数字拼一份可读解读，绝不报错给前端
function fallbackForecastInsight(forecast) {
  if (forecast.insufficient_data) {
    return { headline: '连续日数据不足，暂无法给出可信预测', confidence_note: forecast.message || '需要更多连续日数据', drivers: [], horizon_reads: [], scenario_read: '', risks: [], actions: [], isMock: true };
  }
  const m = forecast.model || {};
  const scenarioActive = forecast.scenario && Number(forecast.scenario.new_sign_factor) !== 1;
  const horizonReads = (forecast.horizons || []).map((h) => ({
    horizon: h.label,
    read: `${h.label}中性预测约 ${fmtYi(h.baseline.p50)}（${fmtYi(h.baseline.p25)}~${fmtYi(h.baseline.p75)}），其中已落袋 ${fmtYi(h.actual_to_date)}。`,
    number: `P50 ${fmtYi(h.baseline.p50)} / 区间 ${fmtYi(h.baseline.p25)}~${fmtYi(h.baseline.p75)}`,
    confidence: h.confidence,
  }));
  let scenarioRead = '当前为基准情景（维持现状）。';
  if (scenarioActive) {
    const worst = [...(forecast.horizons || [])].sort((a, b) => (a.delta?.pct ?? 0) - (b.delta?.pct ?? 0))[0];
    scenarioRead = worst ? `按当前新签假设，冲击最大的是${worst.label}：相对基准${worst.delta.amount >= 0 ? '增加' : '减少'} ${fmtYi(Math.abs(worst.delta.amount))}（${worst.delta.pct}%）。` : '';
  }
  return {
    headline: `续费地板日均 ${fmtYi(m.renewal_daily)}、新签日均 ${fmtYi(m.newsign_daily)}（续费占比${m.renewal_share_pct}%），波动主要来自新签`,
    confidence_note: '本季度/本半年度多为已发生，置信高；下季度与本年度含较多外推，仅供情景参考',
    drivers: [
      { factor: '续费地板', reading: '相对稳定，是收入底盘', evidence: `续费日均 ${fmtYi(m.renewal_daily)}` },
      { factor: '新签动能', reading: m.trend_slope_per_day >= 0 ? '近期走平偏升' : '近期走弱', evidence: `日斜率 ${m.trend_slope_per_day}，R²${m.trend_r2}` },
      { factor: '波动', reading: '日波动较大，区间需关注', evidence: `日波动 ${fmtYi(m.daily_volatility)}` },
    ],
    horizon_reads: horizonReads,
    scenario_read: scenarioRead,
    risks: [],
    actions: [{ owner: '投放', action: '关注新签流是否可持续，结合预算计划用情景模拟评估缺口', priority: 'P1', watch_metric: '新签净额日均、退款率' }],
    isMock: true,
  };
}

async function forecastInsight(req, res) {
  try {
    const body = req.body || {};
    const { filters, scopeTag } = resolveCpsScope(req);
    const scenario = {
      new_sign_factor: body.new_sign_factor,
      effective_from: body.effective_from,
      recover_after_days: body.recover_after_days,
      renewal_decay_monthly: body.renewal_decay_monthly,
    };
    const forecast = await cpsForecastService.getForecast({ ...filters, as_of: body.as_of, scenario });

    const cacheKey = aiCache.createCacheKey('cps_forecast_insight', {
      as_of: forecast.as_of, ...filters, ...scenario, scopeTag,
    });
    const cached = await aiCache.getCached(cacheKey);
    if (cached) return success(res, { ...cached, forecast, cached: true });

    const fallback = fallbackForecastInsight(forecast);
    if (forecast.insufficient_data || !aiLLMProvider.isAvailable()) {
      return success(res, { ...fallback, forecast });
    }
    try {
      // 周序列对叙事无用且占 token，剥掉再喂 LLM（防 prompt 过长/输出截断）
      const { series_weekly, ...leanForecast } = forecast;
      const prompt = cpsPromptBuilder.buildForecastInsightPrompt(leanForecast);
      const result = await aiLLMProvider.chat({ prompt, user: req.user, taskType: 'cps_forecast_insight', responseFormat: false, fallback, maxTokens: 4000 });
      if (result && !result.isMock) aiCache.setCached(cacheKey, 'cps_forecast_insight', result, CPS_AI_TTL).catch(() => {});
      return success(res, { ...(result || fallback), forecast });
    } catch (llmErr) {
      console.error('CPS forecastInsight LLM 降级:', llmErr.message);
      return success(res, { ...fallback, forecast, degraded: true });
    }
  } catch (err) {
    console.error('CPS forecastInsight error:', err);
    return error(res, err.message || 'AI 预测解读失败');
  }
}

module.exports = {
  dailyInsight,
  periodAnalysis,
  forecastInsight,
};
