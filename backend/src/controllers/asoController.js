const { Op } = require('sequelize');
const { sequelize, AsoProduct, AsoKeyword, AsoDailyKeywordMetric, AsoSnapshot, AsoCampaign, AsoCampaignKeyword, AsoMetadataVersion, AsoProductBaselineMetric } = require('../models');
const { success, error } = require('../utils/response');
const asoCalc = require('../services/asoCalcService');
const asoDashboardService = require('../services/asoDashboardService');
const asoImportService = require('../services/asoImportService');

function parseIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number).filter(Boolean);
  return String(value).split(',').map(Number).filter(Boolean);
}

function todayString() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

// ==================== Dashboard ====================
async function getDashboard(req, res) {
  try {
    const data = await asoDashboardService.getDashboard(req.query);
    return success(res, data);
  } catch (err) {
    console.error('ASO dashboard error:', err);
    return error(res, err.message || '获取ASO看板失败');
  }
}

// ==================== Daily Metrics ====================
async function getDailyMetrics(req, res) {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 20, 1), 200);
    const where = { deleted_at: null };

    if (req.query.start_date && req.query.end_date) {
      where.stat_date = { [Op.between]: [req.query.start_date, req.query.end_date] };
    } else if (req.query.stat_date) {
      where.stat_date = req.query.stat_date;
    }
    const prodIds = parseIds(req.query.product_ids);
    const keywordIds = parseIds(req.query.keyword_ids);
    if (prodIds.length) where.product_id = { [Op.in]: prodIds };
    if (keywordIds.length) where.keyword_id = { [Op.in]: keywordIds };
    if (req.query.source) where.source = req.query.source;

    const result = await AsoDailyKeywordMetric.findAndCountAll({
      where,
      include: [
        { model: AsoProduct, as: 'product', attributes: ['id', 'name', 'code'] },
        { model: AsoKeyword, as: 'keyword', attributes: ['id', 'keyword', 'keyword_type', 'keyword_group'] },
      ],
      order: [['stat_date', 'DESC'], ['product_id', 'ASC'], ['keyword_id', 'ASC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    const rows = result.rows.map(row => asoCalc.attachDerivedFields(row.toJSON()));
    return success(res, { rows, total: result.count, page, pageSize });
  } catch (err) {
    console.error('ASO getDailyMetrics error:', err);
    return error(res, err.message || '获取ASO日报明细失败');
  }
}

async function upsertDailyMetric(req, res) {
  const payload = req.body || {};
  if (!payload.stat_date) return error(res, '缺少 stat_date', 400, 400);
  if (!payload.product_id) return error(res, '缺少 product_id', 400, 400);
  if (!payload.keyword_id) return error(res, '缺少 keyword_id', 400, 400);
  // 移除 stat_date 不能晚于今天的限制（系统调整 3.0）
  // if (String(payload.stat_date) > todayString()) return error(res, 'stat_date 不能晚于今天', 400, 400);

  const product = await AsoProduct.findByPk(payload.product_id);
  if (!product) return error(res, '产品不存在', 404, 404);

  const sanitized = asoCalc.sanitizeDailyMetricInput(payload);
  const derived = asoCalc.buildDerivedDailyFields(sanitized);

  const where = { stat_date: payload.stat_date, product_id: payload.product_id, keyword_id: payload.keyword_id };
  const t = await sequelize.transaction();
  let row;
  try {
    row = await AsoDailyKeywordMetric.findOne({ where, transaction: t });
    if (row) {
      await AsoSnapshot.create({
        record_type: 'aso_daily_keyword_metric',
        record_id: row.id,
        version: row.version,
        payload_json: JSON.stringify(row.toJSON()),
        changed_by: req.user?.id,
        changed_by_name: req.user?.name || req.user?.username,
        change_reason: payload.change_reason || 'manual_update',
      }, { transaction: t });
      await row.update({
        ...sanitized, ...derived,
        source: payload.source || 'manual',
        status: payload.status || 'confirmed',
        uploader_id: req.user?.id,
        uploader_name: req.user?.name || req.user?.username,
        version: row.version + 1,
        remark: payload.remark,
      }, { transaction: t });
    } else {
      row = await AsoDailyKeywordMetric.create({
        ...where, ...sanitized, ...derived,
        source: payload.source || 'manual',
        status: payload.status || 'confirmed',
        uploader_id: req.user?.id,
        uploader_name: req.user?.name || req.user?.username,
        version: 1,
        remark: payload.remark,
      }, { transaction: t });
    }
    await t.commit();
    return success(res, asoCalc.attachDerivedFields(row.toJSON()));
  } catch (err) {
    await t.rollback();
    console.error('ASO upsertDailyMetric error:', err);
    return error(res, err.message || '保存ASO日报数据失败');
  }
}

async function updateDailyMetric(req, res) {
  try {
    const row = await AsoDailyKeywordMetric.findByPk(req.params.id);
    if (!row) return error(res, '数据不存在', 404, 404);

    const payload = req.body || {};
    const sanitized = asoCalc.sanitizeDailyMetricInput(payload);
    const derived = asoCalc.buildDerivedDailyFields(sanitized);

    await AsoSnapshot.create({
      record_type: 'aso_daily_keyword_metric',
      record_id: row.id,
      version: row.version,
      payload_json: JSON.stringify(row.toJSON()),
      changed_by: req.user?.id,
      changed_by_name: req.user?.name || req.user?.username,
      change_reason: payload.change_reason || 'manual_update',
    });

    await row.update({
      ...sanitized, ...derived,
      version: row.version + 1,
      remark: payload.remark,
      uploader_id: req.user?.id,
      uploader_name: req.user?.name || req.user?.username,
    });
    return success(res, asoCalc.attachDerivedFields(row.toJSON()));
  } catch (err) {
    console.error('ASO updateDailyMetric error:', err);
    return error(res, err.message || '更新ASO日报数据失败');
  }
}

async function deleteDailyMetric(req, res) {
  try {
    const row = await AsoDailyKeywordMetric.findByPk(req.params.id);
    if (!row) return error(res, '数据不存在', 404, 404);
    await row.destroy();
    return success(res, true);
  } catch (err) { return error(res, err.message || '删除失败'); }
}

async function getMetricSnapshots(req, res) {
  try {
    const rows = await AsoSnapshot.findAll({
      where: { record_type: 'aso_daily_keyword_metric', record_id: req.params.id },
      order: [['created_at', 'DESC']],
    });
    return success(res, rows);
  } catch (err) { return error(res, err.message || '获取快照失败'); }
}

// ==================== Import / Export ====================
async function importDailyMetrics(req, res) {
  try {
    if (!req.file) return error(res, '请上传Excel文件', 400, 400);
    try {
      const result = await asoImportService.importDailyMetrics(req.file.path, {
        stat_date: req.body.stat_date,
        uploader_id: req.user?.id,
        uploader_name: req.user?.name || req.user?.username,
        file_name: req.file.originalname,
        default_product_id: req.body.default_product_id || null,
      });
      return success(res, result);
    } finally {
      const fs = require('fs');
      fs.unlink(req.file.path, () => {});
    }
  } catch (err) {
    console.error('ASO import error:', err);
    return error(res, err.message || '导入失败');
  }
}

async function exportDailyMetrics(req, res) {
  try {
    const where = { deleted_at: null };
    if (req.query.start_date && req.query.end_date) {
      where.stat_date = { [Op.between]: [req.query.start_date, req.query.end_date] };
    }
    const rows = await AsoDailyKeywordMetric.findAll({
      where,
      include: [
        { model: AsoProduct, as: 'product', attributes: ['name'] },
        { model: AsoKeyword, as: 'keyword', attributes: ['keyword', 'keyword_type'] },
      ],
      order: [['stat_date', 'DESC']],
      raw: false,
    });

    // Simple CSV export
    // 安全：CSV注入防护 — 对以 =, +, -, @ 开头的单元格添加单引号前缀
    function sanitizeCsvCell(value) {
      const str = String(value ?? '');
      if (/^[=+\-@]/.test(str)) return `'${str}`;
      return str;
    }
    const headers = ['日期', '产品', '关键词', '类型', '搜索指数', '流行度', '初始排名', '昨日排名', '当前排名', '排名变化', '今日量级', '消耗金额', '状态'];
    const lines = [headers.join(',')];
    for (const row of rows) {
      const r = row.toJSON();
      lines.push([
        r.stat_date, r.product?.name || '', r.keyword?.keyword || '', r.keyword?.keyword_type || '',
        r.search_index || '', r.popularity || '', r.initial_rank || '', r.yesterday_rank || '',
        r.current_rank || '', r.rank_delta || '', r.today_volume, r.cost_amount, r.keyword_status || '',
      ].map(v => `"${sanitizeCsvCell(v).replace(/"/g, '""')}"`).join(','));
    }
    const csv = '﻿' + lines.join('\n');
    res.setHeader('Content-Disposition', `attachment; filename="aso_metrics_${Date.now()}.csv"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send(csv);
  } catch (err) { return error(res, err.message || '导出失败'); }
}

// ==================== Campaigns ====================
async function getCampaigns(req, res) {
  try {
    const where = {};
    const prodIds = parseIds(req.query.product_ids);
    if (prodIds.length) where.product_id = { [Op.in]: prodIds };
    if (req.query.campaign_month) where.campaign_month = req.query.campaign_month;

    const rows = await AsoCampaign.findAll({
      where,
      include: [{ model: AsoProduct, as: 'product', attributes: ['id', 'name', 'code'] }],
      order: [['campaign_month', 'DESC']],
    });
    return success(res, rows);
  } catch (err) { return error(res, err.message || '获取计划失败'); }
}

async function createCampaign(req, res) {
  try {
    const payload = req.body || {};
    if (!payload.product_id) return error(res, '缺少 product_id', 400, 400);
    if (!payload.campaign_month) return error(res, '缺少 campaign_month', 400, 400);
    if (!payload.name) return error(res, '缺少计划名称', 400, 400);

    const row = await AsoCampaign.create({
      ...payload,
      created_by: req.user?.id,
      updated_by: req.user?.id,
    });
    return success(res, row, '创建成功');
  } catch (err) { return error(res, err.message || '创建计划失败'); }
}

async function updateCampaign(req, res) {
  try {
    const row = await AsoCampaign.findByPk(req.params.id);
    if (!row) return error(res, '计划不存在', 404, 404);
    await row.update({ ...req.body, updated_by: req.user?.id });
    return success(res, row);
  } catch (err) { return error(res, err.message || '更新计划失败'); }
}

async function deleteCampaign(req, res) {
  try {
    const row = await AsoCampaign.findByPk(req.params.id);
    if (!row) return error(res, '计划不存在', 404, 404);
    await row.destroy();
    return success(res, true);
  } catch (err) { return error(res, err.message || '删除计划失败'); }
}

// ==================== Metadata Versions ====================
async function getMetadataVersions(req, res) {
  try {
    const where = {};
    const prodIds = parseIds(req.query.product_ids);
    if (prodIds.length) where.product_id = { [Op.in]: prodIds };

    const rows = await AsoMetadataVersion.findAll({
      where,
      include: [{ model: AsoProduct, as: 'product', attributes: ['id', 'name', 'code'] }],
      order: [['version_date', 'DESC']],
    });
    return success(res, rows);
  } catch (err) { return error(res, err.message || '获取元数据版本失败'); }
}

async function createMetadataVersion(req, res) {
  try {
    const payload = req.body || {};
    if (!payload.product_id) return error(res, '缺少 product_id', 400, 400);
    if (!payload.version_date) return error(res, '缺少 version_date', 400, 400);
    if (!payload.locale) return error(res, '缺少 locale', 400, 400);

    const row = await AsoMetadataVersion.create({
      ...payload,
      created_by: req.user?.id,
      updated_by: req.user?.id,
    });
    return success(res, row, '创建成功');
  } catch (err) { return error(res, err.message || '创建元数据版本失败'); }
}

async function updateMetadataVersion(req, res) {
  try {
    const row = await AsoMetadataVersion.findByPk(req.params.id);
    if (!row) return error(res, '元数据版本不存在', 404, 404);
    await row.update({ ...req.body, updated_by: req.user?.id });
    return success(res, row);
  } catch (err) { return error(res, err.message || '更新元数据版本失败'); }
}

// ==================== Baseline Metrics ====================
async function getBaselineMetrics(req, res) {
  try {
    const where = {};
    const prodIds = parseIds(req.query.product_ids);
    if (prodIds.length) where.product_id = { [Op.in]: prodIds };
    if (req.query.start_date && req.query.end_date) {
      where.stat_date = { [Op.between]: [req.query.start_date, req.query.end_date] };
    }

    const rows = await AsoProductBaselineMetric.findAll({
      where,
      include: [{ model: AsoProduct, as: 'product', attributes: ['id', 'name', 'code'] }],
      order: [['stat_date', 'DESC']],
    });
    return success(res, rows);
  } catch (err) { return error(res, err.message || '获取基础指标失败'); }
}

async function upsertBaselineMetric(req, res) {
  const payload = req.body || {};
  if (!payload.stat_date) return error(res, '缺少 stat_date', 400, 400);
  if (!payload.product_id) return error(res, '缺少 product_id', 400, 400);

  try {
    const [row] = await AsoProductBaselineMetric.upsert({
      ...payload,
      source: payload.source || 'manual',
    });
    return success(res, row);
  } catch (err) { return error(res, err.message || '保存基础指标失败'); }
}

async function importBaselineMetrics(req, res) {
  try {
    if (!req.file) return error(res, '请上传Excel文件', 400, 400);
    try {
      const result = await asoImportService.importBaselineMetrics(req.file.path, {
        default_product_id: req.body.default_product_id || null,
      });
      return success(res, result);
    } finally {
      const fs = require('fs');
      fs.unlink(req.file.path, () => {});
    }
  } catch (err) {
    return error(res, err.message || '导入失败');
  }
}

module.exports = {
  getDashboard,
  getDailyMetrics, upsertDailyMetric, updateDailyMetric, deleteDailyMetric,
  getMetricSnapshots, importDailyMetrics, exportDailyMetrics,
  getCampaigns, createCampaign, updateCampaign, deleteCampaign,
  getMetadataVersions, createMetadataVersion, updateMetadataVersion,
  getBaselineMetrics, upsertBaselineMetric, importBaselineMetrics,
};
