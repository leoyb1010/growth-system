const { AsoProduct, AsoKeyword } = require('../models');
const { success, error } = require('../utils/response');
const { safeCode, isUniqueConstraintError } = require('../utils/asoCode');

// ==================== 产品字典 ====================
async function getProducts(req, res) {
  try {
    const rows = await AsoProduct.findAll({ order: [['id', 'ASC']] });
    return success(res, rows);
  } catch (err) { return error(res, err.message || '获取产品失败'); }
}

async function createProduct(req, res) {
  try {
    const { code: inputCode, name, app_store_id, bundle_id, category, owner_name } = req.body || {};
    if (!name || !String(name).trim()) return error(res, '产品名称必填', 400, 400);

    const finalCode = safeCode(inputCode || name, 'aso_pr');
    const p = await AsoProduct.create({
      code: finalCode,
      name: String(name).trim(),
      app_store_id: app_store_id || null,
      bundle_id: bundle_id || null,
      category: category || null,
      owner_name: owner_name || null,
      status: 'active',
    });
    return success(res, p, '创建成功');
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return error(res, '产品编码已存在', 400, 400);
    }
    return error(res, err.message || '创建产品失败');
  }
}

async function updateProduct(req, res) {
  try {
    const p = await AsoProduct.findByPk(req.params.id);
    if (!p) return error(res, '产品不存在', 404, 404);
    const { name, app_store_id, bundle_id, category, owner_name, status } = req.body || {};
    await p.update({
      name: name || p.name,
      app_store_id: app_store_id !== undefined ? app_store_id : p.app_store_id,
      bundle_id: bundle_id !== undefined ? bundle_id : p.bundle_id,
      category: category !== undefined ? category : p.category,
      owner_name: owner_name !== undefined ? owner_name : p.owner_name,
      status: status || p.status,
    });
    return success(res, p);
  } catch (err) { return error(res, err.message || '更新产品失败'); }
}

// ==================== 关键词字典 ====================
async function getKeywords(req, res) {
  try {
    const where = {};
    if (req.query.product_id) where.product_id = Number(req.query.product_id);
    if (req.query.keyword_type) where.keyword_type = req.query.keyword_type;
    if (req.query.keyword_group) where.keyword_group = req.query.keyword_group;
    if (req.query.status) where.status = req.query.status;

    const page = Math.max(Number(req.query.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 50, 1), 200);

    const result = await AsoKeyword.findAndCountAll({
      where,
      include: [{ model: AsoProduct, as: 'product', attributes: ['id', 'name', 'code'] }],
      order: [['id', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    return success(res, { rows: result.rows, total: result.count, page, pageSize });
  } catch (err) { return error(res, err.message || '获取关键词失败'); }
}

async function createKeyword(req, res) {
  try {
    const { product_id, keyword, keyword_type, keyword_group, language, search_index, popularity } = req.body || {};
    if (!product_id) return error(res, '缺少 product_id', 400, 400);
    if (!keyword || !String(keyword).trim()) return error(res, '关键词必填', 400, 400);

    const kw = await AsoKeyword.create({
      product_id: Number(product_id),
      keyword: String(keyword).trim(),
      keyword_type: keyword_type || null,
      keyword_group: keyword_group || null,
      language: language || null,
      search_index: search_index !== undefined && search_index !== null ? Number(search_index) : null,
      popularity: popularity !== undefined && popularity !== null ? Number(popularity) : null,
      status: 'active',
    });
    return success(res, kw, '创建成功');
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return error(res, '该产品下已存在相同关键词', 400, 400);
    }
    return error(res, err.message || '创建关键词失败');
  }
}

async function updateKeyword(req, res) {
  try {
    const kw = await AsoKeyword.findByPk(req.params.id);
    if (!kw) return error(res, '关键词不存在', 404, 404);
    const { keyword, keyword_type, keyword_group, language, search_index, popularity, status } = req.body || {};
    await kw.update({
      keyword: keyword || kw.keyword,
      keyword_type: keyword_type !== undefined ? keyword_type : kw.keyword_type,
      keyword_group: keyword_group !== undefined ? keyword_group : kw.keyword_group,
      language: language !== undefined ? language : kw.language,
      search_index: search_index !== undefined ? (search_index !== null ? Number(search_index) : null) : kw.search_index,
      popularity: popularity !== undefined ? (popularity !== null ? Number(popularity) : null) : kw.popularity,
      status: status || kw.status,
    });
    return success(res, kw);
  } catch (err) { return error(res, err.message || '更新关键词失败'); }
}

module.exports = { getProducts, createProduct, updateProduct, getKeywords, createKeyword, updateKeyword };
