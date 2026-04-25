/**
 * 项目诊断服务
 * 单项目深度分析
 */

const llmProvider = require('./aiLLMProvider');
const promptBuilder = require('./aiPromptBuilder');
const { formatAIResponse } = require('../utils/aiFormatters');

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

  try {
    const dataSummary = promptBuilder.formatDataSummary(context);
    const { systemPrompt, userPrompt } = promptBuilder.buildPrompt({
      mode: 'today_judgment',
      page: 'project_detail',
      role: mapRole(context.currentUser.role),
      dataSummary: dataSummary + `\n\n特别要求：对项目"${project.name}"进行深度诊断，输出风险等级、主要卡点、建议动作。`
    });

    const llmOutput = await llmProvider.call(systemPrompt, userPrompt);

    return formatAIResponse({
      headline: extractHeadline(llmOutput) || `${project.name}：${riskLevel === 'high' ? '高风险' : '需关注'}`,
      mode: 'today_judgment',
      cards: buildDiagnosisCards(project, ruleDiagnosis),
      actions: [
        { key: 'update_project', label: '更新项目', mode: 'today_judgment' },
        { key: 'view_risk_source', label: '查看风险来源', mode: 'risk_closure' },
      ],
      rawAnalysis: llmOutput
    });
  } catch (err) {
    console.error('AI 项目诊断 LLM 调用失败:', err.message);
    return formatAIResponse({
      headline: `${project.name}：${riskLevel === 'high' ? '高风险' : '需关注'}`,
      mode: 'today_judgment',
      cards: buildDiagnosisCards(project, ruleDiagnosis),
      actions: [
        { key: 'update_project', label: '更新项目', mode: 'today_judgment' },
        { key: 'view_risk_source', label: '查看风险来源', mode: 'risk_closure' },
      ]
    });
  }
}

function buildDiagnosisCards(project, diagnosis) {
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

module.exports = { diagnose };
