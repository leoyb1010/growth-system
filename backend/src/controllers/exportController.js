const xlsx = require('xlsx');
const { Kpi, Project, Performance, MonthlyTask, Achievement, Department } = require('../models');
const { success, error } = require('../utils/response');
const fs = require('fs');
const path = require('path');

/**
 * 导出指定模块数据为 Excel
 * GET /api/export/:module?quarter=Q1
 */
async function exportModule(req, res) {
  try {
    const { module } = req.params;
    const { quarter, dept_id } = req.query;
    const where = {};
    if (quarter) where.quarter = quarter;
    if (dept_id) where.dept_id = parseInt(dept_id);

    let data = [];
    let sheetName = '';
    let headers = [];

    switch (module) {
      case 'kpis':
        sheetName = '核心指标';
        headers = ['部门', '季度', '年份', '指标名', '目标值', '完成值', '完成率(%)', '单位'];
        const kpis = await Kpi.findAll({
          where,
          include: [{ model: Department, attributes: ['name'] }]
        });
        data = kpis.map(k => [
          k.Department?.name || '',
          k.quarter,
          k.year,
          k.indicator_name,
          k.target,
          k.actual,
          k.target > 0 ? ((k.actual / k.target) * 100).toFixed(2) : 0,
          k.unit
        ]);
        break;

      case 'projects':
        sheetName = '重点工作';
        headers = ['部门', '项目类型', '项目名称', '负责人', '工作目标', '本周进展', '进度%', '状态', '风险与问题', '预计完成时间', '季度'];
        const projects = await Project.findAll({
          where,
          include: [{ model: Department, attributes: ['name'] }]
        });
        data = projects.map(p => [
          p.Department?.name || '',
          p.type,
          p.name,
          p.owner_name,
          p.goal,
          p.weekly_progress,
          p.progress_pct,
          p.status,
          p.risk_desc,
          p.due_date,
          p.quarter
        ]);
        break;

      case 'performances':
        sheetName = '业务线业绩';
        headers = ['部门', '业务类型', '指标', '单位', 'Q1目标', 'Q1完成', 'Q2目标', 'Q2完成', 'Q3目标', 'Q3完成', 'Q4目标', 'Q4完成', '累计目标', '累计完成', '差额', '预警状态'];
        const performances = await Performance.findAll({
          where,
          include: [{ model: Department, attributes: ['name'] }]
        });
        data = performances.map(p => {
          const totalTarget = parseFloat(p.q1_target) + parseFloat(p.q2_target) + parseFloat(p.q3_target) + parseFloat(p.q4_target);
          const totalActual = parseFloat(p.q1_actual) + parseFloat(p.q2_actual) + parseFloat(p.q3_actual) + parseFloat(p.q4_actual);
          const rate = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;
          const status = rate >= 90 ? '正常' : rate >= 60 ? '预警' : '严重';
          return [
            p.Department?.name || '',
            p.business_type,
            p.indicator,
            p.unit,
            p.q1_target, p.q1_actual,
            p.q2_target, p.q2_actual,
            p.q3_target, p.q3_actual,
            p.q4_target, p.q4_actual,
            totalTarget.toFixed(2),
            totalActual.toFixed(2),
            (totalTarget - totalActual).toFixed(2),
            status
          ];
        });
        break;

      case 'monthly-tasks':
        sheetName = '月度工作';
        headers = ['部门', '月份', '负责人', '工作类别', '工作事项', '工作目标', '实际完成情况', '成果/产出', '完成度', '状态', '亮点与问题', '下月跟进', '季度'];
        const tasks = await MonthlyTask.findAll({
          where,
          include: [{ model: Department, attributes: ['name'] }]
        });
        data = tasks.map(t => [
          t.Department?.name || '',
          t.month,
          t.owner_name,
          t.category,
          t.task,
          t.goal,
          t.actual_result,
          t.output,
          t.completion_rate,
          t.status,
          t.highlights,
          t.next_month_plan,
          t.quarter
        ]);
        break;

      case 'achievements':
        sheetName = '季度成果';
        headers = ['部门', '季度', '负责人', '成果类型', '项目/工作名称', '成果描述', '量化结果', '业务价值', '沉淀/可复用内容', '纳入下季计划', '沉淀负责人', '完成时间', '优先级'];
        const achievements = await Achievement.findAll({
          where,
          include: [{ model: Department, attributes: ['name'] }]
        });
        data = achievements.map(a => [
          a.Department?.name || '',
          a.quarter,
          a.owner_name,
          a.achievement_type,
          a.project_name,
          a.description,
          a.quantified_result,
          a.business_value,
          a.reusable_content,
          a.include_next_quarter ? '是' : '否',
          a.archive_owner,
          a.completed_at,
          a.priority
        ]);
        break;

      default:
        return error(res, '未知的导出模块');
    }

    // 创建工作簿
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([headers, ...data]);
    xlsx.utils.book_append_sheet(wb, ws, sheetName);

    const exportDir = path.join(__dirname, '../../uploads/exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const fileName = `${module}_${Date.now()}.xlsx`;
    const filePath = path.join(exportDir, fileName);
    xlsx.writeFile(wb, filePath);

    success(res, {
      download_url: `/uploads/exports/${fileName}`,
      file_name: fileName,
      record_count: data.length
    }, '导出成功');
  } catch (err) {
    console.error('导出失败:', err);
    error(res, '导出失败: ' + err.message, 1, 500);
  }
}

module.exports = { exportModule };
