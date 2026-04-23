/**
 * useAIContext - 自动检测当前页面和对象，组装 AI 请求参数
 */
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

// 路由 → 页面映射
const ROUTE_PAGE_MAP = {
  '/': 'dashboard',
  '/today': 'dashboard',
  '/week': 'week',
  '/kpis': 'kpis',
  '/projects': 'projects',
  '/performances': 'kpis',
  '/monthly-tasks': 'projects',
  '/achievements': 'projects',
  '/weekly-reports': 'weekly_reports',
  '/data-entry': 'dashboard',
  '/users': 'dashboard',
  '/departments': 'dashboard',
  '/audit-logs': 'dashboard',
  '/archives': 'dashboard',
  '/settlement': 'week',
};

export function useAIContext() {
  const location = useLocation();

  const context = useMemo(() => {
    const pathname = location.pathname;
    const searchParams = new URLSearchParams(location.search);

    const currentPage = ROUTE_PAGE_MAP[pathname] || 'dashboard';

    // 从 URL 参数中提取当前对象
    const currentObject = {};
    const projectId = searchParams.get('projectId');
    if (projectId) currentObject.projectId = parseInt(projectId);

    // 当前周范围
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    currentObject.weekRange = `${monday.toISOString().split('T')[0]}~${sunday.toISOString().split('T')[0]}`;

    return { currentPage, currentObject };
  }, [location.pathname, location.search]);

  return context;
}

export default useAIContext;
