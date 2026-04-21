const { AuditLog, User } = require('../models');
const { success, error } = require('../utils/response');
const { Op } = require('sequelize');

/**
 * 获取审计日志列表（管理员）
 */
async function getAuditLogs(req, res) {
  try {
    const { table_name, action, operator_id, record_id, page = 1, pageSize = 20 } = req.query;
    const where = {};

    if (table_name) where.table_name = table_name;
    if (action) where.action = action;
    if (operator_id) where.operator_id = parseInt(operator_id);
    if (record_id) where.record_id = parseInt(record_id);

    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(pageSize),
      offset
    });

    success(res, {
      list: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(count / parseInt(pageSize))
      }
    });
  } catch (err) {
    console.error('获取审计日志失败:', err);
    error(res, '获取审计日志失败', 1, 500);
  }
}

/**
 * 获取某条记录的变更历史（版本对比）
 */
async function getRecordHistory(req, res) {
  try {
    const { table_name, record_id } = req.params;

    const logs = await AuditLog.findAll({
      where: { table_name, record_id },
      order: [['created_at', 'DESC']]
    });

    success(res, logs);
  } catch (err) {
    console.error('获取变更历史失败:', err);
    error(res, '获取变更历史失败', 1, 500);
  }
}

module.exports = { getAuditLogs, getRecordHistory };
