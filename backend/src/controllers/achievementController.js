const { Achievement, Department, sequelize } = require('../models');
const { success, error } = require('../utils/response');
const { Op } = require('sequelize');
const { logAudit } = require('../services/auditLogService');
const { checkArchived } = require('../services/archiveCheckService');

function getOperator(req) {
  return { id: req.user.id, name: req.user.name || req.user.username };
}

/**
 * 获取季度成果列表
 * GET /api/achievements?quarter=Q1&priority=高&owner_name=张三
 */
async function getAchievements(req, res) {
  try {
    const { quarter, priority, owner_name, dept_id, include_next_quarter } = req.query;
    const where = {};

    if (quarter) where.quarter = quarter;
    if (priority) where.priority = priority;
    if (owner_name) where.owner_name = { [Op.like]: `%${owner_name}%` };
    if (dept_id) where.dept_id = parseInt(dept_id);
    if (include_next_quarter !== undefined) where.include_next_quarter = include_next_quarter === 'true';
    if (req.deptFilter) where.dept_id = req.deptFilter;

    // self 范围：department_member 只能看自己负责或创建的
    if (req.dataScope && req.dataScope.type === 'self') {
      const userId = req.dataScope.userId;
      const userName = req.user?.name || req.user?.username;
      where[Op.or] = [
        { creator_id: userId },
        { owner_name: userName }
      ];
    }

    const achievements = await Achievement.findAll({
      where,
      include: [{ model: Department, attributes: ['id', 'name'] }],
      order: [
        ['quarter', 'DESC'],
        [sequelize.literal("CASE priority WHEN '高' THEN 1 WHEN '中' THEN 2 ELSE 3 END"), 'ASC'],
        ['updated_at', 'DESC']
      ]
    });

    success(res, achievements);
  } catch (err) {
    console.error('获取成果列表失败:', err);
    error(res, '获取成果列表失败', 1, 500);
  }
}

/**
 * 创建季度成果
 * POST /api/achievements
 */
async function createAchievement(req, res) {
  try {
    const data = req.body;

    if (!data.dept_id || !data.quarter || !data.project_name) {
      return error(res, '部门、季度和项目名称不能为空');
    }

    if (req.deptFilter && req.deptFilter !== parseInt(data.dept_id)) {
      return error(res, '无权为其他部门创建数据', 403, 403);
    }

    // 字段白名单
    const allowedFields = ['dept_id', 'project_id', 'quarter', 'owner_name', 'achievement_type', 'project_name', 'description', 'quantified_result', 'business_value', 'reusable_content', 'include_next_quarter', 'archive_owner', 'completed_at', 'priority'];
    const payload = {};
    allowedFields.forEach(f => { if (data[f] !== undefined) payload[f] = data[f]; });
    payload.creator_id = req.user?.id || null;
    payload.updater_id = req.user?.id || null;

    const achievement = await Achievement.create(payload);
    await logAudit('achievements', achievement.id, 'create', getOperator(req), null, achievement.toJSON());
    success(res, achievement, '成果创建成功');
  } catch (err) {
    console.error('创建成果失败:', err);
    error(res, '创建成果失败', 1, 500);
  }
}

/**
 * 更新季度成果
 * PUT /api/achievements/:id
 */
async function updateAchievement(req, res) {
  try {
    const { id } = req.params;
    const achievement = await Achievement.findByPk(id);

    if (!achievement) {
      return error(res, '成果不存在');
    }

    if (req.deptFilter && req.deptFilter !== achievement.dept_id) {
      return error(res, '无权修改其他部门数据', 403, 403);
    }

    const isBlocked = await checkArchived('achievements', achievement.quarter, new Date().getFullYear(), error, res);
    if (isBlocked) return;

    // 字段白名单
    const allowedFields = ['dept_id', 'project_id', 'quarter', 'owner_name', 'achievement_type', 'project_name', 'description', 'quantified_result', 'business_value', 'reusable_content', 'include_next_quarter', 'archive_owner', 'completed_at', 'priority'];
    const updateData = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });
    updateData.updater_id = req.user?.id || null;

    const oldValues = achievement.toJSON();
    await achievement.update(updateData);
    await logAudit('achievements', achievement.id, 'update', getOperator(req), oldValues, achievement.toJSON());
    success(res, achievement, '成果更新成功');
  } catch (err) {
    console.error('更新成果失败:', err);
    error(res, '更新成果失败', 1, 500);
  }
}

/**
 * 删除季度成果
 * DELETE /api/achievements/:id
 */
async function deleteAchievement(req, res) {
  try {
    const { id } = req.params;
    const achievement = await Achievement.findByPk(id);

    if (!achievement) {
      return error(res, '成果不存在');
    }

    if (req.deptFilter && req.deptFilter !== achievement.dept_id) {
      return error(res, '无权删除其他部门数据', 403, 403);
    }

    const isBlocked = await checkArchived('achievements', achievement.quarter, new Date().getFullYear(), error, res);
    if (isBlocked) return;

    const oldValues = achievement.toJSON();
    await achievement.destroy();
    await logAudit('achievements', id, 'delete', getOperator(req), oldValues, null);
    success(res, null, '成果删除成功');
  } catch (err) {
    console.error('删除成果失败:', err);
    error(res, '删除成果失败', 1, 500);
  }
}

module.exports = { getAchievements, createAchievement, updateAchievement, deleteAchievement };
