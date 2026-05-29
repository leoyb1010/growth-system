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
      copy_material: buildRuleCopyMaterial(ruleSections),
      isMock: true,
    };
  }

  try {
    const dataSummary = promptBuilder.formatDataSummary(context);
    const structured = await llmProvider.chatJSON({
      systemPrompt: '你是增长业务经营分析助手。输出用于内部备会，不是正式周报正文。只基于输入数据，不编造。必须给出可用于管理会议的具体判断、追问和下一步动作。',
      prompt: `${dataSummary}

请输出 AI 经营分析/备会 JSON。内容要比简报更扎实，避免空泛套话；每个数组尽量给 3-6 条，单条 40-90 字，必须包含可追问对象/事项/动作：
{
  "summary":"120字以内本周经营判断：先说总体态势，再说最该管的1-2个问题",
  "key_changes":["本周关键变化：变化+影响+建议动作"],
  "high_risk_projects":[{"project":"项目名","reason":"风险原因与业务影响","question":"会上要追问的具体问题","next_action":"会后建议动作"}],
  "kpi_deviations":[{"indicator":"指标","reason_guess":"基于数据的原因猜测，不确定要标注","action":"纠偏动作"}],
  "decision_topics":["需要会上拍板的问题：背景+选项/负责人"],
  "follow_up_people":[{"name":"负责人或角色","topic":"追问事项","expected_output":"希望会后拿到的产出"}],
  "copy_material":"可复制到正式周报的经营分析素材，300-500字，分2-3段，不要AI腔"
}`,
      user: context.currentUser,
      taskType: 'weekly_operating_brief',
      fallback: null,
      maxTokens: 2200,
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
      copy_material: structured?.copy_material || buildRuleCopyMaterial(ruleSections),
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
      copy_material: buildRuleCopyMaterial(ruleSections),
      isMock: true,
    };
  }
}

function buildRuleCopyMaterial(sections) {
  return sections
    .map(section => `${section.title}\n${section.items.map(item => `- ${item}`).join('\n')}`)
    .join('\n\n');
}

function buildOperatingRuleSections(context) {
  const highRisk = (context.derivedSignals.projectSignals || []).filter(s => s.riskLevel === 'high').slice(0, 6);
  const mediumRisk = (context.derivedSignals.projectSignals || []).filter(s => s.riskLevel === 'medium').slice(0, 4);
  const kpiWarnings = (context.derivedSignals.kpiSignals || []).filter(k => k.isWarning).slice(0, 6);
  const closureGaps = (context.derivedSignals.closureGaps || []).slice(0, 6);

  return [
    {
      title: '风险项目追问',
      items: highRisk.length
        ? highRisk.map(s => `${s.name}：${s.riskSources.map(r => r.desc).join('、')}。会上确认卡点、负责人和截止日。`)
        : ['暂无高风险项目；可抽查中风险项目是否有明确下一步。']
    },
    {
      title: '中风险观察',
      items: mediumRisk.length
        ? mediumRisk.map(s => `${s.name}：${s.riskSources.map(r => r.desc).join('、')}。建议本周补一次进展和风险判断。`)
        : ['暂无明显中风险项目。']
    },
    {
      title: 'KPI偏差与纠偏',
      items: kpiWarnings.length
        ? kpiWarnings.map(k => `${k.name}完成率${k.completionRate}%，低于季度节奏；需要补充偏差原因和追赶动作。`)
        : ['暂无明显KPI偏差；会议可重点确认核心指标是否有新增变量。']
    },
    {
      title: '闭环缺口',
      items: closureGaps.length
        ? closureGaps.map(g => `${g.project}：${g.gaps.map(item => item.desc).join('、')}。建议会后补齐责任人/截止日/决策项。`)
        : ['暂无明显闭环缺口。']
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
