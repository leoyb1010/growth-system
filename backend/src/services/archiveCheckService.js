const { QuarterArchive } = require('../models');

const MODULE_MAP = {
  'kpis': 'kpis',
  'projects': 'projects',
  'performances': 'performances',
  'monthly_tasks': 'monthly_tasks',
  'achievements': 'achievements'
};

/**
 * 检查某模块某季度是否已归档
 * @param {string} moduleName - 模块名
 * @param {string} quarter - Q1/Q2/Q3/Q4
 * @param {number} year - 年份
 * @returns {Promise<boolean>}
 */
async function isArchived(moduleName, quarter, year) {
  if (!moduleName || !quarter || !year) return false;
  const archive = await QuarterArchive.findOne({
    where: { module: moduleName, quarter, year: parseInt(year) }
  });
  return !!archive;
}

/**
 * 通用归档校验，用于控制器中
 * @param {string} moduleName
 * @param {string} quarter
 * @param {number} year
 * @param {Function} errorFn - response.error 函数
 * @param {object} res
 * @returns {boolean} - true 表示已归档（应终止操作）
 */
async function checkArchived(moduleName, quarter, year, errorFn, res) {
  const archived = await isArchived(moduleName, quarter, year);
  if (archived) {
    errorFn(res, `该季度数据已归档，不可修改`);
    return true;
  }
  return false;
}

module.exports = { isArchived, checkArchived, MODULE_MAP };
