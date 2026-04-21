const { Project, Department } = require('../models');
const { success, error } = require('../utils/response');
const { Op } = require('sequelize');
const moment = require('moment');
const { logAudit } = require('../services/auditLogService');
const { checkArchived } = require('../services/archiveCheckService');

function getOperator(req) {
  return { id: req.user.id, name: req.user.name || req.user.username };
}

/**
 * 获取重点工作列表
 * GET /api/projects?quarter=Q1&status=进行中&dept_id=1
 */
async function getProjects(req, res) {
  try {
    const { quarter, status, dept_id, search, sort } = req.query;
    const where = {};

    if (quarter) where.quarter = quarter;
    if (status) where.status = status;
    if (dept_id) where.dept_id = parseInt(dept_id);
    if (req.deptFilter) where.dept_id = req.deptFilter;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { owner_name: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const order = sort === 'priority'
      ? [['status', 'ASC'], ['progress_pct', 'ASC'], ['updated_at', 'DESC']]
      : [['updated_at', 'DESC']];

    const projects = await Project.findAll({
      where,
      include: [{ model: Department, attributes: ['id', 'name'] }],
      order
    });

    // 添加预警标记
    const result = projects.map(p => {
      const data = p.toJSON();
      // 严重预警：进度 < 60% 且非完成状态
      data.severe_warning = data.progress_pct < 60 && data.status !== '完成';
      // 风险标记
      data.is_risk = data.status === '风险';
      // 即将到期（7天内）
      if (data.due_date) {
        const daysUntil = moment(data.due_date).diff(moment(), 'days');
        data.is_due_soon = daysUntil >= 0 && daysUntil <= 7;
        data.days_until_due = daysUntil;
      }
      return data;
    });

    // 管理优先级排序：风险 > 临期 > 低进度 > 其他
    if (sort === 'priority') {
      result.sort((a, b) => {
        const getPriority = (p) => {
          if (p.is_risk) return 0;
          if (p.is_due_soon) return 1;
          if (p.severe_warning) return 2;
          return 3;
        };
        return getPriority(a) - getPriority(b);
      });
    }

    success(res, result);
  } catch (err) {
    console.error('获取项目列表失败:', err);
    error(res, '获取项目列表失败', 1, 500);
  }
}

/**
 * 创建重点工作
 * POST /api/projects
 */
async function createProject(req, res) {
  try {
    const data = req.body;

    if (!data.dept_id || !data.name || !data.quarter) {
      return error(res, '部门、项目名称和季度不能为空');
    }

    if (req.deptFilter && req.deptFilter !== parseInt(data.dept_id)) {
      return error(res, '无权为其他部门创建数据', 403, 403);
    }

    const project = await Project.create(data);
    await logAudit('projects', project.id, 'create', getOperator(req), null, project.toJSON());
    success(res, project, '项目创建成功');
  } catch (err) {
    console.error('创建项目失败:', err);
    error(res, '创建项目失败', 1, 500);
  }
}

/**
 * 更新重点工作
 * PUT /api/projects/:id
 */
async function updateProject(req, res) {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);

    if (!project) {
      return error(res, '项目不存在');
    }

    if (req.deptFilter && req.deptFilter !== project.dept_id) {
      return error(res, '无权修改其他部门数据', 403, 403);
    }

    const isBlocked = await checkArchived('projects', project.quarter, new Date().getFullYear(), error, res);
    if (isBlocked) return;

    const oldValues = project.toJSON();
    await project.update(req.body);
    await logAudit('projects', project.id, 'update', getOperator(req), oldValues, project.toJSON());
    success(res, project, '项目更新成功');
  } catch (err) {
    console.error('更新项目失败:', err);
    error(res, '更新项目失败', 1, 500);
  }
}

/**
 * 删除重点工作
 * DELETE /api/projects/:id
 */
async function deleteProject(req, res) {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);

    if (!project) {
      return error(res, '项目不存在');
    }

    if (req.deptFilter && req.deptFilter !== project.dept_id) {
      return error(res, '无权删除其他部门数据', 403, 403);
    }

    const isBlocked = await checkArchived('projects', project.quarter, new Date().getFullYear(), error, res);
    if (isBlocked) return;

    const oldValues = project.toJSON();
    await project.destroy();
    await logAudit('projects', id, 'delete', getOperator(req), oldValues, null);
    success(res, null, '项目删除成功');
  } catch (err) {
    console.error('删除项目失败:', err);
    error(res, '删除项目失败', 1, 500);
  }
}

/**
 * 获取仪表盘项目统计
 * GET /api/projects/dashboard
 */
async function getProjectStats(req, res) {
  try {
    const { quarter } = req.query;
    const where = quarter ? { quarter } : {};
    if (req.deptFilter) where.dept_id = req.deptFilter;

    const projects = await Project.findAll({ where });

    const stats = {
      total: projects.length,
      not_started: projects.filter(p => p.status === '未启动').length,
      in_progress: projects.filter(p => p.status === '进行中').length,
      risk: projects.filter(p => p.status === '风险').length,
      completed: projects.filter(p => p.status === '完成').length,
      risk_list: projects
        .filter(p => p.status === '风险')
        .map(p => ({ id: p.id, name: p.name, owner_name: p.owner_name, risk_desc: p.risk_desc })),
      due_soon: projects
        .filter(p => {
          if (!p.due_date) return false;
          const days = moment(p.due_date).diff(moment(), 'days');
          return days >= 0 && days <= 7 && p.status !== '完成';
        })
        .map(p => ({
          id: p.id,
          name: p.name,
          owner_name: p.owner_name,
          due_date: p.due_date,
          days_until: moment(p.due_date).diff(moment(), 'days')
        }))
        .sort((a, b) => a.days_until - b.days_until)
    };

    success(res, stats);
  } catch (err) {
    console.error('获取项目统计失败:', err);
    error(res, '获取项目统计失败', 1, 500);
  }
}

/**
 * 获取超N天未更新的项目
 * GET /api/projects/stale?days=3
 */
async function getStaleProjects(req, res) {
  try {
    const days = parseInt(req.query.days) || 3;
    const staleDate = moment().subtract(days, 'days').toDate();
    const where = {
      updated_at: { [Op.lt]: staleDate },
      status: { [Op.ne]: '完成' }
    };
    if (req.deptFilter) where.dept_id = req.deptFilter;

    const projects = await Project.findAll({
      where,
      include: [{ model: Department, attributes: ['name'] }],
      order: [['updated_at', 'ASC']]
    });

    success(res, projects.map(p => ({
      ...p.toJSON(),
      days_since_update: moment().diff(moment(p.updated_at), 'days')
    })));
  } catch (err) {
    console.error('获取待更新项目失败:', err);
    error(res, '获取待更新项目失败', 1, 500);
  }
}

/**
 * 快速更新项目（仅更新进度/状态/进展）
 * PUT /api/projects/:id/quick-update
 */
async function quickUpdateProject(req, res) {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);

    if (!project) {
      return error(res, '项目不存在');
    }

    if (req.deptFilter && req.deptFilter !== project.dept_id) {
      return error(res, '无权修改其他部门数据', 403, 403);
    }

    const isBlocked = await checkArchived('projects', project.quarter, new Date().getFullYear(), error, res);
    if (isBlocked) return;

    const allowedFields = ['progress_pct', 'status', 'weekly_progress', 'risk_desc'];
    const updateData = {};
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    });

    const oldValues = project.toJSON();
    await project.update(updateData);
    await logAudit('projects', project.id, 'update', getOperator(req), oldValues, project.toJSON());
    success(res, project, '快速更新成功');
  } catch (err) {
    console.error('快速更新项目失败:', err);
    error(res, '快速更新项目失败', 1, 500);
  }
}

module.exports = { getProjects, createProject, updateProject, deleteProject, getProjectStats, getStaleProjects, quickUpdateProject };
