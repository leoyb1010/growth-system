const bcrypt = require('bcryptjs');
const { User, Department } = require('../models');
const { success, error } = require('../utils/response');

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

module.exports = { getUsers, createUser, updateUser, deleteUser };
