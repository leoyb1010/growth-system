const sequelize = require('../../config/database');
const { DataTypes } = require('sequelize');

// 部门表
const Department = sequelize.define('Department', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(50), allowNull: false, unique: true }
}, {
  tableName: 'departments',
  timestamps: false
});

// 用户表
const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(50), allowNull: false },
  role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'dept_staff' },
  dept_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: Department, key: 'id' } },
  password_hash: { type: DataTypes.STRING(255), allowNull: false },
  // V4 新增字段
  email: { type: DataTypes.STRING(100), allowNull: true },
  mobile: { type: DataTypes.STRING(20), allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' }, // active / disabled / pending
  must_change_password: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  last_login_at: { type: DataTypes.DATE, allowNull: true },
  last_login_ip: { type: DataTypes.STRING(50), allowNull: true },
  data_scope_type: { type: DataTypes.STRING(20), allowNull: true }, // all / department / self / custom
  data_scope_value: { type: DataTypes.TEXT, allowNull: true }, // JSON for custom
}, {
  tableName: 'users',
  timestamps: false,
  paranoid: false // 使用 deleted_at 手动管理
});

// A表：核心指标
const Kpi = sequelize.define('Kpi', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dept_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Department, key: 'id' } },
  quarter: { type: DataTypes.ENUM('Q1', 'Q2', 'Q3', 'Q4'), allowNull: false },
  year: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2026 },
  indicator_name: { type: DataTypes.STRING(100), allowNull: false }, // GMV / 净利润
  target: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  actual: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '万元' }
}, {
  tableName: 'kpis',
  timestamps: true,
  updatedAt: 'updated_at',
  createdAt: 'created_at'
});

// B表：重点工作追踪
const Project = sequelize.define('Project', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dept_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Department, key: 'id' } },
  type: { type: DataTypes.STRING(50), allowNull: false }, // 项目类型
  name: { type: DataTypes.STRING(200), allowNull: false }, // 项目名称
  owner_name: { type: DataTypes.STRING(50), allowNull: false }, // 负责人（展示用，过渡期保留）
  owner_user_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'User', key: 'id' } }, // V4: 稳定用户主键
  goal: { type: DataTypes.TEXT, allowNull: true }, // 工作目标
  weekly_progress: { type: DataTypes.TEXT, allowNull: true }, // 本周进展
  progress_pct: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // 进度%
  status: { type: DataTypes.ENUM('未启动', '进行中', '合作中', '阻塞中', '风险', '完成'), allowNull: false, defaultValue: '未启动' },
  risk_desc: { type: DataTypes.TEXT, allowNull: true }, // 风险与问题
  next_week_focus: { type: DataTypes.TEXT, allowNull: true }, // 下周重点工作
  due_date: { type: DataTypes.DATEONLY, allowNull: true }, // 预计完成时间
  quarter: { type: DataTypes.ENUM('Q1', 'Q2', 'Q3', 'Q4'), allowNull: false },
  year: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2026 },
  creator_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'User', key: 'id' } }, // 创建人
  updater_id: { type: DataTypes.INTEGER, allowNull: true }, // 最后更新人
  // V4 闭环字段
  priority: { type: DataTypes.ENUM('高', '中', '低'), allowNull: false, defaultValue: '中' },
  next_action: { type: DataTypes.TEXT, allowNull: true }, // 下一步动作
  action_owner_user_id: { type: DataTypes.INTEGER, allowNull: true }, // 动作负责人
  action_due_date: { type: DataTypes.DATEONLY, allowNull: true }, // 动作截止日
  decision_needed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, // 是否需决策
  decision_owner_user_id: { type: DataTypes.INTEGER, allowNull: true }, // 决策负责人
  closed_at: { type: DataTypes.DATE, allowNull: true }, // 关闭时间
  closed_by: { type: DataTypes.INTEGER, allowNull: true }, // 关闭人
  block_reason: { type: DataTypes.TEXT, allowNull: true }, // 阻塞原因
}, {
  tableName: 'projects',
  timestamps: true,
  updatedAt: 'updated_at',
  createdAt: 'created_at'
});

// C表：业务线业绩追踪
const Performance = sequelize.define('Performance', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dept_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Department, key: 'id' } },
  business_type: { type: DataTypes.STRING(100), allowNull: false }, // 业务类型
  indicator: { type: DataTypes.STRING(100), allowNull: false }, // 指标
  unit: { type: DataTypes.STRING(20), allowNull: false, defaultValue: '万元' },
  q1_target: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  q1_actual: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  q2_target: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  q2_actual: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  q3_target: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  q3_actual: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  q4_target: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  q4_actual: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  // 累计完成和目标由后端计算
  total_target: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  total_actual: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  gap: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  warning_status: { type: DataTypes.ENUM('正常', '预警', '严重'), allowNull: false, defaultValue: '正常' }
}, {
  tableName: 'performances',
  timestamps: true,
  updatedAt: 'updated_at',
  createdAt: 'created_at'
});

// D表：月度重点工作
const MonthlyTask = sequelize.define('MonthlyTask', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dept_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Department, key: 'id' } },
  project_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Project', key: 'id' } }, // 关联项目（可空）
  month: { type: DataTypes.STRING(10), allowNull: false }, // 格式：2026-04
  owner_name: { type: DataTypes.STRING(50), allowNull: false },
  category: { type: DataTypes.STRING(50), allowNull: false }, // 工作类别
  task: { type: DataTypes.TEXT, allowNull: false }, // 工作事项
  goal: { type: DataTypes.TEXT, allowNull: true }, // 工作目标
  actual_result: { type: DataTypes.TEXT, allowNull: true }, // 实际完成情况
  output: { type: DataTypes.TEXT, allowNull: true }, // 成果/产出
  completion_rate: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // 完成度
  status: { type: DataTypes.ENUM('未启动', '进行中', '风险', '完成'), allowNull: false, defaultValue: '未启动' },
  highlights: { type: DataTypes.TEXT, allowNull: true }, // 亮点与问题
  next_month_plan: { type: DataTypes.TEXT, allowNull: true }, // 下月跟进
  quarter: { type: DataTypes.ENUM('Q1', 'Q2', 'Q3', 'Q4'), allowNull: false },
  creator_id: { type: DataTypes.INTEGER, allowNull: true },
  updater_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'monthly_tasks',
  timestamps: true,
  updatedAt: 'updated_at',
  createdAt: 'created_at'
});

// E表：季度成果沉淀
const Achievement = sequelize.define('Achievement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dept_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Department, key: 'id' } },
  project_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'Project', key: 'id' } }, // 关联项目（可空）
  quarter: { type: DataTypes.ENUM('Q1', 'Q2', 'Q3', 'Q4'), allowNull: false },
  owner_name: { type: DataTypes.STRING(50), allowNull: false },
  achievement_type: { type: DataTypes.STRING(50), allowNull: false }, // 成果类型
  project_name: { type: DataTypes.STRING(200), allowNull: false }, // 项目/工作名称
  description: { type: DataTypes.TEXT, allowNull: true }, // 成果描述
  quantified_result: { type: DataTypes.TEXT, allowNull: true }, // 量化结果
  business_value: { type: DataTypes.TEXT, allowNull: true }, // 业务价值
  reusable_content: { type: DataTypes.TEXT, allowNull: true }, // 沉淀/可复用内容
  include_next_quarter: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }, // 纳入下季计划
  archive_owner: { type: DataTypes.STRING(50), allowNull: true }, // 沉淀负责人
  completed_at: { type: DataTypes.DATEONLY, allowNull: true }, // 完成时间
  priority: { type: DataTypes.ENUM('高', '中', '低'), allowNull: false, defaultValue: '中' },
  creator_id: { type: DataTypes.INTEGER, allowNull: true },
  updater_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'achievements',
  timestamps: true,
  updatedAt: 'updated_at',
  createdAt: 'created_at'
});

// 周报表
const WeeklyReport = sequelize.define('WeeklyReport', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  week_start: { type: DataTypes.DATEONLY, allowNull: false },
  week_end: { type: DataTypes.DATEONLY, allowNull: false },
  content_json: { type: DataTypes.JSONB, allowNull: false },
  html_content: { type: DataTypes.TEXT, allowNull: true },
  png_url: { type: DataTypes.STRING(500), allowNull: true },
  pdf_url: { type: DataTypes.STRING(500), allowNull: true },
  generated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'weekly_reports',
  timestamps: false
});

// 审计日志表
const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  table_name: { type: DataTypes.STRING(50), allowNull: false },
  record_id: { type: DataTypes.INTEGER, allowNull: false },
  action: { type: DataTypes.ENUM('create', 'update', 'delete'), allowNull: false },
  operator_id: { type: DataTypes.INTEGER, allowNull: false },
  operator_name: { type: DataTypes.STRING(50), allowNull: false },
  changed_fields: { type: DataTypes.JSONB, allowNull: true },
  old_values: { type: DataTypes.JSONB, allowNull: true },
  new_values: { type: DataTypes.JSONB, allowNull: true },
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
}, {
  tableName: 'audit_logs',
  timestamps: false
});

// 季度归档表
const QuarterArchive = sequelize.define('QuarterArchive', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  module: { type: DataTypes.ENUM('kpis', 'projects', 'performances', 'monthly_tasks', 'achievements'), allowNull: false },
  quarter: { type: DataTypes.ENUM('Q1', 'Q2', 'Q3', 'Q4'), allowNull: false },
  year: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2026 },
  archived_by: { type: DataTypes.INTEGER, allowNull: false },
  archived_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  note: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'quarter_archives',
  timestamps: false
});

// F表：项目更新日志（每日内容更新，非操作审计）
const ProjectUpdateLog = sequelize.define('ProjectUpdateLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  project_id: { type: DataTypes.INTEGER, allowNull: false },
  update_date: { type: DataTypes.DATEONLY, allowNull: false }, // 更新日期
  progress_content: { type: DataTypes.TEXT, allowNull: true }, // 本次进展
  status: { type: DataTypes.STRING(20), allowNull: true }, // 更新时状态
  progress_pct: { type: DataTypes.INTEGER, allowNull: true }, // 更新时进度
  risk_desc: { type: DataTypes.TEXT, allowNull: true }, // 风险说明
  next_action: { type: DataTypes.TEXT, allowNull: true }, // 下一步动作
  created_by: { type: DataTypes.INTEGER, allowNull: true }, // 更新人
  created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, {
  tableName: 'project_update_logs',
  timestamps: false
});

// 建立关联关系
Department.hasMany(User, { foreignKey: 'dept_id' });
User.belongsTo(Department, { foreignKey: 'dept_id' });

Department.hasMany(Kpi, { foreignKey: 'dept_id' });
Kpi.belongsTo(Department, { foreignKey: 'dept_id' });

Department.hasMany(Project, { foreignKey: 'dept_id' });
Project.belongsTo(Department, { foreignKey: 'dept_id' });

Department.hasMany(Performance, { foreignKey: 'dept_id' });
Performance.belongsTo(Department, { foreignKey: 'dept_id' });

Department.hasMany(MonthlyTask, { foreignKey: 'dept_id' });
MonthlyTask.belongsTo(Department, { foreignKey: 'dept_id' });

Department.hasMany(Achievement, { foreignKey: 'dept_id' });
Achievement.belongsTo(Department, { foreignKey: 'dept_id' });

// 项目关联：更新日志、月度任务、季度成果
Project.hasMany(ProjectUpdateLog, { foreignKey: 'project_id', as: 'UpdateLogs' });
ProjectUpdateLog.belongsTo(Project, { foreignKey: 'project_id' });

Project.hasMany(MonthlyTask, { foreignKey: 'project_id', as: 'MonthlyTasks' });
MonthlyTask.belongsTo(Project, { foreignKey: 'project_id' });

Project.hasMany(Achievement, { foreignKey: 'project_id', as: 'Achievements' });
Achievement.belongsTo(Project, { foreignKey: 'project_id' });

module.exports = {
  sequelize,
  Department,
  User,
  Kpi,
  Project,
  Performance,
  MonthlyTask,
  Achievement,
  WeeklyReport,
  AuditLog,
  QuarterArchive,
  ProjectUpdateLog
};
