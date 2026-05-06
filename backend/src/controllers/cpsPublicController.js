const crypto = require('crypto');
const { Op } = require('sequelize');
const { CpsChannel, CpsProduct, CpsDailyMetric, CpsUploadLog } = require('../models');
const { success, error } = require('../utils/response');
const cpsCalc = require('../services/cpsCalcService');

async function uploadDailyData(req, res) {
  try {
    const token = String(req.headers['x-upload-token'] || req.body?.upload_token || '');
    if (!token) return error(res, '上传 Token 缺失', 401, 401);

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    console.log('[CPS Public] upload attempt, token_hash=' + tokenHash.substring(0,8) + '...');
    const ch = await CpsChannel.findOne({ where: { upload_token: tokenHash, status: 'active' } });
    if (!ch) return error(res, '渠道不存在或 Token 无效', 403, 403);

    const payload = req.body || {};
    if (!payload.stat_date) return error(res, 'stat_date 必填', 400, 400);
    if (!payload.product_code) return error(res, 'product_code 必填', 400, 400);

    const product = await CpsProduct.findOne({ where: { code: payload.product_code, status: 'active' } });
    if (!product) return error(res, '产品不存在或已停用: ' + payload.product_code, 404, 404);

    const input = cpsCalc.sanitizeInput(payload);
    const derived = cpsCalc.buildDerivedFields({ ...input, unit_price: Number(payload.unit_price || product.unit_price || 0) });

    const where = { stat_date: payload.stat_date, channel_id: ch.id, product_id: product.id };
    let row = await CpsDailyMetric.findOne({ where });

    if (row) {
      await row.update({ ...input, ...derived, unit_price: Number(payload.unit_price || row.unit_price || 0), source: 'channel_upload', status: 'confirmed', uploader_token_hash: tokenHash, version: row.version + 1, remark: payload.remark || null });
    } else {
      row = await CpsDailyMetric.create({ ...where, ...input, ...derived, unit_price: Number(payload.unit_price || product.unit_price || 0), source: 'channel_upload', status: 'confirmed', uploader_token_hash: tokenHash, version: 1, remark: payload.remark || null });
    }

    await CpsUploadLog.upsert({ stat_date: payload.stat_date, channel_id: ch.id, status: 'success', uploaded_at: new Date(), row_count: 1, error_count: 0 });

    return success(res, { id: row.id, stat_date: row.stat_date, channel: ch.name, product_name: product.name, effective_count: row.effective_count, effective_amount: row.effective_amount, message: '数据已接收' });
  } catch (err) {
    console.error('[CPS Public] upload error:', err);
    return error(res, err.message || '数据提交失败');
  }
}

module.exports = { uploadDailyData };
