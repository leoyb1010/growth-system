/**
 * AI 请求输入校验中间件
 * 防止非法参数注入、类型错误、超长输入
 */

const { error } = require('../utils/response');

// 合法的 AI 模式白名单
const VALID_MODES = ['today_judgment', 'risk_closure', 'briefing_meeting', 'free_ask'];

// 合法的 actionKey 白名单
const VALID_ACTION_KEYS = [
  'view_risk', 'view_high_risk',
  'view_closure', 'view_stale_3d', 'fill_gaps', 'push_stale',
  'generate_brief', 'generate_agenda', 'prepare_meeting',
  'view_stale', 'view_behind', 'view_owner_load',
  'diagnose_project',
];

// 合法的 briefing 类型
const VALID_BRIEFING_TYPES = ['brief', 'agenda', 'summary'];

// 合法的 AI Action 白名单（可操作输出）
const VALID_AI_ACTIONS = [
  'view_project', 'create_note', 'flag_risk',
  'set_reminder', 'export_summary', 'navigate_to',
];

// 合法的页面标识
const VALID_PAGES = [
  'dashboard', 'week', 'kpis', 'projects',
  'weekly_reports', 'monthly_tasks', 'achievements',
];

/**
 * 校验函数映射
 */
const validators = {
  panel: (body) => {
    const { mode, currentPage } = body;
    if (mode && !VALID_MODES.includes(mode)) {
      return `无效的 mode: ${mode}`;
    }
    if (currentPage && !VALID_PAGES.includes(currentPage)) {
      return `无效的 currentPage: ${currentPage}`;
    }
    return null;
  },

  analyze: (body) => {
    const { actionKey, currentPage } = body;
    if (!actionKey) return '缺少 actionKey 参数';
    if (!VALID_ACTION_KEYS.includes(actionKey)) {
      return `无效的 actionKey: ${actionKey}`;
    }
    if (currentPage && !VALID_PAGES.includes(currentPage)) {
      return `无效的 currentPage: ${currentPage}`;
    }
    return null;
  },

  chat: (body) => {
    const { query, currentPage } = body;
    if (!query || typeof query !== 'string') return '请输入问题';
    if (query.length > 2000) return '问题过长，请控制在2000字以内';
    if (currentPage && !VALID_PAGES.includes(currentPage)) {
      return `无效的 currentPage: ${currentPage}`;
    }
    return null;
  },

  'chat-stream': (body) => {
    const { query, currentPage } = body;
    if (!query || typeof query !== 'string') return '请输入问题';
    if (query.length > 2000) return '问题过长，请控制在2000字以内';
    if (currentPage && !VALID_PAGES.includes(currentPage)) {
      return `无效的 currentPage: ${currentPage}`;
    }
    return null;
  },

  briefing: (body) => {
    const { type, currentPage } = body;
    if (type && !VALID_BRIEFING_TYPES.includes(type)) {
      return `无效的 briefing type: ${type}`;
    }
    if (currentPage && !VALID_PAGES.includes(currentPage)) {
      return `无效的 currentPage: ${currentPage}`;
    }
    return null;
  },

  action: (body) => {
    const { actionKey, params } = body;
    if (!actionKey || typeof actionKey !== 'string') return '缺少 actionKey';
    if (!VALID_AI_ACTIONS.includes(actionKey)) {
      return `无效的 actionKey: ${actionKey}，不在白名单中`;
    }
    if (params && typeof params !== 'object') return 'params 必须为对象';
    // 防止 params 中注入危险字段
    if (params) {
      const dangerousKeys = Object.keys(params).filter(k =>
        k.startsWith('_') || k.includes('__') || k === 'constructor' || k === 'prototype'
      );
      if (dangerousKeys.length > 0) {
        return `params 包含非法字段: ${dangerousKeys.join(', ')}`;
      }
    }
    return null;
  },
};

/**
 * 生成校验中间件
 * @param {string} endpoint - 端点名称
 */
function validateAiRequest(endpoint) {
  const validate = validators[endpoint];
  if (!validate) {
    console.warn(`[AI Validate] 未知的端点: ${endpoint}，跳过校验`);
    return (req, res, next) => next();
  }

  return (req, res, next) => {
    const body = req.body || req.query || {};
    const errMsg = validate(body);
    if (errMsg) {
      return error(res, errMsg, 1, 400);
    }
    next();
  };
}

module.exports = { validateAiRequest, VALID_AI_ACTIONS };
