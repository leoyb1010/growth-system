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

module.exports = {
  getPanel,
  analyze,
  chat,
  generateBriefing,
  getBadgeSummary
};
