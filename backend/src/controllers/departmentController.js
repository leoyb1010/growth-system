const { Department, User, sequelize } = require('../models');
const { error, success } = require('../utils/response');

/**
 * 获取部门列表
 * GET /api/departments
 */
async function getDepartments(req, res) {
  try {
    const departments = await Department.findAll({
      where: { status: 'active' },
      order: [['id', 'ASC']],
      include: [{
        model: User,
        attributes: ['id', 'name', 'role'],
        where: { role: { [require('sequelize').Op.in]: ['dept', 'dept_manager'] } },
        required: false
      }]
    });

    // 附加用户数量
    const deptUserCounts = await User.findAll({
      attributes: ['dept_id', [sequelize.fn('COUNT', sequelize.col('id')), 'user_count']],
      where: { dept_id: { [require('sequelize').Op.ne]: null } },
      group: ['dept_id'],
      raw: true
    });
    const userCountMap = {};
    deptUserCounts.forEach(r => { userCountMap[r.dept_id] = r.user_count; });

    const result = departments.map(d => ({
      ...d.toJSON(),
      user_count: userCountMap[d.id] || 0
    }));

    return success(res, result);
  } catch (err) {
    console.error('获取部门列表失败:', err);
    return error(res, '获取部门列表失败', 500, 500);
  }
}

/**
 * 创建部门
 * POST /api/departments
 * Body: { name: string }
 */
async function createDepartment(req, res) {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return error(res, '部门名称不能为空', 400, 400);
    }

    // 检查重名
    const existing = await Department.findOne({ where: { name: name.trim() } });
    if (existing) {
      return error(res, '部门名称已存在', 409, 409);
    }

    const department = await Department.create({ name: name.trim() });
    return success(res, department, '部门创建成功');
  } catch (err) {
    console.error('创建部门失败:', err);
    return error(res, '创建部门失败', 500, 500);
  }
}

/**
 * 更新部门
 * PUT /api/departments/:id
 * Body: { name: string }
 */
async function updateDepartment(req, res) {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return error(res, '部门名称不能为空', 400, 400);
    }

    const department = await Department.findByPk(id);
    if (!department) {
      return error(res, '部门不存在', 404, 404);
    }

    // 检查重名（排除自身）
    const existing = await Department.findOne({
      where: {
        name: name.trim(),
        id: { [require('sequelize').Op.ne]: id }
      }
    });
    if (existing) {
      return error(res, '部门名称已存在', 409, 409);
    }

    await department.update({ name: name.trim() });
    return success(res, department, '部门更新成功');
  } catch (err) {
    console.error('更新部门失败:', err);
    return error(res, '更新部门失败', 500, 500);
  }
}

/**
 * 删除部门
 * DELETE /api/departments/:id
 * 安全检查：有关联用户或业务数据时不允许删除
 */
async function deleteDepartment(req, res) {
  try {
    const { id } = req.params;

    const department = await Department.findByPk(id);
    if (!department) {
      return error(res, '部门不存在', 404, 404);
    }

    // 检查关联用户
    const userCount = await User.count({ where: { dept_id: id } });
    if (userCount > 0) {
      return error(res, `该部门下有 ${userCount} 个用户，无法删除。请先转移用户`, 400, 400);
    }

    // 检查关联业务数据
    const { Kpi, Project, Performance, MonthlyTask, Achievement } = require('../models');
    const [kpiCount, projectCount, perfCount, taskCount, achCount] = await Promise.all([
      Kpi.count({ where: { dept_id: id } }),
      Project.count({ where: { dept_id: id } }),
      Performance.count({ where: { dept_id: id } }),
      MonthlyTask.count({ where: { dept_id: id } }),
      Achievement.count({ where: { dept_id: id } }),
    ]);
    const totalBiz = kpiCount + projectCount + perfCount + taskCount + achCount;
    if (totalBiz > 0) {
      return error(res, `该部门下有 ${totalBiz} 条业务数据（指标${kpiCount}/项目${projectCount}/业绩${perfCount}/月度${taskCount}/成果${achCount}），无法删除`, 400, 400);
    }

    // 软删除：标记为 deleted 而非物理删除
    await department.update({ status: 'deleted' });
    return success(res, null, '部门删除成功');
  } catch (err) {
    console.error('删除部门失败:', err);
    return error(res, '删除部门失败', 500, 500);
  }
}

module.exports = {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment
};
