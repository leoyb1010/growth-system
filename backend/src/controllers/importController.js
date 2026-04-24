const xlsx = require('xlsx');
const { Kpi, Project, Performance, MonthlyTask, Achievement, Department } = require('../models');
const { success, error } = require('../utils/response');
const fs = require('fs');

/**
 * Excel 导入数据
 * POST /api/import/excel
 * 支持从现有"部门追踪总表.xlsx"一键导入
 */
async function importExcel(req, res) {
  try {
    if (!req.file) {
      return error(res, '请上传 Excel 文件');
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetNames = workbook.SheetNames;
    const results = { sheets: [], errors: [], skipped: [] };

    // 辅助函数：宽松的 sheet 名称匹配
    function matchSheet(sheetLower, keywords) {
      return keywords.some(k => sheetLower.includes(k.toLowerCase()));
    }
    function matchHeader(headersLower, keywords) {
      return keywords.some(k => headersLower.some(h => h.includes(k.toLowerCase())));
    }

    // 获取部门映射（受 deptFilter 约束，防止跨部门导入）
    const scopeDeptId = req.deptFilter || null;
    const whereOpt = scopeDeptId ? { where: { id: scopeDeptId } } : {};
    const departments = await Department.findAll(whereOpt);
    const deptMap = {};
    departments.forEach(d => { deptMap[d.name] = d.id; });

    for (const sheetName of sheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) continue;

      const headers = jsonData[0];
      const rows = jsonData.slice(1);

      try {
        // 根据 Sheet 名称或表头特征判断对应模块（更宽松的匹配）
        const sheetLower = sheetName.toLowerCase();
        const headersLower = headers.map(h => String(h).toLowerCase());

        if (matchSheet(sheetLower, ['核心指标','a','kpi','指标']) || matchHeader(headersLower, ['指标名','指标','indicator','gmv'])) {
          await importKpis(rows, headers, deptMap, results);
        } else if (matchSheet(sheetLower, ['重点工作','b','项目','project']) || matchHeader(headersLower, ['项目类型','项目名称','项目'])) {
          await importProjects(rows, headers, deptMap, results);
        } else if (matchSheet(sheetLower, ['业绩','c','业绩追踪','performance']) || matchHeader(headersLower, ['业务类型','业务线','业绩'])) {
          await importPerformances(rows, headers, deptMap, results);
        } else if (matchSheet(sheetLower, ['月度','d','月度工作','monthly']) || matchHeader(headersLower, ['工作类别','月度','month'])) {
          await importMonthlyTasks(rows, headers, deptMap, results);
        } else if (matchSheet(sheetLower, ['成果','e','季度成果','achievement']) || matchHeader(headersLower, ['成果类型','成果','achievement'])) {
          await importAchievements(rows, headers, deptMap, results);
        } else {
          results.skipped.push({ sheet: sheetName, reason: '未识别到对应模块' });
        }
      } catch (sheetErr) {
        results.errors.push({ sheet: sheetName, error: sheetErr.message });
      }
    }

    // 删除临时文件
    fs.unlinkSync(req.file.path);

    success(res, results, '导入完成');
  } catch (err) {
    console.error('导入 Excel 失败:', err);
    error(res, '导入失败: ' + err.message, 1, 500);
  }
}

/**
 * 导入 A 表：核心指标
 */
async function importKpis(rows, headers, deptMap, results) {
  let count = 0;
  for (const row of rows) {
    if (!row[0]) continue;
    const deptName = row[0];
    const deptId = deptMap[deptName];
    if (!deptId) continue;

    await Kpi.create({
      dept_id: deptId,
      quarter: row[1] || 'Q1',
      year: parseInt(row[2]) || 2026,
      indicator_name: row[3] || '',
      target: parseFloat(row[4]) || 0,
      actual: parseFloat(row[5]) || 0,
      unit: row[6] || '万元'
    });
    count++;
  }
  results.sheets.push({ name: '核心指标', imported: count });
}

/**
 * 导入 B 表：重点工作
 */
async function importProjects(rows, headers, deptMap, results) {
  let count = 0;
  for (const row of rows) {
    if (!row[0]) continue;
    const deptName = row[0];
    const deptId = deptMap[deptName];
    if (!deptId) continue;

    await Project.create({
      dept_id: deptId,
      type: row[1] || '',
      name: row[2] || '',
      owner_name: row[3] || '',
      goal: row[4] || '',
      weekly_progress: row[5] || '',
      progress_pct: parseInt(row[6]) || 0,
      status: ['未启动', '进行中', '合作中', '阻塞中', '风险', '完成'].includes(row[7]) ? row[7] : '未启动',
      risk_desc: row[8] || '',
      due_date: row[9] || null,
      quarter: row[10] || 'Q1'
    });
    count++;
  }
  results.sheets.push({ name: '重点工作', imported: count });
}

/**
 * 导入 C 表：业务线业绩
 */
async function importPerformances(rows, headers, deptMap, results) {
  let count = 0;
  for (const row of rows) {
    if (!row[0]) continue;
    const deptName = row[0];
    const deptId = deptMap[deptName];
    if (!deptId) continue;

    await Performance.create({
      dept_id: deptId,
      business_type: row[1] || '',
      indicator: row[2] || '',
      unit: row[3] || '万元',
      q1_target: parseFloat(row[4]) || 0,
      q1_actual: parseFloat(row[5]) || 0,
      q2_target: parseFloat(row[6]) || 0,
      q2_actual: parseFloat(row[7]) || 0,
      q3_target: parseFloat(row[8]) || 0,
      q3_actual: parseFloat(row[9]) || 0,
      q4_target: parseFloat(row[10]) || 0,
      q4_actual: parseFloat(row[11]) || 0
    });
    count++;
  }
  results.sheets.push({ name: '业务线业绩', imported: count });
}

/**
 * 导入 D 表：月度工作
 */
async function importMonthlyTasks(rows, headers, deptMap, results) {
  let count = 0;
  for (const row of rows) {
    if (!row[0]) continue;
    const deptName = row[0];
    const deptId = deptMap[deptName];
    if (!deptId) continue;

    await MonthlyTask.create({
      dept_id: deptId,
      month: row[1] || '',
      owner_name: row[2] || '',
      category: row[3] || '',
      task: row[4] || '',
      goal: row[5] || '',
      actual_result: row[6] || '',
      output: row[7] || '',
      completion_rate: parseInt(row[8]) || 0,
      status: ['未启动', '进行中', '风险', '完成'].includes(row[9]) ? row[9] : '未启动',
      highlights: row[10] || '',
      next_month_plan: row[11] || '',
      quarter: row[12] || 'Q1'
    });
    count++;
  }
  results.sheets.push({ name: '月度工作', imported: count });
}

/**
 * 导入 E 表：季度成果
 */
async function importAchievements(rows, headers, deptMap, results) {
  let count = 0;
  for (const row of rows) {
    if (!row[0]) continue;
    const deptName = row[0];
    const deptId = deptMap[deptName];
    if (!deptId) continue;

    await Achievement.create({
      dept_id: deptId,
      quarter: row[1] || 'Q1',
      owner_name: row[2] || '',
      achievement_type: row[3] || '',
      project_name: row[4] || '',
      description: row[5] || '',
      quantified_result: row[6] || '',
      business_value: row[7] || '',
      reusable_content: row[8] || '',
      include_next_quarter: row[9] === true || row[9] === '是',
      archive_owner: row[10] || '',
      completed_at: row[11] || null,
      priority: ['高', '中', '低'].includes(row[12]) ? row[12] : '中'
    });
    count++;
  }
  results.sheets.push({ name: '季度成果', imported: count });
}

module.exports = { importExcel };
