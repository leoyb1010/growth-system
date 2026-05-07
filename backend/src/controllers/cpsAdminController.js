const crypto = require('crypto');
const { Op } = require('sequelize');
const { CpsChannel, CpsProduct, CpsAlertRule } = require('../models');
const { success, error } = require('../utils/response');
const { safeCode, isUniqueConstraintError } = require('../utils/cpsCode');

function makeToken() { return crypto.randomBytes(32).toString('hex'); }

async function getChannels(req, res) {
  try {
    const rows = await CpsChannel.findAll({ order: [['id', 'ASC']] });
    return success(res, rows);
  } catch (err) { return error(res, err.message || '获取渠道失败'); }
}

async function createChannel(req, res) {
  try {
    const { code: inputCode, name, contact_name, contact_info, commission_rate } = req.body || {};
    if (!name || !String(name).trim()) return error(res, '渠道名称必填', 400, 400);

    const finalCode = safeCode(inputCode || name, 'ch');
    const upload_token = makeToken();
    const token_hash = crypto.createHash('sha256').update(upload_token).digest('hex');

    const ch = await CpsChannel.create({
      code: finalCode,
      name: String(name).trim(),
      contact_name,
      contact_info,
      commission_rate: commission_rate !== undefined && commission_rate !== null && commission_rate !== ''
        ? Number(commission_rate) : null,
      upload_token: token_hash,
      status: 'active',
    });

    return success(res, { ...ch.toJSON(), _upload_token_plain: upload_token }, '创建成功');
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return error(res, '渠道编码已存在，请换一个编码或留空自动生成', 400, 400);
    }
    return error(res, err.message || '创建渠道失败');
  }
}

async function updateChannel(req, res) {
  try {
    const ch = await CpsChannel.findByPk(req.params.id);
    if (!ch) return error(res, '渠道不存在', 404, 404);
    const { name, contact_name, contact_info, commission_rate, status } = req.body || {};
    await ch.update({ name: name || ch.name, contact_name: contact_name !== undefined ? contact_name : ch.contact_name, contact_info: contact_info !== undefined ? contact_info : ch.contact_info, commission_rate: commission_rate !== undefined ? Number(commission_rate) : ch.commission_rate, status: status || ch.status });
    return success(res, ch);
  } catch (err) { return error(res, err.message || '更新渠道失败'); }
}

async function regenerateToken(req, res) {
  try {
    const ch = await CpsChannel.findByPk(req.params.id);
    if (!ch) return error(res, '渠道不存在', 404, 404);
    const upload_token = makeToken();
    const token_hash = crypto.createHash('sha256').update(upload_token).digest('hex');
    await ch.update({ upload_token: token_hash });
    return success(res, { ...ch.toJSON(), _upload_token_plain: upload_token }, 'Token已重新生成');
  } catch (err) { return error(res, err.message || '重置Token失败'); }
}

async function getProducts(req, res) {
  try {
    const rows = await CpsProduct.findAll({ order: [['id', 'ASC']] });
    return success(res, rows);
  } catch (err) { return error(res, err.message || '获取产品失败'); }
}

async function createProduct(req, res) {
  try {
    const { code: inputCode, name, product_type, unit_price } = req.body || {};
    if (!name || !String(name).trim()) return error(res, '产品名称必填', 400, 400);

    const finalCode = safeCode(inputCode || name, 'pr');
    const p = await CpsProduct.create({
      code: finalCode,
      name: String(name).trim(),
      product_type,
      unit_price: unit_price !== undefined && unit_price !== null && unit_price !== '' ? Number(unit_price) : 0,
      status: 'active',
    });

    return success(res, p, '创建成功');
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return error(res, '产品编码已存在，请换一个编码或留空自动生成', 400, 400);
    }
    return error(res, err.message || '创建产品失败');
  }
}

async function updateProduct(req, res) {
  try {
    const p = await CpsProduct.findByPk(req.params.id);
    if (!p) return error(res, '产品不存在', 404, 404);
    const { name, product_type, unit_price, status } = req.body || {};
    await p.update({ name: name || p.name, product_type: product_type !== undefined ? product_type : p.product_type, unit_price: unit_price !== undefined ? Number(unit_price) : p.unit_price, status: status || p.status });
    return success(res, p);
  } catch (err) { return error(res, err.message || '更新产品失败'); }
}

async function getAlertRules(req, res) {
  try {
    const rows = await CpsAlertRule.findAll({ order: [['id', 'ASC']] });
    return success(res, rows);
  } catch (err) { return error(res, err.message || '获取预警规则失败'); }
}

async function upsertAlertRule(req, res) {
  try {
    const { id, code, name, level, metric, operator, threshold_value, min_base_value, scope_type, enabled, notify_enabled, notify_emails } = req.body || {};
    if (!code || !name || !metric) return error(res, 'code/name/metric必填', 400, 400);
    let rule;
    if (id) {
      rule = await CpsAlertRule.findByPk(id);
      if (!rule) return error(res, '规则不存在', 404, 404);
      await rule.update({ code, name, level, metric, operator, threshold_value: Number(threshold_value) || 0, min_base_value: min_base_value !== undefined ? Number(min_base_value) : rule.min_base_value, scope_type, enabled: enabled !== undefined ? enabled : rule.enabled, notify_enabled: notify_enabled !== undefined ? notify_enabled : rule.notify_enabled, notify_emails });
    } else {
      rule = await CpsAlertRule.create({ code, name, level: level || 'warning', metric, operator: operator || '>=', threshold_value: Number(threshold_value) || 0, min_base_value: min_base_value ? Number(min_base_value) : null, scope_type: scope_type || 'global', enabled: enabled !== undefined ? enabled : true, notify_enabled: !!notify_enabled, notify_emails: notify_emails || null });
    }
    return success(res, rule, id ? '更新成功' : '创建成功');
  } catch (err) { return error(res, err.message || '保存预警规则失败'); }
}

async function deleteAlertRule(req, res) {
  try {
    const rule = await CpsAlertRule.findByPk(req.params.id);
    if (!rule) return error(res, '规则不存在', 404, 404);
    await rule.destroy();
    return success(res, true, '已删除');
  } catch (err) { return error(res, err.message || '删除规则失败'); }
}

module.exports = { getChannels, createChannel, updateChannel, regenerateToken, getProducts, createProduct, updateProduct, getAlertRules, upsertAlertRule, deleteAlertRule };
