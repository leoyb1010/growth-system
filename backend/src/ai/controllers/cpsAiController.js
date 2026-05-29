const dayjs = require('dayjs');
const { success, error } = require('../../utils/response');
const cpsAiContextBuilder = require('../services/cpsAiContextBuilder');
const cpsPromptBuilder = require('../services/cpsAiPromptBuilder');
const aiLLMProvider = require('../services/aiLLMProvider');

async function dailyInsight(req, res) {
  try {
    const statDate = req.body?.stat_date || dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    const ctx = await cpsAiContextBuilder.buildDailyContext(statDate);
    const prompt = cpsPromptBuilder.buildDailyInsightPrompt(ctx);
    const result = await aiLLMProvider.chat({ prompt, user: req.user, taskType: 'cps_daily_insight', responseFormat: false });
    return success(res, result);
  } catch (err) {
    console.error('CPS dailyInsight error:', err);
    return error(res, err.message || 'AI 日洞察失败');
  }
}

async function periodAnalysis(req, res) {
  try {
    const ctx = await cpsAiContextBuilder.buildPeriodContext(req.body || {});
    const prompt = cpsPromptBuilder.buildPeriodAnalysisPrompt(ctx);
    const result = await aiLLMProvider.chat({ prompt, user: req.user, taskType: 'cps_period_analysis', responseFormat: false });
    return success(res, result);
  } catch (err) {
    console.error('CPS periodAnalysis error:', err);
    return error(res, err.message || 'AI 周期分析失败');
  }
}

module.exports = {
  dailyInsight,
  periodAnalysis,
};
