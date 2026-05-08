const xlsx = require('xlsx');
const { AsoProduct, AsoKeyword, AsoDailyKeywordMetric, AsoSnapshot, AsoImportLog } = require('../models');
const asoCalc = require('./asoCalcService');
const { safeCode } = require('../utils/asoCode');

function norm(v) {
  return String(v || '').trim().toLowerCase();
}

function getCell(raw, keys) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && String(raw[key]).trim() !== '') return raw[key];
  }
  return '';
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// 中文产品名称标准化映射，防止重复创建
const ASO_PRODUCT_CODE_MAP = {
  '词典': 'dict',
  '网易有道词典': 'dict',
  '有道词典': 'dict',
  'echo': 'echo',
  'Echo': 'echo',
  '翻译官': 'translator',
  '有道翻译官': 'translator',
};

function normalizeAsoProductName(name) {
  const s = String(name || '').trim();
  if (['网易有道词典', '有道词典'].includes(s)) return '词典';
  if (['有道翻译官'].includes(s)) return '翻译官';
  if (s.toLowerCase() === 'echo') return 'echo';
  return s;
}

function stableAsoCode(name) {
  return ASO_PRODUCT_CODE_MAP[String(name || '').trim()] || ASO_PRODUCT_CODE_MAP[normalizeAsoProductName(name)] || safeCode(name, 'aso_pr');
}

async function ensureProduct(name, code) {
  if (!name) return null;
  const normalizedName = normalizeAsoProductName(name);
  const finalCode = code || stableAsoCode(normalizedName);

  let product = await AsoProduct.findOne({ where: { code: finalCode } });
  if (product) return product;

  product = await AsoProduct.findOne({ where: { name: normalizedName } });
  if (product) {
    if (product.code !== finalCode) await product.update({ code: finalCode });
    return product;
  }

  return AsoProduct.create({ code: finalCode, name: normalizedName, status: 'active' });
}

async function ensureKeyword(productId, keyword, keywordType) {
  if (!keyword || !productId) return null;
  const [kw] = await AsoKeyword.findOrCreate({
    where: { product_id: productId, keyword: String(keyword).trim() },
    defaults: { product_id: productId, keyword: String(keyword).trim(), keyword_type: keywordType || null, status: 'active' },
  });
  return kw;
}

async function importDailyMetrics(filePath, opts = {}) {
  const wb = xlsx.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  if (!rows.length) return { success: 0, skip: 0, error: 1, total: 0, errors: ['空文件'] };

  let success = 0, skip = 0;
  const errors = [];

  for (const raw of rows) {
    try {
      // 每行独立解析产品，避免多产品导入错归属
      const rowProductName = getCell(raw, ['product_name', '产品', '产品名称', 'App', '应用']);
      const rowProductCode = getCell(raw, ['product_code', '产品编码', 'code']);
      let product = null;
      if (rowProductName || rowProductCode) {
        product = await ensureProduct(rowProductName, rowProductCode);
      }
      // 兜底：使用上传时选择的默认产品
      if (!product && opts.default_product_id) {
        product = await AsoProduct.findByPk(Number(opts.default_product_id));
      }
      if (!product) {
        errors.push(`行 ${success + skip + 1}: 产品列无法识别（当前行产品名=${rowProductName || '(空)'}, 编码=${rowProductCode || '(空)'}）。请确认：①Excel有产品列 ②产品名/编码已录入系统 ③或上传时选择默认产品`);
        skip++; continue;
      }

      const keywordStr = String(getCell(raw, ['keyword', '关键词'])).trim();
      if (!keywordStr) { skip++; continue; }

      const keywordType = getCell(raw, ['keyword_type', '关键词类型', '分类']);
      const keyword = await ensureKeyword(product.id, keywordStr, keywordType);

      const statDate = String(getCell(raw, ['stat_date', '日期'])).trim() || opts.stat_date || todayString();
      if (statDate > todayString()) { errors.push(`${keywordStr}: 日期不能晚于今天`); skip++; continue; }

      const payload = {
        keyword_status: getCell(raw, ['keyword_status', '关键词状态', '状态']) || null,
        search_index: getCell(raw, ['search_index', '搜索指数', '热度']),
        popularity: getCell(raw, ['popularity', '流行度']),
        initial_rank: getCell(raw, ['initial_rank', '初始排名']),
        yesterday_rank: getCell(raw, ['yesterday_rank', '昨日排名']),
        current_rank: getCell(raw, ['current_rank', '今日排名', '当前排名']),
        best_rank: getCell(raw, ['best_rank', '优化后最高', '最高排名']),
        yesterday_volume: getCell(raw, ['yesterday_volume', '昨日量级']) || 0,
        today_volume: getCell(raw, ['today_volume', '今日量级', '量级']) || 0,
        cost_amount: getCell(raw, ['cost_amount', '消耗金额', '消耗']) || 0,
      };

      // 处理"未覆盖"等非数字排名
      const parseRank = (v) => {
        if (v === undefined || v === null || v === '') return null;
        const s = String(v).trim();
        if (s === '未覆盖' || s === '无' || s === '-' || s === 'N/A') return null;
        const n = Number(s);
        return Number.isFinite(n) && n > 0 ? n : null;
      };

      const sanitized = {
        keyword_status: payload.keyword_status || null,
        search_index: payload.search_index ? asoCalc.toInt(payload.search_index) : null,
        popularity: payload.popularity ? asoCalc.toInt(payload.popularity) : null,
        initial_rank: parseRank(payload.initial_rank),
        yesterday_rank: parseRank(payload.yesterday_rank),
        current_rank: parseRank(payload.current_rank),
        best_rank: parseRank(payload.best_rank),
        yesterday_volume: asoCalc.toInt(payload.yesterday_volume),
        today_volume: asoCalc.toInt(payload.today_volume),
        cost_amount: asoCalc.money(payload.cost_amount),
      };
      const derived = asoCalc.buildDerivedDailyFields(sanitized);

      const where = { stat_date: statDate, product_id: product.id, keyword_id: keyword.id };
      let row = await AsoDailyKeywordMetric.findOne({ where });

      if (row) {
        await AsoSnapshot.create({
          record_type: 'aso_daily_keyword_metric',
          record_id: row.id,
          version: row.version,
          payload_json: JSON.stringify(row.toJSON()),
          changed_by: opts.uploader_id,
          changed_by_name: opts.uploader_name,
          change_reason: 'excel_import',
        });
        await row.update({
          ...sanitized, ...derived,
          source: 'excel_import',
          status: 'confirmed',
          uploader_id: opts.uploader_id,
          uploader_name: opts.uploader_name,
          version: row.version + 1,
        });
      } else {
        await AsoDailyKeywordMetric.create({
          ...where, ...sanitized, ...derived,
          source: 'excel_import',
          status: 'confirmed',
          uploader_id: opts.uploader_id,
          uploader_name: opts.uploader_name,
          version: 1,
        });
      }
      success++;
    } catch (e) {
      errors.push(`行: ${e.message}`);
      skip++;
    }
  }

  await AsoImportLog.create({
    import_type: 'daily_metrics',
    product_id: null,
    file_name: opts.file_name || 'unknown',
    status: errors.length ? 'partial' : 'success',
    row_count: rows.length,
    success_count: success,
    error_count: errors.length,
    error_message: errors.length ? errors.slice(0, 20).join('\n') : null,
    uploaded_by: opts.uploader_id,
    uploaded_by_name: opts.uploader_name,
  });

  return { success, skip, error: errors.length ? 1 : 0, total: rows.length, errors: errors.slice(0, 20) };
}

module.exports = { importDailyMetrics };
