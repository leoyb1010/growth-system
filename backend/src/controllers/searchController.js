const { Project, Kpi, MonthlyTask, Achievement, Department } = require('../models');
const { success, error } = require('../utils/response');
const { Op } = require('sequelize');

/**
 * 构建搜索条件下的数据范围过滤
 * - all: 不加过滤
 * - department: dept_id = user.dept_id
 * - self: dept_id = user.dept_id AND (owner_user_id/creator_id = user.id OR owner_name = user.name)
 */
function buildScopeWhere(access, resourceType) {
  if (!access) return {};

  const { dataScopeType, dataScopeValue, deptId } = access;
  const where = {};

  switch (dataScopeType) {
    case 'all':
      // 不加任何过滤
      break;
    case 'department':
      where.dept_id = deptId;
      break;
    case 'self': {
      where.dept_id = deptId;
      const userId = dataScopeValue;
      const userName = access.username;

      if (resourceType === 'project') {
        // 项目有 owner_user_id 和 creator_id
        where[Op.or] = [
          { owner_user_id: userId },
          { creator_id: userId },
          { owner_name: userName }
        ];
      } else if (resourceType === 'monthly_task') {
        where[Op.or] = [
          { creator_id: userId },
          { owner_name: userName }
        ];
      } else if (resourceType === 'achievement') {
        where[Op.or] = [
          { creator_id: userId },
          { owner_name: userName }
        ];
      }
      // kpi 没有 owner 字段，self 只看本部门
      break;
    }
    default:
      where.dept_id = deptId;
  }

  return where;
}

/**
 * 全局搜索
 * GET /api/search?q=keyword
 * 跨项目、指标、月度工作、季度成果搜索
 */
async function globalSearch(req, res) {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return success(res, []);
    }
    const keyword = q.trim();
    // SQLite 不支持 ILIKE，使用 LIKE（SQLite 对 ASCII 默认大小写不敏感）
    const likeQuery = { [Op.like]: `%${keyword}%` };

    // 使用 access 权限上下文构建数据范围
    const projectScope = buildScopeWhere(req.access, 'project');
    const kpiScope = buildScopeWhere(req.access, 'kpi');
    const monthlyTaskScope = buildScopeWhere(req.access, 'monthly_task');
    const achievementScope = buildScopeWhere(req.access, 'achievement');

    // 1. 搜索重点工作
    const projects = await Project.findAll({
      where: {
        ...projectScope,
        [Op.or]: [
          { name: likeQuery },
          { owner_name: likeQuery },
          { weekly_progress: likeQuery },
          { risk_desc: likeQuery }
        ]
      },
      include: [{ model: Department, attributes: ['name'] }],
      limit: 10,
      order: [['updated_at', 'DESC']]
    });

    // 2. 搜索核心指标
    const kpis = await Kpi.findAll({
      where: {
        ...kpiScope,
        [Op.or]: [
          { indicator_name: likeQuery },
          { unit: likeQuery }
        ]
      },
      include: [{ model: Department, attributes: ['name'] }],
      limit: 10,
      order: [['updated_at', 'DESC']]
    });

    // 3. 搜索月度工作
    const monthlyTasks = await MonthlyTask.findAll({
      where: {
        ...monthlyTaskScope,
        [Op.or]: [
          { task: likeQuery },
          { owner_name: likeQuery },
          { actual_result: likeQuery },
          { next_month_plan: likeQuery }
        ]
      },
      include: [{ model: Department, attributes: ['name'] }],
      limit: 10,
      order: [['updated_at', 'DESC']]
    });

    // 4. 搜索季度成果
    const achievements = await Achievement.findAll({
      where: {
        ...achievementScope,
        [Op.or]: [
          { project_name: likeQuery },
          { owner_name: likeQuery },
          { achievement_type: likeQuery },
          { quantified_result: likeQuery },
          { business_value: likeQuery }
        ]
      },
      include: [{ model: Department, attributes: ['name'] }],
      limit: 10,
      order: [['updated_at', 'DESC']]
    });

    const results = [
      ...projects.map(p => ({
        type: 'project',
        typeLabel: '重点工作',
        id: p.id,
        title: p.name,
        subtitle: p.Department?.name || '',
        meta: `${p.owner_name} · ${p.status} · ${p.progress_pct}%`,
        url: `/projects`,
        updated_at: p.updated_at
      })),
      ...kpis.map(k => ({
        type: 'kpi',
        typeLabel: '核心指标',
        id: k.id,
        title: k.indicator_name,
        subtitle: k.Department?.name || '',
        meta: `目标 ${k.target} · 实际 ${k.actual} · ${k.unit}`,
        url: `/kpis`,
        updated_at: k.updated_at
      })),
      ...monthlyTasks.map(t => ({
        type: 'monthly_task',
        typeLabel: '月度工作',
        id: t.id,
        title: t.task,
        subtitle: t.Department?.name || '',
        meta: `${t.owner_name} · ${t.status || '进行中'}`,
        url: `/monthly-tasks`,
        updated_at: t.updated_at
      })),
      ...achievements.map(a => ({
        type: 'achievement',
        typeLabel: '季度成果',
        id: a.id,
        title: a.project_name,
        subtitle: a.Department?.name || '',
        meta: `${a.owner_name} · ${a.achievement_type}`,
        url: `/achievements`,
        updated_at: a.updated_at
      }))
    ];

    // 按更新时间降序排列
    results.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    success(res, results.slice(0, 20));
  } catch (err) {
    console.error('全局搜索失败:', err);
    error(res, '搜索失败', 1, 500);
  }
}

module.exports = { globalSearch };
