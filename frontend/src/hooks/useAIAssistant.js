/**
 * useAIAssistant - 管理 AI 助手状态
 */
import { useState, useCallback, useRef } from 'react';
import { fetchAIPanel, fetchAIAnalyze, fetchAIChat, fetchAIBriefing, fetchBadgeSummary } from '../services/aiService';

const MODES = [
  { key: 'free_ask', label: '问我任何问题' },
  { key: 'today_judgment', label: '今日判断' },
  { key: 'risk_closure', label: '风险与闭环' },
  { key: 'briefing_meeting', label: '汇报与周会' },
];

export function useAIAssistant() {
  const [open, setOpen] = useState(false);
  const [activeMode, setActiveMode] = useState('free_ask');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [badgeData, setBadgeData] = useState({ highRiskCount: 0, unclosedCount: 0, staleCount: 0, totalBadge: 0 });

  const loadPanel = useCallback(async (mode, currentPage, currentObject) => {
    setLoading(true);
    try {
      const res = await fetchAIPanel({ mode, currentPage, currentObject });
      if (res.code === 0) {
        setData(res.data);
        setActiveMode(mode);
      } else {
        setData({ headline: res.message || '加载失败，请重试', cards: [], actions: [], mode: 'error' });
      }
    } catch (err) {
      console.error('AI Panel 加载失败:', err);
      setData({ headline: '网络请求失败，请重试', cards: [], actions: [], mode: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  const runAction = useCallback(async (actionKey, currentPage, currentObject) => {
    setLoading(true);
    try {
      const res = await fetchAIAnalyze({ actionKey, currentPage, currentObject });
      if (res.code === 0) {
        setData(res.data);
      } else {
        // 业务错误：显示错误状态而非静默丢弃
        setData({ headline: res.message || '分析失败，请稍后重试', cards: [], actions: [], mode: 'error' });
      }
    } catch (err) {
      console.error('AI 分析失败:', err);
      setData({ headline: '网络请求失败，请检查网络后重试', cards: [], actions: [], mode: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  const sendChat = useCallback(async (query, currentPage, currentObject) => {
    setLoading(true);
    const userMsg = { role: 'user', content: query };
    setChatHistory(prev => [...prev, userMsg]);
    try {
      const res = await fetchAIChat({ query, currentPage, currentObject });
      if (res.code === 0) {
        const assistantMsg = { role: 'assistant', content: res.data.answer, sources: res.data.sources, suggestedFollowUps: res.data.suggestedFollowUps, isMock: res.data.isMock };
        setChatHistory(prev => [...prev, assistantMsg]);
        return res.data;
      } else {
        // 业务错误：告诉用户具体原因
        setChatHistory(prev => [...prev, { role: 'assistant', content: res.message || 'AI 分析失败，请稍后重试', isError: true }]);
      }
    } catch (err) {
      console.error('AI 问答失败:', err);
      setChatHistory(prev => [...prev, { role: 'assistant', content: '网络请求超时或失败，请稍后重试', isError: true }]);
    } finally {
      setLoading(false);
    }
  }, []);

  const generateBriefing = useCallback(async (type, currentPage, currentObject) => {
    setLoading(true);
    try {
      const res = await fetchAIBriefing({ type, currentPage, currentObject });
      if (res.code === 0) {
        setData(res.data);
        setActiveMode('briefing_meeting');
      }
    } catch (err) {
      console.error('AI 简报生成失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshBadge = useCallback(async (currentPage) => {
    try {
      const res = await fetchBadgeSummary({ currentPage });
      if (res.code === 0) {
        setBadgeData(res.data);
      }
    } catch (err) {
      // 静默
    }
  }, []);

  const openDrawer = useCallback((mode) => {
    setOpen(true);
    if (mode) setActiveMode(mode);
  }, []);

  const closeDrawer = useCallback(() => {
    setOpen(false);
  }, []);

  return {
    open,
    activeMode,
    loading,
    data,
    chatHistory,
    badgeData,
    MODES,
    loadPanel,
    runAction,
    sendChat,
    generateBriefing,
    refreshBadge,
    openDrawer,
    closeDrawer,
    setActiveMode,
  };
}

export default useAIAssistant;
