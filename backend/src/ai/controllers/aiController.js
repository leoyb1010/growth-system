/**
 * AI 控制器
 * 统一处理 AI 相关接口
 */

const { success, error } = require('../../utils/response');
const orchestrator = require('../services/aiOrchestrator');

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
  res.setHeader('X-Accel-Buffering', 'no'); // nginx 兼容

  const { sanitizeUserInput } = require('../utils/promptSecurity');
  const { safe: safeQuery, isSuspicious } = sanitizeUserInput(query);

  // 如果检测到注入，发送警告后继续
  if (isSuspicious) {
    res.write(`data: ${JSON.stringify({ type: 'warning', message: '检测到疑似指令注入，已自动过滤' })}\n\n`);
  }

  try {
    const aiOrchestrator = require('../services/aiOrchestrator');
    const llmProvider = require('../services/aiLLMProvider');
    const promptBuilder = require('../services/aiPromptBuilder');
    const aiContextService = require('../services/aiContextService');

    // 如果 LLM 不可用，降级为普通响应
    if (!llmProvider.isAvailable()) {
      const mockProvider = require('../services/aiMockProvider');
      const context = await aiContextService.assembleContext({
        currentPage: currentPage || 'dashboard',
        currentObject: {},
        currentUser: req.access || { userId: req.user.id }
      });
      const answer = mockProvider.mockChatAnswer(safeQuery, context);
      res.write(`data: ${JSON.stringify({ type: 'content', text: answer })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'done', isMock: true })}\n\n`);
      res.end();
      return;
    }

    // 组装上下文和 prompt
    const context = await aiContextService.assembleContext({
      currentPage: currentPage || 'dashboard',
      currentObject: {},
      currentUser: req.access || { userId: req.user.id }
    });

    const dataSummary = promptBuilder.formatDataSummary(context);
    const role = (req.user?.role === 'admin' || req.user?.role === 'super_admin') ? 'super_admin'
      : (req.user?.role === 'dept' || req.user?.role === 'dept_manager') ? 'department_manager'
      : 'department_member';

    const { systemPrompt, userPrompt } = promptBuilder.buildPrompt({
      mode: 'free_ask',
      page: currentPage || 'dashboard',
      role,
      dataSummary,
      userQuery: safeQuery
    });

    // 流式调用 LLM
    await llmProvider.callStream(systemPrompt, userPrompt, {}, (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'content', text: chunk })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ type: 'done', isMock: false })}\n\n`);
    res.end();
  } catch (err) {
    console.error('AI Stream Chat 错误:', err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI 服务暂时不可用' })}\n\n`);
    res.end();
  }
}

module.exports = {
  getPanel,
  analyze,
  chat,
  generateBriefing,
  getBadgeSummary,
  streamChat
};
