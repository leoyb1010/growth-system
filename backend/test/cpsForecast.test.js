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

test('projectDay 续费衰减仅在新签走弱且开启衰减时生效', () => {
  const model = { newsign_daily: 100, renewal_daily: 200, newsign_slope: 0, r2: 0.5 };
  const scenario = normalizeScenario({ new_sign_factor: 0, renewal_decay_monthly: 0.1 }, '2026-06-20');
  const day30 = projectDay(30, '2026-07-20', model, scenario);
  assert.ok(day30.renewal_scenario < 200, '一个月后续费应被侵蚀');
  assert.ok(day30.renewal_scenario >= 60, '侵蚀有地板（不低于30%）');
});

test('gradeConfidence 按已发生占比/周期长度/数据量分级', () => {
  assert.equal(gradeConfidence({ actualShare: 0.9, projectedDays: 10, dataDays: 50, r2: 0.5 }), 'high');
  assert.equal(gradeConfidence({ actualShare: 0, projectedDays: 194, dataDays: 50, r2: 0.5 }), 'low');
  assert.equal(gradeConfidence({ actualShare: 0.1, projectedDays: 30, dataDays: 10, r2: 0.5 }), 'low'); // 数据不足
  assert.equal(gradeConfidence({ actualShare: 0, projectedDays: 92, dataDays: 50, r2: 0.5 }), 'medium');
});
