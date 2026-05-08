const { Op } = require('sequelize');
const { sequelize, CpsChannel, CpsProduct, CpsDailyMetric, CpsDailyMetricSnapshot, CpsAlertEvent } = require('../models');
const { success, error } = require('../utils/response');
const cpsCalc = require('../services/cpsCalcService');
const cpsDashboardService = require('../services/cpsDashboardService');
const cpsImportService = require('../services/cpsImportService');
const cpsExportService = require('../services/cpsExportService');
const cpsAlertService = require('../services/cpsAlertService');

function parseIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number).filter(Boolean);
  return String(value).split(',').map(Number).filter(Boolean);
}

function buildMetricWhere(query) {
  const where = {};
  if (query.start_date && query.end_date) {
    where.stat_date = { [Op.between]: [query.start_date, query.end_date] };
  } else if (query.stat_date) {
    where.stat_date = query.stat_date;
  }
  const channelIds = parseIds(query.channel_ids);
  const productIds = parseIds(query.product_ids);
  if (channelIds.length) where.channel_id = { [Op.in]: channelIds };
  if (productIds.length) where.product_id = { [Op.in]: productIds };
  if (query.source) where.source = query.source;
  if (query.status) where.status = query.status;
  return where;
}

// P0-2: 数据范围工具函数
function mergeDataScope(where, req) {
  if (req.dataScope?.where && Object.keys(req.dataScope.where).length) {
    Object.assign(where, req.dataScope.where);
  }
  return where;
}

function isCpsChannelScope(req) {
  return req.dataScope?.type === 'cps_channel';
}

function assertMetricScope(req, rowOrPayload) {
  if (!isCpsChannelScope(req)) return null;
  const ownChannelId = Number(req.dataScope.value || req.user?.cps_channel_id);
  if (!ownChannelId) return '当前账号未绑定CPS渠道';
  if (Number(rowOrPayload.channel_id) !== ownChannelId) return '无权操作其他渠道的数据';
  return null;
}

function todayString() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseUnitPrice(value, fallback) {
  const raw = value === undefined || value === null || value === '' ? fallback : value;
  const number = Number(raw || 0);
  if (!Number.isFinite(number) || number < 0) return null;
  return number;
}

function validateStatDate(value) {
  if (!value) return '缺少 stat_date';
  if (String(value) > todayString()) return 'stat_date 不能晚于今天';
  return null;
}

async function getDashboard(req, res) {
  try {
    const scopedQuery = { ...req.query };
    if (isCpsChannelScope(req)) {
      scopedQuery.channel_ids = String(req.dataScope.value);
    }
    const data = await cpsDashboardService.getDashboard(scopedQuery);
    return success(res, data);
  } catch (err) {
    console.error('CPS dashboard error:', err);
    return error(res, err.message || '获取CPS看板失败');
  }
}

async function getMetrics(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 200);
    const where = buildMetricWhere(req.query);
    // 显式处理渠道用户数据范围，不用 mergeDataScope（避免 dept_id 等不相关字段污染 CPS 表查询）
    if (isCpsChannelScope(req)) {
      where.channel_id = req.dataScope.value;
    }

    const result = await CpsDailyMetric.findAndCountAll({
      where,
      include: [
        { model: CpsChannel, as: 'channel', attributes: ['id', 'name', 'code'] },
        { model: CpsProduct, as: 'product', attributes: ['id', 'name', 'code', 'unit_price'] },
      ],
      order: [['stat_date', 'DESC'], ['channel_id', 'ASC'], ['product_id', 'ASC']],
      limit: pageSize, offset: (page - 1) * pageSize,
    });

    const rows = result.rows.map(row => cpsCalc.attachRates(row.toJSON()));
    return success(res, { rows, total: result.count, page, pageSize });
  } catch (err) {
    console.error('CPS getMetrics error:', err);
    return error(res, err.message || '获取CPS明细失败');
  }
}

async function upsertMetric(req, res) {
  const payload = { ...(req.body || {}) };
  // 渠道账号强制改写channel_id，无法伪造
  if (isCpsChannelScope(req)) {
    payload.channel_id = req.dataScope.value;
  }
  if (!payload.stat_date) return error(res, '缺少 stat_date', 400, 400);
  if (!payload.channel_id) return error(res, '缺少 channel_id', 400, 400);
  if (!payload.product_id) return error(res, '缺少 product_id', 400, 400);
  const dateError = validateStatDate(payload.stat_date);
  if (dateError) return error(res, dateError, 400, 400);

  const product = await CpsProduct.findByPk(payload.product_id);
  if (!product) return error(res, '产品不存在', 404, 404);

  const input = cpsCalc.sanitizeInput(payload);
  const unitPrice = parseUnitPrice(payload.unit_price, product.unit_price);
  if (unitPrice === null) return error(res, 'unit_price 不能为负数或非法数字', 400, 400);
  const derived = cpsCalc.buildDerivedFields({ ...input, unit_price: unitPrice });

  const where = { stat_date: payload.stat_date, channel_id: payload.channel_id, product_id: payload.product_id };
  const t = await sequelize.transaction();
  let row;
  try {
    row = await CpsDailyMetric.findOne({ where, transaction: t });

    if (row) {
      await CpsDailyMetricSnapshot.create({
        metric_id: row.id, stat_date: row.stat_date, channel_id: row.channel_id,
        product_id: row.product_id, version: row.version,
        payload_json: JSON.stringify(row.toJSON()),
        changed_by: req.user?.id, changed_by_name: req.user?.name || req.user?.username,
        change_reason: payload.change_reason || 'manual_update',
      }, { transaction: t });
      await row.update({ ...input, ...derived, unit_price: unitPrice, source: payload.source || 'manual', status: payload.status || 'confirmed', uploader_id: req.user?.id, uploader_name: req.user?.name || req.user?.username, version: row.version + 1, remark: payload.remark }, { transaction: t });
    } else {
      row = await CpsDailyMetric.create({ ...where, ...input, ...derived, unit_price: unitPrice, source: payload.source || 'manual', status: payload.status || 'confirmed', uploader_id: req.user?.id, uploader_name: req.user?.name || req.user?.username, version: 1, remark: payload.remark }, { transaction: t });
    }

    await t.commit();
    return success(res, cpsCalc.attachRates(row.toJSON()));
  } catch (err) {
    await t.rollback();
    console.error('CPS upsertMetric error:', err);
    return error(res, err.message || '保存CPS数据失败');
  }
}

async function updateMetric(req, res) {
  try {
    const row = await CpsDailyMetric.findByPk(req.params.id);
    if (!row) return error(res, '数据不存在', 404, 404);

    const scopeError = assertMetricScope(req, row);
    if (scopeError) return error(res, scopeError, 403, 403);

    const payload = req.body || {};
    const input = cpsCalc.sanitizeInput(payload);
    const unitPrice = parseUnitPrice(payload.unit_price, row.unit_price);
    if (unitPrice === null) return error(res, 'unit_price 不能为负数或非法数字', 400, 400);
    const derived = cpsCalc.buildDerivedFields({ ...input, unit_price: unitPrice });

    await CpsDailyMetricSnapshot.create({
      metric_id: row.id, stat_date: row.stat_date, channel_id: row.channel_id,
      product_id: row.product_id, version: row.version,
      payload_json: JSON.stringify(row.toJSON()),
      changed_by: req.user?.id, changed_by_name: req.user?.name || req.user?.username,
      change_reason: payload.change_reason || 'manual_update',
    });

    await row.update({ ...input, ...derived, unit_price: unitPrice, version: row.version + 1, remark: payload.remark, uploader_id: req.user?.id, uploader_name: req.user?.name || req.user?.username });
    return success(res, cpsCalc.attachRates(row.toJSON()));
  } catch (err) {
    console.error('CPS updateMetric error:', err);
    return error(res, err.message || '更新CPS数据失败');
  }
}

async function deleteMetric(req, res) {
  try {
    const row = await CpsDailyMetric.findByPk(req.params.id);
    if (!row) return error(res, '数据不存在', 404, 404);
    const scopeError = assertMetricScope(req, row);
    if (scopeError) return error(res, scopeError, 403, 403);
    await row.destroy();
    return success(res, true);
  } catch (err) {
    console.error('CPS deleteMetric error:', err);
    return error(res, err.message || '删除CPS数据失败');
  }
}

async function getMetricSnapshots(req, res) {
  try {
    const rows = await CpsDailyMetricSnapshot.findAll({ where: { metric_id: req.params.id }, order: [['created_at', 'DESC']] });
    return success(res, rows);
  } catch (err) { return error(res, err.message || '获取快照失败'); }
}

async function importMetrics(req, res) {
  try {
    if (!req.file) return error(res, '请上传Excel文件', 400, 400);
    try {
      const result = await cpsImportService.importFromExcel(req.file.path, {
        stat_date: req.body.stat_date,
        uploader_id: req.user?.id,
        uploader_name: req.user?.name || req.user?.username,
        auto_create_dim: req.body.auto_create_dim !== 'false',
        forced_channel_id: req.body.forced_channel_id || (isCpsChannelScope(req) ? req.dataScope.value : null),
        default_product_id: req.body.default_product_id || null,
        source: req.body.source || 'admin_excel_import',
      });
      return success(res, result);
    } finally {
      // 清理临时上传文件
      const fs = require('fs');
      fs.unlink(req.file.path, () => {});
    }
  } catch (err) { console.error('CPS import error:', err); return error(res, err.message || '导入失败'); }
}

async function exportMetrics(req, res) {
  try {
    const buffer = await cpsExportService.exportToExcel(req.query, req.dataScope);
    res.setHeader('Content-Disposition', `attachment; filename="cps_metrics_${Date.now()}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (err) { console.error('CPS export error:', err); return error(res, err.message || '导出失败'); }
}

async function getAlerts(req, res) {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.level) where.level = req.query.level;
    if (req.query.start_date && req.query.end_date) where.stat_date = { [Op.between]: [req.query.start_date, req.query.end_date] };
    const channelIds = parseIds(req.query.channel_ids), productIds = parseIds(req.query.product_ids);
    if (channelIds.length) where.channel_id = { [Op.in]: channelIds };
    if (productIds.length) where.product_id = { [Op.in]: productIds };
    // 显式处理渠道用户数据范围（不用 mergeDataScope，避免非 CPS 字段污染查询）
    if (isCpsChannelScope(req)) {
      where.channel_id = req.dataScope.value;
    }

    const rows = await CpsAlertEvent.findAll({
      where, include: [
        { model: CpsChannel, as: 'channel', attributes: ['id', 'name'] },
        { model: CpsProduct, as: 'product', attributes: ['id', 'name'] },
      ],
      order: [['created_at', 'DESC']], limit: Number(req.query.limit) || 100,
    });
    return success(res, rows);
  } catch (err) {
    console.error('CPS getAlerts error:', err);
    return error(res, err.message || '获取预警失败');
  }
}

async function ackAlert(req, res) {
  try {
    const row = await CpsAlertEvent.findByPk(req.params.id);
    if (!row) return error(res, '预警不存在', 404, 404);
    await row.update({ status: 'ack', ack_by: req.user?.id, ack_by_name: req.user?.name || req.user?.username, ack_at: new Date() });
    return success(res, row);
  } catch (err) { return error(res, err.message || '确认预警失败'); }
}

// 手动触发预警检查（不用等 cron，立即检查昨天的数据）
async function checkAlertsNow(req, res) {
  try {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const date = req.query.date || yesterday.toISOString().slice(0, 10);
    const events = await cpsAlertService.checkAlertsForDate(date);
    return success(res, { date, events_count: events.length });
  } catch (err) {
    console.error('CPS checkAlertsNow error:', err);
    return error(res, err.message || '执行预警检查失败');
  }
}

module.exports = { getDashboard, getMetrics, upsertMetric, updateMetric, deleteMetric, getMetricSnapshots, importMetrics, exportMetrics, getAlerts, ackAlert, checkAlertsNow };
