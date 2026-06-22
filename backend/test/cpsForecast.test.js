const test = require('node:test');
const assert = require('node:assert/strict');

const { _internal } = require('../src/services/cpsForecastService');
const { trimmedMean, stdDev, linearFit, buildHorizons, projectDay, normalizeScenario, gradeConfidence } = _internal;

test('trimmedMean 去掉极端值后更稳健', () => {
  // 10 个 100 + 一个 100000 离群，截尾均值应接近 100
  const vals = [...Array(10).fill(100), 100000];
  assert.ok(trimmedMean(vals) < 200, '截尾均值应抑制离群点');
  assert.equal(trimmedMean([]), 0);
});

test('linearFit 能识别上升/下降趋势与拟合度', () => {
  const up = linearFit([1, 2, 3, 4, 5]);
  assert.ok(up.slope > 0.9 && up.slope < 1.1);
  assert.ok(up.r2 > 0.99, '完美线性 r2≈1');
  const down = linearFit([5, 4, 3, 2, 1]);
  assert.ok(down.slope < 0);
});

test('stdDev 对常数序列为 0', () => {
  assert.equal(stdDev([5, 5, 5, 5]), 0);
  assert.ok(stdDev([1, 2, 3, 4, 5]) > 0);
});

test('buildHorizons 给出正确的季度/半年/年度边界（6月锚点）', () => {
  const hs = buildHorizons('2026-06-20');
  const byKey = Object.fromEntries(hs.map((h) => [h.key, h]));
  assert.equal(byKey.current_quarter.start, '2026-04-01');
  assert.equal(byKey.current_quarter.end, '2026-06-30');
  assert.equal(byKey.next_quarter.start, '2026-07-01');
  assert.equal(byKey.next_quarter.end, '2026-09-30');
  assert.equal(byKey.half_year.start, '2026-01-01');
  assert.equal(byKey.half_year.end, '2026-06-30');
  assert.equal(byKey.full_year.start, '2026-01-01');
  assert.equal(byKey.full_year.end, '2026-12-31');
});

test('buildHorizons 下季度跨年顺延（Q4 锚点）', () => {
  const hs = buildHorizons('2026-11-15');
  const byKey = Object.fromEntries(hs.map((h) => [h.key, h]));
  assert.equal(byKey.current_quarter.start, '2026-10-01');
  assert.equal(byKey.next_quarter.start, '2027-01-01');
  assert.equal(byKey.next_quarter.end, '2027-03-31');
  assert.equal(byKey.half_year.start, '2026-07-01'); // 下半年
});

test('normalizeScenario 默认值与边界裁剪', () => {
  const def = normalizeScenario({}, '2026-06-20');
  assert.equal(def.new_sign_factor, 1);
  assert.equal(def.effective_from, '2026-06-21'); // 默认锚点次日
  assert.equal(def.recover_after_days, null);
  assert.equal(def.renewal_decay_monthly, 0);
  // 越界裁剪
  assert.equal(normalizeScenario({ new_sign_factor: -3 }, '2026-06-20').new_sign_factor, 0);
  assert.equal(normalizeScenario({ new_sign_factor: 99 }, '2026-06-20').new_sign_factor, 5);
});

test('projectDay 情景因子在生效日起作用', () => {
  const model = { newsign_daily: 100, renewal_daily: 200, newsign_slope: 0, r2: 0.5 };
  const scenario = normalizeScenario({ new_sign_factor: 0 }, '2026-06-20'); // effective 06-21
  // 生效前一天：新签照常
  const before = projectDay(0, '2026-06-20', model, scenario);
  assert.equal(before.newsign_scenario, 100);
  // 生效当天：新签归零
  const after = projectDay(1, '2026-06-21', model, scenario);
  assert.equal(after.newsign_scenario, 0);
  assert.equal(after.renewal_scenario, 200); // 续费不受影响（未开启衰减）
  assert.equal(after.baseline, 300); // 基准两条流之和
});

test('projectDay 恢复期后新签回到基准', () => {
  const model = { newsign_daily: 100, renewal_daily: 200, newsign_slope: 0, r2: 0.5 };
  const scenario = normalizeScenario({ new_sign_factor: 0, recover_after_days: 5 }, '2026-06-20');
  const stopped = projectDay(3, '2026-06-23', model, scenario);
  assert.equal(stopped.newsign_scenario, 0);
  const recovered = projectDay(10, '2026-06-30', model, scenario); // 06-21 + 5 = 06-26 起恢复
  assert.equal(recovered.newsign_scenario, 100);
});

test('projectDay 续费衰减独立于新签因子，从生效日起按月线性侵蚀(可蚀到0)', () => {
  const model = { newsign_daily: 100, renewal_daily: 200, newsign_slope: 0, r2: 0.5 };
  // 即使新签维持(factor=1)，只要设了衰减就生效（修复"只拉衰减不生效"的旧 bug）
  const sc = normalizeScenario({ new_sign_factor: 1, renewal_decay_monthly: 0.2 }, '2026-06-20');
  const d30 = projectDay(30, '2026-07-21', model, sc);   // ~1个月 → 蚀20% → 80%
  assert.ok(Math.abs(d30.renewal_scenario - 160) < 1, '一个月后续费≈基准×80%');
  const d180 = projectDay(180, '2026-12-18', model, sc); // ~6个月 → 蚀>100% → 地板0
  assert.equal(d180.renewal_scenario, 0, '长期可蚀到0(已去掉0.3地板)');
});

test('projectDay 情景只作用于目标产品线份额(停某条线)', () => {
  // 目标线占新签 30% → 停投后新签只降 30%
  const model = { newsign_daily: 100, renewal_daily: 0, newsign_slope: 0, r2: 0, newsign_target_share: 0.3, renewal_target_share: 0 };
  const sc = normalizeScenario({ new_sign_factor: 0 }, '2026-06-20');
  const d = projectDay(1, '2026-06-21', model, sc);
  assert.ok(Math.abs(d.newsign_scenario - 70) < 0.01, '停目标线后新签=基准×(1-0.3)=70');
});

test('normalizeScenario 解析 target_product_ids', () => {
  assert.deepEqual(normalizeScenario({ target_product_ids: '3,5' }, '2026-06-20').target_product_ids, [3, 5]);
  assert.deepEqual(normalizeScenario({}, '2026-06-20').target_product_ids, []);
});

test('gradeConfidence 按已发生占比/周期长度/数据量分级', () => {
  assert.equal(gradeConfidence({ actualShare: 0.9, projectedDays: 10, dataDays: 50, r2: 0.5 }), 'high');
  assert.equal(gradeConfidence({ actualShare: 0, projectedDays: 194, dataDays: 50, r2: 0.5 }), 'low');
  assert.equal(gradeConfidence({ actualShare: 0.1, projectedDays: 30, dataDays: 10, r2: 0.5 }), 'low'); // 数据不足
  assert.equal(gradeConfidence({ actualShare: 0, projectedDays: 92, dataDays: 50, r2: 0.5 }), 'medium');
});
