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
  // Excel serial date number (e.g. 46143 = 2026-05-01)
  // 标准公式：(序列号 - 25569) * 86400000，25569 = 1900-01-01与1970-01-01的天数差
  if (typeof v === 'number' && v > 40000 && v < 60000) {
    const d = new Date((v - 25569) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  // Standard date strings
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  // Chinese date with day: "2026年5月7日" or "5月7日"
  const mDay = String(v).match(/(\d{4})?[年\-\/]?(\d{1,2})[月\-\/](\d{1,2})[日号]?/);
  if (mDay && mDay[1]) return `${mDay[1]}-${mDay[2].padStart(2,'0')}-${mDay[3].padStart(2,'0')}`;
  if (mDay) {
    const y = new Date().getFullYear();
    return `${y}-${mDay[2].padStart(2,'0')}-${mDay[3].padStart(2,'0')}`;
  }
  // Chinese date month-level: "2026年1月" or "1月" or "2026-01"
  const mMth = String(v).match(/^(\d{4})?[年\-\/]?(\d{1,2})[月]?$/);
  if (mMth && mMth[1]) return `${mMth[1]}-${mMth[2].padStart(2,'0')}-01`;
  if (mMth) {
    const y = new Date().getFullYear();
    return `${y}-${mMth[2].padStart(2,'0')}-01`;
  }
  // Fallback: try slice
  return String(v).slice(0, 10);
}

async function importFromExcel(filePath, opts = {}) {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) {
    return {
      success: 0,
      skip: 0,
      error: 1,
      total: 0,
      errors: ['空文件'],
      created_channels: [],
      created_products: [],
      affected_dates: [],
      affected_channel_ids: [],
    };
  }

  const autoCreate = opts.auto_create_dim !== false;
  const forcedChannelId = opts.forced_channel_id ? Number(opts.forced_channel_id) : null;
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
    if (!forcedChannelId && !hasChannel && dim.channelName) needChannels.set(norm(dim.channelName), dim.channelName);
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
  let lastChannelName = '';
  let lastChannelCode = '';
  const affectedDates = new Set();
  const affectedChannelIds = new Set();

  for (const raw of rows) {
    try {
      const dim = extractRowDim(raw);
      if (forcedChannelId) {
        if (!dim.productName && !dim.productCode) {
          if (opts.default_product_id) {
            dim.productId = Number(opts.default_product_id);
          } else {
            skip++; continue;
          }
        }
      } else {
        // 合并行：如果当前行没有渠道信息，沿用上一行
        if (!dim.channelName && !dim.channelCode) {
          dim.channelName = lastChannelName;
          dim.channelCode = lastChannelCode;
        } else {
          lastChannelName = dim.channelName;
          lastChannelCode = dim.channelCode;
        }
        // 跳过完全空行
        if (!dim.channelName && !dim.channelCode && !dim.productName && !dim.productCode) { skip++; continue; }
      }

      const ch = forcedChannelId
        ? channels.find(c => Number(c.id) === forcedChannelId)
        : maps.channelByCode.get(dim.channelCode) || maps.channelByName.get(norm(dim.channelName));
      const pr = dim.productId
        ? products.find(p => Number(p.id) === dim.productId)
        : maps.productByCode.get(dim.productCode) || maps.productByName.get(norm(dim.productName));

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

      const importSource = opts.source || 'admin_excel_import';
      const input = cpsCalc.sanitizeInput(payload);
      const unitPrice = Number(raw.unit_price || raw['单价'] || raw['产品金额'] || pr.unit_price || 0);
      const derived = cpsCalc.buildDerivedFields({ ...input, unit_price: unitPrice });
      // 每行独立解析日期，支持多日期导入
      const rowDate = formatDate(raw.stat_date || raw['日期'] || raw['月份'] || statDate);
      const where = { stat_date: rowDate, channel_id: ch.id, product_id: pr.id };
      let row = await CpsDailyMetric.findOne({ where });

      if (row) {
        await CpsDailyMetricSnapshot.create({
          metric_id: row.id, stat_date: row.stat_date, channel_id: row.channel_id, product_id: row.product_id,
          version: row.version, payload_json: JSON.stringify(row.toJSON()),
          changed_by: opts.uploader_id, changed_by_name: opts.uploader_name, change_reason: importSource,
        });
        await row.update({ ...input, ...derived, unit_price: unitPrice, source: importSource, uploader_id: opts.uploader_id, uploader_name: opts.uploader_name, version: row.version + 1 });
      } else {
        await CpsDailyMetric.create({ ...where, ...input, ...derived, unit_price: unitPrice, source: importSource, uploader_id: opts.uploader_id, uploader_name: opts.uploader_name, version: 1 });
      }
      affectedDates.add(where.stat_date);
      affectedChannelIds.add(ch.id);
      success++;
    } catch (e) {
      errors.push(`行 ${raw.__rowNum__ || '?'}: ${e.message}`);
      skip++;
    }
  }

  return {
    success,
    skip,
    error: errors.length ? 1 : 0,
    total: rows.length,
    errors: errors.slice(0, 20),
    created_channels,
    created_products,
    affected_dates: Array.from(affectedDates).sort(),
    affected_channel_ids: Array.from(affectedChannelIds),
  };
}

module.exports = { importFromExcel };
