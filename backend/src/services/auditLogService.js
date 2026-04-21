const { AuditLog } = require('../models');

/**
 * 记录审计日志
 * @param {string} tableName - 表名
 * @param {number} recordId - 记录ID
 * @param {string} action - create/update/delete
 * @param {object} operator - 操作者 { id, name }
 * @param {object} oldValues - 变更前值（update/delete）
 * @param {object} newValues - 变更后值（create/update）
 */
async function logAudit(tableName, recordId, action, operator, oldValues = null, newValues = null) {
  try {
    let changedFields = null;
    if (action === 'update' && oldValues && newValues) {
      changedFields = {};
      for (const key of Object.keys(newValues)) {
        if (oldValues[key] !== undefined && oldValues[key] !== newValues[key]) {
          changedFields[key] = { old: oldValues[key], new: newValues[key] };
        }
      }
      if (Object.keys(changedFields).length === 0) changedFields = null;
    }

    await AuditLog.create({
      table_name: tableName,
      record_id: recordId,
      action,
      operator_id: operator.id,
      operator_name: operator.name,
      changed_fields: changedFields,
      old_values: oldValues,
      new_values: newValues,
      created_at: new Date()
    });
  } catch (err) {
    console.error('审计日志记录失败:', err.message);
  }
}

module.exports = { logAudit };
