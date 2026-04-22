const { Performance, Department } = require('../models');
const { success, error } = require('../utils/response');
const { logAudit } = require('../services/auditLogService');

function getOperator(req) {
  return { id: req.user.id, name: req.user.name || req.user.username };
}

/**
 * 计算预警状态
 * 正常(>=90%) / 预警(60%-90%) / 严重(<60%)
 */
function calculateWarningStatus(totalActual, totalTarget) {
  if (totalTarget <= 0) return '正常';
  const rate = (totalActual / totalTarget) * 100;
  if (rate >= 90) return '正常';
  if (rate >= 60) return '预警';
  return '严重';
}

/**
 * 获取业务线业绩列表
 * GET /api/performances?quarter=Q1&dept_id=1
 */
async function getPerformances(req, res) {
  try {
    const { dept_id } = req.query;
    const where = {};

    if (dept_id) where.dept_id = parseInt(dept_id);
    if (req.deptFilter) where.dept_id = req.deptFilter;

    const performances = await Performance.findAll({
      where,
      include: [{ model: Department, attributes: ['id', 'name'] }],
      order: [['dept_id', 'ASC'], ['business_type', 'ASC']]
    });

    // 后端硬计算累计和预警状态
    const result = performances.map(p => {
      const data = p.toJSON();
      data.total_target = parseFloat(data.q1_target) + parseFloat(data.q2_target) + parseFloat(data.q3_target) + parseFloat(data.q4_target);
      data.total_actual = parseFloat(data.q1_actual) + parseFloat(data.q2_actual) + parseFloat(data.q3_actual) + parseFloat(data.q4_actual);
      data.gap = data.total_target - data.total_actual;
      data.completion_rate = data.total_target > 0
        ? parseFloat(((data.total_actual / data.total_target) * 100).toFixed(2))
        : 0;
      data.warning_status = calculateWarningStatus(data.total_actual, data.total_target);
      return data;
    });

    success(res, result);
  } catch (err) {
    console.error('获取业绩列表失败:', err);
    error(res, '获取业绩列表失败', 1, 500);
  }
}

/**
 * 创建业绩记录
 * POST /api/performances
 */
async function createPerformance(req, res) {
  try {
    const data = req.body;

    if (!data.dept_id || !data.business_type || !data.indicator) {
      return error(res, '部门、业务类型和指标不能为空');
    }

    if (req.deptFilter && req.deptFilter !== parseInt(data.dept_id)) {
      return error(res, '无权为其他部门创建数据', 403, 403);
    }

    // 字段白名单
    const allowedFields = ['dept_id', 'business_type', 'indicator', 'unit', 'q1_target', 'q1_actual', 'q2_target', 'q2_actual', 'q3_target', 'q3_actual', 'q4_target', 'q4_actual'];
    const payload = {};
    allowedFields.forEach(f => { if (data[f] !== undefined) payload[f] = data[f]; });

    const performance = await Performance.create(payload);
    await logAudit('performances', performance.id, 'create', getOperator(req), null, performance.toJSON());
    success(res, performance, '业绩记录创建成功');
  } catch (err) {
    console.error('创建业绩记录失败:', err);
    error(res, '创建业绩记录失败', 1, 500);
  }
}

/**
 * 更新业绩记录
 * PUT /api/performances/:id
 */
async function updatePerformance(req, res) {
  try {
    const { id } = req.params;
    const performance = await Performance.findByPk(id);

    if (!performance) {
      return error(res, '业绩记录不存在');
    }

    if (req.deptFilter && req.deptFilter !== performance.dept_id) {
      return error(res, '无权修改其他部门数据', 403, 403);
    }

    const oldValues = performance.toJSON();

    // 字段白名单
    const allowedFields = ['dept_id', 'business_type', 'indicator', 'unit', 'q1_target', 'q1_actual', 'q2_target', 'q2_actual', 'q3_target', 'q3_actual', 'q4_target', 'q4_actual'];
    const updateData = {};
    allowedFields.forEach(f => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });

    await performance.update(updateData);
    await logAudit('performances', performance.id, 'update', getOperator(req), oldValues, performance.toJSON());
    success(res, performance, '业绩记录更新成功');
  } catch (err) {
    console.error('更新业绩记录失败:', err);
    error(res, '更新业绩记录失败', 1, 500);
  }
}

/**
 * 删除业绩记录
 * DELETE /api/performances/:id
 */
async function deletePerformance(req, res) {
  try {
    const { id } = req.params;
    const performance = await Performance.findByPk(id);

    if (!performance) {
      return error(res, '业绩记录不存在');
    }

    if (req.deptFilter && req.deptFilter !== performance.dept_id) {
      return error(res, '无权删除其他部门数据', 403, 403);
    }

    const oldValues = performance.toJSON();
    await performance.destroy();
    await logAudit('performances', id, 'delete', getOperator(req), oldValues, null);
    success(res, null, '业绩记录删除成功');
  } catch (err) {
    console.error('删除业绩记录失败:', err);
    error(res, '删除业绩记录失败', 1, 500);
  }
}

/**
 * 获取仪表盘业绩统计
 * GET /api/performances/dashboard
 */
async function getPerformanceStats(req, res) {
  try {
    const where = {};
    if (req.deptFilter) where.dept_id = req.deptFilter;

    const performances = await Performance.findAll({ where });

    const stats = {
      total: performances.length,
      normal: 0,
      warning: 0,
      severe: 0,
      details: []
    };

    performances.forEach(p => {
      const totalTarget = parseFloat(p.q1_target) + parseFloat(p.q2_target) + parseFloat(p.q3_target) + parseFloat(p.q4_target);
      const totalActual = parseFloat(p.q1_actual) + parseFloat(p.q2_actual) + parseFloat(p.q3_actual) + parseFloat(p.q4_actual);
      const status = calculateWarningStatus(totalActual, totalTarget);

      if (status === '正常') stats.normal++;
      else if (status === '预警') stats.warning++;
      else stats.severe++;

      stats.details.push({
        id: p.id,
        business_type: p.business_type,
        indicator: p.indicator,
        completion_rate: totalTarget > 0 ? parseFloat(((totalActual / totalTarget) * 100).toFixed(2)) : 0,
        warning_status: status
      });
    });

    success(res, stats);
  } catch (err) {
    console.error('获取业绩统计失败:', err);
    error(res, '获取业绩统计失败', 1, 500);
  }
}

module.exports = { getPerformances, createPerformance, updatePerformance, deletePerformance, getPerformanceStats };
