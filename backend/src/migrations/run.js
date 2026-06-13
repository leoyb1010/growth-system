/**
 * 轻量数据库迁移 Runner
 * ------------------------------------------------------------------
 * 设计原则（针对「远端有累积已久的真实数据」的生产环境）：
 *  1. 只增不改不删：迁移只允许新增表 / 新增列 / 新增索引，禁止 DROP / 改列类型 / 删数据。
 *  2. 幂等：每条迁移内部都先探测「是否已存在」，已存在则跳过；整个 runner 可重复执行无副作用。
 *  3. 有记录：已执行的迁移写入 schema_migrations 表，二次执行直接跳过。
 *  4. 双方言：SQLite（生产）与 Postgres 都支持，列/表探测各自实现。
 *  5. 先于 sync：在 sequelize.sync({force:false}) 之前执行，确保「加列」这类 sync 不会做的变更被补上。
 *  6. 失败即停：任一迁移抛错则整体中止（exit 1），交由部署护栏回滚，不会留下半执行状态。
 *
 * 用法：
 *   node src/migrations/run.js            # 独立执行（CI / 手动）
 *   require('./migrations/run').runMigrations(sequelize)   # 在 app 启动时调用
 */

const path = require('path');

// ---------- 方言无关的探测工具 ----------

function getDialect(sequelize) {
  return sequelize.getDialect();
}

async function tableExists(sequelize, tableName) {
  const dialect = getDialect(sequelize);
  if (dialect === 'sqlite') {
    const [rows] = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name = :t",
      { replacements: { t: tableName } }
    );
    return rows.length > 0;
  }
  // postgres
  const [rows] = await sequelize.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = :t",
    { replacements: { t: tableName } }
  );
  return rows.length > 0;
}

async function columnExists(sequelize, tableName, columnName) {
  const dialect = getDialect(sequelize);
  if (!(await tableExists(sequelize, tableName))) return false;
  if (dialect === 'sqlite') {
    const [rows] = await sequelize.query(`PRAGMA table_info(${quoteIdent(tableName, dialect)})`);
    return rows.some((r) => r.name === columnName);
  }
  const [rows] = await sequelize.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name = :t AND column_name = :c",
    { replacements: { t: tableName, c: columnName } }
  );
  return rows.length > 0;
}

async function indexExists(sequelize, indexName) {
  const dialect = getDialect(sequelize);
  if (dialect === 'sqlite') {
    const [rows] = await sequelize.query(
      "SELECT name FROM sqlite_master WHERE type='index' AND name = :n",
      { replacements: { n: indexName } }
    );
    return rows.length > 0;
  }
  const [rows] = await sequelize.query(
    "SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname = :n",
    { replacements: { n: indexName } }
  );
  return rows.length > 0;
}

function quoteIdent(name, dialect) {
  // 简单标识符引用；迁移里的表/列名均为内部硬编码常量，非用户输入
  if (dialect === 'sqlite') return `"${name}"`;
  return `"${name}"`;
}

/**
 * 安全加列：仅当列不存在时才 ALTER TABLE ADD COLUMN。
 * @param {object} sequelize
 * @param {string} table
 * @param {string} column
 * @param {string} ddlType  例如 'INTEGER', 'TEXT', "VARCHAR(50)", 'BOOLEAN NOT NULL DEFAULT 0'
 */
async function addColumnIfMissing(sequelize, table, column, ddlType) {
  if (!(await tableExists(sequelize, table))) {
    // 表还不存在（全新库）：交给 sequelize.sync 创建，迁移跳过加列
    return { skipped: true, reason: 'table-not-exists' };
  }
  if (await columnExists(sequelize, table, column)) {
    return { skipped: true, reason: 'column-exists' };
  }
  const dialect = getDialect(sequelize);
  const sql = `ALTER TABLE ${quoteIdent(table, dialect)} ADD COLUMN ${quoteIdent(column, dialect)} ${ddlType}`;
  await sequelize.query(sql);
  return { skipped: false };
}

const helpers = { tableExists, columnExists, indexExists, addColumnIfMissing, getDialect, quoteIdent };

// ---------- 迁移注册表 ----------
// 每条迁移：{ id, description, up(sequelize, helpers) }
// id 必须唯一且有序（建议 NNN_slug）。up 内必须自身幂等。
const migrations = require('./migrations');

// ---------- schema_migrations 记账表 ----------

async function ensureMigrationTable(sequelize) {
  const dialect = getDialect(sequelize);
  if (dialect === 'sqlite') {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } else {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
  }
}

async function isApplied(sequelize, id) {
  const [rows] = await sequelize.query(
    'SELECT id FROM schema_migrations WHERE id = :id',
    { replacements: { id } }
  );
  return rows.length > 0;
}

async function markApplied(sequelize, id) {
  await sequelize.query('INSERT INTO schema_migrations (id) VALUES (:id)', {
    replacements: { id },
  });
}

/**
 * 执行所有未应用的迁移。可在 app 启动时调用，也可独立运行。
 * @returns {Promise<{applied: string[], skipped: string[]}>}
 */
async function runMigrations(sequelize) {
  await ensureMigrationTable(sequelize);

  const applied = [];
  const skipped = [];

  for (const m of migrations) {
    if (await isApplied(sequelize, m.id)) {
      skipped.push(m.id);
      continue;
    }
    console.log(`[迁移] ▶ 执行 ${m.id} — ${m.description}`);
    await m.up(sequelize, helpers);
    await markApplied(sequelize, m.id);
    applied.push(m.id);
    console.log(`[迁移] ✅ 完成 ${m.id}`);
  }

  if (applied.length === 0) {
    console.log('[迁移] 数据库已是最新，无需变更');
  } else {
    console.log(`[迁移] 本次应用 ${applied.length} 条迁移: ${applied.join(', ')}`);
  }
  return { applied, skipped };
}

module.exports = { runMigrations, helpers };

// ---------- 独立运行入口 ----------
if (require.main === module) {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), override: true });
  const sequelize = require('../../config/database');
  (async () => {
    try {
      await sequelize.authenticate();
      console.log(`[迁移] 数据库连接成功 (${sequelize.getDialect()})`);
      await runMigrations(sequelize);
      await sequelize.close();
      process.exit(0);
    } catch (err) {
      console.error('[迁移] ❌ 失败:', err.message);
      console.error(err);
      process.exit(1);
    }
  })();
}
