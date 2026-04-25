/**
 * AI 统一编排器
 * 接收 mode + context → 路由到对应 service → 统一输出
 */

const aiInsightService = require('./aiInsightService');
const aiRiskService = require('./aiRiskService');
const aiClosureService = require('./aiClosureService');
const aiWeeklyBriefService = require('./aiWeeklyBriefService');
const aiMeetingService = require('./aiMeetingService');
const aiProjectDiagnosisService = require('./aiProjectDiagnosisService');
const aiContextService = require('./aiContextService');
const llmProvider = require('./aiLLMProvider');
const mockProvider = require('./aiMockProvider');
const promptBuilder = require('./aiPromptBuilder');
const { formatAIResponse, formatChatResponse, formatBriefingResponse } = require('../utils/aiFormatters');
const { parseChatOutput, cleanLLMOutput } = require('../utils/aiOutputParser');

const VALID_MODES = ['today_judgment', 'risk_closure', 'briefing_meeting', 'free_ask'];
const VALID_PAGES = ['dashboard', 'week', 'kpis', 'projects', 'weekly_reports', 'project_detail'];

/**
 * 处理 AI Panel 请求
 * @param {Object} params
 * @param {string} params.mode - AI 模式
 * @param {string} params.currentPage - 当前页面
 * @param {Object} params.currentObject - 当前对象
 * @param {Object} params.currentUser - 当前用户
 * @returns {Promise<Object>}
 */
async function handlePanel(params) {
  const { mode = 'today_judgment', currentPage = 'dashboard', currentObject = {}, currentUser = {} } = params;

  // 组装上下文
  const context = await aiContextService.assembleContext({ currentPage, currentObject, currentUser });

  // 路由到对应模式
  switch (mode) {
    case 'today_judgment':
      return await aiInsightService.generate(context);
    case 'risk_closure':
      return await aiRiskService.analyze(context);
    case 'briefing_meeting':
      return await aiWeeklyBriefService.generate(context, 'brief');
    case 'free_ask':
      // 自由问答默认先给今日判断
      return await aiInsightService.generate(context);
    default:
      return await aiInsightService.generate(context);
  }
}

/**
 * 处理分析请求（页面内快捷动作）
 * @param {Object} params
 * @param {string} params.actionKey - 动作 key
 * @param {string} params.currentPage
 * @param {Object} params.currentObject
 * @param {Object} params.currentUser
 * @returns {Promise<Object>}
 */
async function handleAnalyze(params) {
  const { actionKey, currentPage = 'dashboard', currentObject = {}, currentUser = {} } = params;

  const context = await aiContextService.assembleContext({ currentPage, currentObject, currentUser });

  switch (actionKey) {
    case 'view_risk':
    case 'view_high_risk':
      return await aiRiskService.analyze(context);
    case 'view_closure':
    case 'view_stale_3d':
    case 'fill_gaps':
    case 'push_stale':
      return await aiClosureService.check(context);
    case 'generate_brief':
      return await aiWeeklyBriefService.generate(context, 'brief');
    case 'generate_agenda':
    case 'prepare_meeting':
      return await aiMeetingService.generateAgenda(context);
    case 'view_stale':
      return handleStaleProjects(context);
    case 'view_behind':
      return handleBehindProjects(context);
    case 'view_owner_load':
      return handleOwnerLoad(context);
    case 'diagnose_project':
      return await aiProjectDiagnosisService.diagnose(context);
    default:
      return await aiInsightService.generate(context);
  }
}

/**
 * 处理自由问答
 * @param {Object} params
 * @param {string} params.query - 用户问题
 * @param {string} params.currentPage
 * @param {Object} params.currentObject
 * @param {Object} params.currentUser
 * @returns {Promise<Object>}
 */
async function handleChat(params) {
  const { query, currentPage = 'dashboard', currentObject = {}, currentUser = {} } = params;

  const context = await aiContextService.assembleContext({ currentPage, currentObject, currentUser });

  if (!llmProvider.isAvailable()) {
    const answer = mockProvider.mockChatAnswer(query, context);
    return formatChatResponse({
      answer,
      sources: ['规则分析'],
      suggestedFollowUps: generateSuggestedFollowUps(context),
      isMock: true
    });
  }

  try {
    const dataSummary = promptBuilder.formatDataSummary(context);
    const role = mapRole(currentUser.role);
    const { systemPrompt, userPrompt, warnings } = promptBuilder.buildPrompt({
      mode: 'free_ask',
      page: currentPage,
      role,
      dataSummary,
      userQuery: query
    });

    // 记录安全警告（如果有）
    if (warnings && warnings.length > 0) {
      console.warn('[AI 安全] Prompt注入检测:', warnings.join('; '));
    }

    const llmOutput = await llmProvider.call(systemPrompt, userPrompt);

    // 使用解析器结构化 LLM 输出
    const parsed = parseChatOutput(llmOutput);

    const result = formatChatResponse({
      answer: cleanLLMOutput(parsed.answer || llmOutput),
      sources: parsed.sources.length > 0 ? parsed.sources : ['AI 分析'],
      suggestedFollowUps: parsed.suggestedFollowUps || generateSuggestedFollowUps(context),
      confidence: parsed.confidence,
      isMock: false
    });

    // 如果有安全警告，附加到响应中供前端展示
    if (warnings && warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  } catch (err) {
    console.error('AI 自由问答 LLM 调用失败:', err.message);
    const answer = mockProvider.mockChatAnswer(query, context);
    return formatChatResponse({
      answer: answer + '\n\n（LLM 不可用，以上为规则分析结果）',
      sources: ['规则分析（降级）'],
      suggestedFollowUps: generateSuggestedFollowUps(context),
      isMock: true
    });
  }
}

/**
 * 处理简报生成请求
 */
async function handleBriefing(params) {
  const { type = 'brief', currentPage = 'dashboard', currentObject = {}, currentUser = {} } = params;

  const context = await aiContextService.assembleContext({ currentPage, currentObject, currentUser });

  switch (type) {
    case 'agenda':
      return await aiMeetingService.generateAgenda(context);
    case 'summary':
      return await aiWeeklyBriefService.generate(context, 'summary');
    case 'brief':
    default:
      return await aiWeeklyBriefService.generate(context, 'brief');
  }
}

/**
 * 获取角标摘要
 */
async function handleBadgeSummary(params) {
  const { currentPage = 'dashboard', currentObject = {}, currentUser = {} } = params;

  const context = await aiContextService.assembleContext({ currentPage, currentObject, currentUser });

  const highRiskCount = (context.derivedSignals.projectSignals || []).filter(s => s.riskLevel === 'high').length;
  const unclosedCount = (context.derivedSignals.closureGaps || []).length;
  const staleCount = (context.derivedSignals.projectSignals || []).filter(s => s.staleDays >= 3).length;

  return {
    highRiskCount,
    unclosedCount,
    staleCount,
    totalBadge: highRiskCount + unclosedCount
  };
}

// ===== 辅助方法 =====

function handleStaleProjects(context) {
  const staleProjects = (context.derivedSignals.projectSignals || []).filter(s => s.staleDays >= 3);
  return formatAIResponse({
    headline: `${staleProjects.length} 个项目待更新`,
    mode: 'risk_closure',
    cards: staleProjects.map(s => ({
      type: s.staleDays >= 7 ? 'danger' : 'warning',
      title: s.name,
      description: `已${s.staleDays}天未更新`,
      icon: s.staleDays >= 7 ? '🔴' : '🟡',
      tags: ['待更新'],
      meta: { projectId: s.projectId }
    })),
    actions: [{ key: 'push_stale', label: '催更', type: 'primary' }]
  });
}

function handleBehindProjects(context) {
  const behindProjects = (context.derivedSignals.projectSignals || []).filter(s => s.progressRisk === 'behind');
  return formatAIResponse({
    headline: `${behindProjects.length} 个项目进度落后`,
    mode: 'risk_closure',
    cards: behindProjects.map(s => ({
      type: 'danger',
      title: s.name,
      description: s.riskSources.map(r => r.desc).join('；'),
      icon: '📊',
      tags: ['落后'],
      meta: { projectId: s.projectId }
    })),
    actions: [{ key: 'view_risk', label: '查看风险', type: 'primary' }]
  });
}

function handleOwnerLoad(context) {
  const loads = context.derivedSignals.ownerLoads || {};
  const overloaded = Object.entries(loads).filter(([_, v]) => v.highRisk >= 2 || v.total >= 4);
  return formatAIResponse({
    headline: overloaded.length > 0 ? `${overloaded.length} 位负责人负载较高` : '负责人负载均衡',
    mode: 'risk_closure',
    cards: overloaded.length > 0 ? overloaded.map(([name, v]) => ({
      type: v.highRisk >= 3 ? 'danger' : 'warning',
      title: name,
      description: `总项目${v.total}个，高风险${v.highRisk}个`,
      icon: '👤',
      tags: ['负载']
    })) : [{
      type: 'success',
      title: '负载均衡',
      description: '各负责人项目分配合理',
      icon: '✅'
    }],
    actions: []
  });
}

function generateSuggestedFollowUps(context) {
  const suggestions = [];
  const signals = context.derivedSignals.projectSignals || [];
  const highRisk = signals.filter(s => s.riskLevel === 'high');

  if (highRisk.length > 0) {
    suggestions.push(`${highRisk[0].name}的风险根因是什么？`);
  }
  suggestions.push('本周哪些指标偏差最大？');
  suggestions.push('下周应该优先推进什么？');
  return suggestions.slice(0, 3);
}

function mapRole(role) {
  if (!role) return 'department_member';
  if (role === 'super_admin') return 'super_admin';
  if (role === 'department_manager' || role === 'dept') return 'department_manager';
  return 'department_member';
}

module.exports = {
  handlePanel,
  handleAnalyze,
  handleChat,
  handleBriefing,
  handleBadgeSummary,
  VALID_MODES,
  VALID_PAGES
};
