const xlsx = require('xlsx');
const { Op } = require('sequelize');
const { CpsChannel, CpsProduct, CpsDailyMetric, CpsDailyMetricSnapshot, CpsUploadLog } = require('../models');
const cpsCalc = require('./cpsCalcService');

async function importFromExcel(filePath, opts = {}) {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) return { success: 0, skip: 0, error: 1, errors: ['空文件'] };

  const statDate = opts.stat_date || formatDate(rows[0].stat_date || rows[0]['日期'] || rows[0]['stat_date']);
  const channels = await CpsChannel.findAll({ where: { status: 'active' } });
  const products = await CpsProduct.findAll({ where: { status: 'active' } });
  const channelMap = Object.fromEntries(channels.map(c => [String(c.code || '').toLowerCase(), c]));
  const productMap = Object.fromEntries(products.map(p => [String(p.code || '').toLowerCase(), p]));

  let success = 0, skip = 0, errors = [];

  for (const raw of rows) {
    try {
      const channelCode = String(raw.channel_code || raw['渠道编码'] || '').trim().toLowerCase();
      const productCode = String(raw.product_code || raw['产品编码'] || '').trim().toLowerCase();
      const ch = channelMap[channelCode];
      const pr = productMap[productCode];
      if (!ch) { errors.push(`未知渠道: ${channelCode}`); skip++; continue; }
      if (!pr) { errors.push(`未知产品: ${productCode}`); skip++; continue; }

      const payload = {
        new_sign_count: Number(raw.new_sign_count || raw['新签数'] || 0),
        new_terminate_count: Number(raw.new_terminate_count || raw['解约数'] || 0),
        new_refund_count: Number(raw.new_refund_count || raw['新签退款数'] || 0),
        renewal_count: Number(raw.renewal_count || raw['续费数'] || 0),
        renewal_refund_count: Number(raw.renewal_refund_count || raw['续费退款数'] || 0),
        after_sale_refund_count: Number(raw.after_sale_refund_count || raw['售后退款数'] || 0),
        complaint_count: Number(raw.complaint_count || raw['客诉数'] || 0),
      };

      const input = cpsCalc.sanitizeInput(payload);
      const derived = cpsCalc.buildDerivedFields({ ...input, unit_price: Number(raw.unit_price || pr.unit_price || 0) });

      const where = { stat_date: statDate, channel_id: ch.id, product_id: pr.id };
      let row = await CpsDailyMetric.findOne({ where });

      if (row) {
        await CpsDailyMetricSnapshot.create({
          metric_id: row.id, stat_date: row.stat_date, channel_id: row.channel_id, product_id: row.product_id,
          version: row.version, payload_json: JSON.stringify(row.toJSON()),
          changed_by: opts.uploader_id, changed_by_name: opts.uploader_name, change_reason: 'excel_import',
        });
        await row.update({ ...input, ...derived, unit_price: Number(raw.unit_price || pr.unit_price || 0), source: 'excel_import', uploader_id: opts.uploader_id, uploader_name: opts.uploader_name, version: row.version + 1 });
      } else {
        await CpsDailyMetric.create({ ...where, ...input, ...derived, unit_price: Number(raw.unit_price || pr.unit_price || 0), source: 'excel_import', uploader_id: opts.uploader_id, uploader_name: opts.uploader_name, version: 1 });
      }
      success++;
    } catch (e) { errors.push(`行 ${raw.__rowNum__ || '?'}: ${e.message}`); skip++; }
  }

  return { success, skip, error: 0, total: rows.length, errors: errors.slice(0, 20) };
}

function formatDate(v) {
  if (!v) return new Date().toISOString().slice(0, 10);
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
}

module.exports = { importFromExcel };
