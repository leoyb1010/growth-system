const bcrypt = require('bcryptjs');
const { User, Department } = require('../models');
const { generateToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');
const { logAudit } = require('../services/auditLogService');

/**
 * 用户登录
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return error(res, '用户名和密码不能为空');
    }

    const user = await User.findOne({
      where: { username },
      include: [{ model: Department, attributes: ['id', 'name'] }]
    });

    if (!user) {
      return error(res, '用户名或密码错误', 1, 401);
    }

    // V4: 检查账号状态
    if (user.status === 'disabled') {
      return error(res, '账号已被禁用，请联系管理员', 1, 403);
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return error(res, '用户名或密码错误', 1, 401);
    }

    // V4: 更新最后登录时间
    await user.update({ last_login_at: new Date() });

    // 计算角色层级
    const roleLevel = user.role === 'admin' ? 0 : (user.role === 'dept_manager' || user.role === 'dept') ? 1 : 2;

    const token = generateToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      dept_id: user.dept_id,
      roleLevel
    });

    success(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        roleLevel,
        dept_id: user.dept_id,
        department: user.Department
      }
    }, '登录成功');
  } catch (err) {
    console.error('登录失败:', err);
    error(res, '登录失败，请稍后重试', 1, 500);
  }
}

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
async function getCurrentUser(req, res) {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Department, attributes: ['id', 'name'] }],
      attributes: { exclude: ['password_hash'] }
    });
    if (!user) {
      return error(res, '用户不存在', 1, 404);
    }
    // 注入 roleLevel
    const roleLevel = user.role === 'admin' ? 0 : (user.role === 'dept_manager' || user.role === 'dept') ? 1 : 2;
    const userData = user.toJSON();
    userData.roleLevel = roleLevel;
    success(res, userData);
  } catch (err) {
    error(res, '获取用户信息失败', 1, 500);
  }
}

/**
 * 修改密码（仅限当前登录用户修改自己密码）
 * POST /api/auth/change-password
 * 必须提供 old_password + new_password
 */
async function changePassword(req, res) {
  try {
    const { old_password, new_password } = req.body;
    const currentUser = req.user;

    if (!new_password || new_password.length < 6) {
      return error(res, '新密码长度不能少于6位');
    }

    if (!old_password) {
      return error(res, '请提供旧密码');
    }

    const user = await User.findByPk(currentUser.id);
    if (!user) {
      return error(res, '用户不存在');
    }

    const isValid = await bcrypt.compare(old_password, user.password_hash);
    if (!isValid) {
      return error(res, '旧密码错误');
    }

    const newHash = await bcrypt.hash(new_password, 10);
    const oldValues = user.toJSON();
    await user.update({ password_hash: newHash });
    await logAudit('users', user.id, 'update', { id: currentUser.id, name: currentUser.name || currentUser.username }, oldValues, { change_password: true });

    success(res, null, '密码修改成功');
  } catch (err) {
    console.error('修改密码失败:', err);
    error(res, '修改密码失败', 1, 500);
  }
}

/**
 * 用户注册（公开，默认普通成员角色）
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    const { username, name, password } = req.body;

    if (!username || !name || !password) {
      return error(res, '用户名、姓名和密码不能为空');
    }
    if (password.length < 6) {
      return error(res, '密码长度不能少于6位');
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return error(res, '用户名已存在');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      name,
      role: 'dept_staff',   // 注册账号默认普通成员
      password_hash: passwordHash,
      status: 'active',
      must_change_password: false,
    });

    // 注册成功后自动登录
    const roleLevel = 2;
    const token = generateToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      dept_id: user.dept_id,
      roleLevel
    });

    await logAudit('users', user.id, 'create', { id: user.id, name: user.name, system: true }, null, { username: user.username, role: user.role, register: true });

    success(res, {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        roleLevel,
        dept_id: user.dept_id,
      }
    }, '注册成功');
  } catch (err) {
    console.error('注册失败:', err);
    error(res, '注册失败，请稍后重试', 1, 500);
  }
}

module.exports = { login, getCurrentUser, changePassword, register };
