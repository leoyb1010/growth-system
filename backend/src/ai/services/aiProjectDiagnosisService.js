/**
 * 项目诊断服务
 * 单项目深度分析
 */

const llmProvider = require('./aiLLMProvider');
const promptBuilder = require('./aiPromptBuilder');
const { formatAIResponse } = require('../utils/aiFormatters');
const { createCacheKey, getCached, setCached, TASK_CACHE_TTL } = require('../../services/aiCacheService');

/**
 * 诊断单个项目
 * @param {Object} context - AI 上下文（含 projectDetail）
 * @returns {Promise<Object>}
 */
async function diagnose(context) {
  const project = context.pageData.projectDetail;
  if (!project) {
    return formatAIResponse({
      headline: '未找到项目信息',
      mode: 'today_judgment',
      cards: [{ type: 'info', title: '请选择一个项目进行诊断', description: '' }],
      actions: []
    });
  }

  const projectSignal = (context.derivedSignals.projectSignals || []).find(s => s.projectId === project.id);
  const riskLevel = projectSignal?.riskLevel || 'low';
  const riskSources = projectSignal?.riskSources || [];

  // 规则诊断
  const ruleDiagnosis = {
    riskLevel,
    riskSources,
    staleDays: projectSignal?.staleDays || 0,
    dueInDays: projectSignal?.dueInDays,
    progressRisk: projectSignal?.progressRisk || 'on_track',
  };

  if (!llmProvider.isAvailable()) {
    return buildFallbackResponse(project, ruleDiagnosis);
  }

  const cacheKey = createCacheKey('project_diagnosis', {
    userId: context.currentUser?.id,
    projectId: project.id,
    updatedAt: project.updated_at,
    progressPct: project.progress_pct,
    riskDesc: project.risk_desc,
    nextAction: project.next_action,
    ruleDiagnosis
  });
  const cached = await getCached(cacheKey);
  if (cached) return cached;

  try {
    const dataSummary = promptBuilder.formatDataSummary(context);
    const systemPrompt = `你是增长业务项目诊断助手。只基于输入数据做判断，不能编造负责人、指标或项目事实。`;
    const userPrompt = `${dataSummary}

请对项目「${project.name}」输出结构化诊断 JSON：
{
  "headline": "20字以内结论",
  "diagnosis_summary": "80字以内诊断",
  "root_causes": ["原因1", "原因2"],
  "recommended_actions": [{"title":"动作标题", "description":"动作说明", "priority":"low|medium|high|urgent", "owner_id": 数字或null, "due_date":"YYYY-MM-DD或null"}],
  "risk_candidates": [{"title":"风险标题", "description":"风险说明", "risk_level":"low|medium|high|critical", "mitigation_plan":"应对建议", "owner_id": 数字或null}],
  "weekly_report_material": "可复制到周报的素材，120字以内",
  "meeting_questions": ["会上要追问的问题"]
}`;

    const structured = await llmProvider.chatJSON({
      systemPrompt,
      prompt: userPrompt,
      user: context.currentUser,
      taskType: 'project_diagnosis',
      fallback: null,
      maxTokens: 2500,
    });

    const result = formatAIResponse({
      headline: structured?.headline || `${project.name}：${riskLevel === 'high' ? '高风险' : '需关注'}`,
      mode: 'today_judgment',
      cards: buildDiagnosisCards(project, ruleDiagnosis, structured),
      actions: [
        { key: 'update_project', label: '更新项目', mode: 'today_judgment' },
        { key: 'view_risk_source', label: '查看风险来源', mode: 'risk_closure' },
      ],
      rawAnalysis: structured,
      suggestedActions: buildSuggestedActions(structured, project),
      sources: [{ type: 'project', id: project.id, title: project.name }],
      confidence: structured ? 0.75 : 0.5,
    });

    await setCached(cacheKey, 'project_diagnosis', result, TASK_CACHE_TTL.project_diagnosis);
    return result;
  } catch (err) {
    console.error('AI 项目诊断 LLM 调用失败:', err.message);
    return buildFallbackResponse(project, ruleDiagnosis);
  }
}

function buildFallbackResponse(project, ruleDiagnosis) {
  const riskLevel = ruleDiagnosis.riskLevel;
  return formatAIResponse({
    headline: `${project.name}：${riskLevel === 'high' ? '高风险' : riskLevel === 'medium' ? '需关注' : '状态正常'}`,
    mode: 'today_judgment',
    cards: buildDiagnosisCards(project, ruleDiagnosis),
    actions: [
      { key: 'update_project', label: '更新项目', mode: 'today_judgment' },
      { key: 'view_risk_source', label: '查看风险来源', mode: 'risk_closure' },
    ]
  });
}

function buildDiagnosisCards(project, diagnosis, structured = null) {
  const cards = [];

  if (diagnosis.riskLevel === 'high') {
    cards.push({
      type: 'danger',
      title: '风险等级：高',
      description: diagnosis.riskSources.map(r => `- ${r.desc}`).join('\n'),
      icon: '🔴',
      tags: ['高风险']
    });
  } else if (diagnosis.riskLevel === 'medium') {
    cards.push({
      type: 'warning',
      title: '风险等级：中',
      description: diagnosis.riskSources.map(r => `- ${r.desc}`).join('\n'),
      icon: '🟡',
      tags: ['需关注']
    });
  }

  if (diagnosis.staleDays >= 3) {
    cards.push({
      type: 'warning',
      title: '更新滞后',
      description: `已${diagnosis.staleDays}天未更新`,
      icon: '📋',
      tags: ['待更新']
    });
  }

  if (diagnosis.progressRisk === 'behind') {
    cards.push({
      type: 'danger',
      title: '进度落后',
      description: `当前进度${project.progress_pct}%，落后于时间进度`,
      icon: '📊',
      tags: ['落后']
    });
  }

  if (project.risk_desc) {
    cards.push({
      type: 'info',
      title: '风险说明',
      description: project.risk_desc,
      icon: '📝',
      tags: []
    });
  }

  if (project.next_action) {
    cards.push({
      type: 'action',
      title: '下一步动作',
      description: project.next_action,
      icon: '➡️',
      tags: []
    });
  }

  if (structured?.diagnosis_summary) {
    cards.push({
      type: diagnosis.riskLevel === 'high' ? 'danger' : 'info',
      title: 'AI诊断',
      description: structured.diagnosis_summary,
      icon: '🤖',
      tags: ['需确认'],
      meta: {
        root_causes: structured.root_causes || [],
        weekly_report_material: structured.weekly_report_material || '',
        meeting_questions: structured.meeting_questions || []
      }
    });
  }

  if (cards.length === 0) {
    cards.push({
      type: 'success',
      title: '项目状态正常',
      description: `进度${project.progress_pct}%，无显著风险`,
      icon: '✅',
      tags: []
    });
  }

  return cards;
}

function buildSuggestedActions(structured, project) {
  if (!structured) return [];
  const actions = [];

  (structured.recommended_actions || []).slice(0, 3).forEach((item, index) => {
    actions.push({
      key: `materialize_action_${index}`,
      label: item.title || '生成待办',
      confirmRequired: true,
      params: {
        materializeType: 'action_item',
        title: item.title,
        description: item.description,
        priority: item.priority || 'medium',
        owner_id: item.owner_id || project.owner_user_id || null,
        due_date: item.due_date || null,
        source_type: 'project',
        source_id: project.id,
      }
    });
  });

  (structured.risk_candidates || []).slice(0, 3).forEach((item, index) => {
    actions.push({
      key: `materialize_risk_${index}`,
      label: item.title || '登记风险',
      confirmRequired: true,
      params: {
        materializeType: 'risk_register',
        project_id: project.id,
        title: item.title,
        description: item.description,
        risk_level: item.risk_level || 'medium',
        mitigation_plan: item.mitigation_plan || '',
        owner_id: item.owner_id || project.owner_user_id || null,
        source_type: 'project',
        source_id: project.id,
      }
    });
  });

  return actions;
}

module.exports = { diagnose };
