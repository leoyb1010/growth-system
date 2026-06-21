/**
 * CPS 连包投流 · 经营预测服务
 *
 * 设计要点（与产品同事/管理层口径一致）：
 *  1. 把"实收(actual_amount)"拆成两条流：
 *     - 续费流(连包地板)：相对稳定，作为"不投也跑得动"的底盘；
 *     - 新签流(弹性部分)：波动源，单独估趋势，也是 What-if 的旋钮。
 *     两条流按毛额占比分摊售后退款，使其之和精确等于看板的 actual_amount。
 *  2. 用"近窗稳健均值(截尾均值)"做基准，而不是单点增速——抗掉单周尖峰。
 *  3. 趋势用最小二乘拟合 + 阻尼衰减，避免把短期斜率复利成长期幻觉。
 *  4. 输出 P25/P50/P75 区间 + 置信度，而不是假装精确的单值。
 *  5. What-if：拨动新签强度/生效起点/是否恢复（可选续费衰减），看对各周期的冲击。
 *
 * 纯增量模块：不改动 cpsDashboardService 等既有逻辑。
 */
const { Op, fn, col, literal } = require('sequelize');
const { CpsDailyMetric } = require('../models');

const MS_DAY = 86400000;
const LOOKBACK_DAYS = 60;        // 取最近 60 天作为可用历史窗口
const RENEWAL_WINDOW = 28;       // 续费基准窗口（更长更稳）
const NEWSIGN_WINDOW = 14;       // 新签基准窗口（更短更敏感）
const TRIM_RATIO = 0.1;          // 截尾比例（去掉上下各 10%）
const DAMP = 0.9;                // 趋势阻尼系数
const Z_IQR = 0.674;             // P25/P75 对应的 ±0.674σ（四分位带）

/* ----------------------------- 日期工具 ----------------------------- */
function toDateStr(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}
function parseDate(value) {
  return new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
}
function addDays(value, days) {
  const d = parseDate(value);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateStr(d);
}
function daysBetween(start, end) {
  return Math.round((parseDate(end) - parseDate(start)) / MS_DAY);
}
// 方言安全：DB 取出的 stat_date 在 sqlite 是 'YYYY-MM-DD' 字符串，在 Postgres 可能是 Date 对象。
// 统一归一为 'YYYY-MM-DD'（Date 用本地日历位，与看板 normalizeStatDate 口径一致，避免时区错位）。
function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-');
  }
  return String(value).slice(0, 10);
}
function quarterOf(month0) {
  return Math.floor(month0 / 3); // 0..3
}

/* --------------------------- 统计小工具 --------------------------- */
function trimmedMean(values) {
  const arr = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (!arr.length) return 0;
  const cut = Math.floor(arr.length * TRIM_RATIO);
  const kept = arr.length - 2 * cut > 0 ? arr.slice(cut, arr.length - cut) : arr;
  return kept.reduce((s, v) => s + v, 0) / kept.length;
}
function stdDev(values) {
  const arr = values.filter((v) => Number.isFinite(v));
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}
function median(values) {
  const arr = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}
// 最小二乘：返回 { slope(每日), intercept, r2 }
function linearFit(values) {
  const n = values.length;
  if (n < 3) return { slope: 0, intercept: values[0] || 0, r2: 0 };
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sx += i; sy += values[i]; sxx += i * i; sxy += i * values[i]; syy += values[i] * values[i];
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n, r2: 0 };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const ssTot = syy - (sy * sy) / n;
  const ssRes = values.reduce((s, y, i) => s + (y - (intercept + slope * i)) ** 2, 0);
  const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { slope, intercept, r2 };
}
function round2(v) { return Number((Number(v) || 0).toFixed(2)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/* ----------------------- 维度过滤（含数据范围） ----------------------- */
function parseIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(Number).filter(Boolean);
  return String(value).split(',').map(Number).filter(Boolean);
}
function buildWhere({ channel_ids, product_ids }, windowStart, asOf) {
  const where = { deleted_at: null, stat_date: { [Op.between]: [windowStart, asOf] } };
  const ch = parseIds(channel_ids);
  const pr = parseIds(product_ids);
  if (ch.length) where.channel_id = { [Op.in]: ch };
  if (pr.length) where.product_id = { [Op.in]: pr };
  return where;
}

/* ------------------------- 取按日聚合的历史 ------------------------- */
async function loadDailySeries(filters, windowStart, asOf) {
  const rows = await CpsDailyMetric.findAll({
    where: buildWhere(filters, windowStart, asOf),
    attributes: [
      'stat_date',
      [fn('COALESCE', fn('SUM', col('new_sign_amount')), 0), 'new_sign_amount'],
      [fn('COALESCE', fn('SUM', col('new_refund_amount')), 0), 'new_refund_amount'],
      [fn('COALESCE', fn('SUM', col('renewal_amount')), 0), 'renewal_amount'],
      [fn('COALESCE', fn('SUM', col('renewal_refund_amount')), 0), 'renewal_refund_amount'],
      [fn('COALESCE', fn('SUM', col('actual_amount')), 0), 'actual_amount'],
      [fn('COALESCE', fn('SUM', col('new_sign_count')), 0), 'new_sign_count'],
      [fn('COALESCE', fn('SUM', col('renewal_count')), 0), 'renewal_count'],
    ],
    group: ['stat_date'],
    order: [['stat_date', 'ASC']],
    raw: true,
  });

  // 把每天拆成 续费净额 / 新签净额，两者之和 = actual_amount（按毛额占比分摊售后退款）
  return rows.map((r) => {
    const newGross = Number(r.new_sign_amount) || 0;
    const renewGross = Number(r.renewal_amount) || 0;
    const actual = Number(r.actual_amount) || 0;
    const gross = newGross + renewGross;
    // 售后退款等隐含扣减 = 毛额 - 实收（>=0），按占比分摊回两条流
    const deduction = gross - actual;
    const newShare = gross > 0 ? newGross / gross : 0.5;
    const newsign_net = newGross - deduction * newShare;
    const renewal_net = renewGross - deduction * (1 - newShare);
    return {
      date: normalizeDate(r.stat_date),
      actual_amount: actual,
      newsign_net,
      renewal_net,
      new_sign_count: Number(r.new_sign_count) || 0,
      renewal_count: Number(r.renewal_count) || 0,
    };
  });
}

// 统计 [start, end] 区间内的实收合计（含 1-4 月的整月汇总行，不受模型窗口限制）
async function sumActual(filters, start, end) {
  const row = await CpsDailyMetric.findOne({
    where: buildWhere(filters, start, end),
    attributes: [[fn('COALESCE', fn('SUM', col('actual_amount')), 0), 'amt']],
    raw: true,
  });
  return Number(row?.amt) || 0;
}

// 构建周序列（供前端"实际→预测分叉图"）：历史实际 + 未来基准/情景预测，按 7 天分桶
function buildWeeklySeries(series, asOf, end, model, scenario) {
  const actualMap = new Map(series.map((r) => [r.date, r.actual_amount]));
  const start = series.length ? series[0].date : addDays(asOf, -28);
  const weeks = new Map();
  const totalDays = daysBetween(start, end) + 1;
  for (let i = 0; i < totalDays; i++) {
    const dateStr = addDays(start, i);
    const wk = Math.floor(daysBetween(start, dateStr) / 7);
    let b = weeks.get(wk);
    if (!b) { b = { week: addDays(start, wk * 7), actual: 0, baseline: 0, scenario: 0, hasActual: false, hasProj: false }; weeks.set(wk, b); }
    if (dateStr <= asOf) {
      if (actualMap.has(dateStr)) { b.actual += actualMap.get(dateStr); b.hasActual = true; }
    } else {
      const day = projectDay(daysBetween(asOf, dateStr), dateStr, model, scenario);
      b.baseline += day.baseline; b.scenario += day.scenario; b.hasProj = true;
    }
  }
  return Array.from(weeks.values()).map((b) => ({
    week: b.week,
    actual: b.hasActual ? round2(b.actual) : null,
    baseline: b.hasProj ? round2(b.baseline) : null,
    scenario: b.hasProj ? round2(b.scenario) : null,
  }));
}

/* --------------------------- 周期定义 --------------------------- */
// 返回包含 asOf 的"本季度 / 本半年 / 本年度" + 紧邻的"下季度"
function buildHorizons(asOf) {
  const d = parseDate(asOf);
  const year = d.getUTCFullYear();
  const m0 = d.getUTCMonth();
  const q = quarterOf(m0); // 0..3

  const qStart = toDateStr(new Date(Date.UTC(year, q * 3, 1)));
  const qEnd = toDateStr(new Date(Date.UTC(year, q * 3 + 3, 0)));

  // 下季度（跨年顺延）
  const nq = (q + 1) % 4;
  const nqYear = q === 3 ? year + 1 : year;
  const nqStart = toDateStr(new Date(Date.UTC(nqYear, nq * 3, 1)));
  const nqEnd = toDateStr(new Date(Date.UTC(nqYear, nq * 3 + 3, 0)));

  // 本半年
  const half = m0 < 6 ? 0 : 1;
  const hStart = toDateStr(new Date(Date.UTC(year, half * 6, 1)));
  const hEnd = toDateStr(new Date(Date.UTC(year, half * 6 + 6, 0)));

  return [
    { key: 'current_quarter', label: '本季度', start: qStart, end: qEnd },
    { key: 'next_quarter', label: '下季度', start: nqStart, end: nqEnd },
    { key: 'half_year', label: '本半年度', start: hStart, end: hEnd },
    { key: 'full_year', label: '本年度', start: `${year}-01-01`, end: `${year}-12-31` },
  ];
}

/* --------------------------- 情景归一化 --------------------------- */
function normalizeScenario(scenario = {}, asOf) {
  const factor = scenario.new_sign_factor;
  return {
    new_sign_factor: Number.isFinite(Number(factor)) ? clamp(Number(factor), 0, 5) : 1,
    effective_from: scenario.effective_from ? String(scenario.effective_from).slice(0, 10) : addDays(asOf, 1),
    recover_after_days: Number.isFinite(Number(scenario.recover_after_days)) && Number(scenario.recover_after_days) > 0
      ? Math.round(Number(scenario.recover_after_days)) : null,
    // 续费随新签下滑的延迟衰减（每月侵蚀比例 0~1），默认 0=不衰减
    renewal_decay_monthly: Number.isFinite(Number(scenario.renewal_decay_monthly))
      ? clamp(Number(scenario.renewal_decay_monthly), 0, 1) : 0,
  };
}

/* ------------------- 逐日投影：基准 & 情景 ------------------- */
// 返回某日的 { baseline, scenario }（净实收）
function projectDay(k, dateStr, model, scenario) {
  // 新签：基准 = 截尾日均 + 阻尼趋势；阻尼累积 (1-φ^k)/(1-φ) 会饱和，防止爆炸。
  // 趋势贡献再封顶 ±35% 日均，避免把 7-14 天短期斜率过度外推成长期幻觉。
  const damped = (1 - DAMP ** k) / (1 - DAMP);
  // 用绝对值,保证 clamp 上下界正确(防新签日均为负时 [-cap,cap] 反转)
  const trendCap = Math.abs(0.35 * model.newsign_daily);
  const trendAdj = clamp(model.newsign_slope * damped, -trendCap, trendCap);
  let newsignBase = Math.max(0, model.newsign_daily + trendAdj);

  // 情景因子：到达生效日后乘 factor；若设定恢复，恢复日后回到 1
  let factor = 1;
  if (dateStr >= scenario.effective_from) {
    factor = scenario.new_sign_factor;
    if (scenario.recover_after_days != null) {
      const recoverDate = addDays(scenario.effective_from, scenario.recover_after_days);
      if (dateStr >= recoverDate) factor = 1;
    }
  }
  const newsignScenario = newsignBase * factor;

  // 续费：基准持平；情景下若新签走弱且开启衰减，续费地板按月延迟侵蚀
  let renewalBase = model.renewal_daily;
  let renewalScenario = renewalBase;
  if (scenario.renewal_decay_monthly > 0 && scenario.new_sign_factor < 1) {
    const monthsOut = k / 30;
    const erosion = scenario.renewal_decay_monthly * monthsOut * (1 - scenario.new_sign_factor);
    renewalScenario = renewalBase * Math.max(0.3, 1 - erosion);
  }

  return {
    baseline: newsignBase + renewalBase,
    scenario: newsignScenario + renewalScenario,
    newsign_baseline: newsignBase,
    newsign_scenario: newsignScenario,
    renewal_baseline: renewalBase,
    renewal_scenario: renewalScenario,
  };
}

/* --------------------------- 置信度评级 --------------------------- */
function gradeConfidence({ actualShare, projectedDays, dataDays, r2 }) {
  if (dataDays < 21 || projectedDays > 150) return 'low';
  if (actualShare >= 0.7 && dataDays >= 30) return 'high';
  if (projectedDays > 100 || (r2 < 0.1 && actualShare < 0.3)) return 'low';
  return 'medium';
}

/* =============================== 主入口 =============================== */
async function getForecast(params = {}) {
  const filters = { channel_ids: params.channel_ids, product_ids: params.product_ids };

  // 锚点日：默认取该维度下最新有数据的日期，否则昨天
  const yesterday = toDateStr(new Date(Date.now() - MS_DAY));
  const latestRow = await CpsDailyMetric.findOne({
    where: buildWhere(filters, '1970-01-01', yesterday),
    attributes: [[fn('MAX', col('stat_date')), 'd']],
    raw: true,
  });
  const asOf = params.as_of ? String(params.as_of).slice(0, 10) : (normalizeDate(latestRow?.d) || yesterday);

  const windowStart = addDays(asOf, -LOOKBACK_DAYS + 1);
  const series = await loadDailySeries(filters, windowStart, asOf);

  const scenario = normalizeScenario(params.scenario, asOf);

  // 数据不足：返回空壳，前端给"数据不足"提示而不是报错
  if (series.length < 7) {
    return {
      as_of: asOf,
      insufficient_data: true,
      data_days: series.length,
      message: '连续日数据不足（需≥7天），无法给出可信预测',
      scenario,
      horizons: [],
    };
  }

  // 剔除"整月汇总"等离群行（>3×中位数），避免污染日均/趋势；正常日数据下此步为空操作
  const med = median(series.map((r) => r.actual_amount));
  const modelSeries = med > 0 ? series.filter((r) => r.actual_amount <= med * 3 && r.actual_amount >= 0) : series;
  const dataDays = modelSeries.length;

  // 取尾部子窗口算基准（稳健截尾均值）
  const newsign_daily = trimmedMean(modelSeries.slice(-NEWSIGN_WINDOW).map((r) => r.newsign_net));
  const renewal_daily = trimmedMean(modelSeries.slice(-RENEWAL_WINDOW).map((r) => r.renewal_net));

  // 趋势：对新签净额拟合（续费当稳），阻尼后纳入投影
  const fit = linearFit(modelSeries.slice(-NEWSIGN_WINDOW).map((r) => r.newsign_net));
  const dailyVol = stdDev(modelSeries.slice(-NEWSIGN_WINDOW).map((r) => r.actual_amount));

  const model = {
    newsign_daily,
    renewal_daily,
    newsign_slope: fit.slope,
    r2: fit.r2,
  };

  const horizonsDef = buildHorizons(asOf);

  // 各周期"已发生"实收：统计全部历史（含 1-4 月整月汇总），与模型窗口解耦
  const actualToDateList = await Promise.all(
    horizonsDef.map((h) => (h.start <= asOf ? sumActual(filters, h.start, asOf < h.end ? asOf : h.end) : Promise.resolve(0)))
  );

  const horizons = horizonsDef.map((h, idx) => {
    const actualToDate = actualToDateList[idx];

    // 预测部分：max(asOf+1, h.start) ~ h.end 逐日累加
    const projStart = h.start > asOf ? h.start : addDays(asOf, 1);
    let projectedDays = 0;
    let baselineProj = 0, scenarioProj = 0;
    let newsignBaseProj = 0, newsignScenProj = 0, renewalBaseProj = 0, renewalScenProj = 0;
    if (projStart <= h.end) {
      const total = daysBetween(projStart, h.end) + 1;
      for (let i = 0; i < total; i++) {
        const dateStr = addDays(projStart, i);
        const k = daysBetween(asOf, dateStr); // 距锚点的天数（用于趋势/衰减）
        const day = projectDay(k, dateStr, model, scenario);
        baselineProj += day.baseline;
        scenarioProj += day.scenario;
        newsignBaseProj += day.newsign_baseline;
        newsignScenProj += day.newsign_scenario;
        renewalBaseProj += day.renewal_baseline;
        renewalScenProj += day.renewal_scenario;
        projectedDays++;
      }
    }

    const p50Baseline = actualToDate + baselineProj;
    const p50Scenario = actualToDate + scenarioProj;
    // 区间：只对"预测部分"加不确定性，已发生部分不抖动。
    // 两部分叠加：①日噪声 Z·σ·√天数 ②系统性误差(趋势估偏)，按周期长度放宽，避免长周期假精确。
    const noise = Z_IQR * dailyVol * Math.sqrt(Math.max(projectedDays, 0));
    const systematic = baselineProj * clamp(0.02 * (projectedDays / 30), 0, 0.45);
    const band = noise + systematic;
    const actualShare = p50Baseline > 0 ? actualToDate / p50Baseline : 1;
    const confidence = gradeConfidence({ actualShare, projectedDays, dataDays, r2: fit.r2 });

    return {
      key: h.key,
      label: h.label,
      range: { start: h.start, end: h.end },
      projected_days: projectedDays,
      actual_to_date: round2(actualToDate),
      actual_share: Number(actualShare.toFixed(3)),
      confidence,
      baseline: {
        p25: round2(Math.max(0, p50Baseline - band)),
        p50: round2(p50Baseline),
        p75: round2(p50Baseline + band),
      },
      scenario: {
        p50: round2(p50Scenario),
        p25: round2(Math.max(0, p50Scenario - band)),
        p75: round2(p50Scenario + band),
      },
      delta: {
        amount: round2(p50Scenario - p50Baseline),
        pct: p50Baseline > 0 ? Number((((p50Scenario - p50Baseline) / p50Baseline) * 100).toFixed(2)) : null,
      },
      breakdown: {
        renewal_floor: round2(renewalBaseProj),
        renewal_floor_scenario: round2(renewalScenProj),
        newsign_baseline: round2(newsignBaseProj),
        newsign_scenario: round2(newsignScenProj),
      },
    };
  });

  const renewalShare = (newsign_daily + renewal_daily) > 0
    ? renewal_daily / (newsign_daily + renewal_daily) : 0;

  const fullYearEnd = horizonsDef.find((h) => h.key === 'full_year').end;
  const series_weekly = buildWeeklySeries(modelSeries, asOf, fullYearEnd, model, scenario);

  return {
    as_of: asOf,
    insufficient_data: false,
    data_days: dataDays,
    window: { start: windowStart, end: asOf },
    scenario,
    model: {
      newsign_daily: round2(newsign_daily),
      renewal_daily: round2(renewal_daily),
      renewal_share_pct: Number((renewalShare * 100).toFixed(1)),
      daily_volatility: round2(dailyVol),
      trend_slope_per_day: round2(fit.slope),
      trend_r2: Number(fit.r2.toFixed(3)),
    },
    horizons,
    series_weekly,
  };
}

module.exports = {
  getForecast,
  // 导出纯函数便于单测
  _internal: { trimmedMean, stdDev, linearFit, buildHorizons, projectDay, normalizeScenario, gradeConfidence },
};
