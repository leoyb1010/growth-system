const { WeeklyReport } = require('../models');
const { generateWeeklyReportData } = require('../services/weeklyReportService');
const { sendWeeklyReportToFeishu } = require('../services/feishuService');
const { success, error } = require('../utils/response');
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

    const reportData = await generateWeeklyReportData(start, end);

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

    success(res, reports.map(r => ({
      id: r.id,
      week_start: r.week_start,
      week_end: r.week_end,
      generated_at: moment(r.generated_at).format('YYYY-MM-DD HH:mm'),
      png_url: r.png_url,
      pdf_url: r.pdf_url
    })));
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

    success(res, {
      id: report.id,
      week_start: report.week_start,
      week_end: report.week_end,
      content: report.content_json,
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

    success(res, {
      id: report.id,
      week_start: report.week_start,
      week_end: report.week_end,
      content: report.content_json,
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
