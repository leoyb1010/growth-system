const test = require('node:test');
const assert = require('node:assert/strict');
const { _internal } = require('../src/services/dashboardForecastService');
const { normalizeFactors, historicalQoQ, currentQuarterOf } = _internal;

test('currentQuarterOf 按自然季度映射', () => {
  assert.equal(currentQuarterOf(new Date('2026-02-10')), 'Q1');
  assert.equal(currentQuarterOf(new Date('2026-06-24')), 'Q2');
  assert.equal(currentQuarterOf(new Date('2026-08-01')), 'Q3');
  assert.equal(currentQuarterOf(new Date('2026-12-31')), 'Q4');
});

test('normalizeFactors 默认值与裁剪', () => {
  const d = normalizeFactors({});
  assert.equal(d.scenario, 'neutral');
  assert.equal(d.global_growth, null);
  assert.equal(d.season_factor, 1);
  assert.equal(d.event_pct, 0);
  const c = normalizeFactors({ scenario: 'optimistic', global_growth: 999, season_factor: 5, event_pct: -999 });
  assert.equal(c.scenario, 'optimistic');
  assert.equal(c.global_growth, 200);   // 上限
  assert.equal(c.season_factor, 3);     // 上限
  assert.equal(c.event_pct, -100);      // 下限
});

test('historicalQoQ 计算已完成季度环比均值(限幅)', () => {
  const perQ = { Q1: { actual: 100 }, Q2: { actual: 110 }, Q3: { actual: 121 } };
  const g = historicalQoQ(perQ, ['Q1', 'Q2', 'Q3']);
  assert.ok(Math.abs(g - 10) < 0.01, '连续 +10% → 约 10');
  assert.equal(historicalQoQ({ Q1: { actual: 100 } }, ['Q1']), 0, '不足2季 → 0');
});
