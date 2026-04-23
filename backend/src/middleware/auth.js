const { verifyToken } = require('../utils/jwt');
const { error } = require('../utils/response');
const { User, Department, Role, Permission, RolePermission } = require('../models');
const { Op } = require('sequelize');

// ==================== 权限定义 ====================
// 角色权限映射（当 RBAC 表不存在时使用硬编码降级）
const ROLE_PERMISSIONS = {
  super_admin: [
    'dashboard.read', 'kpi.read', 'kpi.create', 'kpi.update', 'kpi.delete',
    'project.read', 'project.create', 'project.update', 'project.delete', 'project.quick_update',
    'performance.read', 'performance.create', 'performance.update', 'performance.delete',
    'monthly_task.read', 'monthly_task.create', 'monthly_task.update', 'monthly_task.delete',
    'achievement.read', 'achievement.create', 'achievement.update', 'achievement.delete',
    'weekly_report.read', 'weekly_report.generate', 'weekly_report.update',
    'user.read', 'user.create', 'user.update', 'user.disable', 'user.reset_password',
    'department.read', 'department.create', 'department.update', 'department.delete',
    'audit.read', 'archive.read', 'archive.create', 'archive.delete',
    'import.excel', 'export.data', 'search.use'
  ],
  department_manager: [
    'dashboard.read', 'kpi.read', 'kpi.create', 'kpi.update',
    'project.read', 'project.create', 'project.update', 'project.quick_update',
    'performance.read', 'performance.create', 'performance.update',
    'monthly_task.read', 'monthly_task.create', 'monthly_task.update',
    'achievement.read', 'achievement.create', 'achievement.update',
    'weekly_report.read', 'weekly_report.generate', 'weekly_report.update',
    'department.read',
    'export.data', 'search.use'
  ],
  department_member: [
    'dashboard.read', 'kpi.read',
    'project.read', 'project.quick_update',
    'performance.read',
    'monthly_task.read', 'monthly_task.create', 'monthly_task.update',
    'achievement.read', 'achievement.create', 'achievement.update',
    'weekly_report.read',
    'department.read',
    'export.data', 'search.use'
  ]
};

// 角色兼容映射
const ROLE_COMPAT = {
  admin: 'super_admin',
  dept: 'department_manager',
  dept_manager: 'department_manager',
  dept_staff: 'department_member'
};

// 数据范围映射
const DATA_SCOPE_MAP = {
  super_admin: { type: 'all', value: null },
  department_manager: { type: 'department', value: null }, // value 运行时注入 dept_id
  department_member: { type: 'self', value: null }         // value 运行时注入 user.id
};

/**
 * 统一注入访问上下文
 * 在 authenticate 之后使用，给 req.access 注入完整权限信息
 */
async function injectAccessContext(req, res, next) {
  const user = req.user;
  if (!user) return error(res, '未认证', 401, 401);

  // 兼容旧角色
  const canonicalRole = ROLE_COMPAT[user.role] || user.role;
  const permissions = ROLE_PERMISSIONS[canonicalRole] || [];
  const scopeConfig = DATA_SCOPE_MAP[canonicalRole] || DATA_SCOPE_MAP.department_member;

  // 数据范围值注入
  let dataScopeValue = scopeConfig.value;
  if (scopeConfig.type === 'department') {
    dataScopeValue = user.dept_id;
  } else if (scopeConfig.type === 'self') {
    dataScopeValue = user.id;
  }

  req.access = {
    userId: user.id,
    username: user.username || user.name,
    role: canonicalRole,
    roleLevel: user.roleLevel,
    permissions,
    dataScopeType: scopeConfig.type,
    dataScopeValue,
    deptId: user.dept_id,
    deptIds: user.dept_id ? [user.dept_id] : [], // 预留 custom 多部门
  };

  // 向后兼容：同时设 req.deptFilter
  req.deptFilter = scopeConfig.type === 'all' ? null : user.dept_id;

  next();
}

/**
 * JWT 认证中间件
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '未提供有效的认证令牌', 401, 401);
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return error(res, '认证令牌已过期或无效', 401, 401);
  }

  const role = decoded.role || 'dept_staff';
  const roleLevel = (role === 'admin' || role === 'super_admin') ? 0 : (role === 'dept_manager' || role === 'dept') ? 1 : 2;
  req.user = { ...decoded, role, roleLevel };
  next();
}

/**
 * 权限校验中间件
 * 用法：requirePermission('kpi.create')
 */
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.access) {
      return error(res, '权限上下文未初始化', 403, 403);
    }
    if (req.access.permissions.includes(permission)) {
      return next();
    }
    return error(res, `需要 ${permission} 权限`, 403, 403);
  };
}

/**
 * 数据范围中间件
 * 用法：applyDataScope('project')
 * 效果：给 req.dataScope 注入 { type, deptId, userId, where }
 */
function applyDataScope(resourceType) {
  return (req, res, next) => {
    if (!req.access) {
      return error(res, '权限上下文未初始化', 403, 403);
    }

    const { dataScopeType, dataScopeValue, deptId, userId } = req.access;
    const scopeWhere = {};

    switch (dataScopeType) {
      case 'all':
        // 不加任何过滤
        break;
      case 'department':
        scopeWhere.dept_id = deptId;
        break;
      case 'self':
        scopeWhere.dept_id = deptId;
        // 对于有 owner_user_id 的表，用 owner_user_id / creator_id 过滤
        if (['project'].includes(resourceType)) {
          scopeWhere[Op.or] = [
            { owner_user_id: userId },
            { creator_id: userId }
          ];
        }
        // 对于只有 owner_name 的表（过渡期），后续迁移到 owner_user_id 后更新
        break;
      default:
        scopeWhere.dept_id = deptId;
    }

    req.dataScope = {
      type: dataScopeType,
      deptId,
      userId,
      where: scopeWhere
    };

    next();
  };
}

/**
 * 管理员权限校验（兼容旧接口）
 */
function requireAdmin(req, res, next) {
  if (req.access && req.access.role === 'super_admin') return next();
  if (req.user && req.user.roleLevel === 0) return next();
  return error(res, '需要管理员权限', 403, 403);
}

/**
 * 部门权限校验（兼容旧接口）
 */
function requireDeptAccess(req, res, next) {
  const user = req.user || {};
  if (user.roleLevel === 0) {
    req.deptFilter = null;
    return next();
  }
  if (user.dept_id) {
    req.deptFilter = user.dept_id;
    return next();
  }
  return error(res, '无权访问该部门数据', 403, 403);
}

/**
 * 部门负责人权限校验（兼容旧接口）
 */
function requireDeptManager(req, res, next) {
  if (req.user && req.user.roleLevel <= 1) return next();
  return error(res, '需要部门负责人权限', 403, 403);
}

module.exports = {
  authenticate,
  injectAccessContext,
  requirePermission,
  applyDataScope,
  requireAdmin,
  requireDeptAccess,
  requireDeptManager,
  ROLE_PERMISSIONS,
  ROLE_COMPAT
};
