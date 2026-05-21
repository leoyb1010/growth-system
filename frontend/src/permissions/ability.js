/**
 * V4 统一权限中心
 * 所有菜单、按钮、Tab、快捷入口统一走 can(permission)
 * 禁止在各页面散落使用 isAdmin / isDeptManager 做零碎显隐
 *
 * 注意：此文件维护了一份与后端 middleware/auth.js 重复的权限定义
 * （ROLE_PERMISSIONS, ROLE_COMPAT, CPS_ROLE_PERMS, ASO_ROLE_PERMS）。
 * TODO：权限应以后端为唯一数据源，前端通过 /api/auth/me 返回的 permissions
 * 数组推导菜单可见性，避免双写不一致风险。
 */

// 角色兼容映射（与后端 ROLE_COMPAT 一致）
const ROLE_COMPAT = {
  admin: 'super_admin',
  dept: 'department_manager',
  dept_manager: 'department_manager',
  dept_staff: 'department_member',
  cps_admin: 'cps_admin',
  cps_ops: 'cps_ops',
  cps_channel_user: 'cps_channel_user',
  aso_admin: 'aso_admin',
  aso_ops: 'aso_ops',
  aso_viewer: 'aso_viewer',
  supervisor: 'supervisor',
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
    'cps.read', 'cps.write', 'cps.admin', 'cps.channel_upload', 'cps.channel_read_own',
    'aso.read', 'aso.write', 'aso.admin',
    'action_item.read', 'action_item.create', 'action_item.update', 'action_item.delete',
    'risk_register.read', 'risk_register.create', 'risk_register.update'
  ],
  cps_admin: ['cps.read', 'cps.write', 'cps.admin'],
  cps_ops: ['cps.read', 'cps.write'],
  cps_channel_user: ['cps.read', 'cps.channel_upload', 'cps.channel_read_own'],
  aso_admin: ['aso.read', 'aso.write', 'aso.admin'],
  aso_ops: ['aso.read', 'aso.write'],
  aso_viewer: ['aso.read'],
  supervisor: [
    'dashboard.read', 'kpi.read', 'project.read', 'performance.read', 'monthly_task.read',
    'achievement.read', 'weekly_report.read', 'department.read', 'audit.read', 'archive.read',
    'export.data', 'search.use', 'cps.read', 'aso.read', 'action_item.read', 'risk_register.read',
    'user.read'
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

// CPS 权限叠加映射
const CPS_ROLE_PERMS = {
  admin: ['cps.read', 'cps.write', 'cps.admin', 'cps.channel_upload', 'cps.channel_read_own'],
  ops: ['cps.read', 'cps.write', 'cps.channel_upload', 'cps.channel_read_own'],
  channel_user: ['cps.read', 'cps.channel_upload', 'cps.channel_read_own'],
};

// ASO 权限叠加映射
const ASO_ROLE_PERMS = {
  admin: ['aso.read', 'aso.write', 'aso.admin'],
  ops: ['aso.read', 'aso.write'],
  viewer: ['aso.read'],
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
export function can(role, permission, cpsRole, asoRole) {
  const permissions = getPermissions(role);
  // CPS权限叠加
  if (cpsRole && CPS_ROLE_PERMS[cpsRole] && CPS_ROLE_PERMS[cpsRole].includes(permission)) {
    return true;
  }
  // ASO权限叠加
  if (asoRole && ASO_ROLE_PERMS[asoRole] && ASO_ROLE_PERMS[asoRole].includes(permission)) {
    return true;
  }
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
  '/cps': 'cps.read',
  '/aso': 'aso.read',
};

/**
 * 判断菜单是否可见
 * @param {string} role
 * @param {string} menuKey 
 * @param {string} cpsRole - 可选，CPS权限叠加
 */
export function canSeeMenu(role, menuKey, cpsRole, asoRole) {
  const permission = MENU_PERMISSIONS[menuKey];
  if (!permission) return true;
  return can(role, permission, cpsRole, asoRole);
}

/**
 * 判断用户是否为 CPS 渠道账号
 * 兼容主角色 cps_channel_user 和叠加角色 cps_role=channel_user
 */
export function isCpsChannelUser(user) {
  return user?.role === 'cps_channel_user' || user?.cps_role === 'channel_user';
}

const ability = { can, getCanonicalRole, getPermissions, useAbility, canSeeMenu, isCpsChannelUser, MENU_PERMISSIONS };
export default ability;
