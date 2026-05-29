const dayjs = require('dayjs');
const { success, error } = require('../../utils/response');
const asoAiContextBuilder = require('../services/asoAiContextBuilder');
const asoAiPromptBuilder = require('../services/asoAiPromptBuilder');
const aiLLMProvider = require('../services/aiLLMProvider');

function fallbackInsight(ctx) {
  const current = ctx.current || {};
  const delta = ctx.delta || {};
  const changes = ctx.keyword_changes || {};
  const lostT3 = changes.lost_t3 || [];
  const newT3 = changes.new_t3 || [];
  const newT1 = changes.new_t1 || [];
  const rankDown = Number(delta.overall_rank || 0) < 0 || Number(delta.category_rank || 0) < 0;
  const riskLevel = lostT3.length > 0 || rankDown ? 'medium' : 'low';

  return {
    headline: riskLevel === 'medium' ? '关键词排名需复盘' : 'ASO表现平稳',
    risk_level: riskLevel,
    summary: `优化词${current.optimized_keywords || 0}个，T1 ${current.t1_keywords || 0}个，T3 ${current.t3_keywords || 0}个，总量级${current.total_volume || 0}。`,
    key_findings: [
      { type: newT1.length || newT3.length ? 'good' : 'neutral', metric: '到榜变化', detail: `新到T1 ${newT1.length}个，新到T3 ${newT3.length}个` },
      { type: lostT3.length ? 'bad' : 'neutral', metric: '掉榜风险', detail: lostT3.length ? `${lostT3.slice(0, 5).join('、')} 掉出T3` : '暂无明显掉出T3关键词' },
    ],
    keyword_focus: [
      ...newT1.slice(0, 3).map(keyword => ({ keyword, status: 'new_t1', suggestion: '复盘量级和排名稳定性，沉淀可复制打法' })),
      ...lostT3.slice(0, 3).map(keyword => ({ keyword, status: 'lost_t3', suggestion: '检查竞品波动、量级投放和关键词状态' })),
    ],
    risks: lostT3.length ? [{ level: 'medium', reason: '存在掉出T3关键词', suggestion: '优先复盘掉榜词的排名和量级变化' }] : [],
    actions: [
      { owner: '投放/运营', action: '复盘新增到榜和掉榜关键词，调整明日量级计划', expected_effect: '提升T3稳定性' }
    ],
    isMock: true,
  };
}

async function dailyInsight(req, res) {
  try {
    const ctx = await asoAiContextBuilder.buildDailyContext({
      date: req.body?.date || dayjs().format('YYYY-MM-DD'),
      compare_date: req.body?.compare_date,
      product_ids: req.body?.product_ids,
    });

    if (!aiLLMProvider.isAvailable()) return success(res, fallbackInsight(ctx));

    const prompt = asoAiPromptBuilder.buildDailyInsightPrompt(ctx);
    const result = await aiLLMProvider.chat({ prompt, user: req.user, taskType: 'aso_daily_insight', fallback: fallbackInsight(ctx), responseFormat: false });
    return success(res, result || fallbackInsight(ctx));
  } catch (err) {
    console.error('ASO dailyInsight error:', err);
    return error(res, err.message || 'AI ASO洞察失败');
  }
}

module.exports = { dailyInsight };
