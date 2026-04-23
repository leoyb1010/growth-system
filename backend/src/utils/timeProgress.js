/**
 * 时间进度计算工具
 *
 * 核心概念：时间进度 = 已过去天数 / 周期总天数
 * 业务判断应以"完成率 vs 时间进度"的差值为基础，而非硬阈值。
 */

/**
 * 获取季度的起止日期
 * Q1: 1/1 - 3/31, Q2: 4/1 - 6/30, Q3: 7/1 - 9/30, Q4: 10/1 - 12/31
 */
function getQuarterRange(quarter, year) {
  const qMap = {
    Q1: { startMonth: 0, endMonth: 2 },  // Jan-Mar
    Q2: { startMonth: 3, endMonth: 5 },  // Apr-Jun
    Q3: { startMonth: 6, endMonth: 8 },  // Jul-Sep
    Q4: { startMonth: 9, endMonth: 11 }, // Oct-Dec
  };
  const q = qMap[quarter];
  if (!q) return null;
  const startDate = new Date(year, q.startMonth, 1);
  // 季度最后一天：下个月第0天 = 本月最后一天
  const endDate = new Date(year, q.endMonth + 1, 0);
  return { startDate, endDate };
}

/**
 * 计算季度时间进度（百分比）
 * @param {string} quarter - Q1/Q2/Q3/Q4
 * @param {number} year - 年份
 * @param {Date} [now] - 当前时间（可注入，方便测试）
 * @returns {number} 0-100 的时间进度百分比
 */
function getQuarterTimeProgress(quarter, year, now) {
  const range = getQuarterRange(quarter, year);
  if (!range) return 0;
  const current = now || new Date();
  const start = range.startDate.getTime();
  const end = range.endDate.getTime() + 86400000; // 含最后一天
  const cur = current.getTime();

  if (cur <= start) return 0;
  if (cur >= end) return 100;
  return parseFloat((((cur - start) / (end - start)) * 100).toFixed(2));
}

/**
 * 计算年度时间进度（百分比）
 * @param {number} year - 年份
 * @param {Date} [now] - 当前时间
 * @returns {number} 0-100 的时间进度百分比
 */
function getYearTimeProgress(year, now) {
  const current = now || new Date();
  if (current.getFullYear() < year) return 0;
  if (current.getFullYear() > year) return 100;

  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const cur = current.getTime();
  return parseFloat((((cur - start) / (end - start)) * 100).toFixed(2));
}

/**
 * 根据完成率和时间进度判断业务状态
 *
 * 判断规则：
 * - 完成率 >= 时间进度 + 5%  → 'ahead'  (超前/达标)
 * - |完成率 - 时间进度| <= 5%  → 'on_track' (正常/追赶)
 * - 完成率 < 时间进度 - 5%     → 'behind'  (落后/严重)
 *
 * @param {number} completionRate - 完成率 0-100
 * @param {number} timeProgress  - 时间进度 0-100
 * @param {number} [tolerance]   - 容差百分比，默认5
 * @returns {'ahead'|'on_track'|'behind'}
 */
function getProgressStatus(completionRate, timeProgress, tolerance) {
  const tol = tolerance !== undefined ? tolerance : 5;
  if (completionRate >= timeProgress + tol) return 'ahead';
  if (completionRate >= timeProgress - tol) return 'on_track';
  return 'behind';
}

/**
 * 兼容旧接口：返回中文预警状态
 * 对应 Performance 页面的 warning_status
 */
function getWarningStatus(completionRate, timeProgress) {
  const status = getProgressStatus(completionRate, timeProgress);
  if (status === 'ahead') return '正常';
  if (status === 'on_track') return '预警';
  return '严重';
}

/**
 * 获取进度状态中文标签（用于 KPI 卡片、仪表盘等）
 */
function getProgressLabel(completionRate, timeProgress) {
  const status = getProgressStatus(completionRate, timeProgress);
  if (status === 'ahead') return '超前';
  if (status === 'on_track') return '正常';
  return '落后';
}

/**
 * 获取进度状态颜色 key（用于前端 Tag color）
 */
function getProgressColorKey(completionRate, timeProgress) {
  const status = getProgressStatus(completionRate, timeProgress);
  if (status === 'ahead') return 'success';
  if (status === 'on_track') return 'warning';
  return 'error';
}

module.exports = {
  getQuarterRange,
  getQuarterTimeProgress,
  getYearTimeProgress,
  getProgressStatus,
  getWarningStatus,
  getProgressLabel,
  getProgressColorKey,
};
