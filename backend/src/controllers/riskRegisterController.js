const { sequelize, RiskRegister, Project, User } = require('../models');
const { success, error } = require('../utils/response');
const { Op } = require('sequelize');
const { logAudit } = require('../services/auditLogService');

function getOperator(req) {
  return { id: req.user?.id, name: req.user?.name || req.user?.username };
}

/**
 * GET /api/risk-register
 */
async function list(req, res) {
  try {
    const { status, risk_level, project_id, page = 1, pageSize = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (risk_level) where.risk_level = risk_level;
    if (project_id) where.project_id = parseInt(project_id);

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

    const operator = getOperator(req);
    const updateData = { updated_by: operator.id };
    const fields = ['title', 'description', 'risk_level', 'risk_type', 'impact', 'probability', 'mitigation_plan', 'owner_id', 'project_id', 'status'];
    for (const f of fields) {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    }

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
