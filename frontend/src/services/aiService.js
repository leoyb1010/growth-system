/**
 * AI API 服务封装
 */
import { api } from '../hooks/useAuth';

/**
 * 获取 AI Panel 数据
 */
export async function fetchAIPanel({ mode = 'today_judgment', currentPage = 'dashboard', currentObject = {} } = {}) {
  const res = await api.post('/ai/panel', { mode, currentPage, currentObject });
  return res;
}

/**
 * AI 分析（快捷动作）
 */
export async function fetchAIAnalyze({ actionKey, currentPage = 'dashboard', currentObject = {} }) {
  const res = await api.post('/ai/analyze', { actionKey, currentPage, currentObject });
  return res;
}

/**
 * AI 自由问答
 */
export async function fetchAIChat({ query, currentPage = 'dashboard', currentObject = {} }) {
  const res = await api.post('/ai/chat', { query, currentPage, currentObject });
  return res;
}

/**
 * AI 生成简报
 */
export async function fetchAIBriefing({ type = 'brief', currentPage = 'dashboard', currentObject = {} }) {
  const res = await api.post('/ai/briefing', { type, currentPage, currentObject });
  return res;
}

/**
 * 获取角标数据
 */
export async function fetchBadgeSummary({ currentPage = 'dashboard' } = {}) {
  const res = await api.get('/ai/badge-summary', { params: { currentPage } });
  return res;
}
