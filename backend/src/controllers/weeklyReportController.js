const { WeeklyReport } = require('../models');
const { Department } = require('../models');
const { generateWeeklyReportData } = require('../services/weeklyReportService');
const { sendWeeklyReportToFeishu } = require('../services/feishuService');
const { generateReportPng } = require('../services/reportScreenshotService');
const { success, error } = require('../utils/response');
const { getQuarterTimeProgress, getProgressStatus } = require('../utils/timeProgress');
const moment = require('moment');

function resolveWeeklyReportRange(body = {}, now = moment()) {
  const { week_start, week_end } = body;
  const defaultStart = moment(now).subtract(1, 'week').startOf('isoWeek');
  const defaultEnd = moment(now).subtract(1, 'week').endOf('isoWeek');
  const start = week_start ? moment(week_start).startOf('day') : defaultStart;
  const end = week_end ? moment(week_end).endOf('day') : defaultEnd;

  if (!start.isValid() || !end.isValid()) {
    throw new Error('周报日期格式错误');
  }
  if (start.isAfter(end)) {
    throw new Error('周报开始日期不能晚于结束日期');
  }

  return { start: start.toDate(), end: end.toDate() };
}

/**
 * 生成周报
 * POST /api/weekly-reports/generate
 */
async function generateReport(req, res) {
  try {
    // 默认生成上一完整自然周，匹配周一部门会复盘上周工作的使用方式。
    // 如需查看其他周期，前端可传入 week_start/week_end 指定日期范围。
    const { start, end } = resolveWeeklyReportRange(req.body);

    // 传入部门过滤：admin 看全部，其他只看本部门
    const deptFilter = req.deptFilter || null;
    const isAdmin = !deptFilter; // admin 无 deptFilter，dept_manager/dept_staff 有
    const permissions = req.access?.permissions || [];
    const reportData = await generateWeeklyReportData(start, end, deptFilter, isAdmin, {
      includeAso: permissions.includes('aso.read'),
      includeCps: permissions.includes('cps.read'),
      cpsChannelId: req.dataScope?.type === 'cps_channel' ? req.dataScope.value : null,
    });

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
    // 检测 SQLITE_READONLY 错误，给出明确提示
    if (err.original && err.original.code === 'SQLITE_READONLY') {
      error(res, '数据库只读，请重启服务（pm2 delete + start）', 1, 500);
    } else {
      error(res, `生成周报失败: ${err.message || '未知错误'}`, 1, 500);
    }
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
    const visibleReports = [];
    for (const r of reports) {
      if (deptFilter) {
        const filtered = await filterReportContentForDept(r.content_json, deptFilter);
        if (!filtered.hasData) continue;
      }
      const item = {
        id: r.id,
        week_start: r.week_start,
        week_end: r.week_end,
        generated_at: moment(r.generated_at).format('YYYY-MM-DD HH:mm'),
        png_url: sanitizeReportFileUrlForResponse(r.png_url),
        pdf_url: sanitizeReportFileUrlForResponse(r.pdf_url)
      };
      visibleReports.push(item);
    }
    success(res, visibleReports);
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
    const reports = await WeeklyReport.findAll({
      order: [['generated_at', 'DESC']],
      limit: 50
    });

    if (!reports.length) {
      return error(res, '暂无周报数据');
    }

    // 部门过滤内容
    const deptFilter = req.deptFilter || null;
    let report = reports[0];
    let visibleContent = report.content_json;

    if (deptFilter) {
      report = null;
      for (const candidate of reports) {
        const filtered = await filterReportContentForDept(candidate.content_json, deptFilter);
        if (filtered.hasData) {
          report = candidate;
          visibleContent = filtered.content;
          break;
        }
      }
      if (!report) return error(res, '暂无可见周报数据', 1, 404);
    }

    success(res, {
      id: report.id,
      week_start: report.week_start,
      week_end: report.week_end,
      content: visibleContent,
      generated_at: moment(report.generated_at).format('YYYY-MM-DD HH:mm'),
      png_url: sanitizeReportFileUrlForResponse(report.png_url),
      pdf_url: sanitizeReportFileUrlForResponse(report.pdf_url)
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
    let content = report.content_json;
    if (deptFilter && report.content_json) {
      const filtered = await filterReportContentForDept(report.content_json, deptFilter);
      if (!filtered.hasData) {
        return error(res, '无权查看该周报', 403, 403);
      }
      content = filtered.content;
    }

    success(res, {
      id: report.id,
      week_start: report.week_start,
      week_end: report.week_end,
      content,
      html_content: deptFilter ? null : report.html_content,
      generated_at: moment(report.generated_at).format('YYYY-MM-DD HH:mm'),
      png_url: sanitizeReportFileUrlForResponse(report.png_url),
      pdf_url: sanitizeReportFileUrlForResponse(report.pdf_url)
    });
  } catch (err) {
    console.error('获取周报详情失败:', err);
    error(res, '获取周报详情失败', 1, 500);
  }
}

/**
 * 保存周报内容（编辑后）
 * PUT /api/weekly-reports/:id/content
 */
async function saveReportContent(req, res) {
  try {
    const { id } = req.params;
    const { content_json } = req.body;

    if (!content_json) {
      return error(res, '缺少 content_json 参数');
    }

    const report = await WeeklyReport.findByPk(id);
    if (!report) {
      return error(res, '周报不存在');
    }

    const deptFilter = req.deptFilter || null;
    if (deptFilter) {
      const dept = await Department.findByPk(deptFilter);
      const deptName = dept ? dept.name : '';
      // 检查旧报告是否对当前用户可见
      const visible = await filterReportContentForDept(report.content_json, deptFilter);
      if (!visible.hasData) {
        return error(res, '无权修改该周报', 403, 403);
      }
      const currentScope = getOutOfScopeDeptData(report.content_json, deptFilter, deptName);
      if (currentScope.length) {
        return error(res, '无权修改包含其他部门数据的周报', 403, 403);
      }
      // 检查新内容：必须对当前部门可见，防止写入其他部门数据
      const newVisible = await filterReportContentForDept(content_json, deptFilter);
      if (!newVisible.hasData && content_json && Object.keys(content_json).length > 0) {
        return error(res, '无权写入不包含本部门数据的周报内容', 403, 403);
      }
      const incomingScope = getOutOfScopeDeptData(content_json, deptFilter, deptName);
      if (incomingScope.length) {
        return error(res, '无权写入包含其他部门数据的周报', 403, 403);
      }
    }

    // 合并更新：保留原始数据，用编辑后的字段覆盖
    const merged = { ...report.content_json, ...content_json };
    await report.update({ content_json: merged });
    success(res, { id: report.id, ...merged }, '周报内容保存成功');
  } catch (err) {
    console.error('保存周报内容失败:', err);
    if (err.original && err.original.code === 'SQLITE_READONLY') {
      error(res, '数据库只读，请重启服务（pm2 delete + start）', 1, 500);
    } else {
      error(res, '保存周报内容失败', 1, 500);
    }
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

    if (req.deptFilter) {
      return error(res, '仅管理员可保存周报 HTML 内容', 403, 403);
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

    if (req.deptFilter) {
      return error(res, '仅管理员可保存周报文件链接', 403, 403);
    }

    const updateData = {};
    if (png_url !== undefined) {
      if (!isSafeWeeklyReportFileUrl(png_url, '.png')) return error(res, '非法 PNG 文件链接', 1, 400);
      updateData.png_url = png_url || null;
    }
    if (pdf_url !== undefined) {
      if (!isSafeWeeklyReportFileUrl(pdf_url, '.pdf')) return error(res, '非法 PDF 文件链接', 1, 400);
      updateData.pdf_url = pdf_url || null;
    }

    await report.update(updateData);
    success(res, null, '文件链接保存成功');
  } catch (err) {
    console.error('保存文件链接失败:', err);
    error(res, '保存文件链接失败', 1, 500);
  }
}

/**
 * 导出周报 PNG（后端 puppeteer 截图）
 * GET /api/weekly-reports/:id/png
 */
async function exportReportPng(req, res) {
  try {
    const { id } = req.params;
    const report = await WeeklyReport.findByPk(id);

    if (!report) {
      return error(res, '周报不存在');
    }

    let content = report.content_json;
    if (!content) {
      return error(res, '周报内容为空');
    }

    const deptFilter = req.deptFilter || null;
    if (deptFilter) {
      const filtered = await filterReportContentForDept(content, deptFilter);
      if (!filtered.hasData) {
        return error(res, '无权导出该周报', 403, 403);
      }
      content = filtered.content;
    }

    // 取该周报「要进导出」的插图，按项目分组注入渲染
    let assets = null;
    try {
      const { getExportableAssetsGrouped } = require('./reportAssetController');
      assets = await getExportableAssetsGrouped(report.id);
    } catch (assetErr) {
      console.warn('加载周报插图失败（降级为无图导出）:', assetErr.message);
    }

    const pngBuffer = await generateReportPng(content, assets);

    // 质检：空图检测
    if (!pngBuffer || pngBuffer.length < 5000) {
      return error(res, 'PNG 生成异常（空白图），请稍后重试', 1, 500);
    }

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="weekly_report_${report.week_start}_${report.week_end}.png"`,
      'Content-Length': pngBuffer.length,
      'Cache-Control': 'no-cache',
    });
    res.send(pngBuffer);
  } catch (err) {
    console.error('导出周报 PNG 失败:', err);
    error(res, `导出 PNG 失败: ${err.message || '未知错误'}`, 1, 500);
  }
}

module.exports = {
  generateReport,
  getReports,
  getLatestReport,
  getReportById,
  saveReportContent,
  saveReportHtml,
  saveReportFiles,
  exportReportPng,
  __private: {
    filterReportContentForDept,
    getOutOfScopeDeptData,
    isSafeWeeklyReportFileUrl,
    resolveWeeklyReportRange
  }
};

function sanitizeReportFileUrlForResponse(value) {
  if (!value) return null;
  if (isSafeWeeklyReportFileUrl(value, '.png') || isSafeWeeklyReportFileUrl(value, '.pdf')) return value;
  return null;
}

function isSafeWeeklyReportFileUrl(value, expectedExt) {
  if (value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  if (!value.startsWith('/api/files/weekly-reports/')) return false;
  const filename = value.slice('/api/files/weekly-reports/'.length);
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) return false;
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) return false;
  return filename.toLowerCase().endsWith(expectedExt);
}

function itemHasDeptMarker(item) {
  return item && typeof item === 'object' && (
    item.dept_id !== undefined ||
    item.deptId !== undefined ||
    item.dept_name !== undefined ||
    item.department_name !== undefined
  );
}

function itemBelongsToDept(item, deptId, deptName) {
  if (!itemHasDeptMarker(item)) return true;
  const itemDeptId = item.dept_id ?? item.deptId;
  const itemDeptName = item.dept_name ?? item.department_name;
  if (itemDeptId !== undefined && itemDeptId !== null && Number(itemDeptId) === Number(deptId)) return true;
  // TODO: 部门名称字符串匹配是已知局限性，依赖 dept_name 文本相等。
  // 当部门重命名时可能失效，应迁移到 dept_id 整数匹配（需要清洗历史数据）。
  if (itemDeptName && deptName && String(itemDeptName) === String(deptName)) return true;
  return false;
}

function collectOutOfScopeItems(items, deptId, deptName, pathLabel, out) {
  if (!Array.isArray(items)) return;
  items.forEach((item, index) => {
    if (!itemBelongsToDept(item, deptId, deptName)) {
      out.push({ path: `${pathLabel}[${index}]`, dept_id: item.dept_id ?? item.deptId, dept_name: item.dept_name ?? item.department_name });
    }
  });
}

function getOutOfScopeDeptData(content, deptId, deptName = '') {
  if (!content || !deptId) return [];
  const out = [];
  collectOutOfScopeItems(content.kpi_summary, deptId, deptName, 'kpi_summary', out);
  collectOutOfScopeItems(content.project_progress, deptId, deptName, 'project_progress', out);
  collectOutOfScopeItems(content.next_week_key_work, deptId, deptName, 'next_week_key_work', out);
  collectOutOfScopeItems(content.new_achievements, deptId, deptName, 'new_achievements', out);
  collectOutOfScopeItems(content.risk_and_warnings?.risk_projects, deptId, deptName, 'risk_and_warnings.risk_projects', out);
  collectOutOfScopeItems(content.risk_and_warnings?.severe_warnings, deptId, deptName, 'risk_and_warnings.severe_warnings', out);
  collectOutOfScopeItems(content.next_week_focus?.upcoming_projects, deptId, deptName, 'next_week_focus.upcoming_projects', out);
  collectOutOfScopeItems(content.next_week_focus?.follow_up_items, deptId, deptName, 'next_week_focus.follow_up_items', out);
  collectOutOfScopeItems(content.kpi_summary_grouped?.row2, deptId, deptName, 'kpi_summary_grouped.row2', out);
  collectOutOfScopeItems(content.kpi_summary_grouped?.row3, deptId, deptName, 'kpi_summary_grouped.row3', out);
  return out;
}

/**
 * 根据部门过滤周报内容
 * 优先按 dept_id 过滤（新数据），fallback dept_name（老数据兼容）
 * 过滤 kpi_summary, project_progress, risk_and_warnings, next_week_key_work, new_achievements 中的部门数据
 */
async function filterReportContentForDept(content, deptId) {
  if (!content) return { content: null, hasData: false };

  // 动态获取部门名称，不再硬编码
  const dept = await Department.findByPk(deptId);
  const deptName = dept ? dept.name : '';

  const filtered = { ...content };

  // 过滤 KPI 摘要：优先 dept_id，fallback dept_name
  if (filtered.kpi_summary) {
    filtered.kpi_summary = filtered.kpi_summary.filter(k =>
      itemBelongsToDept(k, deptId, deptName)
    );
  }

  if (filtered.kpi_summary_grouped) {
    filtered.kpi_summary_grouped = {
      ...filtered.kpi_summary_grouped,
      row2: (filtered.kpi_summary_grouped.row2 || []).filter(k => itemBelongsToDept(k, deptId, deptName)),
      row3: (filtered.kpi_summary_grouped.row3 || []).filter(k => itemBelongsToDept(k, deptId, deptName)),
    };
  }

  // 过滤项目进展
  if (filtered.project_progress) {
    filtered.project_progress = filtered.project_progress.filter(p =>
      itemBelongsToDept(p, deptId, deptName)
    );
  }

  // 过滤风险与预警
  if (filtered.risk_and_warnings) {
    const raw = filtered.risk_and_warnings;
    filtered.risk_and_warnings = {
      risk_projects: (raw.risk_projects || []).filter(p =>
        itemBelongsToDept(p, deptId, deptName)
      ),
      severe_warnings: (raw.severe_warnings || []).filter(w =>
        itemBelongsToDept(w, deptId, deptName)
      ),
    };
  }

  // 过滤下周重点工作
  if (filtered.next_week_key_work) {
    filtered.next_week_key_work = (filtered.next_week_key_work || []).filter(p =>
      itemBelongsToDept(p, deptId, deptName)
    );
  }

  // 兼容旧周报数据：如果有 next_week_focus 字段（旧格式），也做过滤
  if (filtered.next_week_focus) {
    const raw = filtered.next_week_focus;
    filtered.next_week_focus = {
      upcoming_projects: (raw.upcoming_projects || []).filter(p =>
        itemBelongsToDept(p, deptId, deptName)
      ),
      follow_up_items: (raw.follow_up_items || []).filter(t =>
        itemBelongsToDept(t, deptId, deptName)
      ),
    };
  }

  // 过滤新增成果
  if (filtered.new_achievements) {
    filtered.new_achievements = filtered.new_achievements.filter(a =>
      itemBelongsToDept(a, deptId, deptName)
    );
  }

  // 更新摘要
  if (filtered.summary) {
    filtered.summary = {
      ...filtered.summary,
      total_updated_projects: (filtered.project_progress || []).length,
      total_risk_projects: (filtered.risk_and_warnings?.risk_projects || []).length,
      total_severe_warnings: (filtered.risk_and_warnings?.severe_warnings || []).length,
      total_next_week_key_work: (filtered.next_week_key_work || []).length,
      total_new_achievements: (filtered.new_achievements || []).length,
    };
    // 兼容旧周报
    if (filtered.summary.total_upcoming !== undefined) {
      filtered.summary.total_upcoming = (filtered.next_week_focus?.upcoming_projects || []).length;
    }
  }

  // 重新生成本周结论和关键变化
  if (filtered.week_conclusion) {
    filtered.week_conclusion = regenerateConclusion(filtered);
  }
  if (filtered.key_changes) {
    filtered.key_changes = (filtered.key_changes || []).filter(c =>
      c.text.includes(deptName) || (deptId && c.text.includes(`部门${deptId}`))
    );
  }

  const hasData = (filtered.kpi_summary?.length > 0) ||
    (filtered.project_progress?.length > 0) ||
    (filtered.risk_and_warnings?.risk_projects?.length > 0) ||
    (filtered.next_week_key_work?.length > 0) ||
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

  return parts.join('；');
}
