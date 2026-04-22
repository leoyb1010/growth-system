const bcrypt = require('bcryptjs');
const { User, Department } = require('../models');
const { generateToken } = require('../utils/jwt');
const { success, error } = require('../utils/response');

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

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return error(res, '用户名或密码错误', 1, 401);
    }

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
 * 修改密码（管理员可修改任意用户，部门账号只能修改自己）
 * POST /api/auth/change-password
 */
async function changePassword(req, res) {
  try {
    const { user_id, old_password, new_password } = req.body;
    const currentUser = req.user;

    if (!new_password || new_password.length < 6) {
      return error(res, '新密码长度不能少于6位');
    }

    const targetUserId = (currentUser.role === 'admin' && user_id) ? user_id : currentUser.id;
    const user = await User.findByPk(targetUserId);

    if (!user) {
      return error(res, '用户不存在');
    }

    // 非管理员修改自己密码需要验证旧密码
    if (currentUser.role !== 'admin' || targetUserId === currentUser.id) {
      if (!old_password) {
        return error(res, '请提供旧密码');
      }
      const isValid = await bcrypt.compare(old_password, user.password_hash);
      if (!isValid) {
        return error(res, '旧密码错误');
      }
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await user.update({ password_hash: newHash });

    success(res, null, '密码修改成功');
  } catch (err) {
    console.error('修改密码失败:', err);
    error(res, '修改密码失败', 1, 500);
  }
}

module.exports = { login, getCurrentUser, changePassword };
