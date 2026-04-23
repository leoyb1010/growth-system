/**
 * 今日判断服务
 */

const llmProvider = require('./aiLLMProvider');
const mockProvider = require('./aiMockProvider');
const promptBuilder = require('./aiPromptBuilder');
const { formatAIResponse } = require('../utils/aiFormatters');

/**
 * 生成今日判断
 * @param {Object} context - AI 上下文
 * @returns {Promise<Object>} 格式化的 AI 响应
 */
async function generate(context) {
  // 规则提炼先出结果（作为 fallback 和 LLM 输入）
  const mockResult = mockProvider.mockTodayJudgment(context);

  // 如果 LLM 不可用，直接返回规则结果
  if (!llmProvider.isAvailable()) {
    return formatAIResponse({
      ...mockResult,
      mode: 'today_judgment',
      badgeCount: context.derivedSignals.projectSignals.filter(s => s.riskLevel === 'high').length,
      actions: generateActions(context)
    });
  }

  // LLM 可用时，调用 LLM 润色
  try {
    const dataSummary = promptBuilder.formatDataSummary(context);
    const role = mapRole(context.currentUser.role);
    const { systemPrompt, userPrompt } = promptBuilder.buildPrompt({
      mode: 'today_judgment',
      page: context.currentPage,
      role,
      dataSummary
    });

    const llmOutput = await llmProvider.call(systemPrompt, userPrompt);

    // LLM 输出作为 headline + 补充，规则结果作为结构化卡片
    return formatAIResponse({
      headline: extractHeadline(llmOutput) || mockResult.headline,
      mode: 'today_judgment',
      badgeCount: context.derivedSignals.projectSignals.filter(s => s.riskLevel === 'high').length,
      cards: mockResult.cards, // 规则卡片更结构化，LLM 输出作为 headline 和 rawAnalysis
      actions: generateActions(context),
      rawAnalysis: llmOutput
    });
  } catch (err) {
    console.error('AI 今日判断 LLM 调用失败:', err.message);
    // 降级到规则结果
    return formatAIResponse({
      ...mockResult,
      mode: 'today_judgment',
      badgeCount: context.derivedSignals.projectSignals.filter(s => s.riskLevel === 'high').length,
      actions: generateActions(context)
    });
  }
}

function generateActions(context) {
  const actions = [
    { key: 'view_risk', label: '查看风险排行', mode: 'risk_closure' },
    { key: 'view_closure', label: '查看未闭环', mode: 'risk_closure' },
    { key: 'generate_brief', label: '生成本周简报', mode: 'briefing_meeting' },
  ];
  return actions;
}

function extractHeadline(text) {
  if (!text) return '';
  const lines = text.split('\n').filter(l => l.trim());
  // 取第一个非空行作为 headline
  const first = lines[0]?.replace(/^#+\s*/, '').trim();
  return first?.length <= 50 ? first : first?.substring(0, 50) + '...';
}

function mapRole(role) {
  if (!role) return 'department_member';
  if (role === 'super_admin') return 'super_admin';
  if (role === 'department_manager' || role === 'dept') return 'department_manager';
  return 'department_member';
}

module.exports = { generate };
