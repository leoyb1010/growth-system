const { getRiskLabel } = require('../utils/riskRules');

/**
 * Mock Provider - 无 LLM Key 时的 Fallback
 * 基于规则生成结构化输出，保证系统可用
 */

/**
 * 生成 mock 今日判断
 */
function mockTodayJudgment(context) {
  const { pageData, derivedSignals } = context;
  const highRiskProjects = (pageData.projects || []).filter(p => p.status === '风险' || p.status === '阻塞中');
  const staleProjects = (derivedSignals.projectSignals || []).filter(s => s.staleDays >= 3);
  const behindProjects = (derivedSignals.projectSignals || []).filter(s => s.progressRisk === 'behind');

  const headline = highRiskProjects.length > 0
    ? `⚠️ 当前有 ${highRiskProjects.length} 个高风险项目需要关注`
    : staleProjects.length > 0
    ? `${staleProjects.length} 个项目多日未更新，请确认进展`
    : behindProjects.length > 0
    ? `${behindProjects.length} 个项目进度落后，建议加速推进`
    : '当前各项业务运行平稳，无紧急风险';

  const cards = [];

  if (highRiskProjects.length > 0) {
    cards.push({
      type: 'danger',
      title: '高风险项目',
      description: `${highRiskProjects.map(p => p.name).join('、')}`,
      icon: '⚠️',
      tags: ['风险'],
      actions: [{ key: 'view_risk', label: '查看风险项目', type: 'primary' }]
    });
  }

  if (staleProjects.length > 0) {
    cards.push({
      type: 'warning',
      title: '待更新项目',
      description: staleProjects.slice(0, 3).map(s => `- **${s.name}**（${s.staleDays}天未更新）`).join('\n'),
      icon: '📋',
      tags: ['待更新'],
      actions: [{ key: 'view_stale', label: '查看待更新', type: 'default' }]
    });
  }

  if (behindProjects.length > 0) {
    cards.push({
      type: 'warning',
      title: '进度落后',
      description: behindProjects.slice(0, 3).map(s => `- **${s.name}** 进度落后于时间进度`).join('\n'),
      icon: '📊',
      tags: ['落后'],
      actions: [{ key: 'view_behind', label: '查看落后项目', type: 'default' }]
    });
  }

  if (cards.length === 0) {
    cards.push({
      type: 'success',
      title: '运行平稳',
      description: '当前无高风险、待更新或进度落后的项目，继续推进即可',
      icon: '✅',
      tags: [],
      actions: []
    });
  }

  return { headline, cards, isMock: true };
}

/**
 * 生成 mock 风险与闭环
 */
function mockRiskClosure(context) {
  const { pageData, derivedSignals } = context;
  const riskProjects = (derivedSignals.projectSignals || []).filter(s => s.riskLevel === 'high' || s.riskLevel === 'medium');
  const closureGaps = (derivedSignals.closureGaps || []);

  const headline = riskProjects.length > 0
    ? `发现 ${riskProjects.length} 个风险项目，${closureGaps.length} 个闭环缺口`
    : '暂无显著风险，闭环检查通过';

  const cards = [];

  if (riskProjects.length > 0) {
    riskProjects.slice(0, 5).forEach(s => {
      // 每个风险源单独一行，用 - 开头
      const descLines = s.riskSources.map(r => `- ${r.desc}`).join('\n');
      // tags 用人类可读标签，最多3个
      const readableTags = [...new Set(s.riskSources.map(r => getRiskLabel(r.type)))].slice(0, 3);
      cards.push({
        type: s.riskLevel === 'high' ? 'danger' : 'warning',
        title: s.name,
        description: descLines,
        icon: s.riskLevel === 'high' ? '🔴' : '🟡',
        tags: readableTags,
        meta: { projectId: s.projectId }
      });
    });
  }

  if (closureGaps.length > 0) {
    // 闭环缺口：每个项目单独一行
    const gapLines = closureGaps.slice(0, 3).map(g => `- **${g.project}**：${g.gaps.map(gap => gap.desc).join('、')}`).join('\n');
    cards.push({
      type: 'info',
      title: '闭环缺口',
      description: gapLines,
      icon: '🔄',
      tags: ['闭环'],
      actions: [{ key: 'view_closure', label: '查看闭环详情', type: 'default' }]
    });
  }

  if (cards.length === 0) {
    cards.push({
      type: 'success',
      title: '风险与闭环检查通过',
      description: '当前所有项目风险可控，闭环完整',
      icon: '✅',
      tags: [],
      actions: []
    });
  }

  return { headline, cards, isMock: true };
}

/**
 * 生成 mock 汇报与周会
 */
function mockBriefingMeeting(context) {
  const { pageData } = context;
  const projects = pageData.projects || [];
  const kpis = pageData.kpis || [];

  const riskProjects = projects.filter(p => p.status === '风险' || p.status === '阻塞中');
  const progressProjects = projects.filter(p => p.status === '进行中' || p.status === '合作中');
  const kpiGaps = kpis.filter(k => parseFloat(k.actual) < parseFloat(k.target) * 0.8);

  const headline = `本周 ${progressProjects.length} 个项目推进中，${riskProjects.length} 个风险项，${kpiGaps.length} 个指标偏差较大`;

  const sections = [
    {
      title: '本周简报',
      content: `本周共 ${progressProjects.length} 个项目在推进。${riskProjects.length > 0 ? `需重点关注：${riskProjects.map(p => p.name).join('、')}。` : '无高风险项目。'}${kpiGaps.length > 0 ? `指标方面，${kpiGaps.map(k => k.indicator_name).join('、')}完成率偏低。` : '各项指标进展正常。'}`
    },
    {
      title: '周会议程建议',
      content: riskProjects.length > 0
        ? `1. 风险项目讨论（${riskProjects.map(p => p.name).join('、')}）\n2. 指标偏差分析\n3. 下周重点排期`
        : '1. 本周进展回顾\n2. 指标达成分析\n3. 下周重点排期'
    },
    {
      title: '下周重点建议',
      content: riskProjects.length > 0
        ? `优先解决 ${riskProjects[0].name} 的风险问题`
        : progressProjects.length > 0
        ? `持续推进 ${progressProjects.slice(0, 3).map(p => p.name).join('、')}`
        : '按计划推进各项工作'
    }
  ];

  return { headline, sections, isMock: true };
}

/**
 * 生成 mock 自由问答回复
 */
function mockChatAnswer(question, context) {
  const { currentPage, pageData } = context;
  const projects = pageData.projects || [];

  // 简单关键词匹配
  if (question.includes('风险') || question.includes('危险')) {
    const risks = projects.filter(p => p.status === '风险' || p.status === '阻塞中');
    return risks.length > 0
      ? `当前有 ${risks.length} 个风险项目：${risks.map(p => p.name).join('、')}。建议优先处理。`
      : '当前没有标记为风险的项目。';
  }
  if (question.includes('进度') || question.includes('落后')) {
    return `系统中共 ${projects.length} 个项目，您可以在项目推进页面查看详细进度。`;
  }
  if (question.includes('指标') || question.includes('KPI') || question.includes('kpi')) {
    const kpis = pageData.kpis || [];
    return kpis.length > 0
      ? `当前有 ${kpis.length} 个指标，${kpis.filter(k => parseFloat(k.actual) < parseFloat(k.target) * 0.8).length} 个偏差较大。`
      : '暂无指标数据。';
  }

  return `[规则分析] 关于"${question}"：当前在${currentPage}页面，系统共 ${projects.length} 个项目。如需深度分析，请配置 AI 模型。`;
}

module.exports = {
  mockTodayJudgment,
  mockRiskClosure,
  mockBriefingMeeting,
  mockChatAnswer
};
