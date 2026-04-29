/**
 * 角色映射工具
 * 统一收敛 5 处重复的 mapRole 逻辑
 */

/**
 * 将数据库角色映射为 AI 语义角色
 * @param {string} dbRole - 数据库中的角色字段
 * @returns {'super_admin' | 'department_manager' | 'department_member'}
 */
function mapRole(dbRole) {
  if (!dbRole) return 'department_member';
  if (dbRole === 'admin' || dbRole === 'super_admin') return 'super_admin';
  if (dbRole === 'dept' || dbRole === 'dept_manager' || dbRole === 'department_manager') return 'department_manager';
  return 'department_member';
}

module.exports = mapRole;
