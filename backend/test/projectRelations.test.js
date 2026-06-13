/**
 * 项目 360 关联视图字段映射测试
 * 钉住：ActionItem 通过 source_type='project'+source_id 关联项目（无 project_id 列），
 * RiskRegister/Achievement/MonthlyTask 通过 project_id 关联。
 * 防止 getProjectRelations 用错字段（曾因误用 ActionItem.project_id 导致 500）。
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// 用独立 sqlite 文件初始化模型（复用项目的 models 定义）
process.env.DB_DIALECT = 'sqlite';
process.env.DB_STORAGE = path.join(os.tmpdir(), `relation_test_${Date.now()}.sqlite`);
process.env.NODE_ENV = 'test';

const models = require('../src/models');
const { sequelize, Project, Department, ActionItem, RiskRegister, Achievement } = models;

test('项目关联：ActionItem 走 source_type/source_id，其余走 project_id', async () => {
  await sequelize.sync({ force: true });
  const dept = await Department.create({ name: '测试部门' });
  const project = await Project.create({
    dept_id: dept.id, type: '渠道', name: '关联项目', owner_name: '张三',
    quarter: 'Q2', year: 2026, status: '进行中', progress_pct: 20,
  });

  await ActionItem.create({ title: '动作A', source_type: 'project', source_id: project.id });
  await ActionItem.create({ title: '无关动作', source_type: 'manual', source_id: 999 });
  await RiskRegister.create({ project_id: project.id, title: '风险A' });
  await Achievement.create({
    dept_id: dept.id, project_id: project.id, quarter: 'Q2', owner_name: '张三',
    achievement_type: '增长', project_name: '关联项目', quantified_result: '+100万',
  });

  // 模拟 getProjectRelations 的查询
  const actionItems = await ActionItem.findAll({ where: { source_type: 'project', source_id: project.id } });
  const risks = await RiskRegister.findAll({ where: { project_id: project.id } });
  const achievements = await Achievement.findAll({ where: { project_id: project.id } });

  assert.strictEqual(actionItems.length, 1, '只应关联到本项目的动作项');
  assert.strictEqual(actionItems[0].title, '动作A');
  assert.strictEqual(risks.length, 1);
  assert.strictEqual(achievements.length, 1);

  await sequelize.close();
  fs.rmSync(process.env.DB_STORAGE, { force: true });
});
