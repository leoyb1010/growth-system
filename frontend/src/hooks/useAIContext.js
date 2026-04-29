/**
 * useAIContext - 自动检测当前页面和对象，组装 AI 请求参数
 * V7: 更精准的页面映射，支持动态参数提取
 */
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

// 路由 → 页面映射（精确匹配优先）
const ROUTE_PAGE_MAP = {
  '/': 'dashboard',
  '/today': 'dashboard',
  '/week': 'week',
  '/kpis': 'kpis',
  '/projects': 'projects',
  '/performances': 'kpis',
  '/monthly-tasks': 'monthly_tasks',
  '/achievements': 'achievements',
  '/weekly-reports': 'weekly_reports',
  '/data-entry': 'dashboard',
  '/users': 'settings',
  '/departments': 'settings',
  '/audit-logs': 'settings',
  '/archives': 'settings',
  '/settlement': 'week',
};

// 页面 → 语义描述（供 AI prompt 使用）
const PAGE_DESCRIPTIONS = {
  dashboard: '管理驾驶舱，展示KPI指标、项目状态、风险预警',
  week: '本周管理，展示周维度重点工作和风险',
  kpis: '核心指标页面，展示季度KPI完成率',
  projects: '项目推进页面，展示所有项目详情和进度',
  monthly_tasks: '月度任务页面，展示月度工作进展',
  achievements: '季度成果页面，展示成果沉淀',
  weekly_reports: '周报与复盘页面，展示周报内容',
  settings: '系统设置页面',
};

export function useAIContext() {
  const location = useLocation();

  const context = useMemo(() => {
    const pathname = location.pathname;
    const searchParams = new URLSearchParams(location.search);

    // 精确匹配 + 前缀匹配降级
    const currentPage = ROUTE_PAGE_MAP[pathname] ||
      Object.entries(ROUTE_PAGE_MAP).find(([route]) => pathname.startsWith(route + '/'))?.[1] ||
      'dashboard';

    // 从 URL 参数中提取当前对象
    const currentObject = {};
    const projectId = searchParams.get('projectId');
    if (projectId) currentObject.projectId = parseInt(projectId);

    // 路径参数提取（如 /projects/123）
    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2 && !isNaN(parseInt(pathParts[pathParts.length - 1]))) {
      currentObject.id = parseInt(pathParts[pathParts.length - 1]);
    }

    // 当前周范围
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    currentObject.weekRange = `${monday.toISOString().split('T')[0]}~${sunday.toISOString().split('T')[0]}`;

    // 页面语义描述
    const pageDescription = PAGE_DESCRIPTIONS[currentPage] || '';

    return { currentPage, currentObject, pageDescription };
  }, [location.pathname, location.search]);

  return context;
}

export default useAIContext;
