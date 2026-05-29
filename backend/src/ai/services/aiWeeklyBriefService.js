/**
 * 周报简报生成服务
 */

const llmProvider = require('./aiLLMProvider');
const mockProvider = require('./aiMockProvider');
const promptBuilder = require('./aiPromptBuilder');
const { formatBriefingResponse } = require('../utils/aiFormatters');
const { createCacheKey, getCached, setCached, TASK_CACHE_TTL } = require('../../services/aiCacheService');

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

async function generateOperatingBrief(context) {
  if (process.env.AI_SIDE_CAR_ENABLED === 'false' || process.env.AI_WEEKLY_OPERATING_BRIEF_ENABLED === 'false') {
    return {
      enabled: false,
      title: 'AI 备会分析未开启',
      summary: '当前环境未开启 AI 经营分析能力',
      sections: [],
      copy_material: '',
    };
  }

  const cacheKey = createCacheKey('weekly_operating_brief', {
    userId: context.currentUser?.id,
    role: context.currentUser?.role,
    projectCount: context.pageData.projects?.length || 0,
    highRiskCount: (context.derivedSignals.projectSignals || []).filter(s => s.riskLevel === 'high').length,
    kpiWarningCount: (context.derivedSignals.kpiSignals || []).filter(k => k.isWarning).length,
  });
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  const ruleSections = buildOperatingRuleSections(context);
  if (!llmProvider.isAvailable()) {
    return {
      enabled: true,
      title: 'AI 备会分析',
      summary: 'LLM 未启用，已生成规则版备会材料',
      sections: ruleSections,
      copy_material: ruleSections.map(s => `${s.title}：${s.items.join('；')}`).join('\n'),
      isMock: true,
    };
  }

  try {
    const dataSummary = promptBuilder.formatDataSummary(context);
    const structured = await llmProvider.chatJSON({
      systemPrompt: '你是增长业务经营分析助手。输出用于内部备会，不是正式周报正文。只基于输入数据，不编造。',
      prompt: `${dataSummary}

请输出 AI 经营分析/备会 JSON：
{
  "summary":"80字以内本周经营判断",
  "key_changes":["关键变化"],
  "high_risk_projects":[{"project":"项目名","reason":"原因","question":"会上追问"}],
  "kpi_deviations":[{"indicator":"指标","reason_guess":"基于数据的原因猜测","action":"建议动作"}],
  "decision_topics":["需要会上拍板的问题"],
  "follow_up_people":[{"name":"负责人","topic":"追问事项"}],
  "copy_material":"可复制到正式周报的素材，200字以内"
}`,
      user: context.currentUser,
      taskType: 'weekly_operating_brief',
      fallback: null,
      maxTokens: 1200,
    });

    const result = {
      enabled: true,
      title: 'AI 备会分析',
      summary: structured?.summary || '已生成本周备会分析',
      key_changes: structured?.key_changes || [],
      high_risk_projects: structured?.high_risk_projects || [],
      kpi_deviations: structured?.kpi_deviations || [],
      decision_topics: structured?.decision_topics || [],
      follow_up_people: structured?.follow_up_people || [],
      copy_material: structured?.copy_material || '',
      sections: ruleSections,
      isMock: false,
    };
    await setCached(cacheKey, 'weekly_operating_brief', result, TASK_CACHE_TTL.weekly_operating_brief);
    return result;
  } catch (err) {
    console.error('AI 备会分析生成失败:', err.message);
    return {
      enabled: true,
      title: 'AI 备会分析',
      summary: 'LLM 不可用，已生成规则版备会材料',
      sections: ruleSections,
      copy_material: ruleSections.map(s => `${s.title}：${s.items.join('；')}`).join('\n'),
      isMock: true,
    };
  }
}

function buildOperatingRuleSections(context) {
  const highRisk = (context.derivedSignals.projectSignals || []).filter(s => s.riskLevel === 'high').slice(0, 5);
  const kpiWarnings = (context.derivedSignals.kpiSignals || []).filter(k => k.isWarning).slice(0, 5);
  const closureGaps = (context.derivedSignals.closureGaps || []).slice(0, 5);

  return [
    {
      title: '高风险项目',
      items: highRisk.length ? highRisk.map(s => `${s.name}：${s.riskSources.map(r => r.desc).join('、')}`) : ['暂无高风险项目']
    },
    {
      title: 'KPI偏差',
      items: kpiWarnings.length ? kpiWarnings.map(k => `${k.name}完成率${k.completionRate}%`) : ['暂无明显KPI偏差']
    },
    {
      title: '闭环缺口',
      items: closureGaps.length ? closureGaps.map(g => `${g.project}：${g.gaps.map(item => item.desc).join('、')}`) : ['暂无明显闭环缺口']
    }
  ];
}

function mapRole(role) {
  if (!role) return 'department_member';
  if (role === 'super_admin') return 'super_admin';
  if (role === 'department_manager' || role === 'dept') return 'department_manager';
  return 'department_member';
}

module.exports = { generate, generateOperatingBrief };
