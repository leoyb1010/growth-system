/**
 * TODO: 此文件包含了所有模型定义（Department, User, Kpi, Project, Performance,
 * MonthlyTask, Achievement, WeeklyReport, AuditLog, QuarterArchive, ProjectUpdateLog,
 * ActionItem, RiskRegister, AiCallLog, AiResultCache, RefreshToken, CpsChannel,
 * CpsProduct, CpsDailyMetric, CpsDailyMetricSnapshot, CpsUploadLog, CpsAlertRule,
 * CpsAlertEvent, AsoProduct, AsoKeyword, AsoDailyKeywordMetric, AsoCampaign,
 * AsoCampaignKeyword, AsoCampaignDailyPlan, AsoProductBaselineMetric,
 * AsoMetadataVersion, AsoSnapshot, AsoImportLog）。
 * 建议在后续重构中拆分为独立的模型文件（如 models/User.js, models/Project.js）
 * 以提高可维护性和降低单文件认知负担。
 */
const sequelize = require('../../config/database');
const { DataTypes } = require('sequelize');

// 部门表
const Department = sequelize.define('Department', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' }, // active / deleted
  type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'team' }, // team / manager
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
  // V6 安全字段
  token_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  cps_channel_id: { type: DataTypes.INTEGER, allowNull: true },
  cps_role: { type: DataTypes.STRING(20), allowNull: true },
  aso_role: { type: DataTypes.STRING(20), allowNull: true },
  // token版本号，修改后强制重登录
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
  createdAt: 'created_at',
  paranoid: true,
  deletedAt: 'deleted_at'
});

// B表：重点工作追踪
const Project = sequelize.define('Project', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dept_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Department, key: 'id' } },
  type: { type: DataTypes.STRING(50), allowNull: false }, // 项目类型
  name: { type: DataTypes.STRING(200), allowNull: false }, // 项目名称
  owner_name: { type: DataTypes.STRING(50), allowNull: false }, // 负责人（展示用，过渡期保留）
  owner_user_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: User, key: 'id' } }, // V4: 稳定用户主键
  goal: { type: DataTypes.TEXT, allowNull: true }, // 工作目标
  weekly_progress: { type: DataTypes.TEXT, allowNull: true }, // 本周进展
  progress_pct: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // 进度%
  status: { type: DataTypes.ENUM('未启动', '进行中', '合作中', '阻塞中', '风险', '完成'), allowNull: false, defaultValue: '未启动' },
  risk_desc: { type: DataTypes.TEXT, allowNull: true }, // 风险与问题
  next_week_focus: { type: DataTypes.TEXT, allowNull: true }, // 下周重点工作
  due_date: { type: DataTypes.DATEONLY, allowNull: true }, // 预计完成时间
  quarter: { type: DataTypes.ENUM('Q1', 'Q2', 'Q3', 'Q4'), allowNull: false },
  year: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2026 },
  creator_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: User, key: 'id' } }, // 创建人
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
  createdAt: 'created_at',
  paranoid: true,
  deletedAt: 'deleted_at'
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
  createdAt: 'created_at',
  paranoid: true,
  deletedAt: 'deleted_at'
});

// D表：月度重点工作
const MonthlyTask = sequelize.define('MonthlyTask', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dept_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Department, key: 'id' } },
  project_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: Project, key: 'id' } }, // 关联项目（可空）
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
  createdAt: 'created_at',
  paranoid: true,
  deletedAt: 'deleted_at'
});

// E表：季度成果沉淀
const Achievement = sequelize.define('Achievement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  dept_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: Department, key: 'id' } },
  project_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: Project, key: 'id' } }, // 关联项目（可空）
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
  achievement_status: { type: DataTypes.ENUM('草稿', '已确认'), allowNull: false, defaultValue: '已确认' }, // 成果状态：草稿=自动生成待补充，已确认=人工确认
  creator_id: { type: DataTypes.INTEGER, allowNull: true },
  updater_id: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'achievements',
  timestamps: true,
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  paranoid: true,
  deletedAt: 'deleted_at'
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

// 行动项表
const ActionItem = sequelize.define('ActionItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  owner_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: User, key: 'id' } },
  priority: { type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'), allowNull: false, defaultValue: 'medium' },
  status: { type: DataTypes.ENUM('pending', 'in_progress', 'done', 'cancelled'), allowNull: false, defaultValue: 'pending' },
  due_date: { type: DataTypes.DATEONLY, allowNull: true },
  source_type: { type: DataTypes.STRING(50), allowNull: true }, // ai_risk / ai_kpi / weekly_report / project / manual
  source_id: { type: DataTypes.INTEGER, allowNull: true },
  created_by_ai: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  confirmed_by_user: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  created_by: { type: DataTypes.INTEGER, allowNull: true },
  updated_by: { type: DataTypes.INTEGER, allowNull: true },
  completed_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'action_items',
  timestamps: true,
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  deletedAt: 'deleted_at',
  paranoid: true
});

// 风险台账表
const RiskRegister = sequelize.define('RiskRegister', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  project_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: Project, key: 'id' } },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  risk_level: { type: DataTypes.ENUM('low', 'medium', 'high', 'critical'), allowNull: false, defaultValue: 'medium' },
  risk_type: { type: DataTypes.STRING(50), allowNull: true }, // schedule / quality / resource / cost / communication / other
  impact: { type: DataTypes.TEXT, allowNull: true },
  probability: { type: DataTypes.ENUM('low', 'medium', 'high'), allowNull: false, defaultValue: 'medium' },
  mitigation_plan: { type: DataTypes.TEXT, allowNull: true },
  owner_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: User, key: 'id' } },
  status: { type: DataTypes.ENUM('open', 'monitoring', 'mitigated', 'closed'), allowNull: false, defaultValue: 'open' },
  detected_by: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'manual' }, // manual / ai
  source_type: { type: DataTypes.STRING(50), allowNull: true },
  source_id: { type: DataTypes.INTEGER, allowNull: true },
  created_by: { type: DataTypes.INTEGER, allowNull: true },
  updated_by: { type: DataTypes.INTEGER, allowNull: true },
  resolved_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'risk_register',
  timestamps: true,
  updatedAt: 'updated_at',
  createdAt: 'created_at'
});

// AI 调用日志表
const AiCallLog = sequelize.define('AiCallLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: User, key: 'id' } },
  task_type: { type: DataTypes.STRING(50), allowNull: false },
  provider: { type: DataTypes.STRING(20), allowNull: false },
  success: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  latency_ms: { type: DataTypes.INTEGER, allowNull: true },
  prompt_tokens: { type: DataTypes.INTEGER, allowNull: true },
  completion_tokens: { type: DataTypes.INTEGER, allowNull: true },
  total_tokens: { type: DataTypes.INTEGER, allowNull: true },
  error_message: { type: DataTypes.TEXT, allowNull: true },
  request_hash: { type: DataTypes.STRING(64), allowNull: true }
}, {
  tableName: 'ai_call_logs',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at'
});

// AI 结果缓存表
const AiResultCache = sequelize.define('AiResultCache', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  cache_key: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  task_type: { type: DataTypes.STRING(50), allowNull: false },
  result_json: { type: DataTypes.TEXT, allowNull: false },
  expires_at: { type: DataTypes.DATE, allowNull: false }
}, {
  tableName: 'ai_result_cache',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at'
});

// Refresh Token 表
const RefreshToken = sequelize.define('RefreshToken', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: User, key: 'id' } },
  token: { type: DataTypes.STRING(500), allowNull: false, unique: true },
  expires_at: { type: DataTypes.DATE, allowNull: false },
  revoked: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, {
  tableName: 'refresh_tokens',
  timestamps: true,
  updatedAt: false,
  createdAt: 'created_at'
});

// ==================== CPS 连包投流模块 ====================
const CpsChannel = sequelize.define('CpsChannel', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  contact_name: { type: DataTypes.STRING(100), allowNull: true },
  contact_info: { type: DataTypes.STRING(255), allowNull: true },
  commission_rate: { type: DataTypes.DECIMAL(8, 4), allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
  remark: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'cps_channels', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

const CpsProduct = sequelize.define('CpsProduct', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  product_type: { type: DataTypes.STRING(64), allowNull: true },
  unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
  remark: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'cps_products', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

const CpsDailyMetric = sequelize.define('CpsDailyMetric', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stat_date: { type: DataTypes.DATEONLY, allowNull: false },
  channel_id: { type: DataTypes.INTEGER, allowNull: false },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  new_sign_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  new_terminate_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  new_refund_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  renewal_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  renewal_refund_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  after_sale_refund_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  complaint_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  unit_price: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  new_sign_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  new_refund_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  renewal_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  renewal_refund_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  effective_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  effective_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  actual_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  actual_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  source: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'manual' },
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'confirmed' },
  uploader_id: { type: DataTypes.INTEGER, allowNull: true },
  uploader_name: { type: DataTypes.STRING(100), allowNull: true },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  remark: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'cps_daily_metrics', timestamps: true, paranoid: true,
  createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at',
  indexes: [{ unique: true, fields: ['stat_date', 'channel_id', 'product_id'] }, { fields: ['stat_date'] }, { fields: ['channel_id', 'stat_date'] }, { fields: ['product_id', 'stat_date'] }],
});

const CpsDailyMetricSnapshot = sequelize.define('CpsDailyMetricSnapshot', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  metric_id: { type: DataTypes.INTEGER, allowNull: false },
  stat_date: { type: DataTypes.DATEONLY, allowNull: false },
  channel_id: { type: DataTypes.INTEGER, allowNull: false },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false },
  payload_json: { type: DataTypes.TEXT, allowNull: false },
  changed_by: { type: DataTypes.INTEGER, allowNull: true },
  changed_by_name: { type: DataTypes.STRING(100), allowNull: true },
  change_reason: { type: DataTypes.STRING(255), allowNull: true },
}, { tableName: 'cps_snapshots', timestamps: true, createdAt: 'created_at', updatedAt: false });

const CpsUploadLog = sequelize.define('CpsUploadLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stat_date: { type: DataTypes.DATEONLY, allowNull: false },
  channel_id: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pending' },
  uploaded_at: { type: DataTypes.DATE, allowNull: true },
  row_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  error_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  error_message: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'cps_upload_logs', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at', indexes: [{ unique: true, fields: ['stat_date', 'channel_id'] }] });

const CpsAlertRule = sequelize.define('CpsAlertRule', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  level: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'warning' },
  metric: { type: DataTypes.STRING(64), allowNull: false },
  operator: { type: DataTypes.STRING(16), allowNull: false, defaultValue: '>=' },
  threshold_value: { type: DataTypes.DECIMAL(15, 6), allowNull: false, defaultValue: 0 },
  min_base_value: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
  scope_type: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'global' },
  scope_json: { type: DataTypes.TEXT, allowNull: true },
  enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  notify_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  notify_emails: { type: DataTypes.TEXT, allowNull: true },
  remark: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'cps_alert_rules', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

const CpsAlertEvent = sequelize.define('CpsAlertEvent', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rule_id: { type: DataTypes.INTEGER, allowNull: true },
  rule_code: { type: DataTypes.STRING(64), allowNull: false },
  level: { type: DataTypes.STRING(32), allowNull: false },
  stat_date: { type: DataTypes.DATEONLY, allowNull: true },
  channel_id: { type: DataTypes.INTEGER, allowNull: true },
  product_id: { type: DataTypes.INTEGER, allowNull: true },
  metric: { type: DataTypes.STRING(64), allowNull: true },
  metric_value: { type: DataTypes.DECIMAL(15, 6), allowNull: true },
  threshold_value: { type: DataTypes.DECIMAL(15, 6), allowNull: true },
  title: { type: DataTypes.STRING(255), allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  suggestion: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'open' },
  ack_by: { type: DataTypes.INTEGER, allowNull: true },
  ack_by_name: { type: DataTypes.STRING(100), allowNull: true },
  ack_at: { type: DataTypes.DATE, allowNull: true },
  closed_at: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'cps_alert_events', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// CPS 模型关联
CpsDailyMetric.belongsTo(CpsChannel, { foreignKey: 'channel_id', as: 'channel' });
CpsDailyMetric.belongsTo(CpsProduct, { foreignKey: 'product_id', as: 'product' });
CpsChannel.hasMany(CpsDailyMetric, { foreignKey: 'channel_id', as: 'metrics' });
CpsProduct.hasMany(CpsDailyMetric, { foreignKey: 'product_id', as: 'metrics' });
CpsDailyMetricSnapshot.belongsTo(CpsDailyMetric, { foreignKey: 'metric_id', as: 'metric' });
CpsDailyMetric.hasMany(CpsDailyMetricSnapshot, { foreignKey: 'metric_id', as: 'snapshots' });
CpsUploadLog.belongsTo(CpsChannel, { foreignKey: 'channel_id', as: 'channel' });
CpsAlertEvent.belongsTo(CpsChannel, { foreignKey: 'channel_id', as: 'channel' });
CpsAlertEvent.belongsTo(CpsProduct, { foreignKey: 'product_id', as: 'product' });
CpsAlertEvent.belongsTo(CpsAlertRule, { foreignKey: 'rule_id', as: 'rule' });

// ==================== ASO 苹果商店优化模块 ====================
const AsoProduct = sequelize.define('AsoProduct', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  app_store_id: { type: DataTypes.STRING(64), allowNull: true },
  bundle_id: { type: DataTypes.STRING(128), allowNull: true },
  category: { type: DataTypes.STRING(100), allowNull: true },
  owner_name: { type: DataTypes.STRING(100), allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
  remark: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'aso_products', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

const AsoKeyword = sequelize.define('AsoKeyword', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  keyword: { type: DataTypes.STRING(255), allowNull: false },
  keyword_type: { type: DataTypes.STRING(32), allowNull: true },
  keyword_group: { type: DataTypes.STRING(100), allowNull: true },
  language: { type: DataTypes.STRING(50), allowNull: true },
  search_index: { type: DataTypes.INTEGER, allowNull: true },
  popularity: { type: DataTypes.INTEGER, allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
  remark: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'aso_keywords', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['product_id', 'keyword'] }],
});

const AsoDailyKeywordMetric = sequelize.define('AsoDailyKeywordMetric', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stat_date: { type: DataTypes.DATEONLY, allowNull: false },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  keyword_id: { type: DataTypes.INTEGER, allowNull: false },
  keyword_status: { type: DataTypes.STRING(100), allowNull: true },
  search_index: { type: DataTypes.INTEGER, allowNull: true },
  popularity: { type: DataTypes.INTEGER, allowNull: true },
  initial_rank: { type: DataTypes.INTEGER, allowNull: true },
  yesterday_rank: { type: DataTypes.INTEGER, allowNull: true },
  current_rank: { type: DataTypes.INTEGER, allowNull: true },
  best_rank: { type: DataTypes.INTEGER, allowNull: true },
  yesterday_volume: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  today_volume: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  cost_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  rank_delta: { type: DataTypes.INTEGER, allowNull: true },
  is_t1: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  is_t3: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  is_t10: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  is_covered: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  source: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'manual' },
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'confirmed' },
  uploader_id: { type: DataTypes.INTEGER, allowNull: true },
  uploader_name: { type: DataTypes.STRING(100), allowNull: true },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  remark: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'aso_daily_keyword_metrics', timestamps: true, paranoid: true,
  createdAt: 'created_at', updatedAt: 'updated_at', deletedAt: 'deleted_at',
  indexes: [
    { unique: true, fields: ['stat_date', 'product_id', 'keyword_id'] },
    { fields: ['product_id', 'stat_date'] },
    { fields: ['keyword_id', 'stat_date'] },
    { fields: ['stat_date'] },
  ],
});

const AsoCampaign = sequelize.define('AsoCampaign', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  campaign_month: { type: DataTypes.STRING(7), allowNull: false },
  name: { type: DataTypes.STRING(200), allowNull: false },
  total_plan_volume: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_plan_cost: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  objective: { type: DataTypes.TEXT, allowNull: true },
  strategy: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'draft' },
  owner_name: { type: DataTypes.STRING(100), allowNull: true },
  created_by: { type: DataTypes.INTEGER, allowNull: true },
  updated_by: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'aso_campaigns', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['product_id', 'campaign_month', 'name'] }],
});

const AsoCampaignKeyword = sequelize.define('AsoCampaignKeyword', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  campaign_id: { type: DataTypes.INTEGER, allowNull: false },
  keyword_id: { type: DataTypes.INTEGER, allowNull: false },
  stage: { type: DataTypes.STRING(64), allowNull: true },
  target_rank: { type: DataTypes.STRING(32), allowNull: true },
  start_rank: { type: DataTypes.INTEGER, allowNull: true },
  plan_start_date: { type: DataTypes.DATEONLY, allowNull: true },
  plan_end_date: { type: DataTypes.DATEONLY, allowNull: true },
  plan_volume: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  strategy: { type: DataTypes.TEXT, allowNull: true },
  remark: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'aso_campaign_keywords', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

const AsoCampaignDailyPlan = sequelize.define('AsoCampaignDailyPlan', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  campaign_keyword_id: { type: DataTypes.INTEGER, allowNull: false },
  plan_date: { type: DataTypes.DATEONLY, allowNull: false },
  plan_volume: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  plan_cost: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
}, {
  tableName: 'aso_campaign_daily_plans', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['campaign_keyword_id', 'plan_date'] }],
});

const AsoProductBaselineMetric = sequelize.define('AsoProductBaselineMetric', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  stat_date: { type: DataTypes.DATEONLY, allowNull: false },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  keyword_coverage: { type: DataTypes.INTEGER, allowNull: true },
  effective_keyword_coverage: { type: DataTypes.INTEGER, allowNull: true },
  effective_t3_keywords: { type: DataTypes.INTEGER, allowNull: true },
  effective_t10_keywords: { type: DataTypes.INTEGER, allowNull: true },
  overall_rank: { type: DataTypes.INTEGER, allowNull: true },
  category_rank: { type: DataTypes.INTEGER, allowNull: true },
  rating: { type: DataTypes.DECIMAL(4, 2), allowNull: true },
  rating_count: { type: DataTypes.INTEGER, allowNull: true },
  source: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'manual' },
  remark: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'aso_product_baseline_metrics', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['stat_date', 'product_id'] }],
});

const AsoMetadataVersion = sequelize.define('AsoMetadataVersion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  product_id: { type: DataTypes.INTEGER, allowNull: false },
  version_date: { type: DataTypes.DATEONLY, allowNull: false },
  locale: { type: DataTypes.STRING(64), allowNull: false },
  before_keywords: { type: DataTypes.TEXT, allowNull: true },
  after_keywords: { type: DataTypes.TEXT, allowNull: true },
  change_type: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'update' },
  expected_effect: { type: DataTypes.TEXT, allowNull: true },
  actual_effect: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'draft' },
  created_by: { type: DataTypes.INTEGER, allowNull: true },
  updated_by: { type: DataTypes.INTEGER, allowNull: true },
}, { tableName: 'aso_metadata_versions', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

const AsoSnapshot = sequelize.define('AsoSnapshot', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  record_type: { type: DataTypes.STRING(64), allowNull: false },
  record_id: { type: DataTypes.INTEGER, allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false },
  payload_json: { type: DataTypes.TEXT, allowNull: false },
  changed_by: { type: DataTypes.INTEGER, allowNull: true },
  changed_by_name: { type: DataTypes.STRING(100), allowNull: true },
  change_reason: { type: DataTypes.STRING(255), allowNull: true },
}, { tableName: 'aso_snapshots', timestamps: true, createdAt: 'created_at', updatedAt: false });

const AsoImportLog = sequelize.define('AsoImportLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  import_type: { type: DataTypes.STRING(64), allowNull: false },
  product_id: { type: DataTypes.INTEGER, allowNull: true },
  file_name: { type: DataTypes.STRING(255), allowNull: true },
  status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'pending' },
  row_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  success_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  error_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  error_message: { type: DataTypes.TEXT, allowNull: true },
  uploaded_by: { type: DataTypes.INTEGER, allowNull: true },
  uploaded_by_name: { type: DataTypes.STRING(100), allowNull: true },
}, { tableName: 'aso_import_logs', timestamps: true, createdAt: 'created_at', updatedAt: 'updated_at' });

// ASO 模型关联
AsoDailyKeywordMetric.belongsTo(AsoProduct, { foreignKey: 'product_id', as: 'product' });
AsoDailyKeywordMetric.belongsTo(AsoKeyword, { foreignKey: 'keyword_id', as: 'keyword' });
AsoProduct.hasMany(AsoKeyword, { foreignKey: 'product_id', as: 'keywords' });
AsoProduct.hasMany(AsoDailyKeywordMetric, { foreignKey: 'product_id', as: 'dailyMetrics' });
AsoKeyword.hasMany(AsoDailyKeywordMetric, { foreignKey: 'keyword_id', as: 'dailyMetrics' });
AsoCampaign.belongsTo(AsoProduct, { foreignKey: 'product_id', as: 'product' });
AsoCampaignKeyword.belongsTo(AsoCampaign, { foreignKey: 'campaign_id', as: 'campaign' });
AsoCampaignKeyword.belongsTo(AsoKeyword, { foreignKey: 'keyword_id', as: 'keyword' });
AsoCampaignDailyPlan.belongsTo(AsoCampaignKeyword, { foreignKey: 'campaign_keyword_id', as: 'campaignKeyword' });
AsoProductBaselineMetric.belongsTo(AsoProduct, { foreignKey: 'product_id', as: 'product' });
AsoMetadataVersion.belongsTo(AsoProduct, { foreignKey: 'product_id', as: 'product' });
AsoSnapshot.belongsTo(AsoDailyKeywordMetric, { foreignKey: 'record_id', constraints: false });

// 新模型关联
User.hasMany(ActionItem, { foreignKey: 'owner_id', as: 'OwnedActionItems' });
ActionItem.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });
ActionItem.belongsTo(User, { foreignKey: 'created_by', as: 'Creator' });

Project.hasMany(RiskRegister, { foreignKey: 'project_id' });
RiskRegister.belongsTo(Project, { foreignKey: 'project_id' });
User.hasMany(RiskRegister, { foreignKey: 'owner_id', as: 'OwnedRisks' });
RiskRegister.belongsTo(User, { foreignKey: 'owner_id', as: 'Owner' });

AiCallLog.belongsTo(User, { foreignKey: 'user_id' });
RefreshToken.belongsTo(User, { foreignKey: 'user_id' });

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
  ProjectUpdateLog,
  ActionItem,
  RiskRegister,
  AiCallLog,
  AiResultCache,
  RefreshToken,
  CpsChannel,
  CpsProduct,
  CpsDailyMetric,
  CpsDailyMetricSnapshot,
  CpsUploadLog,
  CpsAlertRule,
  CpsAlertEvent,
  AsoProduct,
  AsoKeyword,
  AsoDailyKeywordMetric,
  AsoCampaign,
  AsoCampaignKeyword,
  AsoCampaignDailyPlan,
  AsoProductBaselineMetric,
  AsoMetadataVersion,
  AsoSnapshot,
  AsoImportLog
};
