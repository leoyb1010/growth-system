/**
 * 中文文本 normalize 工具
 * 兼容历史乱码值，确保枚举判断稳定
 */

// 项目状态枚举
const PROJECT_STATUSES = ['未启动', '进行中', '协作中', '阻塞中', '风险', '完成'];

// 项目状态 normalize 映射（兼容可能的乱码值）
const PROJECT_STATUS_MAP = {
  '未启动': '未启动',
  '进行中': '进行中',
  '协作中': '协作中',
  '阻塞中': '阻塞中',
  '风险': '风险',
  '完成': '完成',
  // 历史兼容：旧版枚举值
  '合作中': '协作中',
};

// 优先级枚举
const PRIORITIES = ['高', '中', '低'];

const PRIORITY_MAP = {
  '高': '高',
  '中': '中',
  '低': '低',
};

// 成果状态枚举
const ACHIEVEMENT_STATUSES = ['草稿', '已确认'];

const ACHIEVEMENT_STATUS_MAP = {
  '草稿': '草稿',
  '已确认': '已确认',
  'draft': '草稿',
  'confirmed': '已确认',
};

/**
 * Normalize 项目状态值
 * @param {string} status - 原始状态值
 * @returns {string} 标准化后的状态值
 */
function normalizeProjectStatus(status) {
  return PROJECT_STATUS_MAP[status] || status || '未启动';
}

/**
 * Normalize 优先级
 */
function normalizePriority(priority) {
  return PRIORITY_MAP[priority] || priority || '中';
}

/**
 * Normalize 成果状态
 */
function normalizeAchievementStatus(status) {
  return ACHIEVEMENT_STATUS_MAP[status] || status || '草稿';
}

module.exports = {
  PROJECT_STATUSES,
  PRIORITIES,
  ACHIEVEMENT_STATUSES,
  normalizeProjectStatus,
  normalizePriority,
  normalizeAchievementStatus,
};
