const { ActionItem, User, sequelize } = require('../models');
const { success, error } = require('../utils/response');
const { Op } = require('sequelize');
const { logAudit } = require('../services/auditLogService');
const { todayString } = require('../utils/businessDate');

function getOperator(req) {
  return { id: req.user?.id, name: req.user?.name || req.user?.username };
}

async function buildActionItemScopeWhere(req) {
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
    const users = await User.findAll({
      where: { dept_id: scope.deptId },
      attributes: ['id'],
      raw: true
    });
    const ids = users.map(u => u.id);
    if (!ids.length) return { id: -1 };
    return {
      [Op.or]: [
        { owner_id: { [Op.in]: ids } },
        { created_by: { [Op.in]: ids } }
      ]
    };
  }

  return { id: -1 };
}

async function canAccessActionItem(req, item) {
  const scopeWhere = await buildActionItemScopeWhere(req);
  if (!scopeWhere || Object.keys(scopeWhere).length === 0) return true;
  const count = await ActionItem.count({ where: { id: item.id, ...scopeWhere } });
  return count > 0;
}

/**
 * GET /api/action-items — 支持 ?aggregate=true 返回统计口径
 */
async function list(req, res) {
  try {
    const { status, priority, owner_id, mine, overdue, page = 1, pageSize = 20, aggregate } = req.query;
    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (owner_id) where.owner_id = parseInt(owner_id);
    if (mine === 'true' && req.user?.id) where.owner_id = req.user.id;
    if (overdue === 'true') {
      where.due_date = { [Op.lt]: todayString() };
      where.status = { [Op.notIn]: ['done', 'cancelled'] };
    }

    Object.assign(where, await buildActionItemScopeWhere(req));

    // aggregate 模式：返回总量统计（不受分页影响）
    if (aggregate === 'true') {
      const rows = await ActionItem.findAll({ where, attributes: ['status', 'due_date'], raw: true });
      const today = todayString();
      return success(res, {
        aggregate: {
          total: rows.length,
          pending: rows.filter(r => r.status === 'pending').length,
          in_progress: rows.filter(r => r.status === 'in_progress').length,
          done: rows.filter(r => r.status === 'done').length,
          overdue: rows.filter(r => !['done', 'cancelled'].includes(r.status) && r.due_date && r.due_date < today).length
        }
      });
    }

    const limit = Math.min(Math.max(parseInt(pageSize), 1), 100);
    const offset = (Math.max(parseInt(page), 1) - 1) * limit;

    const { count, rows } = await ActionItem.findAndCountAll({
      where,
      include: [
        { model: User, as: 'Owner', attributes: ['id', 'name', 'username'] }
      ],
      order: [
        [sequelize.literal(`CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END`)],
        ['due_date', 'ASC'],
        ['created_at', 'DESC']
      ],
      limit,
      offset
    });

    success(res, { data: rows, pagination: { page: parseInt(page), pageSize: limit, total: count } });
  } catch (err) {
    console.error('获取行动项失败:', err);
    error(res, '获取行动项失败', 1, 500);
  }
}

/**
 * POST /api/action-items
 */
async function create(req, res) {
  try {
    const { title, description, owner_id, priority, status, due_date, source_type, source_id, created_by_ai, confirmed_by_user } = req.body;

    if (!title || String(title).trim().length < 2) {
      return error(res, '行动项标题不能为空', 1, 400);
    }

    const operator = getOperator(req);
    const item = await ActionItem.create({
      title: title.trim(),
      description: description || null,
      owner_id: owner_id || null,
      priority: priority || 'medium',
      status: status || 'pending',
      due_date: due_date || null,
      source_type: source_type || 'manual',
      source_id: source_id || null,
      created_by_ai: !!created_by_ai,
      confirmed_by_user: confirmed_by_user === false ? false : true,
      created_by: operator.id,
      updated_by: operator.id
    });

    await logAudit('action_items', item.id, 'create', operator);

    const result = await ActionItem.findByPk(item.id, {
      include: [{ model: User, as: 'Owner', attributes: ['id', 'name', 'username'] }]
    });

    success(res, result, '创建成功');
  } catch (err) {
    console.error('创建行动项失败:', err);
    error(res, '创建行动项失败', 1, 500);
  }
}

/**
 * PATCH /api/action-items/:id
 */
async function update(req, res) {
  try {
    const { id } = req.params;
    const item = await ActionItem.findByPk(id);
    if (!item) return error(res, '行动项不存在', 1, 404);
    if (!(await canAccessActionItem(req, item))) {
      return error(res, '无权修改此行动项', 1, 403);
    }

    const operator = getOperator(req);
    const updateData = { updated_by: operator.id };

    const fields = ['title', 'description', 'owner_id', 'priority', 'status', 'due_date', 'confirmed_by_user'];
    for (const f of fields) {
      if (req.body[f] !== undefined) updateData[f] = req.body[f];
    }

    if (req.body.status === 'done' && item.status !== 'done') {
      updateData.completed_at = new Date();
    }

    await item.update(updateData);
    await logAudit('action_items', item.id, 'update', operator);

    const result = await ActionItem.findByPk(item.id, {
      include: [{ model: User, as: 'Owner', attributes: ['id', 'name', 'username'] }]
    });

    success(res, result, '更新成功');
  } catch (err) {
    console.error('更新行动项失败:', err);
    error(res, '更新行动项失败', 1, 500);
  }
}

/**
 * DELETE /api/action-items/:id — 软删除：标记为 cancelled
 */
async function remove(req, res) {
  try {
    const { id } = req.params;
    const item = await ActionItem.findByPk(id);
    if (!item) return error(res, '行动项不存在', 1, 404);

    if (!(await canAccessActionItem(req, item))) {
      return error(res, '无权删除此行动项', 1, 403);
    }

    // 软删除：status=cancelled，非物理删除
    await item.update({ status: 'cancelled', updated_by: getOperator(req).id });
    await logAudit('action_items', id, 'delete', getOperator(req));

    success(res, null, '已取消');
  } catch (err) {
    console.error('删除行动项失败:', err);
    error(res, '删除行动项失败', 1, 500);
  }
}

module.exports = { list, create, update, remove };
