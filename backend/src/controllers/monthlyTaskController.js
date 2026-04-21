const { MonthlyTask, Department } = require('../models');
const { success, error } = require('../utils/response');
const { Op } = require('sequelize');
const { logAudit } = require('../services/auditLogService');
const { checkArchived } = require('../services/archiveCheckService');

function getOperator(req) {
  return { id: req.user.id, name: req.user.name || req.user.username };
}

/**
 * 获取月度工作列表
 * GET /api/monthly-tasks?month=2026-04&quarter=Q2
 */
async function getMonthlyTasks(req, res) {
  try {
    const { month, quarter, dept_id, status } = req.query;
    const where = {};

    if (month) where.month = month;
    if (quarter) where.quarter = quarter;
    if (status) where.status = status;
    if (dept_id) where.dept_id = parseInt(dept_id);
    if (req.deptFilter) where.dept_id = req.deptFilter;

    const tasks = await MonthlyTask.findAll({
      where,
      include: [{ model: Department, attributes: ['id', 'name'] }],
      order: [['month', 'DESC'], ['updated_at', 'DESC']]
    });

    success(res, tasks);
  } catch (err) {
    console.error('获取月度工作失败:', err);
    error(res, '获取月度工作失败', 1, 500);
  }
}

/**
 * 创建月度工作
 * POST /api/monthly-tasks
 */
async function createMonthlyTask(req, res) {
  try {
    const data = req.body;

    if (!data.dept_id || !data.month || !data.task) {
      return error(res, '部门、月份和工作事项不能为空');
    }

    if (req.deptFilter && req.deptFilter !== parseInt(data.dept_id)) {
      return error(res, '无权为其他部门创建数据', 403, 403);
    }

    const task = await MonthlyTask.create(data);
    await logAudit('monthly_tasks', task.id, 'create', getOperator(req), null, task.toJSON());
    success(res, task, '月度工作创建成功');
  } catch (err) {
    console.error('创建月度工作失败:', err);
    error(res, '创建月度工作失败', 1, 500);
  }
}

/**
 * 更新月度工作
 * PUT /api/monthly-tasks/:id
 */
async function updateMonthlyTask(req, res) {
  try {
    const { id } = req.params;
    const task = await MonthlyTask.findByPk(id);

    if (!task) {
      return error(res, '月度工作不存在');
    }

    if (req.deptFilter && req.deptFilter !== task.dept_id) {
      return error(res, '无权修改其他部门数据', 403, 403);
    }

    const isBlocked = await checkArchived('monthly_tasks', task.quarter, new Date().getFullYear(), error, res);
    if (isBlocked) return;

    const oldValues = task.toJSON();
    await task.update(req.body);
    await logAudit('monthly_tasks', task.id, 'update', getOperator(req), oldValues, task.toJSON());
    success(res, task, '月度工作更新成功');
  } catch (err) {
    console.error('更新月度工作失败:', err);
    error(res, '更新月度工作失败', 1, 500);
  }
}

/**
 * 删除月度工作
 * DELETE /api/monthly-tasks/:id
 */
async function deleteMonthlyTask(req, res) {
  try {
    const { id } = req.params;
    const task = await MonthlyTask.findByPk(id);

    if (!task) {
      return error(res, '月度工作不存在');
    }

    if (req.deptFilter && req.deptFilter !== task.dept_id) {
      return error(res, '无权删除其他部门数据', 403, 403);
    }

    const isBlocked = await checkArchived('monthly_tasks', task.quarter, new Date().getFullYear(), error, res);
    if (isBlocked) return;

    const oldValues = task.toJSON();
    await task.destroy();
    await logAudit('monthly_tasks', id, 'delete', getOperator(req), oldValues, null);
    success(res, null, '月度工作删除成功');
  } catch (err) {
    console.error('删除月度工作失败:', err);
    error(res, '删除月度工作失败', 1, 500);
  }
}

module.exports = { getMonthlyTasks, createMonthlyTask, updateMonthlyTask, deleteMonthlyTask };
