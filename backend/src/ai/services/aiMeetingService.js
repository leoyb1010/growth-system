/**
 * 周会辅助服务
 */

const llmProvider = require('./aiLLMProvider');
const promptBuilder = require('./aiPromptBuilder');
const { formatBriefingResponse } = require('../utils/aiFormatters');

/**
 * 生成周会议程
 */
async function generateAgenda(context) {
  const { pageData, derivedSignals } = context;
  const projects = pageData.projects || [];
  const riskProjects = projects.filter(p => p.status === '风险' || p.status === '阻塞中');
  const highPriorityProjects = projects.filter(p => p.priority === '高' && p.status !== '完成');
  const behindSignals = (derivedSignals.projectSignals || []).filter(s => s.progressRisk === 'behind');

  if (!llmProvider.isAvailable()) {
    return formatBriefingResponse({
      type: 'agenda',
      title: '周会议程',
      sections: [
        {
          title: '1. 风险项目讨论',
          content: riskProjects.length > 0 ? riskProjects.map(p => `- ${p.name}（${p.status}）：${p.risk_desc || '待补充'}`).join('\n') : '无风险项目'
        },
        {
          title: '2. 进度落后项目',
          content: behindSignals.length > 0 ? behindSignals.map(s => `- **${s.name}**：${s.riskSources.map(r => r.desc).join('；')}`).join('\n') : '无进度落后项目'
        },
        {
          title: '3. 高优先级项目推进',
          content: highPriorityProjects.length > 0 ? highPriorityProjects.map(p => `- ${p.name}（进度${p.progress_pct}%）`).join('\n') : '无高优先级项目'
        },
        {
          title: '4. 指标达成分析',
          content: (derivedSignals.kpiSignals || []).filter(k => k.isWarning).map(k => `- ${k.name}：完成率${k.completionRate}%，偏差${k.gap}`).join('\n') || '指标进展正常'
        },
        {
          title: '5. 下周重点排期',
          content: '基于以上讨论确定'
        }
      ],
      actions: [
        { key: 'copy_agenda', label: '复制议程' },
        { key: 'generate_brief', label: '生成简报', mode: 'briefing_meeting' },
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
      dataSummary: dataSummary + '\n\n特别要求：生成周会议程，包含追问点。'
    });

    const llmOutput = await llmProvider.call(systemPrompt, userPrompt);

    return formatBriefingResponse({
      type: 'agenda',
      title: '周会议程',
      content: llmOutput,
      actions: [
        { key: 'copy_agenda', label: '复制议程' },
        { key: 'generate_brief', label: '生成简报', mode: 'briefing_meeting' },
      ]
    });
  } catch (err) {
    console.error('AI 周会议程 LLM 调用失败:', err.message);
    // 降级
    return generateAgenda(context); // 会走 mock 分支因为递归会先检查
  }
}

/**
 * 生成项目追问点
 */
async function generateFollowUpQuestions(context) {
  const { pageData, derivedSignals } = context;
  const projects = pageData.projects || [];
  const riskProjects = projects.filter(p => p.status === '风险' || p.status === '阻塞中');

  const questions = [];
  riskProjects.forEach(p => {
    questions.push(`${p.name}的风险根因是什么？有没有明确的解决时间？`);
    if (p.next_action) questions.push(`${p.name}的下一步动作是否有人跟进？`);
  });

  (derivedSignals.projectSignals || []).filter(s => s.staleDays >= 3).forEach(s => {
    questions.push(`${s.name}已${s.staleDays}天未更新，是否有阻塞？`);
  });

  return questions.slice(0, 8);
}

function mapRole(role) {
  if (!role) return 'department_member';
  if (role === 'super_admin') return 'super_admin';
  if (role === 'department_manager' || role === 'dept') return 'department_manager';
  return 'department_member';
}

module.exports = { generateAgenda, generateFollowUpQuestions };
