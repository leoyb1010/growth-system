const bcrypt = require('bcryptjs');
const { User, Department } = require('../models');
const { success, error } = require('../utils/response');
const { logAudit } = require('../services/auditLogService');

/**
 * 获取用户列表（管理员）
 * GET /api/users
 */
async function getUsers(req, res) {
  try {
    const users = await User.findAll({
      include: [{ model: Department, attributes: ['id', 'name'] }],
      attributes: { exclude: ['password_hash'] },
      order: [['id', 'ASC']]
    });
    success(res, users);
  } catch (err) {
    console.error('获取用户列表失败:', err);
    error(res, '获取用户列表失败', 1, 500);
  }
}

/**
 * 创建用户（管理员）
 * POST /api/users
 */
async function createUser(req, res) {
  try {
    const { username, name, role, dept_id, password } = req.body;

    if (!username || !name || !password) {
      return error(res, '用户名、姓名和密码不能为空');
    }

    const existing = await User.findOne({ where: { username } });
    if (existing) {
      return error(res, '用户名已存在');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      name,
      role: role || 'dept',
      dept_id: dept_id || null,
      password_hash: passwordHash
    });

    const result = await User.findByPk(user.id, {
      include: [{ model: Department, attributes: ['id', 'name'] }],
      attributes: { exclude: ['password_hash'] }
    });

    success(res, result, '用户创建成功');
  } catch (err) {
    console.error('创建用户失败:', err);
    error(res, '创建用户失败', 1, 500);
  }
}

/**
 * 更新用户（管理员）
 * PUT /api/users/:id
 */
async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { name, role, dept_id } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return error(res, '用户不存在');
    }

    await user.update({ name, role, dept_id });

    const result = await User.findByPk(id, {
      include: [{ model: Department, attributes: ['id', 'name'] }],
      attributes: { exclude: ['password_hash'] }
    });

    success(res, result, '用户更新成功');
  } catch (err) {
    console.error('更新用户失败:', err);
    error(res, '更新用户失败', 1, 500);
  }
}

/**
 * 删除用户（管理员）
 * DELETE /api/users/:id
 */
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);

    if (!user) {
      return error(res, '用户不存在');
    }

    if (user.username === 'admin') {
      return error(res, '不能删除管理员账号');
    }

    await user.destroy();
    success(res, null, '用户删除成功');
  } catch (err) {
    console.error('删除用户失败:', err);
    error(res, '删除用户失败', 1, 500);
  }
}

module.exports = { getUsers, createUser, updateUser, deleteUser, resetPassword, enableUser, disableUser };

/**
 * 管理员重置他人密码
 * POST /api/users/:id/reset-password
 * 仅管理员可用，不要求旧密码，设置 must_change_password = true
 */
async function resetPassword(req, res) {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      return error(res, '新密码长度不能少于6位');
    }

    const user = await User.findByPk(id);
    if (!user) {
      return error(res, '用户不存在');
    }

    const newHash = await bcrypt.hash(new_password, 10);
    const oldValues = user.toJSON();
    await user.update({ password_hash: newHash });

    await logAudit('users', user.id, 'update', { id: req.user.id, name: req.user.name }, oldValues, { reset_password: true });

    success(res, null, '密码重置成功');
  } catch (err) {
    console.error('重置密码失败:', err);
    error(res, '重置密码失败', 1, 500);
  }
}

/**
 * 启用用户
 * POST /api/users/:id/enable
 */
async function enableUser(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return error(res, '用户不存在');

    const oldValues = user.toJSON();
    await user.update({ status: 'active' });

    await logAudit('users', user.id, 'update', { id: req.user.id, name: req.user.name }, oldValues, { status: 'active' });

    success(res, null, '用户已启用');
  } catch (err) {
    console.error('启用用户失败:', err);
    error(res, '启用用户失败', 1, 500);
  }
}

/**
 * 禁用用户
 * POST /api/users/:id/disable
 */
async function disableUser(req, res) {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return error(res, '用户不存在');

    if (user.username === 'admin') {
      return error(res, '不能禁用超级管理员账号');
    }

    const oldValues = user.toJSON();
    await user.update({ status: 'disabled' });

    await logAudit('users', user.id, 'update', { id: req.user.id, name: req.user.name }, oldValues, { status: 'disabled' });

    success(res, null, '用户已禁用');
  } catch (err) {
    console.error('禁用用户失败:', err);
    error(res, '禁用用户失败', 1, 500);
  }
}
