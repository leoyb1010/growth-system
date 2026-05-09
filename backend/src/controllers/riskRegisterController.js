const { RiskRegister, Project, User } = require('../models');
const { success, error } = require('../utils/response');
const { Op } = require('sequelize');
const { logAudit } = require('../services/auditLogService');

function getOperator(req) {
  return { id: req.user?.id, name: req.user?.name || req.user?.username };
}

async function buildRiskScopeWhere(req) {
  const scope = req.dataScope;
  if (!scope || scope.type === 'all') return {};

  if (scope.type === 'self') {
    return {
      [Op.or]: [
        { owner_id: req.user?.id },
        { created_by: req.user?.id }
      ]
    };
  }

  if (scope.type === 'department') {
    const [users, projects] = await Promise.all([
      User.findAll({ where: { dept_id: scope.deptId }, attributes: ['id'], raw: true }),
      Project.findAll({ where: { dept_id: scope.deptId }, attributes: ['id'], raw: true })
    ]);
    const userIds = users.map(u => u.id);
    const projectIds = projects.map(p => p.id);
    const clauses = [];
    if (userIds.length) {
      clauses.push({ owner_id: { [Op.in]: userIds } }, { created_by: { [Op.in]: userIds } });
    }
    if (projectIds.length) {
      clauses.push({ project_id: { [Op.in]: projectIds } });
    }
    return clauses.length ? { [Op.or]: clauses } : { id: -1 };
  }

  return { id: -1 };
}

async function canAccessRisk(req, risk) {
  const scopeWhere = await buildRiskScopeWhere(req);
  if (!scopeWhere || Object.keys(scopeWhere).length === 0) return true;
  const count = await RiskRegister.count({ where: { id: risk.id, ...scopeWhere } });
  return count > 0;
}

async function validateRiskPayloadScope(req, payload) {
  const scope = req.dataScope;
  if (!scope || scope.type === 'all') return null;

  if (scope.type === 'self') {
    if (payload.owner_id && Number(payload.owner_id) !== Number(req.user?.id)) {
      return '无权指派给其他负责人';
    }
    if (payload.project_id) {
      const userName = req.user?.name || req.user?.username;
      const project = await Project.findOne({
        where: {
          id: payload.project_id,
          dept_id: scope.deptId,
          [Op.or]: [
            { owner_user_id: req.user?.id },
            { creator_id: req.user?.id },
            { owner_name: userName }
          ]
        }
      });
      if (!project) return '无权关联此项目';
    }
  }

  if (scope.type === 'department') {
    if (payload.owner_id) {
      const user = await User.findOne({ where: { id: payload.owner_id, dept_id: scope.deptId } });
      if (!user) return '无权指派给其他部门成员';
    }
    if (payload.project_id) {
      const project = await Project.findOne({ where: { id: payload.project_id, dept_id: scope.deptId } });
      if (!project) return '无权关联其他部门项目';
    }
  }

  return null;
}

/**
 * GET /api/risk-register
 */
async function list(req, res) {
  try {
    const { status, risk_level, project_id, page = 1, pageSize = 20, aggregate } = req.query;
    const where = {};
    if (status) where.status = status;
    if (risk_level) where.risk_level = risk_level;
    if (project_id) where.project_id = parseInt(project_id);

    Object.assign(where, await buildRiskScopeWhere(req));

    // aggregate 模式：返回总量统计
    if (aggregate === 'true') {
      const rows = await RiskRegister.findAll({ where, attributes: ['status', 'risk_level'], raw: true });
      return success(res, {
        aggregate: {
          total: rows.length,
          open_count: rows.filter(r => r.status === 'open').length,
          monitoring: rows.filter(r => r.status === 'monitoring').length,
          resolved: rows.filter(r => ['mitigated', 'closed'].includes(r.status)).length,
          critical: rows.filter(r => r.risk_level === 'critical').length
        }
      });
    }

    const limit = Math.min(Math.max(parseInt(pageSize), 1), 100);
    const offset = (Math.max(parseInt(page), 1) - 1) * limit;

    const { count, rows } = await RiskRegister.findAndCountAll({
      where,
      include: [
        { model: Project, attributes: ['id', 'name'] },
        { model: User, as: 'Owner', attributes: ['id', 'name', 'username'] }
      ],
      order: [
        [sequelize.literal(`CASE risk_level WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`)],
        ['created_at', 'DESC']
      ],
      limit,
      offset
    });

    success(res, { data: rows, pagination: { page: parseInt(page), pageSize: limit, total: count } });
  } catch (err) {
    console.error('获取风险台账失败:', err);
    error(res, '获取风险台账失败', 1, 500);
  }
}

/**
 * POST /api/risk-register
 */
async function create(req, res) {
  try {
    const { title, description, risk_level, risk_type, impact, probability, mitigation_plan, owner_id, project_id, detected_by, source_type, source_id } = req.body;

    if (!title || String(title).trim().length < 2) {
      return error(res, '风险标题不能为空', 1, 400);
    }

    const scopeError = await validateRiskPayloadScope(req, { owner_id, project_id });
    if (scopeError) return error(res, scopeError, 1, 403);

    const operator = getOperator(req);
    const risk = await RiskRegister.create({
      title: title.trim(),
      description: description || null,
      risk_level: risk_level || 'medium',
      risk_type: risk_type || null,
      impact: impact || null,
      probability: probability || 'medium',
      mitigation_plan: mitigation_plan || null,
      owner_id: owner_id || null,
      project_id: project_id || null,
      status: 'open',
      detected_by: detected_by || 'manual',
      source_type: source_type || null,
      source_id: source_id || null,
      created_by: operator.id,
      updated_by: operator.id
    });

    await logAudit('risk_register', risk.id, 'create', operator);

    const result = await RiskRegister.findByPk(risk.id, {
      include: [
        { model: Project, attributes: ['id', 'name'] },
        { model: User, as: 'Owner', attributes: ['id', 'name', 'username'] }
      ]
    });

    success(res, result, '创建成功');
  } catch (err) {
    console.error('创建风险失败:', err);
    error(res, '创建风险失败', 1, 500);
  }
}

/**
 * PATCH /api/risk-register/:id
 */
async function update(req, res) {
  try {
    const { id } = req.params;
    const risk = await RiskRegister.findByPk(id);
    if (!risk) return error(res, '风险不存在', 1, 404);
    if (!(await canAccessRisk(req, risk))) {
      return error(res, '无权修改此风险', 1, 403);
    }

    const operator = getOperator(req);
    const updateData = { updated_by: operator.id };
    const fields = ['title', 'description', 'risk_level', 'risk_type', 'impact', 'probability', 'mitigation_plan', 'owner_id', 'project_id', 'status'];
    for (const f of fields) {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    }

    const scopeError = await validateRiskPayloadScope(req, updateData);
    if (scopeError) return error(res, scopeError, 1, 403);

    if (['mitigated', 'closed'].includes(req.body.status) && !['mitigated', 'closed'].includes(risk.status)) {
      updateData.resolved_at = new Date();
    }

    await risk.update(updateData);
    await logAudit('risk_register', risk.id, 'update', operator);

    const result = await RiskRegister.findByPk(risk.id, {
      include: [
        { model: Project, attributes: ['id', 'name'] },
        { model: User, as: 'Owner', attributes: ['id', 'name', 'username'] }
      ]
    });

    success(res, result, '更新成功');
  } catch (err) {
    console.error('更新风险失败:', err);
    error(res, '更新风险失败', 1, 500);
  }
}

module.exports = { list, create, update };
