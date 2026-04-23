const { Project, Department, ProjectUpdateLog, MonthlyTask } = require('../models');
const { success, error } = require('../utils/response');
const { Op } = require('sequelize');
const moment = require('moment');
const { logAudit } = require('../services/auditLogService');
const { checkArchived } = require('../services/archiveCheckService');
const { getQuarterTimeProgress, getProgressStatus } = require('../utils/timeProgress');

function getOperator(req) {
  return { id: req.user.id, name: req.user.name || req.user.username };
}

/**
 * 按角色追加项目查询过滤条件
 * admin: 无额外限制
 * dept_manager: 本部门
 * dept_staff: 本部门 + 自己负责/创建的项目
 */
function applyProjectRoleFilter(where, req) {
  const { roleLevel, id, name } = req.user;
  if (roleLevel === 0) return where; // admin
  if (roleLevel === 1) {
    // dept_manager: 已由 requireDeptAccess 限制 dept_id
    return where;
  }
  // dept_staff: 只能看自己负责或创建的项目
  // V4: 优先用 owner_user_id，过渡期兼容 owner_name
  const orConditions = [
    { owner_user_id: id },
    { creator_id: id },
  ];
  if (name) orConditions.push({ owner_name: name }); // name 存在时才追加过渡兼容条件
  where[Op.or] = orConditions;
  return where;
}

/**
 * 校验项目操作权限
 * admin: 任意
 * dept_manager: 本部门任意
 * dept_staff: 只能操作自己负责/创建的项目
 */
function canModifyProject(project, req) {
  const { roleLevel, id, name, dept_id } = req.user;
  if (roleLevel === 0) return true;
  if (roleLevel === 1) return project.dept_id === dept_id;
  // V4: 优先用 owner_user_id，过渡期兼容 owner_name
  return project.owner_user_id === id || project.creator_id === id || project.owner_name === name;
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
        { name: { [Op.like]: `%${search}%` } },
        { owner_name: { [Op.like]: `%${search}%` } }
      ];
    }

    // 按角色过滤
    applyProjectRoleFilter(where, req);

    const order = sort === 'priority'
      ? [['status', 'ASC'], ['progress_pct', 'ASC'], ['updated_at', 'DESC']]
      : [['updated_at', 'DESC']];

    const projects = await Project.findAll({
      where,
      include: [{ model: Department, attributes: ['id', 'name'] }],
      order
    });

    // 添加预警标记
    // 计算当前季度时间进度
    const nowForTP = new Date();
    const monthForTP = nowForTP.getMonth() + 1;
    const currentQuarterForTP = monthForTP <= 3 ? 'Q1' : monthForTP <= 6 ? 'Q2' : monthForTP <= 9 ? 'Q3' : 'Q4';
    const quarterTimeProgress = getQuarterTimeProgress(currentQuarterForTP, nowForTP.getFullYear());

    const result = projects.map(p => {
      const data = p.toJSON();
      // 严重预警：完成率落后于时间进度 且非完成状态
      const progressStatus = getProgressStatus(data.progress_pct, quarterTimeProgress);
      data.severe_warning = progressStatus === 'behind' && data.status !== '完成';
      data.progress_status = data.status === '完成' ? 'ahead' : progressStatus;
      // 风险标记
      data.is_risk = data.status === '风险';
      // 即将到期（7天内）
      if (data.due_date) {
        const daysUntil = moment(data.due_date).diff(moment(), 'days');
        data.is_due_soon = daysUntil >= 0 && daysUntil <= 7;
        data.days_until_due = daysUntil;
      }
      data.time_progress = quarterTimeProgress;
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

    // dept_staff 不能创建项目
    if (req.user.roleLevel === 2) {
      return error(res, '无权创建项目', 403, 403);
    }

    // 字段白名单
    const allowedFields = ['dept_id', 'type', 'name', 'owner_name', 'owner_user_id', 'goal', 'weekly_progress', 'next_week_focus', 'progress_pct', 'status', 'risk_desc', 'due_date', 'quarter', 'year', 'priority', 'next_action', 'action_owner_user_id', 'action_due_date', 'decision_needed', 'decision_owner_user_id', 'block_reason'];
    const payload = {};
    allowedFields.forEach(f => { if (data[f] !== undefined) payload[f] = data[f]; });

    payload.creator_id = req.user?.id || null;
    payload.updater_id = req.user?.id || null;

    const project = await Project.create(payload);
    await logAudit('projects', project.id, 'create', getOperator(req), null, project.toJSON());

    // 同步选项：同步到月度任务
    if (data.sync_to_monthly && payload.weekly_progress) {
      const currentMonth = moment().format('YYYY-MM');
      const monthlyTask = await MonthlyTask.findOne({
        where: { project_id: project.id, month: currentMonth },
        order: [['created_at', 'DESC']]
      });
      if (monthlyTask) {
        const syncContent = payload.weekly_progress.replace(/\[\d{2}\/\d{2}\]\s*/g, '').trim();
        const existing = monthlyTask.actual_result || '';
        const newResult = existing
          ? `${existing}\n[同步${moment().format('M/D')}] ${syncContent}`
          : `[同步${moment().format('M/D')}] ${syncContent}`;
        await monthlyTask.update({ actual_result: newResult, updater_id: req.user?.id || null });
      }
    }

    // 同步选项：同步到季度成果
    if (data.sync_to_achievement && payload.weekly_progress) {
      const Achievement = require('../models').Achievement;
      const achievements = await Achievement.findAll({
        where: { project_id: project.id, quarter: project.quarter },
        order: [['created_at', 'DESC']]
      });
      if (achievements.length > 0) {
        const syncContent = payload.weekly_progress.replace(/\[\d{2}\/\d{2}\]\s*/g, '').trim();
        const achievement = achievements[0];
        const existing = achievement.description || '';
        const newDesc = existing
          ? `${existing}\n[同步${moment().format('M/D')}] ${syncContent}`
          : `[同步${moment().format('M/D')}] ${syncContent}`;
        await achievement.update({ description: newDesc, updater_id: req.user?.id || null });
      }
    }

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

    if (!canModifyProject(project, req)) {
      return error(res, '无权修改此项目', 403, 403);
    }

    const isBlocked = await checkArchived('projects', project.quarter, new Date().getFullYear(), error, res);
    if (isBlocked) return;

    // 字段白名单，禁止任意字段直传
    const allowedFields = ['dept_id', 'type', 'name', 'owner_name', 'owner_user_id', 'goal', 'weekly_progress', 'next_week_focus', 'progress_pct', 'status', 'risk_desc', 'due_date', 'quarter', 'year', 'priority', 'next_action', 'action_owner_user_id', 'action_due_date', 'decision_needed', 'decision_owner_user_id', 'block_reason'];
    const updateData = {};
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    });
    updateData.updater_id = req.user?.id || null;

    const oldValues = project.toJSON();
    await project.update(updateData);
    await logAudit('projects', project.id, 'update', getOperator(req), oldValues, project.toJSON());

    // 同步选项：同步到月度任务
    if (req.body.sync_to_monthly && updateData.weekly_progress) {
      const currentMonth = moment().format('YYYY-MM');
      const monthlyTask = await MonthlyTask.findOne({
        where: { project_id: project.id, month: currentMonth },
        order: [['created_at', 'DESC']]
      });
      if (monthlyTask) {
        const syncContent = updateData.weekly_progress.replace(/\[\d{2}\/\d{2}\]\s*/g, '').trim();
        const existing = monthlyTask.actual_result || '';
        const newResult = existing
          ? `${existing}\n[同步${moment().format('M/D')}] ${syncContent}`
          : `[同步${moment().format('M/D')}] ${syncContent}`;
        await monthlyTask.update({ actual_result: newResult, updater_id: req.user?.id || null });
      }
    }

    // 同步选项：同步到季度成果
    if (req.body.sync_to_achievement && updateData.weekly_progress) {
      const Achievement = require('../models').Achievement;
      const achievements = await Achievement.findAll({
        where: { project_id: project.id, quarter: project.quarter },
        order: [['created_at', 'DESC']]
      });
      if (achievements.length > 0) {
        const syncContent = updateData.weekly_progress.replace(/\[\d{2}\/\d{2}\]\s*/g, '').trim();
        const achievement = achievements[0];
        const existing = achievement.description || '';
        const newDesc = existing
          ? `${existing}\n[同步${moment().format('M/D')}] ${syncContent}`
          : `[同步${moment().format('M/D')}] ${syncContent}`;
        await achievement.update({ description: newDesc, updater_id: req.user?.id || null });
      }
    }

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

    // dept_staff 不能删除项目；dept_manager 只能删本部门
    if (req.user.roleLevel === 2) {
      return error(res, '无权删除项目', 403, 403);
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
    applyProjectRoleFilter(where, req);

    const projects = await Project.findAll({ where });

    const stats = {
      total: projects.length,
      not_started: projects.filter(p => p.status === '未启动').length,
      in_progress: projects.filter(p => p.status === '进行中').length,
      cooperating: projects.filter(p => p.status === '合作中').length,
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
    applyProjectRoleFilter(where, req);

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

    if (!canModifyProject(project, req)) {
      return error(res, '无权更新此项目', 403, 403);
    }

    const isBlocked = await checkArchived('projects', project.quarter, new Date().getFullYear(), error, res);
    if (isBlocked) return;

    const allowedFields = ['progress_pct', 'status', 'weekly_progress', 'next_week_focus', 'risk_desc', 'next_action', 'block_reason'];
    const updateData = {};
    allowedFields.forEach(f => {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    });

    // weekly_progress 追加模式：同一天的内容追加而非覆盖
    if (updateData.weekly_progress) {
      const today = moment().format('MM/DD');
      const existing = project.weekly_progress || '';
      // 检查是否已包含今天的标记
      if (existing.includes(`[${today}]`)) {
        // 今天已有记录，替换今天的内容
        const regex = new RegExp(`\\[${today}\\][\\s\\S]*?(?=\\[\\d{2}/\\d{2}\\]|$)`, 'g');
        updateData.weekly_progress = existing.replace(regex, `[${today}] ${updateData.weekly_progress}`);
      } else {
        // 今天新记录，追加到前面
        updateData.weekly_progress = `[${today}] ${updateData.weekly_progress}\n${existing}`;
      }
    }

    updateData.updater_id = req.user?.id || null;

    const oldValues = project.toJSON();
    await project.update(updateData);

    // 写入项目每日更新日志（内容更新，非操作审计）
    await ProjectUpdateLog.create({
      project_id: project.id,
      update_date: moment().format('YYYY-MM-DD'),
      progress_content: updateData.weekly_progress || oldValues.weekly_progress || '',
      status: updateData.status || oldValues.status,
      progress_pct: updateData.progress_pct !== undefined ? updateData.progress_pct : oldValues.progress_pct,
      risk_desc: updateData.risk_desc || oldValues.risk_desc || '',
      next_action: updateData.next_action || '',
      created_by: req.user?.id || null,
    });

    await logAudit('projects', project.id, 'update', getOperator(req), oldValues, project.toJSON());

    // [6] 同步选项：将进展同步到月度任务
    if (req.body.sync_to_monthly && updateData.weekly_progress) {
      const currentMonth = moment().format('YYYY-MM');
      const monthlyTask = await MonthlyTask.findOne({
        where: {
          project_id: project.id,
          month: currentMonth,
        },
        order: [['created_at', 'DESC']]
      });
      if (monthlyTask) {
        const syncContent = updateData.weekly_progress.replace(/\[\d{2}\/\d{2}\]\s*/g, '').trim();
        const existing = monthlyTask.actual_result || '';
        // 追加而非覆盖
        const newResult = existing
          ? `${existing}\n[同步${moment().format('M/D')}] ${syncContent}`
          : `[同步${moment().format('M/D')}] ${syncContent}`;
        await monthlyTask.update({ actual_result: newResult, updater_id: req.user?.id || null });
      }
    }

    // [7] 同步选项：将进展同步到季度成果
    if (req.body.sync_to_achievement && updateData.weekly_progress) {
      const Achievement = require('../models').Achievement;
      const achievements = await Achievement.findAll({
        where: { project_id: project.id, quarter: project.quarter },
        order: [['created_at', 'DESC']]
      });
      if (achievements.length > 0) {
        const syncContent = updateData.weekly_progress.replace(/\[\d{2}\/\d{2}\]\s*/g, '').trim();
        const achievement = achievements[0]; // 同步到最新的季度成果
        const existing = achievement.description || '';
        const newDesc = existing
          ? `${existing}\n[同步${moment().format('M/D')}] ${syncContent}`
          : `[同步${moment().format('M/D')}] ${syncContent}`;
        await achievement.update({ description: newDesc, updater_id: req.user?.id || null });
      }
    }

    success(res, project, '快速更新成功');
  } catch (err) {
    console.error('快速更新项目失败:', err);
    error(res, '快速更新项目失败', 1, 500);
  }
}

/**
 * 获取项目更新日志（按日期追溯）
 * GET /api/projects/:id/update-logs
 */
async function getProjectUpdateLogs(req, res) {
  try {
    const { id } = req.params;
    const project = await Project.findByPk(id);
    if (!project) return error(res, '项目不存在');

    if (req.deptFilter && req.deptFilter !== project.dept_id) {
      return error(res, '无权查看其他部门数据', 403, 403);
    }

    if (!canModifyProject(project, req)) {
      return error(res, '无权查看此项目日志', 403, 403);
    }

    const logs = await ProjectUpdateLog.findAll({
      where: { project_id: id },
      order: [['update_date', 'DESC'], ['created_at', 'DESC']]
    });

    success(res, logs);
  } catch (err) {
    console.error('获取项目更新日志失败:', err);
    error(res, '获取项目更新日志失败', 1, 500);
  }
}

module.exports = { getProjects, createProject, updateProject, deleteProject, getProjectStats, getStaleProjects, quickUpdateProject, getProjectUpdateLogs };
