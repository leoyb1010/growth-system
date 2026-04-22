const { Kpi, Department } = require('../models');
const { success, error } = require('../utils/response');
const { Op } = require('sequelize');
const { logAudit } = require('../services/auditLogService');
const { checkArchived } = require('../services/archiveCheckService');

function getOperator(req) {
  return { id: req.user.id, name: req.user.name || req.user.username };
}

/**
 * 获取 KPI 列表
 * GET /api/kpis?quarter=Q1&year=2026
 */
async function getKpis(req, res) {
  try {
    const { quarter, year } = req.query;
    const where = {};

    if (quarter) where.quarter = quarter;
    if (year) where.year = parseInt(year);
    if (req.deptFilter) where.dept_id = req.deptFilter;

    const kpis = await Kpi.findAll({
      where,
      include: [{ model: Department, attributes: ['id', 'name'] }],
      order: [['dept_id', 'ASC'], ['indicator_name', 'ASC']]
    });

    // 后端硬计算完成率
    const result = kpis.map(kpi => {
      const data = kpi.toJSON();
      data.completion_rate = data.target > 0 
        ? parseFloat(((data.actual / data.target) * 100).toFixed(2))
        : 0;
      return data;
    });

    success(res, result);
  } catch (err) {
    console.error('获取 KPI 失败:', err);
    error(res, '获取 KPI 失败', 1, 500);
  }
}

/**
 * 创建 KPI
 * POST /api/kpis
 */
async function createKpi(req, res) {
  try {
    const { dept_id, quarter, year, indicator_name, target, actual, unit } = req.body;

    if (!dept_id || !quarter || !indicator_name) {
      return error(res, '部门、季度和指标名不能为空');
    }

    // 部门权限校验
    if (req.deptFilter && req.deptFilter !== parseInt(dept_id)) {
      return error(res, '无权为其他部门创建数据', 403, 403);
    }

    const kpi = await Kpi.create({
      dept_id,
      quarter,
      year: year || 2026,
      indicator_name,
      target: target || 0,
      actual: actual || 0,
      unit: unit || '万元'
    });

    await logAudit('kpis', kpi.id, 'create', getOperator(req), null, kpi.toJSON());

    success(res, kpi, 'KPI 创建成功');
  } catch (err) {
    console.error('创建 KPI 失败:', err);
    error(res, '创建 KPI 失败', 1, 500);
  }
}

/**
 * 更新 KPI
 * PUT /api/kpis/:id
 */
async function updateKpi(req, res) {
  try {
    const { id } = req.params;
    const kpi = await Kpi.findByPk(id, { include: [Department] });

    if (!kpi) {
      return error(res, 'KPI 不存在');
    }

    if (req.deptFilter && req.deptFilter !== kpi.dept_id) {
      return error(res, '无权修改其他部门数据', 403, 403);
    }

    const isBlocked = await checkArchived('kpis', kpi.quarter, kpi.year, error, res);
    if (isBlocked) return;

    const oldValues = kpi.toJSON();
    await kpi.update(req.body);
    await logAudit('kpis', kpi.id, 'update', getOperator(req), oldValues, kpi.toJSON());
    success(res, kpi, 'KPI 更新成功');
  } catch (err) {
    console.error('更新 KPI 失败:', err);
    error(res, '更新 KPI 失败', 1, 500);
  }
}

/**
 * 删除 KPI
 * DELETE /api/kpis/:id
 */
async function deleteKpi(req, res) {
  try {
    const { id } = req.params;
    const kpi = await Kpi.findByPk(id);

    if (!kpi) {
      return error(res, 'KPI 不存在');
    }

    if (req.deptFilter && req.deptFilter !== kpi.dept_id) {
      return error(res, '无权删除其他部门数据', 403, 403);
    }

    const isBlocked = await checkArchived('kpis', kpi.quarter, kpi.year, error, res);
    if (isBlocked) return;

    const oldValues = kpi.toJSON();
    await kpi.destroy();
    await logAudit('kpis', id, 'delete', getOperator(req), oldValues, null);
    success(res, null, 'KPI 删除成功');
  } catch (err) {
    console.error('删除 KPI 失败:', err);
    error(res, '删除 KPI 失败', 1, 500);
  }
}

/**
 * 获取当前季度首页数据
 * GET /api/kpis/dashboard
 */
async function getDashboardKpis(req, res) {
  try {
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentQuarter = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
    const currentYear = now.getFullYear();

    // V4: 数据范围过滤
    const deptFilter = req.deptFilter ? { dept_id: req.deptFilter } : {};

    const kpis = await Kpi.findAll({
      where: { quarter: currentQuarter, year: currentYear, ...deptFilter },
      include: [{ model: Department, attributes: ['id', 'name'] }]
    });

    const result = kpis.map(kpi => {
      const data = kpi.toJSON();
      data.completion_rate = data.target > 0
        ? parseFloat(((data.actual / data.target) * 100).toFixed(2))
        : 0;
      return data;
    });

    success(res, {
      quarter: currentQuarter,
      year: currentYear,
      kpis: result
    });
  } catch (err) {
    console.error('获取仪表盘 KPI 失败:', err);
    error(res, '获取仪表盘数据失败', 1, 500);
  }
}

module.exports = { getKpis, createKpi, updateKpi, deleteKpi, getDashboardKpis };
