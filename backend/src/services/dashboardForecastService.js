/**
 * 驾驶舱「经营预测」引擎（自然季度口径，区别于"往前3个月"）。
 *
 * 方法（严谨、可解释、对稀疏数据稳健）：
 *  1. 本季度收官 = run-rate 与目标按"季度时间进度"加权混合：
 *     收官 = w·(actual/时间进度) + (1−w)·target，w=时间进度。
 *  2. 环比基准 = 本年已完成自然季度的实际 QoQ 增速(数据不足则 0)。
 *  3. 下季度/本半年度/本年度 = 以收官为起点，按 (环比+自定义因子) 逐季滚动；已完成季度用实际。
 *  4. 输出 P50 + 区间 + 置信(已发生越多越准)。
 *  5. 联动 CPS 日流速(复用 cpsForecastService)。
 *  6. 按部门分组(各部门 KPI = 该组产值，项目滚动进部门 KPI)，给"分组产值预测"。
 *
 * 自定义影响因素(factors)：scenario(乐观/中性/保守)、global_growth(季度环比%)、
 *   season_factor(季节系数)、event_pct(事件加成%)、indicator_overrides(按指标增速%)。
 */
const { Kpi, Department } = require('../models');
const { getQuarterTimeProgress, getYearTimeProgress } = require('../utils/timeProgress');
const cpsForecastService = require('./cpsForecastService');

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const SCENARIO_BIAS = { optimistic: 10, neutral: 0, conservative: -10 };
// 金额类(产值)指标，用于分组产值预测。只取部门级汇总指标，不含 GMV 拆分行(私域/学习会员等)，避免与「GMV」汇总行重复计入分组产值
const MONEY_INDICATORS = ['GMV', '净利润'];

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
    global_growth: Number.isFinite(Number(f.global_growth)) ? clamp(Number(f.global_growth), -100, 200) : null,
    season_factor: Number.isFinite(Number(f.season_factor)) ? clamp(Number(f.season_factor), 0.2, 3) : 1,
    event_pct: Number.isFinite(Number(f.event_pct)) ? clamp(Number(f.event_pct), -100, 200) : 0,
    indicator_overrides: overrides,
  };
}

function historicalQoQ(perQ, completedQs) {
  const actuals = completedQs.map((q) => num(perQ[q]?.actual)).filter((a) => a > 0);
  if (actuals.length < 2) return 0;
  const rates = [];
  for (let i = 1; i < actuals.length; i++) {
    if (actuals[i - 1] > 0) rates.push((actuals[i] - actuals[i - 1]) / actuals[i - 1]);
  }
  if (!rates.length) return 0;
  const avg = rates.reduce((s, r) => s + r, 0) / rates.length;
  return clamp(avg * 100, -50, 100);
}

function gradeConf(actualShare, projectedQuarters) {
  if (actualShare >= 0.85) return 'high';
  if (projectedQuarters >= 3 || actualShare < 0.2) return 'low';
  return 'medium';
}

// 核心：把某指标的 perQ(每季 {target,actual}) 投影成 4 周期 + basis
function projectIndicator(name, unit, perQ, ctx) {
  const { now, year, cq, cqIdx, qProgress, factors } = ctx;
  const completedQs = QUARTERS.filter((q) => getQuarterTimeProgress(q, year, now) >= 100 && (num(perQ[q]?.target) > 0 || num(perQ[q]?.actual) > 0));
  const histG = historicalQoQ(perQ, completedQs);
  const baseGrowthPct = (factors.global_growth != null ? factors.global_growth : histG)
    + (factors.indicator_overrides[name] || 0) + factors.event_pct + SCENARIO_BIAS[factors.scenario];
  const gFrac = baseGrowthPct / 100;

  const cqData = perQ[cq] || { target: 0, actual: 0 };
  const t = num(cqData.target), a = num(cqData.actual);
  let closeQ;
  if (t <= 0 && a <= 0) closeQ = 0;
  else {
    const runRate = qProgress > 0.02 ? a / qProgress : (a > 0 ? a / 0.02 : t);
    const w = clamp(qProgress, 0.1, 1);
    closeQ = w * runRate + (1 - w) * t;
  }

  const projByQ = {};
  QUARTERS.forEach((q, idx) => {
    const tp = getQuarterTimeProgress(q, year, now);
    if (tp >= 100) { projByQ[q] = num(perQ[q]?.actual); return; }
    if (q === cq) { projByQ[q] = closeQ; return; }
    const steps = idx - cqIdx;
    projByQ[q] = steps > 0 ? closeQ * Math.pow(1 + gFrac, steps) * factors.season_factor : closeQ;
  });

  let nextQ;
  if (cqIdx < 3) nextQ = projByQ[QUARTERS[cqIdx + 1]];
  else nextQ = closeQ * (1 + gFrac) * factors.season_factor;

  const half = cqIdx < 2 ? ['Q1', 'Q2'] : ['Q3', 'Q4'];
  const halfTotal = half.reduce((s, q) => s + num(projByQ[q]), 0);
  const yearTotal = QUARTERS.reduce((s, q) => s + num(projByQ[q]), 0);
  const actualSum = completedQs.reduce((s, q) => s + num(perQ[q]?.actual), 0) + (qProgress >= 1 ? 0 : a);
  const yearActualShare = yearTotal > 0 ? clamp(actualSum / yearTotal, 0, 1) : 0;
  const futureQs = QUARTERS.filter((q) => getQuarterTimeProgress(q, year, now) < 100).length;
  const cqUnc = clamp((1 - qProgress) * 0.25, 0.02, 0.25);
  const band = (p50, u) => ({ p25: round2(Math.max(0, p50 * (1 - u))), p50: round2(p50), p75: round2(p50 * (1 + u)) });

  return {
    name, unit,
    basis: {
      current_quarter: cq, time_progress_pct: round2(qProgress * 100),
      current_actual: round2(a), current_target: round2(t),
      attainment_pct: t > 0 ? round2((a / t) * 100) : null,
      hist_qoq_pct: round2(histG), applied_growth_pct: round2(baseGrowthPct), completed_quarters: completedQs,
    },
    quarter_projection: QUARTERS.map((q) => ({
      quarter: q, value: round2(projByQ[q]), is_actual: getQuarterTimeProgress(q, year, now) >= 100, is_current: q === cq,
    })),
    horizons: [
      { key: 'current_quarter', label: '本季度', ...band(closeQ, cqUnc), confidence: gradeConf(qProgress >= 1 ? 1 : qProgress, 1) },
      { key: 'next_quarter', label: '下季度', ...band(nextQ, 0.18), confidence: 'medium' },
      { key: 'half_year', label: '本半年度', ...band(halfTotal, half.includes(cq) ? cqUnc + 0.05 : 0.15), confidence: gradeConf(yearActualShare, futureQs) },
      { key: 'full_year', label: '本年度', ...band(yearTotal, clamp(0.05 + futureQs * 0.06, 0.05, 0.4)), confidence: gradeConf(yearActualShare, futureQs) },
    ],
    year_actual_share: round2(yearActualShare),
    _closeQ: closeQ, _yearTotal: yearTotal,
  };
}

function emptyPerQ() { return {}; }

async function getForecast(params = {}) {
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const cq = currentQuarterOf(now);
  const cqIdx = QUARTERS.indexOf(cq);
  const factors = normalizeFactors(params.factors);
  const qProgress = getQuarterTimeProgress(cq, year, now) / 100;
  const ctx = { now, year, cq, cqIdx, qProgress, factors };

  const rows = await Kpi.findAll({ where: { year }, attributes: ['indicator_name', 'quarter', 'unit', 'target', 'actual', 'dept_id'], raw: true });
  const depts = await Department.findAll({ attributes: ['id', 'name'], raw: true });
  const deptName = new Map(depts.map((d) => [d.id, d.name]));

  // 公司级：按指标聚合(跨部门求和)
  const byIndicator = new Map();
  // 分组级：按 (dept, indicator) 聚合
  const byDeptInd = new Map();
  for (const r of rows) {
    if (!byIndicator.has(r.indicator_name)) byIndicator.set(r.indicator_name, { unit: r.unit || '', perQ: emptyPerQ() });
    const gi = byIndicator.get(r.indicator_name);
    if (!gi.perQ[r.quarter]) gi.perQ[r.quarter] = { target: 0, actual: 0 };
    gi.perQ[r.quarter].target += num(r.target);
    gi.perQ[r.quarter].actual += num(r.actual);

    if (MONEY_INDICATORS.includes(r.indicator_name)) {
      const key = `${r.dept_id}||${r.indicator_name}`;
      if (!byDeptInd.has(key)) byDeptInd.set(key, { dept_id: r.dept_id, name: r.indicator_name, unit: r.unit || '', perQ: emptyPerQ() });
      const gd = byDeptInd.get(key);
      if (!gd.perQ[r.quarter]) gd.perQ[r.quarter] = { target: 0, actual: 0 };
      gd.perQ[r.quarter].target += num(r.target);
      gd.perQ[r.quarter].actual += num(r.actual);
    }
  }

  const indicators = [];
  for (const [name, { unit, perQ }] of byIndicator) indicators.push(projectIndicator(name, unit, perQ, ctx));
  const priorityName = (n) => (n === 'GMV' ? 0 : n === '净利润' ? 1 : 2);
  indicators.sort((x, y) => priorityName(x.name) - priorityName(y.name) || y._yearTotal - x._yearTotal);

  // 按部门分组：每个部门的各金额指标产值预测
  const deptMap = new Map();
  for (const { dept_id, name, unit, perQ } of byDeptInd.values()) {
    const proj = projectIndicator(name, unit, perQ, ctx);
    if (!deptMap.has(dept_id)) deptMap.set(dept_id, { dept_id, dept_name: deptName.get(dept_id) || `部门${dept_id}`, indicators: [], _total: 0 });
    const dg = deptMap.get(dept_id);
    dg.indicators.push({
      name, unit,
      current_quarter_close: proj.horizons[0].p50,
      full_year: proj.horizons[3].p50,
      confidence: proj.horizons[3].confidence,
      attainment_pct: proj.basis.attainment_pct,
    });
    dg._total += num(proj.horizons[3].p50);
  }
  const dept_groups = Array.from(deptMap.values()).sort((a, b) => b._total - a._total)
    .map(({ _total, ...g }) => g);

  // CPS 联动
  let cps_linkage = null;
  try {
    const cf = await cpsForecastService.getForecast({});
    if (!cf.insufficient_data) {
      cps_linkage = {
        as_of: cf.as_of, renewal_daily: cf.model?.renewal_daily, newsign_daily: cf.model?.newsign_daily,
        horizons: (cf.horizons || []).map((h) => ({ key: h.key, label: h.label, p50: h.baseline.p50, confidence: h.confidence })),
      };
    }
  } catch (e) { /* 联动失败不影响主预测 */ }

  return {
    as_of: now.toISOString().slice(0, 10),
    year, current_quarter: cq,
    quarter_time_progress_pct: round2(qProgress * 100),
    year_time_progress_pct: getYearTimeProgress(year, now),
    factors,
    indicators: indicators.map(({ _closeQ, _yearTotal, ...i }) => i),
    dept_groups,
    cps_linkage,
  };
}

module.exports = { getForecast, _internal: { normalizeFactors, historicalQoQ, currentQuarterOf, projectIndicator } };
