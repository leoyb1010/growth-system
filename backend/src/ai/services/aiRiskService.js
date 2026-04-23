/**
 * 风险分析服务
 */

const llmProvider = require('./aiLLMProvider');
const mockProvider = require('./aiMockProvider');
const promptBuilder = require('./aiPromptBuilder');
const { formatAIResponse } = require('../utils/aiFormatters');

async function analyze(context) {
  const mockResult = mockProvider.mockRiskClosure(context);

  if (!llmProvider.isAvailable()) {
    return formatAIResponse({
      ...mockResult,
      mode: 'risk_closure',
      badgeCount: countRiskItems(context),
      actions: generateRiskActions(context)
    });
  }

  try {
    const dataSummary = promptBuilder.formatDataSummary(context);
    const role = mapRole(context.currentUser.role);
    const { systemPrompt, userPrompt } = promptBuilder.buildPrompt({
      mode: 'risk_closure',
      page: context.currentPage,
      role,
      dataSummary
    });

    const llmOutput = await llmProvider.call(systemPrompt, userPrompt);

    return formatAIResponse({
      headline: extractHeadline(llmOutput) || mockResult.headline,
      mode: 'risk_closure',
      badgeCount: countRiskItems(context),
      cards: mockResult.cards,
      actions: generateRiskActions(context),
      rawAnalysis: llmOutput
    });
  } catch (err) {
    console.error('AI 风险分析 LLM 调用失败:', err.message);
    return formatAIResponse({
      ...mockResult,
      mode: 'risk_closure',
      badgeCount: countRiskItems(context),
      actions: generateRiskActions(context)
    });
  }
}

function countRiskItems(context) {
  const signals = context.derivedSignals.projectSignals || [];
  return signals.filter(s => s.riskLevel === 'high').length + (context.derivedSignals.closureGaps || []).length;
}

function generateRiskActions(context) {
  return [
    { key: 'view_high_risk', label: '高风险项目', mode: 'risk_closure' },
    { key: 'view_stale_3d', label: '3天未更新', mode: 'risk_closure' },
    { key: 'view_owner_load', label: '负责人负载', mode: 'risk_closure' },
  ];
}

function extractHeadline(text) {
  if (!text) return '';
  const lines = text.split('\n').filter(l => l.trim());
  const first = lines[0]?.replace(/^#+\s*/, '').trim();
  return first?.length <= 50 ? first : first?.substring(0, 50) + '...';
}

function mapRole(role) {
  if (!role) return 'department_member';
  if (role === 'super_admin') return 'super_admin';
  if (role === 'department_manager' || role === 'dept') return 'department_manager';
  return 'department_member';
}

module.exports = { analyze };
