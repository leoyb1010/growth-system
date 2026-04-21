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

  req.user = decoded;
  next();
}

/**
 * 管理员权限校验中间件
 */
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return error(res, '需要管理员权限', 403, 403);
  }
  next();
}

/**
 * 部门权限校验中间件
 * 部门账号只能访问本部门数据
 */
function requireDeptAccess(req, res, next) {
  const user = req.user;
  
  // 管理员可以访问所有部门
  if (user.role === 'admin') {
    req.deptFilter = null; // null 表示不过滤
    return next();
  }

  // 部门账号只能访问本部门
  if (user.role === 'dept' && user.dept_id) {
    req.deptFilter = user.dept_id;
    return next();
  }

  return error(res, '无权访问该部门数据', 403, 403);
}

module.exports = { authenticate, requireAdmin, requireDeptAccess };
