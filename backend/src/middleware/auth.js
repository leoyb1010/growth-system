const { verifyToken } = require('../utils/jwt');
const { error } = require('../utils/response');

/**
 * JWT 认证中间件
 * 从请求头中提取 Token 并验证
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

  // 角色层级注入（兼容旧 dept 角色）
  const role = decoded.role || 'dept_staff';
  const roleLevel = role === 'admin' ? 0 : (role === 'dept_manager' || role === 'dept') ? 1 : 2;
  req.user = { ...decoded, role, roleLevel };
  next();
}

/**
 * 管理员权限校验中间件
 */
function requireAdmin(req, res, next) {
  if (req.user.roleLevel !== 0) {
    return error(res, '需要管理员权限', 403, 403);
  }
  next();
}

/**
 * 部门权限校验中间件
 * admin: 全部门
 * dept_manager / dept(兼容): 本部门
 * dept_staff: 本部门（controller 进一步限制只看自己的数据）
 */
function requireDeptAccess(req, res, next) {
  const user = req.user;
  
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
 * 部门负责人权限校验中间件
 * admin / dept_manager / dept(兼容) 可通过
 */
function requireDeptManager(req, res, next) {
  if (req.user.roleLevel <= 1) {
    return next();
  }
  return error(res, '需要部门负责人权限', 403, 403);
}

module.exports = { authenticate, requireAdmin, requireDeptAccess, requireDeptManager };
