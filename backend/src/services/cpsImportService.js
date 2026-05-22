const { readWorkbook, sheetToJson } = require('../utils/safeExcel');
const { Op } = require('sequelize');
const { CpsChannel, CpsProduct, CpsDailyMetric, CpsDailyMetricSnapshot, CpsUploadLog } = require('../models');
const cpsCalc = require('./cpsCalcService');
const { safeCode } = require('../utils/cpsCode');
const { parseBusinessDate } = require('../utils/businessDate');

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
  return parseBusinessDate(v);
}

async function importFromExcel(filePath, opts = {}) {
  const wb = await readWorkbook(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = sheetToJson(sheet, { defval: '' });
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

      // Excel 中可能包含原始的"实际订单数/金额"和"有效签约数/金额"，优先使用原始值
      const excelActualCount = raw.actual_count !== undefined && raw.actual_count !== '' ? Number(raw.actual_count) : (raw['实际订单数'] !== undefined && raw['实际订单数'] !== '' ? Number(raw['实际订单数']) : null);
      const excelActualAmount = raw.actual_amount !== undefined && raw.actual_amount !== '' ? Number(raw.actual_amount) : (raw['实际订单金额'] !== undefined && raw['实际订单金额'] !== '' ? Number(raw['实际订单金额']) : null);
      const excelEffectiveCount = raw.effective_count !== undefined && raw.effective_count !== '' ? Number(raw.effective_count) : (raw['有效签约数'] !== undefined && raw['有效签约数'] !== '' ? Number(raw['有效签约数']) : null);
      const excelEffectiveAmount = raw.effective_amount !== undefined && raw.effective_amount !== '' ? Number(raw.effective_amount) : (raw['有效收入'] !== undefined && raw['有效收入'] !== '' ? Number(raw['有效收入']) : null);
      const excelNewSignAmount = raw.new_sign_amount !== undefined && raw.new_sign_amount !== '' ? Number(raw.new_sign_amount) : (raw['新签约金额'] !== undefined && raw['新签约金额'] !== '' ? Number(raw['新签约金额']) : null);
      const excelNewRefundAmount = raw.new_refund_amount !== undefined && raw.new_refund_amount !== '' ? Number(raw.new_refund_amount) : (raw['新签退款金额'] !== undefined && raw['新签退款金额'] !== '' ? Number(raw['新签退款金额']) : null);
      const excelRenewalAmount = raw.renewal_amount !== undefined && raw.renewal_amount !== '' ? Number(raw.renewal_amount) : (raw['续费金额'] !== undefined && raw['续费金额'] !== '' ? Number(raw['续费金额']) : null);
      const excelRenewalRefundAmount = raw.renewal_refund_amount !== undefined && raw.renewal_refund_amount !== '' ? Number(raw.renewal_refund_amount) : (raw['续费退款金额'] !== undefined && raw['续费退款金额'] !== '' ? Number(raw['续费退款金额']) : null);

      // 如果 Excel 中有原始值（含0和负数），优先覆盖派生计算；否则保留派生值
      if (excelActualCount !== null && Number.isFinite(excelActualCount)) { derived.actual_count = excelActualCount; }
      if (excelActualAmount !== null && Number.isFinite(excelActualAmount)) { derived.actual_amount = excelActualAmount; }
      if (excelEffectiveCount !== null && Number.isFinite(excelEffectiveCount)) { derived.effective_count = excelEffectiveCount; }
      if (excelEffectiveAmount !== null && Number.isFinite(excelEffectiveAmount)) { derived.effective_amount = excelEffectiveAmount; }
      if (excelNewSignAmount !== null && Number.isFinite(excelNewSignAmount)) { derived.new_sign_amount = excelNewSignAmount; }
      if (excelNewRefundAmount !== null && Number.isFinite(excelNewRefundAmount)) { derived.new_refund_amount = excelNewRefundAmount; }
      if (excelRenewalAmount !== null && Number.isFinite(excelRenewalAmount)) { derived.renewal_amount = excelRenewalAmount; }
      if (excelRenewalRefundAmount !== null && Number.isFinite(excelRenewalRefundAmount)) { derived.renewal_refund_amount = excelRenewalRefundAmount; }
      // 每行独立解析日期，支持多日期导入
      const rowDate = formatDate(raw.stat_date || raw['日期'] || raw['月份'] || statDate);
      const where = { stat_date: rowDate, channel_id: ch.id, product_id: pr.id };
      // paranoid:false：查找包含软删除行，避免唯一索引冲突
      let row = await CpsDailyMetric.findOne({ where, paranoid: false });

      if (row) {
        if (row.deleted_at) {
          // 管理员已删除的错误数据：快照留痕 → 硬删除 → 新建（避免 restore 复活旧数据）
          await CpsDailyMetricSnapshot.create({
            metric_id: row.id, stat_date: row.stat_date, channel_id: row.channel_id, product_id: row.product_id,
            version: row.version, payload_json: JSON.stringify(row.toJSON()),
            changed_by: opts.uploader_id, changed_by_name: opts.uploader_name, change_reason: 'hard_delete_before_reimport',
          });
          await row.destroy({ force: true });
          row = await CpsDailyMetric.create({ ...where, ...input, ...derived, unit_price: unitPrice, source: importSource, uploader_id: opts.uploader_id, uploader_name: opts.uploader_name, version: 1 });
        } else {
          // 正常数据：快照 → 更新
          await CpsDailyMetricSnapshot.create({
            metric_id: row.id, stat_date: row.stat_date, channel_id: row.channel_id, product_id: row.product_id,
            version: row.version, payload_json: JSON.stringify(row.toJSON()),
            changed_by: opts.uploader_id, changed_by_name: opts.uploader_name, change_reason: importSource,
          });
          await row.update({ ...input, ...derived, unit_price: unitPrice, source: importSource, uploader_id: opts.uploader_id, uploader_name: opts.uploader_name, version: row.version + 1 });
        }
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

module.exports = { importFromExcel, __private: { formatDate } };
