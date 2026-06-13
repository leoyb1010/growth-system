/**
 * buildScopeWhere 单一事实源测试
 * 钉住数据范围 → where 的语义，防止未来重构悄悄放大/缩小可见范围（越权回归）。
 */

const test = require('node:test');
const assert = require('node:assert');
const { Op } = require('sequelize');
const { buildScopeWhere } = require('../src/utils/scopeWhere');

test('all 范围：不加任何过滤', () => {
  const w = buildScopeWhere('project', { type: 'all', deptId: 9, userId: 1 });
  assert.deepStrictEqual(Object.keys(w), []);
  assert.strictEqual(w[Op.or], undefined);
});

test('department 范围：仅按 dept_id 过滤', () => {
  const w = buildScopeWhere('project', { type: 'department', deptId: 7, userId: 1 });
  assert.strictEqual(w.dept_id, 7);
  assert.strictEqual(w[Op.or], undefined);
});

test('self 范围 / project：dept_id + (owner_user_id OR creator_id)', () => {
  const w = buildScopeWhere('project', { type: 'self', deptId: 3, userId: 42 });
  assert.strictEqual(w.dept_id, 3);
  assert.deepStrictEqual(w[Op.or], [{ owner_user_id: 42 }, { creator_id: 42 }]);
});

test('self 范围 / action_item：owner_id OR created_by', () => {
  const w = buildScopeWhere('action_item', { type: 'self', deptId: 3, userId: 42 });
  assert.deepStrictEqual(w[Op.or], [{ owner_id: 42 }, { created_by: 42 }]);
});

test('self 范围 / risk_register：owner_id OR created_by', () => {
  const w = buildScopeWhere('risk_register', { type: 'self', deptId: 3, userId: 42 });
  assert.deepStrictEqual(w[Op.or], [{ owner_id: 42 }, { created_by: 42 }]);
});

test('self 范围 / kpi：无 owner 列，只按 dept_id（不应加 Op.or）', () => {
  const w = buildScopeWhere('kpi', { type: 'self', deptId: 3, userId: 42 });
  assert.strictEqual(w.dept_id, 3);
  assert.strictEqual(w[Op.or], undefined);
});

test('cps_channel 范围 / cps：按 channel_id 过滤', () => {
  const w = buildScopeWhere('cps_metric', { type: 'cps_channel', value: 5, deptId: 3, userId: 42 });
  assert.strictEqual(w.channel_id, 5);
});

test('cps_channel 范围 / 非cps资源：退回 dept_id', () => {
  const w = buildScopeWhere('project', { type: 'cps_channel', value: 5, deptId: 3, userId: 42 });
  assert.strictEqual(w.dept_id, 3);
  assert.strictEqual(w.channel_id, undefined);
});

test('cps_channel 但未绑定渠道：抛错（安全拒绝，绝不放行全量）', () => {
  assert.throws(
    () => buildScopeWhere('cps_metric', { type: 'cps_channel', value: null, deptId: 3, userId: 42 }),
    /未绑定CPS渠道/
  );
});

test('未知范围类型：抛错而非静默放行', () => {
  assert.throws(
    () => buildScopeWhere('project', { type: 'something_new', deptId: 3, userId: 42 }),
    /数据范围配置异常/
  );
});

test('缺失 scope：抛错', () => {
  assert.throws(() => buildScopeWhere('project', null), /数据范围未初始化/);
  assert.throws(() => buildScopeWhere('project', {}), /数据范围未初始化/);
});
