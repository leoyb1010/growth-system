/**
 * 周报 PNG 截图服务
 * 使用 puppeteer 渲染专用 HTML 模板，生成高质量 PNG
 */

const puppeteer = require('puppeteer');
const path = require('path');

let browserInstance = null;

/**
 * 获取或启动浏览器实例（复用，避免每次截图都启动）
 * macOS 优先使用本机 Chrome，fallback 到 puppeteer 自带 Chromium
 */
async function getBrowser() {
  if (!browserInstance || !browserInstance.isConnected()) {
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    };

    // macOS 优先使用本机 Chrome
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const fs = require('fs');
    if (fs.existsSync(chromePath)) {
      launchOptions.executablePath = chromePath;
    }

    browserInstance = await puppeteer.launch(launchOptions);
  }
  return browserInstance;
}

/**
 * 生成周报 PNG
 * @param {Object} content - 周报 content_json 数据
 * @returns {Promise<Buffer>} PNG 图片 Buffer
 */
async function generateReportPng(content) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    const html = buildReportHtml(content);
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });

    // 等待字体渲染完成
    await page.evaluate(() => document.fonts.ready);
    // 额外等 200ms 确保布局稳定
    await new Promise(r => setTimeout(r, 200));

    // 设置视口宽度 1200px，高度自适应
    await page.setViewport({ width: 1200, height: 800 });

    // 截图参数
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
    });

    return screenshot;
  } finally {
    await page.close();
  }
}

/**
 * 构建周报专用 HTML（纯内联 CSS，排版完全可控）
 */
function buildReportHtml(content) {
  const {
    kpi_summary, project_progress, risk_and_warnings,
    next_week_key_work, next_week_focus, new_achievements,
    week_conclusion, key_changes, management_comment,
    week_start, week_end, generated_at
  } = content;

  const keyWorkItems = Array.isArray(next_week_key_work) ? next_week_key_work : (Array.isArray(next_week_focus?.upcoming_projects) ? next_week_focus.upcoming_projects : []);
  const riskCount = (Array.isArray(risk_and_warnings?.risk_projects) ? risk_and_warnings.risk_projects.length : 0) + (Array.isArray(risk_and_warnings?.severe_warnings) ? risk_and_warnings.severe_warnings.length : 0);
  const achievementCount = Array.isArray(new_achievements) ? new_achievements.length : 0;
  const riskProjects = Array.isArray(risk_and_warnings?.risk_projects) ? risk_and_warnings.risk_projects : [];
  const severeWarnings = Array.isArray(risk_and_warnings?.severe_warnings) ? risk_and_warnings.severe_warnings : [];

  // 兼容旧周报：management_comment 合并到 week_conclusion
  const fullConclusion = [week_conclusion, management_comment ? '✍️ ' + management_comment : ''].filter(Boolean).join('\n\n');

  const textToHtml = (t) => (t || '-').replace(/\n/g, '<br/>');

  // 同组合并 HTML 行辅助
  const deptGroups = {};
  const itemOrder = [];
  function addRowSpanInfo(items) {
    if (!items || items.length === 0) return [];
    const result = items.map(item => ({ ...item, deptRowSpan: 0 }));
    let i = 0;
    while (i < result.length) {
      const dept = result[i].dept_name;
      let j = i;
      while (j < result.length && result[j].dept_name === dept) j++;
      result[i].deptRowSpan = j - i;
      i = j;
    }
    return result;
  }
  function buildMergedRows(items, textFn) {
    const rows = addRowSpanInfo(items);
    return rows.map(p => {
      const rowStyle = p.status === '风险' ? ' style="background:#FEF2F2"' : '';
      const deptCell = p.deptRowSpan > 0 ? `<td rowspan="${p.deptRowSpan}" style="width:80px;white-space:nowrap">${p.dept_name}</td>` : '';
      const statusHtml = p.status === '风险' ? '<span class="risk-tag">风险</span>' : (p.status || '-');
      return `<tr${rowStyle}>${deptCell}<td style="width:160px">${p.name}</td><td style="width:70px;white-space:nowrap">${p.owner_name}</td><td class="text-cell">${textFn(p)}</td><td style="width:60px;text-align:center">${p.progress_pct}%</td><td style="width:70px;text-align:center">${statusHtml}</td></tr>`;
    }).join('');
  }

  // 通用样式
  const baseStyle = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif;
      color: #111827; background: #fff; padding: 48px 56px;
      line-height: 1.6; width: 1200px;
    }
    h1 { text-align: center; font-size: 26px; border-bottom: 3px solid #3B5AFB; padding-bottom: 12px; margin-bottom: 8px; }
    .date { text-align: center; color: #6B7280; font-size: 14px; margin-bottom: 24px; }
    .section { margin-bottom: 28px; }
    .section-title { font-size: 17px; font-weight: 700; border-left: 4px solid #3B5AFB; padding-left: 12px; margin-bottom: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; table-layout: fixed; }
    th, td { border: 1px solid #E5E7EB; padding: 10px 12px; text-align: left; word-break: break-word; overflow-wrap: break-word; }
    th { background: #F3F4F6; font-weight: 600; color: #374151; }
    .risk-row { background: #FEF2F2; }
    .risk-tag { background: #DC2626; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    .text-cell { max-width: 300px; white-space: pre-wrap; }
    .card-row { display: flex; gap: 16px; margin-bottom: 24px; }
    .metric-card { flex: 1; background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 10px; padding: 18px; text-align: center; }
    .metric-label { font-size: 12px; color: #6B7280; margin-bottom: 4px; }
    .metric-value { font-size: 30px; font-weight: 700; }
    .metric-sub { font-size: 11px; color: #9CA3AF; margin-top: 4px; }
    .conclusion-box { background: #F0F4FF; border: 1px solid #C7D7FE; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; font-size: 14px; color: #1E40AF; line-height: 1.8; }
    .conclusion-title { font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 8px; }
    .auto-tag { background: #DBEAFE; color: #1E40AF; font-size: 10px; padding: 1px 6px; border-radius: 3px; }
    .change-item { display: flex; align-items: center; gap: 8px; padding: 5px 0; font-size: 13px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px; }
    .kpi-card { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; }
    .kpi-dept { font-size: 12px; color: #6B7280; }
    .kpi-rate { font-size: 26px; font-weight: 700; margin: 4px 0; }
    .kpi-detail { font-size: 11px; color: #9CA3AF; }
    .footer { margin-top: 28px; border-top: 1px solid #E5E7EB; padding-top: 12px; display: flex; justify-content: space-between; font-size: 12px; color: #9CA3AF; }
    .no-data { color: #9CA3AF; font-size: 13px; }
  `;

  // KPI 摘要卡片
  let kpiCardsHtml = '';
  if (kpi_summary?.length) {
    kpiCardsHtml = `<div class="kpi-grid">` +
      kpi_summary.map(k => {
        const color = k.completion_rate >= 90 ? '#16A34A' : k.completion_rate >= 60 ? '#F59E0B' : '#DC2626';
        return `<div class="kpi-card">
          <div class="kpi-dept">${k.dept_name} · ${k.indicator}</div>
          <div class="kpi-rate" style="color:${color}">${k.completion_rate}%</div>
          <div class="kpi-detail">目标 ${k.target}${k.unit} / 完成 ${k.actual}${k.unit}</div>
        </div>`;
      }).join('') + `</div>`;
  } else {
    kpiCardsHtml = `<p class="no-data">暂无数据</p>`;
  }

  // 项目进展表格（同组合并）
  let progressHtml = '';
  if (project_progress?.length) {
    progressHtml = `<table>
      <colgroup><col style="width:80px"/><col style="width:160px"/><col style="width:70px"/><col/><col style="width:60px"/><col style="width:70px"/></colgroup>
      <thead><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>本周进展</th><th>进度</th><th>状态</th></tr></thead>
      <tbody>${buildMergedRows(project_progress, p => textToHtml(p.weekly_progress))}</tbody></table>`;
  } else {
    progressHtml = `<p class="no-data">本周无更新项目</p>`;
  }

  // 风险表格
  let riskHtml = '';
  if (riskProjects.length) {
    riskHtml += `<h4 style="color:#DC2626;font-size:14px;margin-bottom:8px">风险项目（${riskProjects.length} 项）</h4>
      <table><colgroup><col style="width:80px"/><col style="width:160px"/><col style="width:70px"/><col/></colgroup>
      <thead><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>风险描述</th></tr></thead>
      <tbody>${riskProjects.map(p =>
        `<tr class="risk-row"><td>${p.dept_name}</td><td>${p.name}</td><td>${p.owner_name}</td><td class="text-cell">${textToHtml(p.risk_desc)}</td></tr>`
      ).join('')}</tbody></table>`;
  }
  if (severeWarnings.length) {
    riskHtml += `<h4 style="color:#F59E0B;font-size:14px;margin:14px 0 8px">严重预警指标（${severeWarnings.length} 项）</h4>
      <table><thead><tr><th>部门</th><th>业务类型</th><th>指标</th><th>完成率</th><th>差额</th></tr></thead>
      <tbody>${severeWarnings.map(w =>
        `<tr><td>${w.dept_name}</td><td>${w.business_type}</td><td>${w.indicator}</td><td style="color:#DC2626;font-weight:600">${w.completion_rate}%</td><td>${w.gap}</td></tr>`
      ).join('')}</tbody></table>`;
  }
  if (riskProjects.length === 0 && severeWarnings.length === 0) {
    riskHtml = `<p style="color:#16A34A">✅ 本周无风险项目或严重预警指标</p>`;
  }

  // 下周重点工作（同组合并）
  let nextWeekHtml = '';
  if (keyWorkItems.length) {
    nextWeekHtml = `<table>
      <colgroup><col style="width:80px"/><col style="width:160px"/><col style="width:70px"/><col/><col style="width:60px"/><col style="width:70px"/></colgroup>
      <thead><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>下周重点工作</th><th>进度</th><th>状态</th></tr></thead>
      <tbody>${buildMergedRows(keyWorkItems, p => textToHtml(p.next_week_focus || p.due_date))}</tbody></table>`;
  } else {
    nextWeekHtml = `<p class="no-data">暂无项目填写下周重点工作</p>`;
  }

  // 新增成果
  let achieveHtml = '';
  if (new_achievements?.length) {
    achieveHtml = `<table>
      <colgroup><col style="width:70px"/><col style="width:140px"/><col style="width:70px"/><col style="width:80px"/><col/><col style="width:60px"/></colgroup>
      <thead><tr><th>部门</th><th>项目/工作</th><th>负责人</th><th>成果类型</th><th>量化结果</th><th>优先级</th></tr></thead>
      <tbody>${new_achievements.map(a => {
        const priColor = a.priority === '高' ? '#DC2626' : a.priority === '中' ? '#F59E0B' : '#6B7280';
        return `<tr><td>${a.dept_name}</td><td>${a.project_name}</td><td>${a.owner_name}</td><td>${a.achievement_type}</td><td class="text-cell">${textToHtml(a.quantified_result)}</td><td style="color:${priColor};font-weight:600">${a.priority}</td></tr>`;
      }).join('')}</tbody></table>`;
  } else {
    achieveHtml = `<p class="no-data">本周无新增成果</p>`;
  }

  // 关键变化
  let changesHtml = '';
  if (key_changes?.length) {
    const iconMap = { risk: '🔴', progress: '📈', deviation: '📉', achieved: '✅' };
    const colorMap = { risk: '#DC2626', progress: '#16A34A', deviation: '#DC2626', achieved: '#16A34A' };
    changesHtml = `<div style="margin-bottom:20px">
      <div style="font-weight:700;font-size:15px;margin-bottom:8px">⚡ 关键变化</div>
      ${key_changes.map(c => `<div class="change-item"><span>${iconMap[c.type] || '📌'}</span><span style="color:${colorMap[c.type] || '#111827'}">${c.text}</span></div>`).join('')}
    </div>`;
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>增长组业务周报</title><style>${baseStyle}</style></head>
<body>
  <h1>增长组业务周报</h1>
  <div class="date">📅 ${week_start} 至 ${week_end}</div>

  ${fullConclusion ? `<div class="conclusion-box">
    <div class="conclusion-title">📋 本周结论 <span class="auto-tag">自动生成+可补充</span></div>
    ${textToHtml(fullConclusion)}
  </div>` : ''}

  ${changesHtml}

  <div class="card-row">
    <div class="metric-card">
      <div class="metric-label">关键成果</div>
      <div class="metric-value">${achievementCount}</div>
      <div class="metric-sub">本周新增</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">风险事项</div>
      <div class="metric-value" style="color:${riskCount > 0 ? '#DC2626' : '#16A34A'}">${riskCount}</div>
      <div class="metric-sub">${riskCount > 0 ? '需要关注' : '一切正常'}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">下周重点</div>
      <div class="metric-value">${keyWorkItems.length}</div>
      <div class="metric-sub">已填写重点工作</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">一、本周数据摘要</div>
    ${kpiCardsHtml}
  </div>

  <div class="section">
    <div class="section-title">二、重点工作进展（更新 ${project_progress?.length || 0} 项）</div>
    ${progressHtml}
  </div>

  <div class="section">
    <div class="section-title">三、风险与预警</div>
    ${riskHtml}
  </div>

  <div class="section">
    <div class="section-title">四、下周重点工作</div>
    ${nextWeekHtml}
  </div>

  <div class="section">
    <div class="section-title">五、新增成果（${achievementCount} 项）</div>
    ${achieveHtml}
  </div>

  <div class="footer">
    <span>🤖 本周报基础数据由系统自动汇总生成于 ${generated_at || ''}</span>
    <span>结论与复盘可手动补充编辑</span>
  </div>
</body></html>`;
}

/**
 * 关闭浏览器实例
 */
async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

module.exports = { generateReportPng, closeBrowser };
