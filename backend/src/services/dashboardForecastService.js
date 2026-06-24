/**
 * 驾驶舱「经营预测」引擎（自然季度口径，区别于"往前3个月"）。
 *
 * 方法（严谨、可解释、对稀疏数据稳健）：
 *  1. 本季度收官 = run-rate 与目标按"季度时间进度"加权混合：
 *     收官 = w·(actual/时间进度) + (1−w)·target，w=时间进度。
 *     —— 季度早期权重偏目标(防 actual/极小进度 爆炸)，越到季末越信实际流速。
 *  2. 环比基准 = 本年已完成自然季度的实际 QoQ 增速(数据不足则 0)。
 *  3. 下季度/本半年度/本年度 = 以收官为起点，按 (环比+自定义因子) 逐季滚动；已完成季度用实际。
 *  4. 输出 P50 + 区间 + 置信(已发生越多越准)。
 *  5. 联动 CPS 日流速(复用 cpsForecastService)作为业务级佐证。
 *
 * 自定义影响因素(factors)：scenario(乐观/中性/保守)、global_growth(季度环比%)、
 *   season_factor(季节系数)、event_pct(事件加成%)、indicator_overrides(按指标增速%)。
 */
const { Op } = require('sequelize');
const { Kpi } = require('../models');
const { getQuarterTimeProgress, getYearTimeProgress } = require('../utils/timeProgress');
const cpsForecastService = require('./cpsForecastService');

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const SCENARIO_BIAS = { optimistic: 10, neutral: 0, conservative: -10 };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function round2(v) { return Number((Number(v) || 0).toFixed(2)); }
function num(v) { return Number(v) || 0; }

function currentQuarterOf(date) {
  const m = date.getMonth();
  return m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4';
}

function normalizeFactors(f = {}) {
  const scenario = ['optimistic', 'neutral', 'conservative'].includes(f.scenario) ? f.scenario : 'neutral';
  const overrides = {};
  if (f.indicator_overrides && typeof f.indicator_overrides === 'object') {
    for (const [k, v] of Object.entries(f.indicator_overrides)) {
      const n = Number(v);
      if (Number.isFinite(n)) overrides[k] = clamp(n, -100, 200);
    }
  }
  return {
    scenario,
    global_growth: Number.isFinite(Number(f.global_growth)) ? clamp(Number(f.global_growth), -100, 200) : null, // 季度环比% (null=用历史)
    season_factor: Number.isFinite(Number(f.season_factor)) ? clamp(Number(f.season_factor), 0.2, 3) : 1,
    event_pct: Number.isFinite(Number(f.event_pct)) ? clamp(Number(f.event_pct), -100, 200) : 0,
    indicator_overrides: overrides,
  };
}

// 本年已完成自然季度的实际 QoQ 平均增速(%)
function historicalQoQ(perQ, completedQs) {
  const actuals = completedQs.map((q) => num(perQ[q]?.actual)).filter((a) => a > 0);
  if (actuals.length < 2) return 0;
  const rates = [];
  for (let i = 1; i < actuals.length; i++) {
    if (actuals[i - 1] > 0) rates.push((actuals[i] - actuals[i - 1]) / actuals[i - 1]);
  }
  if (!rates.length) return 0;
  const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
  return clamp(avg * 100, -50, 100); // 限幅,防历史异常放大
}

function gradeConf(actualShare, projectedQuarters) {
  if (actualShare >= 0.85) return 'high';
  if (projectedQuarters >= 3 || actualShare < 0.2) return 'low';
  return 'medium';
}

async function getForecast(params = {}) {
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const cq = currentQuarterOf(now);
  const cqIdx = QUARTERS.indexOf(cq);
  const factors = normalizeFactors(params.factors);
  const qProgress = getQuarterTimeProgress(cq, year, now) / 100; // 0..1
  const yProgress = getYearTimeProgress(year, now);

  // 拉本年 KPI,按指标聚合(跨部门求和),得到每指标每季的 {target, actual}
  const rows = await Kpi.findAll({
    where: { year },
    attributes: ['indicator_name', 'quarter', 'unit', 'target', 'actual'],
    raw: true,
  });
  const byIndicator = new Map();
  for (const r of rows) {
    if (!byIndicator.has(r.indicator_name)) byIndicator.set(r.indicator_name, { unit: r.unit || '', perQ: {} });
    const g = byIndicator.get(r.indicator_name);
    if (!g.perQ[r.quarter]) g.perQ[r.quarter] = { target: 0, actual: 0 };
    g.perQ[r.quarter].target += num(r.target);
    g.perQ[r.quarter].actual += num(r.actual);
  }

  const half = cqIdx < 2 ? ['Q1', 'Q2'] : ['Q3', 'Q4'];
  const scenarioBias = SCENARIO_BIAS[factors.scenario];

  const indicators = [];
  for (const [name, { unit, perQ }] of byIndicator) {
    // 已完成季度(时间进度=100 且有数据)
    const completedQs = QUARTERS.filter((q) => getQuarterTimeProgress(q, year, now) >= 100 && (num(perQ[q]?.target) > 0 || num(perQ[q]?.actual) > 0));
    const histG = historicalQoQ(perQ, completedQs);
    const baseGrowthPct = (factors.global_growth != null ? factors.global_growth : histG)
      + (factors.indicator_overrides[name] || 0) + factors.event_pct + scenarioBias;
    const gFrac = baseGrowthPct / 100;

    // 本季度收官
    const cqData = perQ[cq] || { target: 0, actual: 0 };
    const t = num(cqData.target), a = num(cqData.actual);
    let closeQ;
    if (t <= 0 && a <= 0) {
      closeQ = 0;
    } else {
      const runRate = qProgress > 0.02 ? a / qProgress : (a > 0 ? a / 0.02 : t);
      const w = clamp(qProgress, 0.1, 1);
      closeQ = w * runRate + (1 - w) * t;
    }

    // 各季投影：已完成用实际，本季用收官，未来按增速滚动 × 季节系数
    const projByQ = {};
    QUARTERS.forEach((q, idx) => {
      const tp = getQuarterTimeProgress(q, year, now);
      if (tp >= 100) { projByQ[q] = num(perQ[q]?.actual); return; }
      if (q === cq) { projByQ[q] = closeQ; return; }
      const steps = idx - cqIdx; // 距本季的季度数(>=1)
      projByQ[q] = steps > 0 ? closeQ * Math.pow(1 + gFrac, steps) * factors.season_factor : closeQ;
    });

    // 下季度(可能跨年)
    let nextQ;
    if (cqIdx < 3) nextQ = projByQ[QUARTERS[cqIdx + 1]];
    else nextQ = closeQ * (1 + gFrac) * factors.season_factor;

    const halfTotal = half.reduce((s, q) => s + num(projByQ[q]), 0);
    const yearTotal = QUARTERS.reduce((s, q) => s + num(projByQ[q]), 0);

    // 已发生占比(用于置信/区间)：年度里已完成季度的实际占年度合计
    const actualSum = completedQs.reduce((s, q) => s + num(perQ[q]?.actual), 0) + (qProgress >= 1 ? 0 : a);
    const yearActualShare = yearTotal > 0 ? clamp(actualSum / yearTotal, 0, 1) : 0;
    const futureQs = QUARTERS.filter((q) => getQuarterTimeProgress(q, year, now) < 100).length;

    // 区间：对"未投影确定"的部分给不确定带,周期越长越宽
    const band = (p50, uncertainty) => ({
      p25: round2(Math.max(0, p50 * (1 - uncertainty))),
      p50: round2(p50),
      p75: round2(p50 * (1 + uncertainty)),
    });
    const cqUnc = clamp((1 - qProgress) * 0.25, 0.02, 0.25);

    indicators.push({
      name, unit,
      basis: {
        current_quarter: cq,
        time_progress_pct: round2(qProgress * 100),
        current_actual: round2(a),
        current_target: round2(t),
        hist_qoq_pct: round2(histG),
        applied_growth_pct: round2(baseGrowthPct),
        completed_quarters: completedQs,
      },
      horizons: [
        { key: 'current_quarter', label: '本季度', ...band(closeQ, cqUnc), confidence: gradeConf(qProgress >= 1 ? 1 : qProgress, 1) },
        { key: 'next_quarter', label: '下季度', ...band(nextQ, 0.18), confidence: 'medium' },
        { key: 'half_year', label: '本半年度', ...band(halfTotal, half.includes(cq) ? cqUnc + 0.05 : 0.15), confidence: gradeConf(yearActualShare, futureQs) },
        { key: 'full_year', label: '本年度', ...band(yearTotal, clamp(0.05 + futureQs * 0.06, 0.05, 0.4)), confidence: gradeConf(yearActualShare, futureQs) },
      ],
      year_actual_share: round2(yearActualShare),
    });
  }

  // 主指标排序：GMV/净利润 优先,其余按本年度大小
  const priorityName = (n) => (n === 'GMV' ? 0 : n === '净利润' ? 1 : 2);
  indicators.sort((x, y) => priorityName(x.name) - priorityName(y.name)
    || num(y.horizons[3].p50) - num(x.horizons[3].p50));

  // CPS 业务联动(有真实日流速,作为佐证)
  let cps_linkage = null;
  try {
    const cf = await cpsForecastService.getForecast({});
    if (!cf.insufficient_data) {
      cps_linkage = {
        as_of: cf.as_of,
        renewal_daily: cf.model?.renewal_daily,
        newsign_daily: cf.model?.newsign_daily,
        horizons: (cf.horizons || []).map((h) => ({ key: h.key, label: h.label, p50: h.baseline.p50, confidence: h.confidence })),
      };
    }
  } catch (e) { /* CPS 联动失败不影响主预测 */ }

  return {
    as_of: now.toISOString().slice(0, 10),
    year,
    current_quarter: cq,
    quarter_time_progress_pct: round2(qProgress * 100),
    year_time_progress_pct: yProgress,
    factors,
    indicators,
    cps_linkage,
  };
}

module.exports = { getForecast, _internal: { normalizeFactors, historicalQoQ, currentQuarterOf } };
