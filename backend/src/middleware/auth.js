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
    'import.excel', 'export.data', 'search.use', 'ai.use',
    'cps.read', 'cps.write', 'cps.admin', 'cps.channel_upload', 'cps.channel_read_own',
    'action_item.read', 'action_item.create', 'action_item.update', 'action_item.delete',
    'risk_register.read', 'risk_register.create', 'risk_register.update'
  ],
  cps_admin: [ 'cps.read', 'cps.write', 'cps.admin', 'ai.use' ],
  cps_ops: [ 'cps.read', 'cps.write', 'ai.use' ],
  cps_channel_user: [ 'cps.channel_upload', 'cps.channel_read_own' ],
  department_manager: [
    'dashboard.read', 'kpi.read', 'kpi.create', 'kpi.update', 'kpi.delete',
    'project.read', 'project.create', 'project.update', 'project.delete', 'project.quick_update',
    'performance.read', 'performance.create', 'performance.update', 'performance.delete',
    'monthly_task.read', 'monthly_task.create', 'monthly_task.update', 'monthly_task.delete',
    'achievement.read', 'achievement.create', 'achievement.update', 'achievement.delete',
    'weekly_report.read', 'weekly_report.generate', 'weekly_report.update',
    'department.read',
    'export.data', 'search.use', 'ai.use',
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
    'department.read',
    'export.data', 'search.use', 'ai.use',
    'action_item.read', 'action_item.create', 'action_item.update',
    'risk_register.read'
  ]
};

// 角色兼容映射
const ROLE_COMPAT = {
  admin: 'super_admin',
  dept: 'department_manager',
  dept_manager: 'department_manager',
  dept_staff: 'department_member',
  cps_admin: 'cps_admin',
  cps_ops: 'cps_ops',
  cps_channel_user: 'cps_channel_user'
};

// 数据范围映射
const DATA_SCOPE_MAP = {
  super_admin: { type: 'all', value: null },
  cps_admin: { type: 'all', value: null },
  cps_ops: { type: 'all', value: null },
  cps_channel_user: { type: 'cps_channel', value: null },
  department_manager: { type: 'department', value: null },
  department_member: { type: 'self', value: null }
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
  // CPS权限叠加：用户 cps_role 不为空时，叠加对应CPS权限
  const CPS_ROLE_PERMS = {
    admin: ['cps.read', 'cps.write', 'cps.admin', 'cps.channel_upload', 'cps.channel_read_own'],
    ops: ['cps.read', 'cps.write', 'cps.channel_upload', 'cps.channel_read_own'],
    channel_user: ['cps.channel_upload', 'cps.channel_read_own'],
  };
  if (user.cps_role && CPS_ROLE_PERMS[user.cps_role]) {
    CPS_ROLE_PERMS[user.cps_role].forEach(p => { if (!permissions.includes(p)) permissions.push(p); });
  }
  const scopeConfig = DATA_SCOPE_MAP[canonicalRole] || DATA_SCOPE_MAP.department_member;

  // 数据范围值注入
  let dataScopeValue = scopeConfig.value;
  if (scopeConfig.type === 'department') {
    dataScopeValue = user.dept_id;
  } else if (scopeConfig.type === 'self') {
    dataScopeValue = user.id;
  } else if (scopeConfig.type === 'cps_channel') {
    dataScopeValue = user.cps_channel_id;
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

  // 袁博组（type=manager）权限隔离：仅 admin 可见
  // dept_manager / dept_staff 的 deptFilter 如果命中 manager 组，不暴露
  req.managerDeptIds = []; // 运行时填充，供 controller 使用

  next();
}

/**
 * JWT 认证中间件
 * 验证 token 后，从数据库查询用户最新状态（防止禁用用户旧 token 继续访问）
 */
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(res, '未提供有效的认证令牌', 401, 401);
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  if (!decoded) {
    return error(res, '认证令牌已过期或无效', 401, 401);
  }

  // 从数据库获取用户最新状态，防止禁用用户的旧 token 继续访问
  try {
    const dbUser = await User.findByPk(decoded.id, {
      attributes: ['id', 'username', 'name', 'role', 'dept_id', 'status', 'token_version', 'cps_channel_id', 'cps_role'],
      include: [{ model: Department, attributes: ['id', 'name'] }]
    });

    if (!dbUser) {
      return error(res, '用户不存在', 401, 401);
    }

    if (dbUser.status === 'disabled') {
      return error(res, '账号已被禁用，请联系管理员', 403, 403);
    }

    if (dbUser.status === 'pending') {
      return error(res, '账号待审核，请联系管理员激活', 403, 403);
    }

    // token_version 校验：如果数据库中的版本号高于 token 中的，说明密码已被修改或管理员强制重登录
    const tokenVersion = decoded.token_version || 0;
    const dbTokenVersion = dbUser.token_version || 0;
    if (dbTokenVersion > tokenVersion) {
      return error(res, '登录凭证已过期，请重新登录', 401, 401);
    }

    // 使用数据库中的最新角色信息，不完全信任 token 内的 role
    const role = dbUser.role || 'dept_staff';
    const cpsRoles = ['cps_admin', 'cps_ops', 'cps_channel_user'];
    const roleLevel = (role === 'admin' || role === 'super_admin') ? 0 : (role === 'dept_manager' || role === 'dept' || role === 'cps_admin') ? 1 : 2;
    req.user = {
      ...decoded,
      role,
      roleLevel,
      dept_id: dbUser.dept_id,
      cps_channel_id: dbUser.cps_channel_id,
      cps_role: dbUser.cps_role,
      name: dbUser.name,
      username: dbUser.username,
      status: dbUser.status,
    };
    next();
  } catch (err) {
    console.error('认证中间件数据库查询失败:', err);
    // 安全修复：DB 查询失败不再降级到 token 数据，返回 503
    // 降级会让被禁用用户的旧 token 继续生效，安全风险过高
    return error(res, '服务暂时不可用，请稍后重试', 503, 503);
  }
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
        if (['project', 'action_item'].includes(resourceType)) {
          scopeWhere[Op.or] = [
            { owner_user_id: userId },
            { owner_id: userId },
            { created_by: userId }
          ];
        }
        if (['risk_register'].includes(resourceType)) {
          scopeWhere[Op.or] = [
            { owner_id: userId },
            { created_by: userId }
          ];
        }
        // 对于只有 owner_name 的表（过渡期），后续迁移到 owner_user_id 后更新
        break;
      default:
        scopeWhere.dept_id = deptId;
      case 'cps_channel': {
        if (!dataScopeValue) {
          return error(res, '当前账号未绑定CPS渠道，禁止访问渠道数据', 403, 403);
        }
        if (['cps', 'cps_metric', 'cps_alert'].includes(resourceType)) {
          scopeWhere.channel_id = dataScopeValue;
        } else {
          scopeWhere.dept_id = deptId;
        }
        break;
      }
    }

    req.dataScope = {
      type: dataScopeType,
      value: dataScopeValue,
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
