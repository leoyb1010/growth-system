/**
 * V4 统一权限中心
 * 所有菜单、按钮、Tab、快捷入口统一走 can(permission)
 * 禁止在各页面散落使用 isAdmin / isDeptManager 做零碎显隐
 */

// 角色兼容映射（与后端 ROLE_COMPAT 一致）
const ROLE_COMPAT = {
  admin: 'super_admin',
  dept: 'department_manager',
  dept_manager: 'department_manager',
  dept_staff: 'department_member',
};

// 角色权限定义（与后端 ROLE_PERMISSIONS 一致）
const ROLE_PERMISSIONS = {
  super_admin: [
    'dashboard.read', 'kpi.read', 'kpi.create', 'kpi.update', 'kpi.delete',
    'project.read', 'project.create', 'project.update', 'project.delete', 'project.quick_update',
    'performance.read', 'performance.create', 'performance.update', 'performance.delete',
    'monthly_task.read', 'monthly_task.create', 'monthly_task.update', 'monthly_task.delete',
    'achievement.read', 'achievement.create', 'achievement.update', 'achievement.delete',
    'weekly_report.read', 'weekly_report.generate', 'weekly_report.update',
    'user.read', 'user.create', 'user.update', 'user.disable', 'user.reset_password',
    'audit.read', 'archive.read', 'archive.create', 'archive.delete',
    'import.excel', 'export.data', 'search.use',
    'action_item.read', 'action_item.create', 'action_item.update', 'action_item.delete',
    'risk_register.read', 'risk_register.create', 'risk_register.update'
  ],
  department_manager: [
    'dashboard.read', 'kpi.read', 'kpi.create', 'kpi.update',
    'project.read', 'project.create', 'project.update', 'project.quick_update',
    'performance.read', 'performance.create', 'performance.update',
    'monthly_task.read', 'monthly_task.create', 'monthly_task.update',
    'achievement.read', 'achievement.create', 'achievement.update',
    'weekly_report.read', 'weekly_report.generate', 'weekly_report.update',
    'export.data', 'search.use',
    'action_item.read', 'action_item.create', 'action_item.update', 'action_item.delete',
    'risk_register.read', 'risk_register.create', 'risk_register.update'
  ],
  department_member: [
    'dashboard.read', 'kpi.read',
    'project.read', 'project.quick_update',
    'performance.read',
    'monthly_task.read', 'monthly_task.create', 'monthly_task.update',
    'achievement.read', 'achievement.create', 'achievement.update',
    'weekly_report.read',
    'export.data', 'search.use',
    'action_item.read', 'action_item.create', 'action_item.update',
    'risk_register.read'
  ],
};

/**
 * 获取规范角色名
 */
export function getCanonicalRole(role) {
  return ROLE_COMPAT[role] || role;
}

/**
 * 获取角色权限列表
 */
export function getPermissions(role) {
  const canonicalRole = getCanonicalRole(role);
  return ROLE_PERMISSIONS[canonicalRole] || [];
}

/**
 * 判断角色是否拥有指定权限
 * @param {string} role - 用户角色（原始值）
 * @param {string} permission - 权限点，如 'kpi.create'
 * @returns {boolean}
 */
export function can(role, permission) {
  const permissions = getPermissions(role);
  return permissions.includes(permission);
}

/**
 * 创建权限判断 hook 工具
 * 使用方式：
 *   const { can } = useAbility(user.role);
 *   if (can('kpi.create')) { ... }
 */
export function useAbility(role) {
  const permissions = getPermissions(role);
  return {
    can: (permission) => permissions.includes(permission),
    permissions,
  };
}

/**
 * 菜单可见性配置
 * 每个菜单项对应的权限点
 */
export const MENU_PERMISSIONS = {
  '/': 'dashboard.read',
  '/week': 'dashboard.read',
  '/kpis': 'kpi.read',
  '/projects': 'project.read',
  '/monthly-tasks': 'monthly_task.read',
  '/achievements': 'achievement.read',
  '/weekly-reports': 'weekly_report.read',
  '/users': 'user.read',
  '/audit-logs': 'audit.read',
  '/archives': 'archive.read',
  '/action-items': 'action_item.read',
  '/risks': 'risk_register.read',
};

/**
 * 判断菜单是否可见
 */
export function canSeeMenu(role, menuKey) {
  const permission = MENU_PERMISSIONS[menuKey];
  if (!permission) return true; // 未定义权限的菜单默认可见
  return can(role, permission);
}

export default { can, getCanonicalRole, getPermissions, useAbility, canSeeMenu, MENU_PERMISSIONS };
