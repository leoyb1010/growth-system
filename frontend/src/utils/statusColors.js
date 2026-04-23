// 全局状态色映射 - V3 系统级标准
// 适用模块：Project / MonthlyTask / Achievement / Performance

export const STATUS_COLORS = {
  // Project / MonthlyTask 状态
  '完成': { tag: 'success', border: '#16A34A', dot: 'green', bg: '#F6FFED' },
  '进行中': { tag: 'processing', border: '#3B5AFB', dot: 'blue', bg: '#F0F5FF' },
  '风险': { tag: 'error', border: '#DC2626', dot: 'red', bg: '#FEF2F2' },
  '未启动': { tag: 'default', border: '#9CA3AF', dot: 'gray', bg: '#F5F5F5' },
  // Performance 预警状态
  '正常': { tag: 'success', border: '#16A34A', dot: 'green', bg: '#F6FFED' },
  '预警': { tag: 'warning', border: '#F59E0B', dot: 'orange', bg: '#FFFBE6' },
  '严重': { tag: 'error', border: '#DC2626', dot: 'red', bg: '#FEF2F2' },
};

export const defaultStatusColor = { tag: 'default', border: '#9CA3AF', dot: 'gray', bg: '#F5F5F5' };

export const getStatusStyle = (status) => STATUS_COLORS[status] || defaultStatusColor;

// 进度条颜色（保留用于项目进度条，基于项目自身进度）
export const getProgressColor = (pct) => {
  if (pct >= 80) return '#16A34A';
  if (pct >= 60) return '#F59E0B';
  return '#DC2626';
};

// 完成率颜色（基于时间进度对比）
export const getCompletionColor = (rate, timeProgress) => {
  if (timeProgress !== undefined && timeProgress !== null) {
    if (rate >= timeProgress + 5) return '#16A34A';
    if (rate >= timeProgress - 5) return '#F59E0B';
    return '#DC2626';
  }
  // 降级：无时间进度时用硬阈值
  if (rate >= 90) return '#16A34A';
  if (rate >= 60) return '#F59E0B';
  return '#DC2626';
};

// 优先级颜色
export const PRIORITY_COLORS = {
  '高': { tag: 'error', color: '#DC2626' },
  '中': { tag: 'warning', color: '#F59E0B' },
  '低': { tag: 'default', color: '#9CA3AF' },
};

// 管理优先级排序权重（数值越大越优先）
export const MANAGEMENT_PRIORITY = {
  '风险': 100,
  '严重': 100,
  '预警': 80,
  '进行中': 60,
  '未启动': 40,
  '完成': 20,
  '正常': 20,
};

// 计算管理优先级分数（用于排序）
export const calcManagementPriority = (item) => {
  let score = MANAGEMENT_PRIORITY[item.status] || 0;
  // 临期加分
  if (item.days_until_due !== undefined && item.days_until_due >= 0 && item.days_until_due <= 7) {
    score += 50;
  }
  // 落后于时间进度加分
  if (item.progress_status === 'behind' && item.status !== '完成') {
    score += 30;
  }
  // 长期未更新加分
  if (item.days_since_update !== undefined && item.days_since_update > 3) {
    score += 20;
  }
  return score;
};
