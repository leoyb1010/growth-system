import React, { useEffect, useState, useRef } from 'react';
import { Button, Card, Table, Tag, message, Tabs, Empty, Modal, Space, Row, Col, Input, Tooltip } from 'antd';
import { FileTextOutlined, EyeOutlined, FileImageOutlined, FileWordOutlined, FileMarkdownOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { api } from '../hooks/useAuth';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import { RobotOutlined } from '@ant-design/icons';

const { TextArea } = Input;

/**
 * 同组 rowSpan 合并辅助函数
 * 返回带 rowSpan 信息的数组，同 dept_name 连续行的部门列合并
 */
function addRowSpan(items) {
  if (!items || items.length === 0) return [];
  // 按 dept_name 分组，保持原始顺序
  const result = items.map(item => ({ ...item, deptRowSpan: 0 }));
  let i = 0;
  while (i < result.length) {
    const dept = result[i].dept_name;
    let j = i;
    while (j < result.length && result[j].dept_name === dept) j++;
    // i ~ j-1 是同一组
    result[i].deptRowSpan = j - i;
    i = j;
  }
  return result;
}

function WeeklyReportPage() {
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef(null);

  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyReport, setHistoryReport] = useState(null);

  // 编辑模式
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);

  // 渲染含换行的文本：\n → <br/>
  const renderText = (text) => {
    if (!text) return '-';
    const lines = String(text).split('\n');
    return lines.map((line, i) => (
      <span key={i}>
        {line}
        {i < lines.length - 1 && <br />}
      </span>
    ));
  };

  // 表格单元格样式
  const cellStyle = { whiteSpace: 'pre-wrap', wordBreak: 'break-word' };

  // 固定列宽样式（解决3-4个字就换行的问题）
  const colStyles = {
    dept: { width: 80, minWidth: 80, whiteSpace: 'nowrap' },
    name: { width: 160, minWidth: 120 },
    owner: { width: 70, minWidth: 70, whiteSpace: 'nowrap' },
    text: cellStyle,
    progress: { width: 60, minWidth: 60, textAlign: 'center' },
    status: { width: 70, minWidth: 70, textAlign: 'center' },
  };

  useEffect(() => {
    fetchReports();
    fetchLatestReport();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await api.get('/weekly-reports');
      if (res.code === 0) {
        setReports(res.data);
      }
    } catch (err) {
      message.error('获取周报列表失败');
    }
  };

  const fetchLatestReport = async () => {
    try {
      const res = await api.get('/weekly-reports/latest');
      if (res.code === 0) {
        setCurrentReport(res.data);
      }
    } catch (err) {
      // 无周报时不报错
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/weekly-reports/generate', {});
      if (res.code === 0) {
        message.success('周报生成成功');
        setCurrentReport(res.data);
        fetchReports();
      } else {
        message.error(res.message || '生成周报失败');
      }
    } catch (err) {
      console.error('生成周报失败:', err);
      message.error(typeof err === 'string' ? err : '生成周报失败，请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  const viewReport = async (id) => {
    try {
      const res = await api.get(`/weekly-reports/${id}`);
      if (res.code === 0) {
        setHistoryReport(res.data);
        setHistoryModalVisible(true);
      }
    } catch (err) {
      message.error('获取周报详情失败');
    }
  };

  // ===== 编辑模式 =====
  const getContent = () => currentReport?.content || currentReport;

  const handleStartEdit = () => {
    const content = getContent();
    if (!content) return;
    setEditData(JSON.parse(JSON.stringify(content)));
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditData(null);
    setEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!currentReport?.id || !editData) return;
    setSaving(true);
    try {
      const res = await api.put(`/weekly-reports/${currentReport.id}/content`, { content_json: editData });
      if (res.code === 0) {
        message.success('周报内容保存成功');
        setCurrentReport(prev => ({ ...prev, content: editData, ...editData }));
        setEditing(false);
        setEditData(null);
      } else {
        message.error(res.message || '保存失败');
      }
    } catch (err) {
      message.error('保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  // 编辑辅助：深层更新 editData
  const updateEditField = (path, value) => {
    setEditData(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      let obj = next;
      for (let i = 0; i < path.length - 1; i++) {
        obj = obj[path[i]];
      }
      obj[path[path.length - 1]] = value;
      return next;
    });
  };

  // ===== 导出功能 =====

  const handleExportPng = async () => {
    if (!currentReport?.id) {
      message.error('无周报数据，无法导出');
      return;
    }
    try {
      message.loading({ content: '正在生成 PNG（后端渲染中）...', key: 'png_export', duration: 0 });
      const token = localStorage.getItem('token');
      const apiBase = process.env.REACT_APP_API_URL || '';
      const res = await fetch(`${apiBase}/api/weekly-reports/${currentReport.id}/png`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      if (blob.size < 5000) {
        message.error({ content: 'PNG 生成异常（空白图），请稍后重试', key: 'png_export' });
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const c = currentReport?.content || currentReport;
      link.download = `增长组周报_${c?.week_start || ''}_${c?.week_end || ''}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      message.success({ content: 'PNG 导出成功', key: 'png_export' });
    } catch (err) {
      console.error('PNG导出失败:', err);
      message.error({ content: `导出 PNG 失败: ${err.message || '未知错误'}`, key: 'png_export' });
    }
  };

  const handleExportMarkdown = (content) => {
    const c = content || currentReport?.content || currentReport;
    if (!c) return;
    const md = generateMarkdown(c);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.download = `增长组周报_${c.week_start || ''}_${c.week_end || ''}.md`;
    link.href = URL.createObjectURL(blob);
    link.click();
    message.success('Markdown 导出成功');
  };

  const handleExportDoc = (content) => {
    const c = content || currentReport?.content || currentReport;
    if (!c) return;
    const html = generateDocHtml(c);
    const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
    const link = document.createElement('a');
    link.download = `增长组周报_${c.week_start || ''}_${c.week_end || ''}.doc`;
    link.href = URL.createObjectURL(blob);
    link.click();
    message.success('Word 文档导出成功');
  };

  // ===== 兼容旧周报：management_comment 合并到 week_conclusion =====
  const getConclusion = (data) => {
    const auto = data.week_conclusion || '';
    const manual = data.management_comment || '';
    if (!auto && !manual) return '';
    if (!manual) return auto;
    if (!auto) return manual;
    return auto + '\n\n✍️ ' + manual;
  };

  // ===== 带同组合并的表格渲染 =====
  const renderMergedTable = (items, columns, editPathPrefix) => {
    if (!items || items.length === 0) return null;
    const rows = addRowSpan(items);
    return (
      <table style={{ fontSize: 13, tableLayout: 'fixed', width: '100%' }}>
        <colgroup>
          <col style={{ width: 80 }} />
          <col style={{ width: 160 }} />
          <col style={{ width: 70 }} />
          <col />
          <col style={{ width: 60 }} />
          <col style={{ width: 70 }} />
        </colgroup>
        <thead><tr>
          <th>部门</th><th>项目名称</th><th>负责人</th><th>{columns.textTitle}</th><th>进度</th><th>状态</th>
        </tr></thead>
        <tbody>
          {rows.map((p, idx) => (
            <tr key={idx} className={p.status === '风险' ? 'risk-row' : ''}>
              {p.deptRowSpan > 0 ? (
                <td rowSpan={p.deptRowSpan} style={colStyles.dept}>{p.dept_name}</td>
              ) : null}
              <td style={colStyles.name}>{p.name}</td>
              <td style={colStyles.owner}>{p.owner_name}</td>
              <td style={colStyles.text}>
                <EditableCell value={p[columns.textField]} path={[...editPathPrefix, idx, columns.textField]} />
              </td>
              <td style={colStyles.progress}>{p.progress_pct}%</td>
              <td style={colStyles.status}>
                {p.status === '风险' ? <span className="risk-tag">风险</span> : (p.status || '-')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  // ===== 导出辅助：同组合并 HTML =====
  const buildMergedHtmlRows = (items, textFn) => {
    if (!items || items.length === 0) return '';
    const rows = addRowSpan(items);
    return rows.map(p => {
      const rowStyle = p.status === '风险' ? ' style="background:#FEF2F2"' : '';
      const deptCell = p.deptRowSpan > 0 ? `<td rowspan="${p.deptRowSpan}" style="width:80px;white-space:nowrap">${p.dept_name}</td>` : '';
      return `<tr${rowStyle}>${deptCell}<td style="width:160px">${p.name}</td><td style="width:70px;white-space:nowrap">${p.owner_name}</td><td class="text-cell">${textFn(p)}</td><td style="width:60px;text-align:center">${p.progress_pct}%</td><td style="width:70px;text-align:center">${p.status === '风险' ? '<span style="background:#DC2626;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">风险</span>' : (p.status || '-')}</td></tr>`;
    }).join('');
  };

  const generateMarkdown = (content) => {
    const { kpi_summary, project_progress, risk_and_warnings, next_week_key_work, next_week_focus, new_achievements } = content;
    const keyWorkItems = Array.isArray(next_week_key_work) ? next_week_key_work : (Array.isArray(next_week_focus?.upcoming_projects) ? next_week_focus.upcoming_projects : []);
    const conclusion = getConclusion(content);
    let md = `# 增长组业务周报\n\n`;
    md += `**周期**：${content.week_start} 至 ${content.week_end}\n\n`;
    if (conclusion) md += `**本周结论**：${conclusion.replace(/\n/g, '；')}\n\n`;
    md += `---\n\n`;
    md += `## 一、本周数据摘要\n\n`;
    if (kpi_summary?.length) {
      const grouped = content.kpi_summary_grouped;
      if (grouped) {
        if (grouped.row1?.length) {
          md += `### 部门级指标\n\n| 指标 | 完成率 | 目标 | 实际 | 单位 |\n|------|--------|------|------|------|\n`;
          grouped.row1.forEach(k => { md += `| ${k.label} | ${k.rate}% | ${k.target} | ${k.actual} | ${k.unit} |\n`; });
          md += `\n`;
        }
        if (grouped.row2?.length) {
          md += `### 各组 GMV\n\n| 部门 | 完成率 | 目标 | 实际 | 单位 |\n|------|--------|------|------|------|\n`;
          grouped.row2.forEach(k => { md += `| ${k.label} | ${k.completion_rate}% | ${k.target} | ${k.actual} | ${k.unit} |\n`; });
          md += `\n`;
        }
        if (grouped.row3?.length) {
          md += `### 其他业务指标\n\n| 部门·指标 | 完成率 | 目标 | 实际 | 单位 |\n|-----------|--------|------|------|------|\n`;
          grouped.row3.forEach(k => { md += `| ${k.label} | ${k.completion_rate}% | ${k.target} | ${k.actual} | ${k.unit} |\n`; });
          md += `\n`;
        }
      } else {
        md += `| 部门 | 指标 | 完成率 | 目标 | 实际 | 单位 |\n|------|------|--------|------|------|------|\n`;
        kpi_summary.forEach(k => { md += `| ${k.dept_name} | ${k.indicator} | ${k.completion_rate}% | ${k.target} | ${k.actual} | ${k.unit} |\n`; });
      }
    } else { md += `暂无数据\n`; }
    md += `\n## 二、重点工作进展\n\n`;
    if (project_progress?.length) {
      md += `| 部门 | 项目名称 | 负责人 | 本周进展 | 进度 | 状态 |\n|------|----------|--------|----------|------|------|\n`;
      project_progress.forEach(p => { md += `| ${p.dept_name} | ${p.name} | ${p.owner_name} | ${p.weekly_progress || '-'} | ${p.progress_pct}% | ${p.status} |\n`; });
    } else { md += `本周无更新项目\n`; }
    md += `\n## 三、风险与预警\n\n`;
    const riskProjects = Array.isArray(risk_and_warnings?.risk_projects) ? risk_and_warnings.risk_projects : [];
    if (riskProjects.length) {
      md += `### 风险项目\n\n| 部门 | 项目名称 | 负责人 | 风险描述 |\n|------|----------|--------|----------|\n`;
      riskProjects.forEach(p => { md += `| ${p.dept_name} | ${p.name} | ${p.owner_name} | ${p.risk_desc || '-'} |\n`; });
      md += `\n`;
    }
    if (!riskProjects.length && !(risk_and_warnings?.severe_warnings?.length)) {
      md += `✅ 本周无风险项目或严重预警指标\n\n`;
    }
    md += `## 四、下周重点工作\n\n`;
    if (keyWorkItems.length) {
      md += `| 部门 | 项目名称 | 负责人 | 下周重点工作 | 进度 | 状态 |\n|------|----------|--------|-------------|------|------|\n`;
      keyWorkItems.forEach(p => { md += `| ${p.dept_name} | ${p.name} | ${p.owner_name} | ${p.next_week_focus || p.due_date || '-'} | ${p.progress_pct}% | ${p.status || '-'} |\n`; });
      md += `\n`;
    }
    md += `## 五、新增成果\n\n`;
    if (new_achievements?.length) {
      md += `| 部门 | 项目/工作 | 负责人 | 成果类型 | 量化结果 | 优先级 |\n|------|----------|--------|----------|----------|--------|\n`;
      new_achievements.forEach(a => { md += `| ${a.dept_name} | ${a.project_name} | ${a.owner_name} | ${a.achievement_type} | ${a.quantified_result || '-'} | ${a.priority} |\n`; });
    } else { md += `本周无新增成果\n`; }
    md += `\n---\n\n自动生成于 ${content.generated_at}\n`;
    return md;
  };

  const generateDocHtml = (content) => {
    const { kpi_summary, project_progress, risk_and_warnings, next_week_key_work, next_week_focus, new_achievements } = content;
    const keyWorkItems = Array.isArray(next_week_key_work) ? next_week_key_work : (Array.isArray(next_week_focus?.upcoming_projects) ? next_week_focus.upcoming_projects : []);
    const conclusion = getConclusion(content);
    const textToHtml = (t) => (t || '-').replace(/\n/g, '<br/>');
    const riskProjects = Array.isArray(risk_and_warnings?.risk_projects) ? risk_and_warnings.risk_projects : [];
    const severeWarnings = Array.isArray(risk_and_warnings?.severe_warnings) ? risk_and_warnings.severe_warnings : [];

    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>增长组周报</title>
<style>
body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; padding: 40px; color: #262626; }
h1 { color: #3B5AFB; border-bottom: 3px solid #3B5AFB; padding-bottom: 10px; }
h2 { color: #262626; border-left: 4px solid #3B5AFB; padding-left: 10px; margin-top: 30px; }
h3 { color: #595959; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; table-layout: fixed; }
th, td { border: 1px solid #d9d9d9; padding: 8px 12px; font-size: 13px; word-break: break-word; overflow-wrap: break-word; }
th { background: #fafafa; font-weight: 600; }
td.text-cell { white-space: pre-wrap; }
.risk { color: #DC2626; font-weight: 600; }
.conclusion-box { background: #F0F4FF; border: 1px solid #C7D7FE; border-radius: 8px; padding: 14px 18px; margin: 16px 0; color: #1E40AF; line-height: 1.7; }
.footer { margin-top: 30px; color: #8c8c8c; font-size: 12px; border-top: 1px solid #d9d9d9; padding-top: 10px; }
</style></head><body>`;
    html += `<h1>增长组业务周报</h1><p><strong>周期</strong>：${content.week_start} 至 ${content.week_end}</p>`;
    if (conclusion) {
      html += `<div class="conclusion-box"><strong>📋 本周结论</strong><br/>${textToHtml(conclusion)}</div>`;
    }
    html += `<h2>一、本周数据摘要</h2>`;
    if (kpi_summary?.length) {
      const grouped = content.kpi_summary_grouped;
      if (grouped) {
        if (grouped.row1?.length) {
          html += `<h3>部门级指标</h3><table><tr><th>指标</th><th>完成率</th><th>目标</th><th>实际</th><th>单位</th></tr>`;
          grouped.row1.forEach(k => {
            const color = k.rate >= 90 ? '#16A34A' : k.rate >= 60 ? '#F59E0B' : '#DC2626';
            html += `<tr><td>${k.label}</td><td style="color:${color};font-weight:600">${k.rate}%</td><td>${k.target}</td><td>${k.actual}</td><td>${k.unit}</td></tr>`;
          });
          html += `</table>`;
        }
        if (grouped.row2?.length) {
          html += `<h3>各组 GMV</h3><table><tr><th>部门</th><th>完成率</th><th>目标</th><th>实际</th><th>单位</th></tr>`;
          grouped.row2.forEach(k => {
            const color = k.completion_rate >= 90 ? '#16A34A' : k.completion_rate >= 60 ? '#F59E0B' : '#DC2626';
            html += `<tr><td>${k.label}</td><td style="color:${color};font-weight:600">${k.completion_rate}%</td><td>${k.target}</td><td>${k.actual}</td><td>${k.unit}</td></tr>`;
          });
          html += `</table>`;
        }
        if (grouped.row3?.length) {
          html += `<h3>其他业务指标</h3><table><tr><th>部门·指标</th><th>完成率</th><th>目标</th><th>实际</th><th>单位</th></tr>`;
          grouped.row3.forEach(k => {
            const color = k.completion_rate >= 90 ? '#16A34A' : k.completion_rate >= 60 ? '#F59E0B' : '#DC2626';
            html += `<tr><td>${k.label}</td><td style="color:${color};font-weight:600">${k.completion_rate}%</td><td>${k.target}</td><td>${k.actual}</td><td>${k.unit}</td></tr>`;
          });
          html += `</table>`;
        }
      } else {
        html += `<table><tr><th>部门</th><th>指标</th><th>完成率</th><th>目标</th><th>实际</th><th>单位</th></tr>`;
        kpi_summary.forEach(k => {
          const color = k.completion_rate >= 90 ? '#16A34A' : k.completion_rate >= 60 ? '#F59E0B' : '#DC2626';
          html += `<tr><td>${k.dept_name}</td><td>${k.indicator}</td><td style="color:${color};font-weight:600">${k.completion_rate}%</td><td>${k.target}</td><td>${k.actual}</td><td>${k.unit}</td></tr>`;
        });
        html += `</table>`;
      }
    } else { html += `<p>暂无数据</p>`; }

    html += `<h2>二、重点工作进展</h2>`;
    if (project_progress?.length) {
      html += `<table><colgroup><col style="width:80px"/><col style="width:160px"/><col style="width:70px"/><col/><col style="width:60px"/><col style="width:70px"/></colgroup>`;
      html += `<thead><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>本周进展</th><th>进度</th><th>状态</th></tr></thead><tbody>`;
      html += buildMergedHtmlRows(project_progress, p => textToHtml(p.weekly_progress));
      html += `</tbody></table>`;
    } else { html += `<p>本周无更新项目</p>`; }

    html += `<h2>三、风险与预警</h2>`;
    if (riskProjects.length) {
      html += `<h3>风险项目（${riskProjects.length} 项）</h3>`;
      html += `<table><thead><tr><th style="width:80px">部门</th><th style="width:160px">项目名称</th><th style="width:70px">负责人</th><th>风险描述</th></tr></thead><tbody>`;
      riskProjects.forEach(p => { html += `<tr style="background:#FEF2F2"><td>${p.dept_name}</td><td>${p.name}</td><td>${p.owner_name}</td><td class="text-cell">${textToHtml(p.risk_desc)}</td></tr>`; });
      html += `</tbody></table>`;
    }
    if (severeWarnings.length) {
      html += `<h3>严重预警指标（${severeWarnings.length} 项）</h3>`;
      html += `<table><thead><tr><th>部门</th><th>业务类型</th><th>指标</th><th>完成率</th><th>差额</th></tr></thead><tbody>`;
      severeWarnings.forEach(w => { html += `<tr><td>${w.dept_name}</td><td>${w.business_type}</td><td>${w.indicator}</td><td style="color:#DC2626;font-weight:600">${w.completion_rate}%</td><td>${w.gap}</td></tr>`; });
      html += `</tbody></table>`;
    }
    if (!riskProjects.length && !severeWarnings.length) {
      html += `<p style="color:#16A34A">✅ 本周无风险项目或严重预警指标</p>`;
    }

    html += `<h2>四、下周重点工作</h2>`;
    if (keyWorkItems.length) {
      html += `<table><colgroup><col style="width:80px"/><col style="width:160px"/><col style="width:70px"/><col/><col style="width:60px"/><col style="width:70px"/></colgroup>`;
      html += `<thead><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>下周重点工作</th><th>进度</th><th>状态</th></tr></thead><tbody>`;
      html += buildMergedHtmlRows(keyWorkItems, p => textToHtml(p.next_week_focus || p.due_date));
      html += `</tbody></table>`;
    } else { html += `<p>暂无项目填写下周重点工作</p>`; }

    html += `<h2>五、新增成果</h2>`;
    if (new_achievements?.length) {
      html += `<table><tr><th>部门</th><th>项目/工作</th><th>负责人</th><th>成果类型</th><th>量化结果</th><th>优先级</th></tr>`;
      new_achievements.forEach(a => { html += `<tr><td>${a.dept_name}</td><td>${a.project_name}</td><td>${a.owner_name}</td><td>${a.achievement_type}</td><td class="text-cell">${textToHtml(a.quantified_result)}</td><td>${a.priority}</td></tr>`; });
      html += `</table>`;
    } else { html += `<p>本周无新增成果</p>`; }

    html += `<div class="footer">自动生成于 ${content.generated_at}</div></body></html>`;
    return html;
  };

  // ===== 周报内容渲染 =====

  const EditableCell = ({ value, path, rows = 2 }) => {
    if (!editing) return <span style={cellStyle}>{renderText(value)}</span>;
    return (
      <TextArea
        value={value || ''}
        onChange={e => updateEditField(path, e.target.value)}
        autoSize={{ minRows: rows, maxRows: 6 }}
        style={{ fontSize: 12 }}
      />
    );
  };

  const renderReportContent = (content, compact = false) => {
    if (!content) return <Empty description="暂无周报数据" />;
    const data = editing && !compact ? editData : content;
    if (!data || typeof data !== 'object') return <Empty description="周报数据格式异常" />;
    const kpi_summary = data.kpi_summary || [];
    const project_progress = data.project_progress || [];
    const risk_and_warnings = data.risk_and_warnings || {};
    const next_week_key_work = data.next_week_key_work;
    const next_week_focus = data.next_week_focus;
    const new_achievements = data.new_achievements || [];
    const keyWorkItems = Array.isArray(next_week_key_work) ? next_week_key_work : (Array.isArray(next_week_focus?.upcoming_projects) ? next_week_focus.upcoming_projects : []);
    const fontSize = compact ? 12 : 13;
    const riskProjects = Array.isArray(risk_and_warnings.risk_projects) ? risk_and_warnings.risk_projects : [];
    const severeWarnings = Array.isArray(risk_and_warnings.severe_warnings) ? risk_and_warnings.severe_warnings : [];
    const riskCount = riskProjects.length + severeWarnings.length;
    const nextWeekCount = keyWorkItems.length;
    const achievementCount = new_achievements.length;
    const conclusion = getConclusion(data);

    return (
      <div ref={!compact && !editing ? reportRef : undefined} className="weekly-report">
        <h1 style={{ fontSize: compact ? 18 : 22, borderBottom: `2px solid #3B5AFB`, paddingBottom: 8, color: '#111827' }}>增长组业务周报</h1>
        <div style={{ fontSize, color: '#6B7280', marginBottom: 20 }}>
          📅 {data.week_start} 至 {data.week_end}
          {editing && <Tag color="orange" style={{ marginLeft: 8 }}>编辑中</Tag>}
        </div>

        {/* 本周结论（可编辑，合并了管理评语） */}
        <div style={{
          background: '#F0F4FF', border: '1px solid #C7D7FE', borderRadius: 10,
          padding: '14px 18px', marginBottom: 20, fontSize: compact ? 12 : 14, color: '#1E40AF', lineHeight: 1.7
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            📋 本周结论
            {editing ? <Tag color="orange" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>可编辑</Tag> : <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>自动生成</Tag>}
          </div>
          {editing && !compact ? (
            <TextArea
              value={data.week_conclusion || ''}
              onChange={e => updateEditField(['week_conclusion'], e.target.value)}
              placeholder="补充管理评语、复盘结论..."
              autoSize={{ minRows: 3, maxRows: 10 }}
              style={{ color: '#1E40AF', fontSize: 13 }}
            />
          ) : renderText(conclusion)}
        </div>

        {/* 关键变化 */}
        {Array.isArray(data.key_changes) && data.key_changes.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: compact ? 13 : 15, marginBottom: 8 }}>⚡ 关键变化</div>
            {data.key_changes.map((c, idx) => {
              const iconMap = { risk: '🔴', progress: '📈', deviation: '📉', achieved: '✅' };
              const colorMap = { risk: '#DC2626', progress: '#16A34A', deviation: '#DC2626', achieved: '#16A34A' };
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: compact ? 12 : 13 }}>
                  <span>{iconMap[c.type] || '📌'}</span>
                  {editing && !compact ? (
                    <Input value={c.text} onChange={e => updateEditField(['key_changes', idx, 'text'], e.target.value)} style={{ flex: 1, fontSize: 12 }} />
                  ) : (
                    <span style={{ color: colorMap[c.type] || '#111827' }}>{c.text}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 摘要卡片行 */}
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col span={8}>
            <Card className="surface-card" bodyStyle={{ padding: 16 }}>
              <div className="metric-label">关键成果</div>
              <div className="metric-value" style={{ fontSize: compact ? 22 : 28 }}>{achievementCount}</div>
              <div className="subtle-text" style={{ fontSize: 11 }}>本周新增</div>
            </Card>
          </Col>
          <Col span={8}>
            <Card className="surface-card" bodyStyle={{ padding: 16 }}>
              <div className="metric-label">风险事项</div>
              <div className="metric-value" style={{ fontSize: compact ? 22 : 28, color: riskCount > 0 ? '#DC2626' : '#16A34A' }}>{riskCount}</div>
              <div className="subtle-text" style={{ fontSize: 11 }}>{riskCount > 0 ? '需要关注' : '一切正常'}</div>
            </Card>
          </Col>
          <Col span={8}>
            <Card className="surface-card" bodyStyle={{ padding: 16 }}>
              <div className="metric-label">下周重点</div>
              <div className="metric-value" style={{ fontSize: compact ? 22 : 28 }}>{nextWeekCount}</div>
              <div className="subtle-text" style={{ fontSize: 11 }}>已填写重点工作</div>
            </Card>
          </Col>
        </Row>

        {/* 数据摘要 — 分层卡片 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>一、本周数据摘要</div>
          {(() => {
            const grouped = data.kpi_summary_grouped;
            // 有分组数据用分层渲染，无分组用旧逻辑兜底
            if (grouped && (grouped.row1?.length || grouped.row2?.length || grouped.row3?.length)) {
              return (
                <>
                  {/* Row1: 部门级 GMV + 利润（大卡片） */}
                  {grouped.row1?.length > 0 && (
                    <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                      {grouped.row1.map((k, idx) => {
                        const color = k.rate >= 90 ? '#16A34A' : k.rate >= 60 ? '#F59E0B' : '#DC2626';
                        return (
                          <Card key={idx} size="small" className="surface-card" bodyStyle={{ padding: 18, flex: 1 }} style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>{k.label}</div>
                            <div style={{ fontSize: 30, fontWeight: 700, color, margin: '6px 0' }}>{k.rate}%</div>
                            <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                              目标 {k.target}{k.unit} · 完成 {k.actual}{k.unit}
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                  {/* Row2: 各组 GMV（中卡片） */}
                  {grouped.row2?.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
                      {grouped.row2.map((k, idx) => {
                        const color = k.completion_rate >= 90 ? '#16A34A' : k.completion_rate >= 60 ? '#F59E0B' : '#DC2626';
                        return (
                          <Card key={idx} size="small" className="surface-card" bodyStyle={{ padding: 14 }}>
                            <div style={{ fontSize: 12, color: '#6B7280' }}>{k.label}</div>
                            <div style={{ fontSize: 24, fontWeight: 700, color, margin: '4px 0' }}>{k.completion_rate}%</div>
                            <div style={{ fontSize: 11, color: '#9CA3AF' }}>目标 {k.target}{k.unit} / 完成 {k.actual}{k.unit}</div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                  {/* Row3: 其他业务指标（紧凑卡片） */}
                  {grouped.row3?.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                      {grouped.row3.map((k, idx) => {
                        const color = k.completion_rate >= 90 ? '#16A34A' : k.completion_rate >= 60 ? '#F59E0B' : '#DC2626';
                        return (
                          <Card key={idx} size="small" className="surface-card" bodyStyle={{ padding: 10 }}>
                            <div style={{ fontSize: 11, color: '#8c8c8c' }}>{k.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 700, color, margin: '2px 0' }}>{k.completion_rate}%</div>
                            <div style={{ fontSize: 10, color: '#bfbfbf' }}>目标 {k.target}{k.unit} / 完成 {k.actual}{k.unit}</div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            }
            // 兜底：旧周报无分组数据，用原逻辑
            return (
              <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
                {kpi_summary.map((kpi, idx) => (
                  <Card key={idx} size="small" className="surface-card" bodyStyle={{ padding: 14 }}>
                    <div style={{ fontSize: 12, color: '#6B7280' }}>{kpi.dept_name} · {kpi.indicator}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: kpi.completion_rate >= 90 ? '#16A34A' : kpi.completion_rate >= 60 ? '#F59E0B' : '#DC2626', margin: '4px 0' }}>
                      {kpi.completion_rate}%
                    </div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                      目标 {kpi.target}{kpi.unit} / 完成 {kpi.actual}{kpi.unit}
                    </div>
                  </Card>
                ))}
              </div>
            );
          })()}
        </div>

        {/* 重点工作进展（同组合并） */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>二、重点工作进展（更新 {project_progress.length} 项）</div>
          {project_progress.length > 0 ? (
            renderMergedTable(project_progress, { textTitle: '本周进展', textField: 'weekly_progress' }, ['project_progress'])
          ) : (
            <p className="subtle-text">本周无更新项目</p>
          )}
        </div>

        {/* 风险与预警 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>三、风险与预警</div>
          {riskProjects.length > 0 && (
            <>
              <h4 style={{ color: '#DC2626', fontSize: compact ? 13 : 14 }}>风险项目（{riskProjects.length} 项）</h4>
              <table style={{ fontSize, tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  <col style={{ width: 80 }} />
                  <col style={{ width: 160 }} />
                  <col style={{ width: 70 }} />
                  <col />
                </colgroup>
                <thead><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>风险描述</th></tr></thead>
                <tbody>
                  {riskProjects.map((p, idx) => (
                    <tr key={idx} className="risk-row"><td>{p.dept_name}</td><td>{p.name}</td><td>{p.owner_name}</td>
                      <td style={cellStyle}><EditableCell value={p.risk_desc} path={['risk_and_warnings', 'risk_projects', idx, 'risk_desc']} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {severeWarnings.length > 0 && (
            <>
              <h4 style={{ color: '#F59E0B', marginTop: 16, fontSize: compact ? 13 : 14 }}>严重预警指标（{severeWarnings.length} 项）</h4>
              <table style={{ fontSize }}>
                <thead><tr><th>部门</th><th>业务类型</th><th>指标</th><th>完成率</th><th>差额</th></tr></thead>
                <tbody>
                  {severeWarnings.map((w, idx) => (
                    <tr key={idx}><td>{w.dept_name}</td><td>{w.business_type}</td><td>{w.indicator}</td>
                    <td style={{ color: '#DC2626', fontWeight: 600 }}>{w.completion_rate}%</td><td>{w.gap}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {riskProjects.length === 0 && severeWarnings.length === 0 && (
            <p style={{ color: '#16A34A' }}>✅ 本周无风险项目或严重预警指标</p>
          )}
        </div>

        {/* 下周重点工作（同组合并） */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>四、下周重点工作</div>
          {keyWorkItems.length > 0 ? (
            renderMergedTable(keyWorkItems, { textTitle: '下周重点工作', textField: 'next_week_focus' }, ['next_week_key_work'])
          ) : (
            <p className="subtle-text">暂无项目填写下周重点工作</p>
          )}
        </div>

        {/* 新增成果 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>五、新增成果（{achievementCount} 项）</div>
          {new_achievements.length > 0 ? (
            <table style={{ fontSize, tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: 80 }} />
                <col style={{ width: 160 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 80 }} />
                <col />
                <col style={{ width: 60 }} />
              </colgroup>
              <thead><tr><th>部门</th><th>项目/工作</th><th>负责人</th><th>成果类型</th><th>量化结果</th><th>优先级</th></tr></thead>
              <tbody>
                {new_achievements.map((a, idx) => (
                  <tr key={idx}><td>{a.dept_name}</td><td>{a.project_name}</td><td>{a.owner_name}</td><td>{a.achievement_type}</td>
                    <td style={cellStyle}><EditableCell value={a.quantified_result} path={['new_achievements', idx, 'quantified_result']} /></td>
                    <td><Tag color={a.priority === '高' ? 'error' : a.priority === '中' ? 'warning' : 'default'}>{a.priority}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="subtle-text">本周无新增成果</p>
          )}
        </div>

        <div className="footer" style={{ marginTop: 20, borderTop: '1px solid #E5E7EB', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#9CA3AF', fontSize: 12 }}>🤖 本周报基础数据由系统自动汇总生成于 {data.generated_at}</span>
          <span style={{ color: '#3B5AFB', fontSize: 12 }}>
            {editing ? '编辑后请点击保存' : '点击编辑按钮补充结论和复盘'}
          </span>
        </div>
      </div>
    );
  };

  const reportColumns = [
    { title: '周报周期', key: 'period', render: (_, r) => `${r.week_start} 至 ${r.week_end}` },
    { title: '生成时间', dataIndex: 'generated_at', key: 'generated' },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => viewReport(record.id)}>查看</Button>
        </Space>
      )
    }
  ];

  const ExportButtons = () => (
    <>
      <Button icon={<FileImageOutlined />} onClick={handleExportPng}>PNG</Button>
      <Button icon={<FileWordOutlined />} onClick={() => handleExportDoc()}>Word</Button>
      <Button icon={<FileMarkdownOutlined />} onClick={() => handleExportMarkdown()}>MD</Button>
    </>
  );

  return (
    <div className="app-page">
      <PageHeader
        title="周报与复盘"
        subtitle="结果输出页 · 周报内容自动生成，补充结论和复盘即可"
        extra={[
          <Button key="ai_brief" icon={<RobotOutlined />} onClick={() => window.__aiAssistant?.generateBriefing('brief', 'weekly_reports')}>AI 简报</Button>,
          <Button key="ai_agenda" icon={<RobotOutlined />} onClick={() => window.__aiAssistant?.runAction('generate_agenda', 'weekly_reports')}>AI 周会议程</Button>,
          <Button key="gen" type="primary" icon={<FileTextOutlined />} onClick={handleGenerate} loading={generating}>
            生成周报
          </Button>,
          currentReport && !editing && (
            <Tooltip key="edit" title="编辑周报内容、补充结论和复盘">
              <Button icon={<EditOutlined />} onClick={handleStartEdit}>编辑</Button>
            </Tooltip>
          ),
          editing && (
            <Button key="save" type="primary" icon={<SaveOutlined />} onClick={handleSaveEdit} loading={saving}>保存</Button>
          ),
          editing && (
            <Button key="cancel" icon={<CloseOutlined />} onClick={handleCancelEdit}>取消</Button>
          ),
          currentReport && !editing && <ExportButtons key="export" />,
        ]}
      />

      <Tabs defaultActiveKey="current">
        <Tabs.TabPane tab="当前周报" key="current">
          {currentReport ? (
            <div style={{ background: '#F5F7FB', padding: 24, borderRadius: 14 }}>
              {renderReportContent(currentReport.content || currentReport)}
            </div>
          ) : (
            <Empty description="暂无周报，点击上方按钮生成" />
          )}
        </Tabs.TabPane>
        <Tabs.TabPane tab="历史周报" key="history">
          <PanelCard>
            <Table dataSource={reports} columns={reportColumns} rowKey="id" scroll={{ x: 'max-content' }} />
          </PanelCard>
        </Tabs.TabPane>
      </Tabs>

      <Modal
        title={historyReport ? `周报：${historyReport.week_start} 至 ${historyReport.week_end}` : '周报详情'}
        open={historyModalVisible}
        onCancel={() => { setHistoryModalVisible(false); setHistoryReport(null); }}
        width={900}
        footer={[
          <Button key="close" onClick={() => { setHistoryModalVisible(false); setHistoryReport(null); }}>关闭</Button>,
          <Button key="png" icon={<FileImageOutlined />} onClick={() => { message.info('请在当前周报Tab中导出PNG'); }}>导出 PNG</Button>,
          <Button key="word" icon={<FileWordOutlined />} onClick={() => handleExportDoc(historyReport)}>导出 Word</Button>,
          <Button key="md" icon={<FileMarkdownOutlined />} onClick={() => handleExportMarkdown(historyReport)}>导出 MD</Button>,
        ]}
      >
        <div style={{ background: '#F5F7FB', padding: 20, borderRadius: 14, maxHeight: '70vh', overflowY: 'auto' }}>
          {renderReportContent(historyReport, true)}
        </div>
      </Modal>
    </div>
  );
}

export default WeeklyReportPage;
