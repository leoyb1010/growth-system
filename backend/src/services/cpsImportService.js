const xlsx = require('xlsx');
const { Op } = require('sequelize');
const { CpsChannel, CpsProduct, CpsDailyMetric, CpsDailyMetricSnapshot, CpsUploadLog } = require('../models');
const cpsCalc = require('./cpsCalcService');
const { safeCode } = require('../utils/cpsCode');

function norm(v) {
  return String(v || '').trim().toLowerCase();
}

function getCell(raw, keys) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') return raw[key];
  }
  return '';
}

function extractRowDim(raw) {
  return {
    channelCode: norm(getCell(raw, ['channel_code', '渠道编码'])),
    channelName: String(getCell(raw, ['channel_name', '渠道名称', '渠道'])).trim(),
    productCode: norm(getCell(raw, ['product_code', '产品编码'])),
    productName: String(getCell(raw, ['product_name', '产品名称', '产品'])).trim(),
  };
}

function formatDate(v) {
  if (!v) return new Date().toISOString().slice(0, 10);
  const d = new Date(v);
  return isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
}

async function importFromExcel(filePath, opts = {}) {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) return { success: 0, skip: 0, error: 1, total: 0, errors: ['空文件'], created_channels: [], created_products: [] };

  const autoCreate = opts.auto_create_dim !== false;
  const statDate = opts.stat_date || formatDate(rows[0].stat_date || rows[0]['日期'] || rows[0]['stat_date']);

  let channels = await CpsChannel.findAll({ where: { status: 'active' } });
  let products = await CpsProduct.findAll({ where: { status: 'active' } });

  const rebuildMaps = () => {
    const channelByCode = new Map(channels.map(c => [norm(c.code), c]));
    const channelByName = new Map(channels.map(c => [norm(c.name), c]));
    const productByCode = new Map(products.map(p => [norm(p.code), p]));
    const productByName = new Map(products.map(p => [norm(p.name), p]));
    return { channelByCode, channelByName, productByCode, productByName };
  };

  let maps = rebuildMaps();
  const needChannels = new Map();
  const needProducts = new Map();

  for (const raw of rows) {
    const dim = extractRowDim(raw);
    const hasChannel = (dim.channelCode && maps.channelByCode.has(dim.channelCode)) || (dim.channelName && maps.channelByName.has(norm(dim.channelName)));
    const hasProduct = (dim.productCode && maps.productByCode.has(dim.productCode)) || (dim.productName && maps.productByName.has(norm(dim.productName)));
    if (!hasChannel && dim.channelName) needChannels.set(norm(dim.channelName), dim.channelName);
    if (!hasProduct && dim.productName) needProducts.set(norm(dim.productName), dim.productName);
  }

  const created_channels = [];
  const created_products = [];

  if (autoCreate) {
    for (const name of needChannels.values()) {
      const ch = await CpsChannel.create({ code: safeCode(name, 'ch'), name, status: 'active' });
      channels.push(ch);
      created_channels.push({ id: ch.id, code: ch.code, name: ch.name });
    }
    for (const name of needProducts.values()) {
      const pr = await CpsProduct.create({ code: safeCode(name, 'pr'), name, unit_price: 0, status: 'active' });
      products.push(pr);
      created_products.push({ id: pr.id, code: pr.code, name: pr.name });
    }
    maps = rebuildMaps();
  }

  let success = 0, skip = 0;
  const errors = [];

  for (const raw of rows) {
    try {
      const dim = extractRowDim(raw);
      // 跳过空行：渠道和产品名都为空
      if (!dim.channelName && !dim.channelCode && !dim.productName && !dim.productCode) { skip++; continue; }

      const ch = opts.forced_channel_id
        ? channels.find(c => Number(c.id) === Number(opts.forced_channel_id))
        : maps.channelByCode.get(dim.channelCode) || maps.channelByName.get(norm(dim.channelName));
      const pr = maps.productByCode.get(dim.productCode) || maps.productByName.get(norm(dim.productName));

      if (!ch) { errors.push(`行 ${raw.__rowNum__ || '?'}: 未知渠道 ${dim.channelCode || dim.channelName || '(空)'}`); skip++; continue; }
      if (!pr) { errors.push(`行 ${raw.__rowNum__ || '?'}: 未知产品 ${dim.productCode || dim.productName || '(空)'}`); skip++; continue; }

      const payload = {
        new_sign_count: Number(raw.new_sign_count || raw['新签数'] || raw['新签约数'] || 0),
        new_terminate_count: Number(raw.new_terminate_count || raw['解约数'] || raw['新签解约数'] || 0),
        new_refund_count: Number(raw.new_refund_count || raw['新签退款数'] || 0),
        renewal_count: Number(raw.renewal_count || raw['续费数'] || raw['续费订单'] || 0),
        renewal_refund_count: Number(raw.renewal_refund_count || raw['续费退款数'] || raw['续费退款'] || 0),
        after_sale_refund_count: Number(raw.after_sale_refund_count || raw['售后退款数'] || 0),
        complaint_count: Number(raw.complaint_count || raw['客诉数'] || 0),
      };

      const input = cpsCalc.sanitizeInput(payload);
      const unitPrice = Number(raw.unit_price || raw['单价'] || raw['产品金额'] || pr.unit_price || 0);
      const derived = cpsCalc.buildDerivedFields({ ...input, unit_price: unitPrice });
      const where = { stat_date: formatDate(raw.stat_date || raw['日期'] || statDate), channel_id: ch.id, product_id: pr.id };
      let row = await CpsDailyMetric.findOne({ where });

      if (row) {
        await CpsDailyMetricSnapshot.create({
          metric_id: row.id, stat_date: row.stat_date, channel_id: row.channel_id, product_id: row.product_id,
          version: row.version, payload_json: JSON.stringify(row.toJSON()),
          changed_by: opts.uploader_id, changed_by_name: opts.uploader_name, change_reason: 'excel_import',
        });
        await row.update({ ...input, ...derived, unit_price: unitPrice, source: 'excel_import', uploader_id: opts.uploader_id, uploader_name: opts.uploader_name, version: row.version + 1 });
      } else {
        await CpsDailyMetric.create({ ...where, ...input, ...derived, unit_price: unitPrice, source: 'excel_import', uploader_id: opts.uploader_id, uploader_name: opts.uploader_name, version: 1 });
      }
      success++;
    } catch (e) {
      errors.push(`行 ${raw.__rowNum__ || '?'}: ${e.message}`);
      skip++;
    }
  }

  return { success, skip, error: errors.length ? 1 : 0, total: rows.length, errors: errors.slice(0, 20), created_channels, created_products };
}

module.exports = { importFromExcel };
