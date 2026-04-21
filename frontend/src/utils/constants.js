/**
 * 系统级统一常量
 * 所有模块共享的状态色、优先级、排序规则
 */

// 状态色统一映射 — 系统级标准
export const STATUS_COLORS = {
  '完成': { tag: 'success', border: '#16A34A', dot: 'green' },
  '进行中': { tag: 'processing', border: '#3B5AFB', dot: 'blue' },
  '风险': { tag: 'error', border: '#DC2626', dot: 'red' },
  '未启动': { tag: 'default', border: '#9CA3AF', dot: 'gray' },
  // Performance 专用
  '正常': { tag: 'success', border: '#16A34A', dot: 'green' },
  '预警': { tag: 'warning', border: '#F59E0B', dot: 'orange' },
  '严重': { tag: 'error', border: '#DC2626', dot: 'red' },
};

export const defaultStatusColor = { tag: 'default', border: '#9CA3AF', dot: 'gray' };
export const getStatusStyle = (status) => STATUS_COLORS[status] || defaultStatusColor;

// 进度色映射
export const getProgressColor = (pct) => {
  if (pct >= 80) return '#16A34A';
  if (pct >= 60) return '#F59E0B';
  return '#DC2626';
};

// 管理优先级排序权重（越小越靠前）
export const getManagementPriority = (item) => {
  if (item.is_risk || item.status === '风险') return 0;
  if (item.is_due_soon) return 1;
  if (item.severe_warning) return 2;
  if ((item.progress_pct || item.completion_rate || 0) < 60 && item.status !== '完成') return 3;
  return 4;
};

// 相对时间格式化
export const formatRelativeTime = (time) => {
  if (!time) return '-';
  const m = new Date(time);
  const now = new Date();
  const diffMs = now - m;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay < 30) return `${diffDay}天前`;
  return `${Math.floor(diffDay / 30)}月前`;
};

// 截止日期标签
export const formatDueLabel = (daysUntil) => {
  if (daysUntil === undefined || daysUntil === null) return null;
  if (daysUntil < 0) return { text: `逾期${Math.abs(daysUntil)}天`, color: 'error' };
  if (daysUntil === 0) return { text: '今天到期', color: 'warning' };
  if (daysUntil <= 3) return { text: `剩${daysUntil}天`, color: 'warning' };
  if (daysUntil <= 7) return { text: `剩${daysUntil}天`, color: 'default' };
  return null;
};
