/**
 * 周报简报生成服务
 */

const llmProvider = require('./aiLLMProvider');
const mockProvider = require('./aiMockProvider');
const promptBuilder = require('./aiPromptBuilder');
const { formatBriefingResponse } = require('../utils/aiFormatters');

/**
 * 生成简报
 * @param {Object} context - AI 上下文
 * @param {string} type - brief / agenda / summary
 * @returns {Promise<Object>}
 */
async function generate(context, type = 'brief') {
  const mockResult = mockProvider.mockBriefingMeeting(context);

  if (!llmProvider.isAvailable()) {
    return formatBriefingResponse({
      ...mockResult,
      type,
      title: type === 'agenda' ? '周会议程' : type === 'summary' ? '管理层摘要' : '本周简报',
      actions: [
        { key: 'copy_brief', label: '复制简报' },
        { key: 'generate_report', label: '生成周报草稿' },
      ]
    });
  }

  try {
    const dataSummary = promptBuilder.formatDataSummary(context);
    const role = mapRole(context.currentUser.role);
    const { systemPrompt, userPrompt } = promptBuilder.buildPrompt({
      mode: 'briefing_meeting',
      page: context.currentPage,
      role,
      dataSummary
    });

    const llmOutput = await llmProvider.call(systemPrompt, userPrompt);

    return formatBriefingResponse({
      type,
      title: type === 'agenda' ? '周会议程' : type === 'summary' ? '管理层摘要' : '本周简报',
      content: llmOutput,
      sections: mockResult.sections, // 规则结果作为结构化补充
      actions: [
        { key: 'copy_brief', label: '复制简报' },
        { key: 'generate_report', label: '生成周报草稿' },
      ],
      rawAnalysis: llmOutput
    });
  } catch (err) {
    console.error('AI 简报生成 LLM 调用失败:', err.message);
    return formatBriefingResponse({
      ...mockResult,
      type,
      title: type === 'agenda' ? '周会议程' : type === 'summary' ? '管理层摘要' : '本周简报',
      actions: [
        { key: 'copy_brief', label: '复制简报' },
        { key: 'generate_report', label: '生成周报草稿' },
      ]
    });
  }
}

function mapRole(role) {
  if (!role) return 'department_member';
  if (role === 'super_admin') return 'super_admin';
  if (role === 'department_manager' || role === 'dept') return 'department_manager';
  return 'department_member';
}

module.exports = { generate };
