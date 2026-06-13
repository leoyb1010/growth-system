/**
 * 迁移 Runner 测试
 * 验证三个生产安全不变量：
 *  1. 幂等：连续执行两次，第二次零变更。
 *  2. 只增不删：迁移不会删除已有表/列/数据。
 *  3. 生产对账无副作用：当库里已有 V4 列时，baseline 迁移全部跳过、不动数据。
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { Sequelize } = require('sequelize');

const { runMigrations, helpers } = require('../src/migrations/run');

function tmpDbPath() {
  return path.join(os.tmpdir(), `mig_test_${Date.now()}_${Math.floor(process.hrtime()[1])}.sqlite`);
}

function newSequelize(storage) {
  return new Sequelize({ dialect: 'sqlite', storage, logging: false });
}

test('全新空库：runner 跑通并记账', async () => {
  const dbp = tmpDbPath();
  const sequelize = newSequelize(dbp);
  try {
    const r1 = await runMigrations(sequelize);
    // 空库里 users/projects 表不存在 → baseline 迁移内部 addColumn 全部 skip，但迁移本身会被标记 applied
    assert.ok(r1.applied.includes('000_baseline_v4_columns'));
    const [rows] = await sequelize.query('SELECT id FROM schema_migrations');
    assert.ok(rows.some((x) => x.id === '000_baseline_v4_columns'));
  } finally {
    await sequelize.close();
    fs.rmSync(dbp, { force: true });
  }
});

test('幂等：连续执行两次，第二次零应用', async () => {
  const dbp = tmpDbPath();
  const sequelize = newSequelize(dbp);
  try {
    await runMigrations(sequelize);
    const r2 = await runMigrations(sequelize);
    assert.strictEqual(r2.applied.length, 0, '第二次执行不应应用任何迁移');
    assert.ok(r2.skipped.includes('000_baseline_v4_columns'));
  } finally {
    await sequelize.close();
    fs.rmSync(dbp, { force: true });
  }
});

test('生产对账：已有完整 V4 列的库不被改动且数据保留', async () => {
  const dbp = tmpDbPath();
  const sequelize = newSequelize(dbp);
  try {
    // 模拟「累积已久的生产库」：users/projects 已含全部 V4 列 + 真实数据
    await sequelize.query(`CREATE TABLE users (
      id INTEGER PRIMARY KEY, username TEXT, name TEXT, role TEXT,
      email TEXT, mobile TEXT, status TEXT DEFAULT 'active',
      must_change_password INTEGER DEFAULT 0, last_login_at DATETIME, last_login_ip TEXT,
      data_scope_type TEXT, data_scope_value TEXT, token_version INTEGER DEFAULT 0,
      cps_channel_id INTEGER, cps_role TEXT, aso_role TEXT
    )`);
    await sequelize.query(`CREATE TABLE projects (
      id INTEGER PRIMARY KEY, name TEXT, year INTEGER DEFAULT 2026, owner_user_id INTEGER,
      priority TEXT DEFAULT '中', next_action TEXT, action_owner_user_id INTEGER, action_due_date DATE,
      decision_needed INTEGER DEFAULT 0, decision_owner_user_id INTEGER, closed_at DATETIME,
      closed_by INTEGER, block_reason TEXT, creator_id INTEGER, updater_id INTEGER
    )`);
    await sequelize.query("INSERT INTO users (id, username, name, role) VALUES (1, 'admin', '管理员', 'super_admin')");
    await sequelize.query("INSERT INTO projects (id, name) VALUES (1, '存量项目')");

    const colsBefore = (await sequelize.query('PRAGMA table_info(users)'))[0].length;

    await runMigrations(sequelize);

    // 数据仍在
    const [users] = await sequelize.query('SELECT name FROM users WHERE id = 1');
    assert.strictEqual(users[0].name, '管理员');
    const [projects] = await sequelize.query('SELECT name FROM projects WHERE id = 1');
    assert.strictEqual(projects[0].name, '存量项目');

    // 列数没变（没有重复加列、没有删列）
    const colsAfter = (await sequelize.query('PRAGMA table_info(users)'))[0].length;
    assert.strictEqual(colsAfter, colsBefore, '已有 V4 列的库列数不应变化');
  } finally {
    await sequelize.close();
    fs.rmSync(dbp, { force: true });
  }
});

test('补列：缺失列的库会被安全补齐且不动数据', async () => {
  const dbp = tmpDbPath();
  const sequelize = newSequelize(dbp);
  try {
    // 模拟一个「漏执行过手工 ALTER」的库：projects 缺 block_reason
    await sequelize.query(`CREATE TABLE projects (id INTEGER PRIMARY KEY, name TEXT, year INTEGER DEFAULT 2026)`);
    await sequelize.query("INSERT INTO projects (id, name) VALUES (1, '老项目')");
    assert.strictEqual(await helpers.columnExists(sequelize, 'projects', 'block_reason'), false);

    await runMigrations(sequelize);

    // 列被补上
    assert.strictEqual(await helpers.columnExists(sequelize, 'projects', 'block_reason'), true);
    // 数据仍在
    const [rows] = await sequelize.query('SELECT name FROM projects WHERE id = 1');
    assert.strictEqual(rows[0].name, '老项目');
  } finally {
    await sequelize.close();
    fs.rmSync(dbp, { force: true });
  }
});
