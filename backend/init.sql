-- 增长组业务管理系统初始化脚本
-- V4: 与 Sequelize Model 严格一致
-- 包含：部门、测试账号、示例数据

-- 创建部门
INSERT INTO departments (name) VALUES
  ('拓展组'),
  ('运营组');

-- 创建测试账号（密码均为 bcrypt hash 后的 "123456"）
-- admin/123456, expand/123456, ops/123456
INSERT INTO users (username, name, role, dept_id, password_hash) VALUES
  ('admin', '管理员', 'admin', NULL, '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqBm7XQYKJhJqW1QYjYQJhJqW1QY'),
  ('expand', '拓展组录入', 'dept_manager', 1, '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqBm7XQYKJhJqW1QYjYQJhJqW1QY'),
  ('ops', '运营组录入', 'dept_manager', 2, '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqBm7XQYKJhJqW1QYjYQJhJqW1QY');

-- A表：核心指标示例数据（2026年Q2，当前季度）
INSERT INTO kpis (dept_id, quarter, year, indicator_name, target, actual, unit) VALUES
  (1, 'Q2', 2026, 'GMV', 6000.00, 3500.00, '万元'),
  (1, 'Q2', 2026, '净利润', 1000.00, 600.00, '万元'),
  (2, 'Q2', 2026, 'GMV', 4000.00, 2800.00, '万元'),
  (2, 'Q2', 2026, '净利润', 600.00, 450.00, '万元');

-- B表：重点工作示例数据（字段与 Project Model 严格对齐）
-- 注意：不再有 monthly_progress 和 quarterly_progress 字段
INSERT INTO projects (dept_id, type, name, owner_name, goal, weekly_progress, progress_pct, status, risk_desc, next_week_focus, due_date, quarter, year, creator_id, updater_id) VALUES
  (1, '新客拓展', 'Q2新客增长项目', '张三', '新增1200个企业客户', '本周完成200个新客签约', 60, '进行中', '', '持续拓展重点客户', '2026-06-30', 'Q2', 2026, 2, 2),
  (1, '渠道合作', '渠道伙伴招募', '李四', '签约60家渠道伙伴', '本周签约3家', 50, '进行中', '渠道反馈政策吸引力不足', '调整渠道政策方案', '2026-06-15', 'Q2', 2026, 2, 2),
  (2, '用户运营', '用户留存提升', '王五', '月留存率提升至75%', '本周留存率72%', 70, '进行中', '', '推进留存策略优化', '2026-06-30', 'Q2', 2026, 3, 3),
  (2, '活动策划', '夏季大促活动', '赵六', 'GMV目标600万', '活动方案已确认', 20, '风险', '活动预算审批延迟，可能影响上线时间', '跟进预算审批', '2026-06-20', 'Q2', 2026, 3, 3);

-- C表：业务线业绩示例数据
INSERT INTO performances (dept_id, business_type, indicator, unit, q1_target, q1_actual, q2_target, q2_actual, q3_target, q3_actual, q4_target, q4_actual, total_target, total_actual, gap, warning_status) VALUES
  (1, 'SaaS订阅', '订阅收入', '万元', 1200.00, 1100.00, 1500.00, 0, 1800.00, 0, 2000.00, 0, 6500.00, 1100.00, -5400.00, '正常'),
  (1, '增值服务', '服务收入', '万元', 800.00, 750.00, 1000.00, 0, 1200.00, 0, 1500.00, 0, 4500.00, 750.00, -3750.00, '正常'),
  (2, '广告收入', '广告营收', '万元', 600.00, 580.00, 700.00, 0, 800.00, 0, 900.00, 0, 3000.00, 580.00, -2420.00, '正常'),
  (2, '会员服务', '会员收入', '万元', 400.00, 350.00, 500.00, 0, 600.00, 0, 700.00, 0, 2200.00, 350.00, -1850.00, '正常');

-- D表：月度工作示例数据
INSERT INTO monthly_tasks (dept_id, project_id, month, owner_name, category, task, goal, actual_result, output, completion_rate, status, highlights, next_month_plan, quarter, creator_id, updater_id) VALUES
  (1, 1, '2026-04', '张三', '客户拓展', '拜访重点客户20家', '完成15家签约意向', '已拜访18家，获得12家意向', '客户拜访报告', 90, '进行中', '客户反馈产品功能需优化', '跟进意向客户签约', 'Q2', 2, 2),
  (1, 2, '2026-04', '李四', '渠道建设', '渠道培训3场', '覆盖50家渠道', '完成2场培训，覆盖35家', '培训资料沉淀', 70, '进行中', '', '完成剩余1场培训', 'Q2', 2, 2),
  (2, 3, '2026-04', '王五', '用户增长', '拉新活动执行', '新增用户5000人', '已新增4200人', '活动数据报告', 84, '进行中', '投放ROI低于预期', '优化投放策略', 'Q2', 3, 3),
  (2, 4, '2026-04', '赵六', '内容运营', '内容发布30篇', '阅读量10万+', '已发布25篇，阅读量8万', '内容素材库', 80, '进行中', '', '完成剩余内容发布', 'Q2', 3, 3);

-- E表：季度成果示例数据
INSERT INTO achievements (dept_id, project_id, quarter, owner_name, achievement_type, project_name, description, quantified_result, business_value, reusable_content, include_next_quarter, archive_owner, completed_at, priority, creator_id, updater_id) VALUES
  (1, 1, 'Q1', '张三', '流程优化', '客户签约流程简化', '将签约流程从7步缩减至4步', '签约周期缩短40%', '提升客户转化率，预计年增收200万', '标准化签约SOP文档', true, '张三', '2026-03-15', '高', 2, 2),
  (1, 2, 'Q1', '李四', '工具开发', '渠道管理系统V1.0', '开发渠道伙伴管理后台', '覆盖50家渠道伙伴管理', '提升渠道管理效率50%', '系统源码及操作手册', true, '李四', '2026-03-20', '高', 2, 2),
  (2, 3, 'Q1', '王五', '方法论', '用户分层运营模型', '建立RFM用户分层体系', '用户分层准确率85%', '精准营销ROI提升30%', '分层模型及运营手册', true, '王五', '2026-03-25', '中', 3, 3),
  (2, 4, 'Q1', '赵六', '案例沉淀', '春季大促活动复盘', '总结活动执行经验', '活动GMV达成率110%', '形成可复用活动模板', '活动复盘报告及模板', false, '赵六', '2026-03-30', '中', 3, 3);
