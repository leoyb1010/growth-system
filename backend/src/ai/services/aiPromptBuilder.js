/**
 * Prompt 分层构建器
 * system + mode + page + role + data summary
 */

// ===== System Prompt =====
const SYSTEM_PROMPT = `你是网易有道增长部门管理系统的 AI 副驾驶。你的职责是帮助管理者快速掌握业务全貌、识别风险、闭环检查、辅助汇报。

核心原则：
1. 先给结论，再给原因，再给建议动作
2. 优先结构化输出，避免大段文字
3. 不复述数据，要提供洞察和判断
4. 体现管理动作导向，告诉用户该做什么
5. 对不确定的信息明确标注置信度
6. 避免空话和套话，直击要点`;

// ===== Mode Prompts =====
const MODE_PROMPTS = {
  today_judgment: `模式：今日判断
目标：给用户进入某个页面时的第一判断，最值得关注的内容。
输出要求：
- headline：一句话判断（20字以内）
- cards：结构化关注点列表，每个包含 title / description / severity(高/中/低) / suggestedAction
- 最多5个关注点，按严重程度排序`,

  risk_closure: `模式：风险与闭环
目标：识别哪些项目要出事，哪些承诺没做完。
输出要求：
- headline：一句话总结风险态势
- riskItems：高风险项目列表，每个包含 projectName / riskSources / riskLevel / suggestedAction
- unclosedItems：未闭环事项列表，每个包含 projectName / gap / suggestedAction
- managementActions：建议管理动作（2-3条）`,

  briefing_meeting: `模式：汇报与周会
目标：把系统数据变成可直接拿去开会和汇报的内容。
输出要求：
- headline：一句话总结本周态势
- weeklyBrief：本周简报（3-5个要点）
- meetingAgenda：周会议程（3-5个议题，按优先级排序）
- followUpQuestions：追问点（每个议题1-2个）
- nextWeekFocus：下周重点建议（2-3条）`,

  free_ask: `模式：自由问答
目标：基于当前页面上下文回答用户问题。
输出要求：
- answer：直接回答（先结论后原因）
- sources：回答依据的数据来源
- suggestedFollowUps：推荐追问（2-3个）`
};

// ===== Page Prompts =====
const PAGE_PROMPTS = {
  dashboard: `当前页面：总览（Dashboard）
用户在查看全局概览，关注全局风险、指标偏差、项目整体状态。
优先关注：高风险项目、偏差最大的指标、最该关注的3件事。`,

  week: `当前页面：本周
用户在查看本周重点和进展，关注本周节奏和闭环。
优先关注：上周承诺未完成项、本周需升级关注项、建议先过会的项目。`,

  kpis: `当前页面：指标与目标
用户在查看KPI达成情况，关注指标偏差和趋势。
优先关注：完成率最低的指标、偏差扩大的指标、归因分析。`,

  projects: `当前页面：项目推进
用户在查看项目列表和状态，关注风险和负载。
优先关注：风险项目、待更新项目、负责人负载。`,

  weekly_reports: `当前页面：周报与复盘
用户在查看或生成周报，关注汇报质量。
优先关注：本周要点提炼、周报优化建议、下周重点。`,

  project_detail: `当前页面：项目详情
用户在查看单个项目的完整信息。
优先关注：该项目风险等级、主要卡点、建议动作。`
};

// ===== Role Prompts =====
const ROLE_PROMPTS = {
  super_admin: `用户角色：超级管理员
可以看所有部门数据，输出粒度：全局视角，关注整体风险和跨部门协调。`,

  department_manager: `用户角色：部门负责人
看本部门数据，输出粒度：部门视角，关注本部门KPI和项目推进。`,

  department_member: `用户角色：部门成员
看自己相关数据，输出粒度：个人视角，关注自己负责的项目和任务。`
};

/**
 * 构建完整 prompt
 * @param {Object} options
 * @param {string} options.mode - 模式
 * @param {string} options.page - 当前页面
 * @param {string} options.role - 用户角色
 * @param {string} options.dataSummary - 数据摘要（规则提炼后）
 * @param {string} options.userQuery - 用户问题（自由问答模式）
 * @returns {Object} { systemPrompt, userPrompt }
 */
function buildPrompt(options) {
  const { mode, page, role, dataSummary, userQuery } = options;

  const systemPrompt = [
    SYSTEM_PROMPT,
    '',
    MODE_PROMPTS[mode] || '',
    '',
    PAGE_PROMPTS[page] || PAGE_PROMPTS.dashboard,
    '',
    ROLE_PROMPTS[role] || ROLE_PROMPTS.department_member,
  ].join('\n');

  let userPrompt = '';
  if (mode === 'free_ask' && userQuery) {
    userPrompt = `基于以下数据摘要回答问题：\n\n${dataSummary}\n\n用户问题：${userQuery}`;
  } else {
    userPrompt = `基于以下数据摘要进行分析：\n\n${dataSummary}\n\n请按${MODE_PROMPTS[mode]?.split('\n')[0] || '当前模式'}的要求输出。`;
  }

  return { systemPrompt, userPrompt };
}

/**
 * 将数据摘要格式化为 LLM 友好的文本
 */
function formatDataSummary(context) {
  const { pageData, derivedSignals, currentPage, currentObject } = context;
  const lines = [];

  lines.push(`=== 页面上下文 ===`);
  lines.push(`当前页面：${currentPage}`);
  if (currentObject?.projectId) lines.push(`当前项目ID：${currentObject.projectId}`);
  if (currentObject?.weekRange) lines.push(`当前周范围：${currentObject.weekRange}`);
  lines.push('');

  // 项目摘要
  const projects = pageData.projects || [];
  if (projects.length > 0) {
    lines.push(`=== 项目概览（共${projects.length}个）===`);
    projects.slice(0, 15).forEach(p => {
      lines.push(`- ${p.name} | 状态:${p.status} | 进度:${p.progress_pct}% | 负责人:${p.owner_name} | 优先级:${p.priority || '中'}`);
      if (p.risk_desc) lines.push(`  风险：${p.risk_desc.substring(0, 100)}`);
      if (p.next_action) lines.push(`  下一步：${p.next_action.substring(0, 100)}`);
    });
    lines.push('');
  }

  // 风险信号摘要
  const signals = derivedSignals.projectSignals || [];
  const riskSignals = signals.filter(s => s.riskLevel === 'high' || s.riskLevel === 'medium');
  if (riskSignals.length > 0) {
    lines.push(`=== 风险信号（${riskSignals.length}个）===`);
    riskSignals.forEach(s => {
      lines.push(`- ${s.name} | 风险等级:${s.riskLevel} | 来源:${s.riskSources.map(r => r.desc).join(';')}`);
    });
    lines.push('');
  }

  // KPI 摘要
  const kpis = pageData.kpis || [];
  if (kpis.length > 0) {
    lines.push(`=== KPI 指标（共${kpis.length}个）===`);
    kpis.slice(0, 10).forEach(k => {
      const rate = k.target > 0 ? ((k.actual / k.target) * 100).toFixed(1) : 'N/A';
      lines.push(`- ${k.indicator_name} | 目标:${k.target} | 实际:${k.actual} | 完成率:${rate}%`);
    });
    lines.push('');
  }

  // 闭环缺口摘要
  const closureGaps = derivedSignals.closureGaps || [];
  if (closureGaps.length > 0) {
    lines.push(`=== 闭环缺口（${closureGaps.length}个）===`);
    closureGaps.slice(0, 5).forEach(g => {
      lines.push(`- ${g.project}：${g.gaps.map(gap => gap.desc).join('、')}`);
    });
    lines.push('');
  }

  // 负责人负载
  const ownerLoads = derivedSignals.ownerLoads || {};
  const overloaded = Object.entries(ownerLoads).filter(([_, v]) => v.highRisk >= 2 || v.total >= 4);
  if (overloaded.length > 0) {
    lines.push(`=== 负责人负载 ===`);
    overloaded.forEach(([name, v]) => {
      lines.push(`- ${name} | 总项目:${v.total} | 高风险:${v.highRisk}`);
    });
  }

  return lines.join('\n');
}

module.exports = {
  buildPrompt,
  formatDataSummary,
  SYSTEM_PROMPT,
  MODE_PROMPTS,
  PAGE_PROMPTS,
  ROLE_PROMPTS
};
