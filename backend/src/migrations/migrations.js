/**
 * 迁移注册表（有序数组）
 * ------------------------------------------------------------------
 * 约定：
 *  - 每条迁移 id 唯一、按数字前缀排序，一经发布不可修改。
 *  - up(sequelize, helpers) 内部必须幂等（用 helpers 探测后再执行）。
 *  - 只允许新增表 / 新增列 / 新增索引；禁止删除、改类型、动数据。
 *  - 新增表优先交给 sequelize.sync({force:false}) 创建；此处只处理
 *    sync 不会做的「给已有表加列 / 加索引」以及需要确定性 DDL 的场景。
 *
 * helpers: { tableExists, columnExists, indexExists, addColumnIfMissing, getDialect, quoteIdent }
 */

module.exports = [
  // ----------------------------------------------------------------
  // 000_baseline_v4_columns
  // 把历史上散落在文档里的 V4 ALTER TABLE 固化为可重放迁移。
  // 生产库这些列早已存在 → 全部走 column-exists 跳过，纯对账，零副作用。
  // 仅用于「万一某环境漏执行过手工 ALTER」时自动补齐。
  // ----------------------------------------------------------------
  {
    id: '000_baseline_v4_columns',
    description: 'V4 历史列对账（users / projects 闭环字段，幂等补齐）',
    async up(sequelize, h) {
      const dialect = h.getDialect(sequelize);
      const bool = dialect === 'sqlite' ? 'BOOLEAN NOT NULL DEFAULT 0' : 'BOOLEAN NOT NULL DEFAULT false';

      // users 表 V4 列
      const userCols = [
        ['email', 'VARCHAR(100)'],
        ['mobile', 'VARCHAR(20)'],
        ['status', "VARCHAR(20) NOT NULL DEFAULT 'active'"],
        ['must_change_password', bool],
        ['last_login_at', dialect === 'sqlite' ? 'DATETIME' : 'TIMESTAMP'],
        ['last_login_ip', 'VARCHAR(50)'],
        ['data_scope_type', 'VARCHAR(20)'],
        ['data_scope_value', 'TEXT'],
        ['token_version', 'INTEGER NOT NULL DEFAULT 0'],
        ['cps_channel_id', 'INTEGER'],
        ['cps_role', 'VARCHAR(20)'],
        ['aso_role', 'VARCHAR(20)'],
      ];
      for (const [col, type] of userCols) {
        await h.addColumnIfMissing(sequelize, 'users', col, type);
      }

      // projects 表 V4 闭环列
      const projectCols = [
        ['year', 'INTEGER NOT NULL DEFAULT 2026'],
        ['owner_user_id', 'INTEGER'],
        ['priority', "VARCHAR(2) NOT NULL DEFAULT '中'"],
        ['next_action', 'TEXT'],
        ['action_owner_user_id', 'INTEGER'],
        ['action_due_date', 'DATE'],
        ['decision_needed', bool],
        ['decision_owner_user_id', 'INTEGER'],
        ['closed_at', dialect === 'sqlite' ? 'DATETIME' : 'TIMESTAMP'],
        ['closed_by', 'INTEGER'],
        ['block_reason', 'TEXT'],
        ['creator_id', 'INTEGER'],
        ['updater_id', 'INTEGER'],
      ];
      for (const [col, type] of projectCols) {
        await h.addColumnIfMissing(sequelize, 'projects', col, type);
      }
    },
  },
];
