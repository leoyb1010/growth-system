const { WeeklyReport } = require('../models');
const { generateWeeklyReportData } = require('../services/weeklyReportService');
const { sendWeeklyReportToFeishu } = require('../services/feishuService');
const { success, error } = require('../utils/response');
const { getQuarterTimeProgress, getProgressStatus } = require('../utils/timeProgress');
const moment = require('moment');
const fs = require('fs');
const path = require('path');

/**
 * 生成周报
 * POST /api/weekly-reports/generate
 */
async function generateReport(req, res) {
  try {
    const { week_start, week_end } = req.body;

    // 默认生成上周的周报
    const start = week_start
      ? moment(week_start).startOf('day').toDate()
      : moment().subtract(7, 'days').startOf('week').add(1, 'days').toDate();
    const end = week_end
      ? moment(week_end).endOf('day').toDate()
      : moment().subtract(1, 'days').endOf('week').add(1, 'days').toDate();

    // 传入部门过滤：admin 看全部，其他只看本部门
    const deptFilter = req.deptFilter || null;
    const reportData = await generateWeeklyReportData(start, end, deptFilter);

    // 保存到数据库
    const report = await WeeklyReport.create({
      week_start: reportData.week_start,
      week_end: reportData.week_end,
      content_json: reportData,
      generated_at: new Date()
    });

    // 异步推送飞书（不阻塞响应）
    sendWeeklyReportToFeishu(reportData).catch(err => {
      console.error('飞书推送异常:', err);
    });

    success(res, { id: report.id, ...reportData }, '周报生成成功');
  } catch (err) {
    console.error('生成周报失败:', err);
    error(res, '生成周报失败', 1, 500);
  }
}

/**
 * 获取周报列表
 * GET /api/weekly-reports
 */
async function getReports(req, res) {
  try {
    const reports = await WeeklyReport.findAll({
      order: [['generated_at', 'DESC']],
      limit: 20
    });

    // 部门过滤：admin 看全部，其他只看本部门相关内容
    const deptFilter = req.deptFilter || null;
    success(res, reports.map(r => {
      const item = {
        id: r.id,
        week_start: r.week_start,
        week_end: r.week_end,
        generated_at: moment(r.generated_at).format('YYYY-MM-DD HH:mm'),
        png_url: r.png_url,
        pdf_url: r.pdf_url
      };
      // 如果有部门过滤，标记周报内容是否属于该部门
      if (deptFilter && r.content_json) {
        item.has_dept_data = filterReportContentForDept(r.content_json, deptFilter).hasData;
      }
      return item;
    }));
  } catch (err) {
    console.error('获取周报列表失败:', err);
    error(res, '获取周报列表失败', 1, 500);
  }
}

/**
 * 获取最新周报
 * GET /api/weekly-reports/latest
 */
async function getLatestReport(req, res) {
  try {
    const report = await WeeklyReport.findOne({
      order: [['generated_at', 'DESC']]
    });

    if (!report) {
      return error(res, '暂无周报数据');
    }

    // 部门过滤内容
    const deptFilter = req.deptFilter || null;
    const content = deptFilter && report.content_json
      ? filterReportContentForDept(report.content_json, deptFilter).content
      : report.content_json;

    success(res, {
      id: report.id,
      week_start: report.week_start,
      week_end: report.week_end,
      content,
      generated_at: moment(report.generated_at).format('YYYY-MM-DD HH:mm'),
      png_url: report.png_url,
      pdf_url: report.pdf_url
    });
  } catch (err) {
    console.error('获取最新周报失败:', err);
    error(res, '获取最新周报失败', 1, 500);
  }
}

/**
 * 获取指定周报详情
 * GET /api/weekly-reports/:id
 */
async function getReportById(req, res) {
  try {
    const { id } = req.params;
    const report = await WeeklyReport.findByPk(id);

    if (!report) {
      return error(res, '周报不存在');
    }

    // 部门过滤内容
    const deptFilter = req.deptFilter || null;
    const content = deptFilter && report.content_json
      ? filterReportContentForDept(report.content_json, deptFilter).content
      : report.content_json;

    success(res, {
      id: report.id,
      week_start: report.week_start,
      week_end: report.week_end,
      content,
      html_content: report.html_content,
      generated_at: moment(report.generated_at).format('YYYY-MM-DD HH:mm'),
      png_url: report.png_url,
      pdf_url: report.pdf_url
    });
  } catch (err) {
    console.error('获取周报详情失败:', err);
    error(res, '获取周报详情失败', 1, 500);
  }
}

/**
 * 保存周报 HTML 内容
 * PUT /api/weekly-reports/:id/html
 */
async function saveReportHtml(req, res) {
  try {
    const { id } = req.params;
    const { html_content } = req.body;

    const report = await WeeklyReport.findByPk(id);
    if (!report) {
      return error(res, '周报不存在');
    }

    await report.update({ html_content });
    success(res, null, 'HTML 内容保存成功');
  } catch (err) {
    console.error('保存 HTML 失败:', err);
    error(res, '保存 HTML 失败', 1, 500);
  }
}

/**
 * 保存周报文件 URL
 * PUT /api/weekly-reports/:id/files
 */
async function saveReportFiles(req, res) {
  try {
    const { id } = req.params;
    const { png_url, pdf_url } = req.body;

    const report = await WeeklyReport.findByPk(id);
    if (!report) {
      return error(res, '周报不存在');
    }

    await report.update({ png_url, pdf_url });
    success(res, null, '文件链接保存成功');
  } catch (err) {
    console.error('保存文件链接失败:', err);
    error(res, '保存文件链接失败', 1, 500);
  }
}

module.exports = {
  generateReport,
  getReports,
  getLatestReport,
  getReportById,
  saveReportHtml,
  saveReportFiles
};

/**
 * 根据部门过滤周报内容
 * dept_id: 1=拓展组, 2=运营组
 * 过滤 kpi_summary, project_progress, risk_and_warnings, next_week_focus, new_achievements 中的部门数据
 */
function filterReportContentForDept(content, deptId) {
  if (!content) return { content: null, hasData: false };

  const deptNameMap = { 1: '拓展组', 2: '运营组' };
  const deptName = deptNameMap[deptId] || '';

  const filtered = { ...content };

  // 过滤 KPI 摘要
  if (filtered.kpi_summary) {
    filtered.kpi_summary = filtered.kpi_summary.filter(k => k.dept_name === deptName);
  }

  // 过滤项目进展
  if (filtered.project_progress) {
    filtered.project_progress = filtered.project_progress.filter(p => p.dept_name === deptName);
  }

  // 过滤风险与预警
  if (filtered.risk_and_warnings) {
    const raw = filtered.risk_and_warnings;
    filtered.risk_and_warnings = {
      risk_projects: (raw.risk_projects || []).filter(p => p.dept_name === deptName),
      severe_warnings: (raw.severe_warnings || []).filter(w => w.dept_name === deptName),
    };
  }

  // 过滤下周焦点
  if (filtered.next_week_focus) {
    const raw = filtered.next_week_focus;
    filtered.next_week_focus = {
      upcoming_projects: (raw.upcoming_projects || []).filter(p => p.dept_name === deptName),
      follow_up_items: (raw.follow_up_items || []).filter(t => t.dept_name === deptName),
    };
  }

  // 过滤新增成果
  if (filtered.new_achievements) {
    filtered.new_achievements = filtered.new_achievements.filter(a => a.dept_name === deptName);
  }

  // 更新摘要
  if (filtered.summary) {
    filtered.summary = {
      ...filtered.summary,
      total_updated_projects: (filtered.project_progress || []).length,
      total_risk_projects: (filtered.risk_and_warnings?.risk_projects || []).length,
      total_severe_warnings: (filtered.risk_and_warnings?.severe_warnings || []).length,
      total_upcoming: (filtered.next_week_focus?.upcoming_projects || []).length,
      total_new_achievements: (filtered.new_achievements || []).length,
    };
  }

  // 重新生成本周结论和关键变化
  if (filtered.week_conclusion) {
    filtered.week_conclusion = regenerateConclusion(filtered);
  }
  if (filtered.key_changes) {
    filtered.key_changes = (filtered.key_changes || []).filter(c => c.text.includes(deptName));
  }

  const hasData = (filtered.kpi_summary?.length > 0) ||
    (filtered.project_progress?.length > 0) ||
    (filtered.risk_and_warnings?.risk_projects?.length > 0) ||
    (filtered.next_week_focus?.upcoming_projects?.length > 0) ||
    (filtered.new_achievements?.length > 0);

  return { content: filtered, hasData };
}

function regenerateConclusion(data) {
  const parts = [];
  const kpis = data.kpi_summary || [];
  const totalTarget = kpis.reduce((s, k) => s + parseFloat(k.target || 0), 0);
  const totalActual = kpis.reduce((s, k) => s + parseFloat(k.actual || 0), 0);
  const totalRate = totalTarget > 0 ? (totalActual / totalTarget * 100) : 0;

  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentQuarter = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  const timeProgress = getQuarterTimeProgress(currentQuarter, currentYear);
  const status = getProgressStatus(totalRate, timeProgress);

  if (status === 'ahead') {
    parts.push(`整体完成率${totalRate.toFixed(0)}%，超过时间进度（${timeProgress.toFixed(0)}%），进度良好。`);
  } else if (status === 'on_track') {
    parts.push(`整体完成率${totalRate.toFixed(0)}%，与时间进度（${timeProgress.toFixed(0)}%）基本持平，需持续保持。`);
  } else {
    parts.push(`整体完成率${totalRate.toFixed(0)}%，低于时间进度（${timeProgress.toFixed(0)}%），需重点关注和加速追赶。`);
  }

  const riskCount = (data.risk_and_warnings?.risk_projects || []).length;
  if (riskCount > 0) parts.push(`当前有${riskCount}个风险项目需关注。`);

  return parts.join(' ');
}
