/**
 * AI 控制器
 * 统一处理 AI 相关接口
 */

const { success, error } = require('../../utils/response');
const orchestrator = require('../services/aiOrchestrator');
const { logAudit } = require('../../services/auditLogService');
const { VALID_AI_ACTIONS } = require('../../middleware/validateAiRequest');

/**
 * Best-effort extraction of source references from LLM text.
 * Matches project names and KPI indicator names from the data context.
 * @param {string} text - LLM output text
 * @param {Object} context - AI context with pageData and derivedSignals
 * @returns {Array<{type: string, id: number|null, title: string}>}
 */
function extractSources(text, context) {
  if (!text || !context) return [];
  try {
    const sources = [];
    const seen = new Set();

    // Match project names
    const projects = (context.pageData && context.pageData.projects) || [];
    for (const p of projects) {
      if (p.name && text.includes(p.name) && !seen.has('project:' + p.name)) {
        seen.add('project:' + p.name);
        sources.push({ type: 'project', id: p.id || null, title: p.name });
      }
    }

    // Match KPI indicator names
    const kpis = (context.pageData && context.pageData.kpis) || [];
    for (const k of kpis) {
      if (k.indicator_name && text.includes(k.indicator_name) && !seen.has('kpi:' + k.indicator_name)) {
        seen.add('kpi:' + k.indicator_name);
        sources.push({ type: 'kpi', id: k.id || null, title: k.indicator_name });
      }
    }

    // Match "XXX完成率" pattern for KPIs
    const completionMatch = text.match(/([\u4e00-\u9fa5A-Za-z]+)完成率/g);
    if (completionMatch) {
      for (const m of completionMatch) {
        const name = m.replace('完成率', '');
        const kpi = kpis.find(k => k.indicator_name && k.indicator_name.includes(name));
        if (kpi && !seen.has('kpi:' + kpi.indicator_name)) {
          seen.add('kpi:' + kpi.indicator_name);
          sources.push({ type: 'kpi', id: kpi.id || null, title: kpi.indicator_name });
        }
      }
    }

    return sources;
  } catch (e) {
    return [];
  }
}

/**
 * POST /api/ai/panel
 * 打开 AI 助手栏时获取结构化内容
 */
async function getPanel(req, res) {
  try {
    const { mode, currentPage, currentObject } = req.body;
    const currentUser = {
      id: req.access?.userId,
      role: req.access?.role,
      deptId: req.access?.deptId,
      dataScopeType: req.access?.dataScopeType,
      dataScopeValue: req.access?.dataScopeValue,
    };

    const result = await orchestrator.handlePanel({
      mode: mode || 'today_judgment',
      currentPage: currentPage || 'dashboard',
      currentObject: currentObject || {},
      currentUser
    });

    return success(res, result);
  } catch (err) {
    console.error('AI panel 错误:', err);
    return error(res, `AI 分析失败: ${err.message}`, 1, 500);
  }
}

/**
 * POST /api/ai/analyze
 * 页面内快捷动作
 */
async function analyze(req, res) {
  try {
    const { actionKey, currentPage, currentObject } = req.body;
    if (!actionKey) return error(res, '缺少 actionKey 参数');

    const currentUser = {
      id: req.access?.userId,
      role: req.access?.role,
      deptId: req.access?.deptId,
      dataScopeType: req.access?.dataScopeType,
      dataScopeValue: req.access?.dataScopeValue,
    };

    const result = await orchestrator.handleAnalyze({
      actionKey,
      currentPage: currentPage || 'dashboard',
      currentObject: currentObject || {},
      currentUser
    });

    return success(res, result);
  } catch (err) {
    console.error('AI analyze 错误:', err);
    return error(res, `AI 分析失败: ${err.message}`, 1, 500);
  }
}

/**
 * POST /api/ai/chat
 * 自由问答
 */
async function chat(req, res) {
  try {
    const { query, currentPage, currentObject } = req.body;
    if (!query || !query.trim()) return error(res, '请输入问题');

    const currentUser = {
      id: req.access?.userId,
      role: req.access?.role,
      deptId: req.access?.deptId,
      dataScopeType: req.access?.dataScopeType,
      dataScopeValue: req.access?.dataScopeValue,
    };

    const result = await orchestrator.handleChat({
      query: query.trim(),
      currentPage: currentPage || 'dashboard',
      currentObject: currentObject || {},
      currentUser
    });

    // Best-effort: extract source references from answer text using context
    try {
      const aiContextService = require('../services/aiContextService');
      const context = await aiContextService.assembleContext({
        currentPage: currentPage || 'dashboard',
        currentObject: currentObject || {},
        currentUser
      });
      const extractedSources = extractSources(result.answer || '', context);
      if (extractedSources.length > 0) {
        // Merge: keep existing structured sources, add extracted ones not already present
        const existingTitles = new Set((result.sources || []).map(s => s.title || s));
        for (const s of extractedSources) {
          if (!existingTitles.has(s.title)) {
            result.sources = result.sources || [];
            result.sources.push(s);
          }
        }
      }
    } catch (_) {
      // best-effort, don't break response
    }

    return success(res, result);
  } catch (err) {
    console.error('AI chat 错误:', err);
    return error(res, `AI 问答失败: ${err.message}`, 1, 500);
  }
}

/**
 * POST /api/ai/briefing
 * 生成简报/周报/周会
 */
async function generateBriefing(req, res) {
  try {
    const { type, currentPage, currentObject } = req.body;

    const currentUser = {
      id: req.access?.userId,
      role: req.access?.role,
      deptId: req.access?.deptId,
      dataScopeType: req.access?.dataScopeType,
      dataScopeValue: req.access?.dataScopeValue,
    };

    const result = await orchestrator.handleBriefing({
      type: type || 'brief',
      currentPage: currentPage || 'dashboard',
      currentObject: currentObject || {},
      currentUser
    });

    return success(res, result);
  } catch (err) {
    console.error('AI briefing 错误:', err);
    return error(res, `AI 简报生成失败: ${err.message}`, 1, 500);
  }
}

/**
 * GET /api/ai/badge-summary
 * 悬浮按钮角标数据
 */
async function getBadgeSummary(req, res) {
  try {
    const currentPage = req.query.currentPage || 'dashboard';
    const currentObject = req.query.projectId ? { projectId: req.query.projectId } : {};

    const currentUser = {
      id: req.access?.userId,
      role: req.access?.role,
      deptId: req.access?.deptId,
      dataScopeType: req.access?.dataScopeType,
      dataScopeValue: req.access?.dataScopeValue,
    };

    const result = await orchestrator.handleBadgeSummary({
      currentPage,
      currentObject,
      currentUser
    });

    return success(res, result);
  } catch (err) {
    console.error('AI badge-summary 错误:', err);
    return error(res, `AI 角标获取失败: ${err.message}`, 1, 500);
  }
}

/**
 * 流式自由问答（SSE）
 * POST /api/ai/chat-stream
 * 安全对齐：复用 orchestrator 的 promptSecurity + outputParser
 */
async function streamChat(req, res) {
  const { query, currentPage } = req.body;

  if (!query || typeof query !== 'string') {
    return error(res, '请输入问题');
  }

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // 复用 promptSecurity（与 chat 端点一致）
  const { sanitizeUserInput } = require('../utils/promptSecurity');
  const { safe: safeQuery, isSuspicious } = sanitizeUserInput(query);

  if (isSuspicious) {
    res.write(`data: ${JSON.stringify({ type: 'warning', message: '检测到疑似指令注入，已自动过滤' })}\n\n`);
  }

  try {
    const llmProvider = require('../services/aiLLMProvider');
    const aiContextService = require('../services/aiContextService');
    const promptBuilder = require('../services/aiPromptBuilder');

    const currentUser = {
      id: req.access?.userId,
      role: req.access?.role,
      deptId: req.access?.deptId,
      dataScopeType: req.access?.dataScopeType,
      dataScopeValue: req.access?.dataScopeValue,
    };

    // 如果 LLM 不可用，降级为规则响应
    if (!llmProvider.isAvailable()) {
      const mockProvider = require('../services/aiMockProvider');
      const context = await aiContextService.assembleContext({
        currentPage: currentPage || 'dashboard',
        currentObject: {},
        currentUser
      });
      const answer = mockProvider.mockChatAnswer(safeQuery, context);
      const text = typeof answer === 'string' ? answer : answer.content;
      const meta = typeof answer === 'object' ? { confidence: answer.confidence, sources: answer.sources } : {};
      res.write(`data: ${JSON.stringify({ type: 'content', text })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', isMock: true, ...meta })}\n\n`);
      res.end();
      return;
    }

    // 组装上下文和 prompt（复用 promptBuilder，与 chat 端点一致）
    const context = await aiContextService.assembleContext({
      currentPage: currentPage || 'dashboard',
      currentObject: {},
      currentUser
    });

    const dataSummary = promptBuilder.formatDataSummary(context);
    const roleMap = require('../utils/roleMapper');
    const role = roleMap(currentUser.role);

    const { systemPrompt, userPrompt } = promptBuilder.buildPrompt({
      mode: 'free_ask',
      page: currentPage || 'dashboard',
      role,
      dataSummary,
      userQuery: safeQuery
    });

    // 流式调用 LLM，累积文本用于 source 提取
    let fullText = '';
    await llmProvider.callStream(systemPrompt, userPrompt, {}, (chunk) => {
      fullText += chunk;
      res.write(`data: ${JSON.stringify({ type: 'content', text: chunk })}\n\n`);
    });

    // Best-effort: extract source references from accumulated text
    let extractedSources = [];
    try {
      extractedSources = extractSources(fullText, context);
    } catch (_) {
      // best-effort, ignore
    }

    res.write(`data: ${JSON.stringify({ type: 'done', isMock: false, sources: extractedSources })}\n\n`);
    res.end();
  } catch (err) {
    console.error('AI Stream Chat 错误:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI 服务暂时不可用' })}\n\n`);
    res.end();
  }
}

/**
 * AI 可操作输出
 * POST /api/ai/action
 * 白名单校验 + 二次确认 + 审计日志
 */
async function executeAction(req, res) {
  try {
    const { actionKey, params } = req.body;

    // 白名单二次校验（路由层已校验，controller 层双保险）
    if (!VALID_AI_ACTIONS.includes(actionKey)) {
      return error(res, `操作 ${actionKey} 不在白名单中，已被拒绝`, 1, 403);
    }

    const currentUser = {
      id: req.access?.userId,
      role: req.access?.role,
      deptId: req.access?.deptId,
      username: req.access?.username,
    };

    // 审计日志
    await logAudit('ai_actions', null, 'execute', currentUser.username || currentUser.id, null, {
      actionKey,
      params: params || {},
      ip: req.ip,
    });

    // 执行只读/导航类 Action
    let result;
    switch (actionKey) {
      case 'view_project': {
        const { projectId } = params || {};
        if (!projectId) return error(res, '缺少 projectId');
        const { Project } = require('../../models');
        const project = await Project.findByPk(projectId);
        if (!project) return error(res, '项目不存在');
        result = { actionKey, type: 'navigate', path: `/projects?projectId=${projectId}`, project: { id: project.id, name: project.name, status: project.status } };
        break;
      }
      case 'navigate_to': {
        const { path } = params || {};
        if (!path || typeof path !== 'string') return error(res, '缺少 path 参数');
        // 路径安全：只允许白名单内部路径
        const ALLOWED_PATH_PREFIXES = ['/dashboard', '/projects', '/kpis', '/week', '/monthly-tasks', '/achievements', '/weekly-reports', '/settlement', '/today', '/departments'];
        if (!path.startsWith('/')) return error(res, '只允许内部路径');
        const isAllowed = ALLOWED_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?'));
        if (!isAllowed) return error(res, '不允许导航到该路径');
        result = { actionKey, type: 'navigate', path };
        break;
      }
      case 'flag_risk': {
        const { projectId, reason } = params || {};
        if (!projectId) return error(res, '缺少 projectId');
        const { Project } = require('../../models');
        const project = await Project.findByPk(projectId);
        if (!project) return error(res, '项目不存在');
        result = {
          actionKey,
          type: 'confirm_required',
          message: `确认将「${project.name}」标记为风险项目？`,
          confirmAction: { projectId, newStatus: '风险', reason: reason || '' },
        };
        break;
      }
      case 'create_note': {
        const { content } = params || {};
        if (!content || typeof content !== 'string') return error(res, '缺少笔记内容');
        result = { actionKey, type: 'confirm_required', message: '确认创建此笔记？', confirmAction: { content: content.substring(0, 500) } };
        break;
      }
      case 'set_reminder': {
        const { projectId, date, note } = params || {};
        if (!projectId) return error(res, '缺少 projectId');
        result = { actionKey, type: 'confirm_required', message: '确认设置提醒？', confirmAction: { projectId, date, note: (note || '').substring(0, 200) } };
        break;
      }
      case 'export_summary': {
        const { scope } = params || {};
        result = { actionKey, type: 'download', scope: scope || 'current_page' };
        break;
      }
      default:
        return error(res, `未实现的操作: ${actionKey}`, 1, 400);
    }

    return success(res, result);
  } catch (err) {
    console.error('AI Action 错误:', err);
    return error(res, `操作执行失败: ${err.message}`, 1, 500);
  }
}

module.exports = {
  getPanel,
  analyze,
  chat,
  generateBriefing,
  getBadgeSummary,
  streamChat,
  executeAction
};
