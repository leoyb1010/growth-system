const dayjs = require('dayjs');
const { success, error } = require('../../utils/response');
const cpsAiContextBuilder = require('../services/cpsAiContextBuilder');
const cpsPromptBuilder = require('../services/cpsAiPromptBuilder');
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

module.exports = {
  dailyInsight,
  periodAnalysis,
};
