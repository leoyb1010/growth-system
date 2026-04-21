const { QuarterArchive } = require('../models');
const { success, error } = require('../utils/response');
const { logAudit } = require('../services/auditLogService');

/**
 * 获取归档列表
 */
async function getArchives(req, res) {
  try {
    const { module, quarter, year } = req.query;
    const where = {};
    if (module) where.module = module;
    if (quarter) where.quarter = quarter;
    if (year) where.year = parseInt(year);

    const archives = await QuarterArchive.findAll({
      where,
      order: [['archived_at', 'DESC']]
    });

    success(res, archives);
  } catch (err) {
    console.error('获取归档列表失败:', err);
    error(res, '获取归档列表失败', 1, 500);
  }
}

/**
 * 创建归档（管理员）
 */
async function createArchive(req, res) {
  try {
    const { module, quarter, year, note } = req.body;

    if (!module || !quarter || !year) {
      return error(res, '模块、季度和年份不能为空');
    }

    const [archive, created] = await QuarterArchive.findOrCreate({
      where: { module, quarter, year },
      defaults: {
        module,
        quarter,
        year: parseInt(year),
        archived_by: req.user.id,
        note: note || '',
        archived_at: new Date()
      }
    });

    if (!created) {
      return error(res, '该模块季度已归档');
    }

    await logAudit('quarter_archives', archive.id, 'create', {
      id: req.user.id,
      name: req.user.name || req.user.username
    });

    success(res, archive, '归档成功');
  } catch (err) {
    console.error('创建归档失败:', err);
    error(res, '创建归档失败', 1, 500);
  }
}

/**
 * 取消归档（管理员）
 */
async function deleteArchive(req, res) {
  try {
    const { id } = req.params;
    const archive = await QuarterArchive.findByPk(id);

    if (!archive) {
      return error(res, '归档记录不存在');
    }

    await archive.destroy();

    await logAudit('quarter_archives', id, 'delete', {
      id: req.user.id,
      name: req.user.name || req.user.username
    });

    success(res, null, '已取消归档');
  } catch (err) {
    console.error('取消归档失败:', err);
    error(res, '取消归档失败', 1, 500);
  }
}

/**
 * 检查某模块季度是否已归档
 */
async function checkArchiveStatus(req, res) {
  try {
    const { module, quarter, year } = req.query;

    if (!module || !quarter || !year) {
      return error(res, '缺少必要参数');
    }

    const archive = await QuarterArchive.findOne({
      where: { module, quarter, year: parseInt(year) }
    });

    success(res, {
      archived: !!archive,
      archive: archive || null
    });
  } catch (err) {
    console.error('检查归档状态失败:', err);
    error(res, '检查归档状态失败', 1, 500);
  }
}

module.exports = { getArchives, createArchive, deleteArchive, checkArchiveStatus };
