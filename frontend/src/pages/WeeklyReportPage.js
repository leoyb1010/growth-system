import React, { useEffect, useState, useRef } from 'react';
import { Button, Card, Table, Tag, message, Tabs, Empty, Modal, Space, Row, Col, Input, Tooltip, Progress, Spin, Grid } from 'antd';
import { FileTextOutlined, EyeOutlined, EyeInvisibleOutlined, FileImageOutlined, FileWordOutlined, FileMarkdownOutlined, EditOutlined, SaveOutlined, CloseOutlined, TrophyOutlined, WarningOutlined, ScheduleOutlined, BarChartOutlined, DollarOutlined, RobotOutlined, CopyOutlined, PictureOutlined } from '@ant-design/icons';
import { api, getAccessToken, useAuth } from '../hooks/useAuth';
import { fetchWeeklyOperatingBrief } from '../services/aiService';
import ReportImagesDrawer from '../components/ReportImagesDrawer';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import Sparkline from '../components/ui/Sparkline';
import MiniMetric from '../components/ui/MiniMetric';
import SectionHeader from '../components/ui/SectionHeader';

const { TextArea } = Input;

const renderTextLines = (text) => {
  if (!text) return '-';
  const lines = String(text).split('\n');
  return lines.map((line, i) => (
    <span key={i}>
      {line}
      {i < lines.length - 1 && <br />}
    </span>
  ));
};

const EditableCell = React.memo(function EditableCell({ editing, value, path, rows = 2, onChange, cellStyle }) {
  if (!editing) return <span style={cellStyle}>{renderTextLines(value)}</span>;
  return (
    <TextArea
      value={value || ''}
      onChange={e => onChange(path, e.target.value)}
      autoSize={{ minRows: rows, maxRows: 6 }}
      style={{ fontSize: 12 }}
    />
  );
});

const fmtMoney = (value) => {
  const n = Number(value || 0);
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toFixed(0);
};

const fmtCompact = (value) => {
  const n = Number(value || 0);
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};

const fmtPercent = (value, digits = 2) => `${(Number(value || 0) * 100).toFixed(digits)}%`;

const fmtSignedMoney = (value) => {
  const n = Number(value || 0);
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}¥${fmtMoney(Math.abs(n))}`;
};

const fmtSignedCount = (value) => {
  const n = Number(value || 0);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n}`;
};

const fmtDayOverDayPct = (value) => {
  if (value == null) return '前日为0';
  const n = Number(value) || 0;
  return `${n.toFixed(Math.abs(n) >= 10 ? 1 : 2)}%`;
};

const fmtCpsDayOverDay = (cps) => {
  const d = cps?.day_over_day || {};
  if (!d.current_date) return '暂无日环比';
  return `${fmtSignedMoney(d.actual_amount_delta)}（${fmtDayOverDayPct(d.actual_amount_delta_pct)}）`;
};

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
  const { isAdmin } = useAuth();
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [aiBriefLoading, setAiBriefLoading] = useState(false);
  const [aiBrief, setAiBrief] = useState(null);
  const [aiBriefVisible, setAiBriefVisible] = useState(false);
  const reportRef = useRef(null);
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false || (typeof window !== 'undefined' && window.innerWidth < 768);

  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyReport, setHistoryReport] = useState(null);

  // 编辑模式
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imagesDrawerOpen, setImagesDrawerOpen] = useState(false);

  // 表格单元格样式
  const cellStyle = { whiteSpace: 'pre-wrap', wordBreak: 'break-word' };

  // 固定列宽样式（解决3-4个字就换行的问题）
  const colStyles = {
    dept: { width: 80, minWidth: 80, whiteSpace: 'nowrap' },
    name: { width: 180, minWidth: 120 },
    text: cellStyle,
    progress: { width: 100, minWidth: 80, textAlign: 'center' },
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

  const handleGenerateAiBrief = async () => {
    setAiBriefLoading(true);
    try {
      const res = await fetchWeeklyOperatingBrief({ currentPage: 'weekly_reports' });
      if (res.code === 0) {
        setAiBrief(res.data);
        setAiBriefVisible(true);
      } else {
        message.error(res.message || 'AI 备会分析生成失败');
      }
    } catch (err) {
      message.error('AI 备会分析生成失败');
    } finally {
      setAiBriefLoading(false);
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
      const token = getAccessToken();
      const apiBase = import.meta.env.REACT_APP_API_URL || import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/weekly-reports/${currentReport.id}/png`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
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

  const copyPlainTextFallback = async (text) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  };

  const copyHtmlSelectionFallback = (html) => {
    const fragmentMatch = html.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/);
    const fragment = fragmentMatch ? fragmentMatch[1] : html;
    const container = document.createElement('div');
    container.setAttribute('contenteditable', 'true');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '860px';
    container.innerHTML = fragment;
    document.body.appendChild(container);

    const selection = window.getSelection();
    if (!selection) {
      document.body.removeChild(container);
      return false;
    }
    const range = document.createRange();
    range.selectNodeContents(container);
    selection.removeAllRanges();
    selection.addRange(range);
    const copied = document.execCommand('copy');
    selection.removeAllRanges();
    document.body.removeChild(container);
    return copied;
  };

  const handleCopyMeetingDoc = async (content) => {
    if (!content && editing) {
      message.warning('当前周报还在编辑中，请先保存后再复制到会议文档');
      return;
    }

    const c = content || currentReport?.content || currentReport;
    if (!c) return;

    const html = generateMeetingDocEditorHtml(c);
    const plainText = generateMeetingDocEditorPlainText(c);

    try {
      if (navigator.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([
          new window.ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plainText], { type: 'text/plain' }),
          })
        ]);
      } else if (!copyHtmlSelectionFallback(html)) {
        await copyPlainTextFallback(plainText);
        message.warning('当前浏览器不支持富文本复制，已复制会议文档纯文本');
        return;
      }
      message.success('已复制为会议文档富文本，可直接粘贴到在线文档');
    } catch (err) {
      try {
        await copyPlainTextFallback(plainText);
        message.warning('富文本复制受限，已复制会议文档纯文本');
      } catch (fallbackErr) {
        console.error('复制会议文档失败:', err, fallbackErr);
        message.error('复制失败，请检查浏览器剪贴板权限');
      }
    }
  };

  // ===== 兼容旧周报：management_comment 合并到 week_conclusion =====
  const getConclusion = (data) => {
    const auto = data.week_conclusion || '';
    const manual = data.management_comment || '';
    if (!auto && !manual) return '';
    if (!manual) return auto;
    if (!auto) return manual;
    return auto + '\n\n✍' + manual;
  };

  const renderStatus = (status) => (
    status === '风险'
      ? <Tag color="error" style={{ margin: 0 }}>风险</Tag>
      : <Tag style={{ margin: 0 }}>{status || '-'}</Tag>
  );

  const renderMobileProjectCards = (items, columns, editPathPrefix, visibleWithIdx, showHideCol) => (
    <div className="weekly-mobile-card-list">
      {visibleWithIdx.map((p, rowIdx) => {
        const origIdx = p._origIdx !== undefined ? p._origIdx : rowIdx;
        const progress = Number(p.progress_pct || 0);
        const progressColor = progress >= 80 ? '#16A34A' : progress >= 50 ? '#F59E0B' : '#DC2626';
        return (
          <div key={origIdx} className={`weekly-mobile-card${p.status === '风险' ? ' is-risk' : ''}`}>
            <div className="weekly-mobile-card-head">
              <div className="weekly-mobile-title-wrap">
                <div className="weekly-mobile-title">{p.name || '-'}</div>
                <div className="weekly-mobile-meta">
                  <Tag style={{ margin: 0 }}>{p.dept_name || '未分组'}</Tag>
                  {renderStatus(p.status)}
                </div>
              </div>
              {showHideCol && (
                <Tooltip title="隐藏此项目（导出时不显示）">
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeInvisibleOutlined />}
                    style={{ color: '#9CA3AF', flexShrink: 0 }}
                    onClick={() => updateEditField([...editPathPrefix, origIdx, '_hidden'], true)}
                  />
                </Tooltip>
              )}
            </div>

            <div className="weekly-mobile-progress">
              <span>进度</span>
              <Progress
                percent={progress}
                size="small"
                strokeColor={progressColor}
                format={() => `${progress}%`}
              />
            </div>

            <div className="weekly-mobile-field">
              <div className="weekly-mobile-label">{columns.textTitle}</div>
              <div className="weekly-mobile-text">
                <EditableCell
                  editing={editing}
                  value={items[origIdx][columns.textField]}
                  path={[...editPathPrefix, origIdx, columns.textField]}
                  rows={3}
                  onChange={updateEditField}
                  cellStyle={cellStyle}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // ===== 带同组合并的表格渲染 =====
  const renderMergedTable = (items, columns, editPathPrefix) => {
    if (!items || items.length === 0) return null;
    // 过滤隐藏项后做 rowSpan 合并；保留原始索引用于 EditableCell path
    const visibleWithIdx = items.map((item, idx) => ({ ...item, _origIdx: idx })).filter(item => !item._hidden);
    if (visibleWithIdx.length === 0) return <p className="subtle-text">所有项目已隐藏</p>;
    const rows = addRowSpan(visibleWithIdx);
    const showHideCol = editing && ['project_progress', 'next_week_key_work'].includes(editPathPrefix[0]);
    if (isMobile) {
      return renderMobileProjectCards(items, columns, editPathPrefix, visibleWithIdx, showHideCol);
    }
    return (
      <table style={{ fontSize: 13, tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse', border: '1px solid #E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
        <colgroup>
          <col style={{ width: 80 }} />
          <col style={{ width: 180 }} />
          <col />
          <col style={{ width: 80 }} />
          <col style={{ width: 70 }} />
          {showHideCol && <col style={{ width: 36 }} />}
        </colgroup>
        <thead><tr style={{ background: '#F9FAFB' }}>
          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #E5E7EB', fontSize: 12, fontWeight: 600, color: '#374151' }}>部门</th>
          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #E5E7EB', fontSize: 12, fontWeight: 600, color: '#374151' }}>项目名称</th>
          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #E5E7EB', fontSize: 12, fontWeight: 600, color: '#374151' }}>{columns.textTitle}</th>
          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #E5E7EB', fontSize: 12, fontWeight: 600, color: '#374151' }}>进度</th>
          <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid #E5E7EB', fontSize: 12, fontWeight: 600, color: '#374151' }}>状态</th>
          {showHideCol && <th style={{ padding: '8px 6px', textAlign: 'center', borderBottom: '2px solid #E5E7EB', fontSize: 12, fontWeight: 600, color: '#374151' }}></th>}
        </tr></thead>
        <tbody>
          {rows.map((p, rowIdx) => {
            const origIdx = p._origIdx !== undefined ? p._origIdx : rowIdx;
            return (
              <tr key={origIdx} style={p.status === '风险' ? { background: '#FEF2F2' } : { borderBottom: '1px solid #F3F4F6' }}>
                {p.deptRowSpan > 0 ? (
                  <td rowSpan={p.deptRowSpan} style={{ ...colStyles.dept, padding: '8px 12px', borderBottom: '1px solid #E5E7EB' }}>{p.dept_name}</td>
                ) : null}
                <td style={{ ...colStyles.name, padding: '8px 12px', borderBottom: '1px solid #E5E7EB' }}>{p.name}</td>
                <td style={{ ...colStyles.text, padding: '8px 12px', borderBottom: '1px solid #E5E7EB' }}>
                  <EditableCell
                    editing={editing}
                    value={items[origIdx][columns.textField]}
                    path={[...editPathPrefix, origIdx, columns.textField]}
                    onChange={updateEditField}
                    cellStyle={cellStyle}
                  />
                </td>
                <td style={{ ...colStyles.progress, padding: '8px 12px', borderBottom: '1px solid #E5E7EB' }}>
                  <Progress percent={p.progress_pct} size="small" strokeColor={p.progress_pct >= 80 ? '#16A34A' : p.progress_pct >= 50 ? '#F59E0B' : '#DC2626'} format={() => `${p.progress_pct}%`} />
                </td>
                <td style={{ ...colStyles.status, padding: '8px 12px', borderBottom: '1px solid #E5E7EB' }}>
                  {p.status === '风险' ? <Tag color="error" style={{ margin: 0 }}>风险</Tag> : (p.status || '-')}
                </td>
                {showHideCol && (
                  <td style={{ padding: '4px 6px', textAlign: 'center', borderBottom: '1px solid #E5E7EB' }}>
                    <Tooltip title="隐藏此项目（导出时不显示）">
                      <Button type="text" size="small" icon={<EyeInvisibleOutlined />} style={{ color: '#9CA3AF' }} onClick={() => updateEditField([...editPathPrefix, origIdx, '_hidden'], true)} />
                    </Tooltip>
                  </td>
                )}
              </tr>
            );
          })}
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
      return `<tr${rowStyle}>${deptCell}<td style="width:180px">${p.name}</td><td class="text-cell">${textFn(p)}</td><td style="width:60px;text-align:center">${p.progress_pct}%</td><td style="width:70px;text-align:center">${p.status === '风险' ? '<span style="background:#DC2626;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">风险</span>' : (p.status || '-')}</td></tr>`;
    }).join('');
  };

  const generateMarkdown = (content) => {
    const { kpi_summary, project_progress, risk_and_warnings, next_week_key_work, next_week_focus, new_achievements } = content;
    const keyWorkItems = Array.isArray(next_week_key_work) ? next_week_key_work : (Array.isArray(next_week_focus?.upcoming_projects) ? next_week_focus.upcoming_projects : []);
    const conclusion = getConclusion(content);
    const business = getBusinessSummary(content);
    let md = `# 增长组业务周报\n\n`;
    md += `**周期**：${content.week_start} 至 ${content.week_end}\n\n`;
    if (conclusion) md += `**本周结论**：${conclusion.replace(/\n/g, '；')}\n\n`;
    md += `---\n\n`;
    md += `## 一、本周数据摘要\n\n`;
    if (kpi_summary?.length) {
      const grouped = content.kpi_summary_grouped;
      const tp = grouped?.time_progress;
      if (tp != null) md += `> 季度时间进度：${tp}%\n\n`;
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
    md += `\n## 一、重点业务速览\n\n`;
    if (business?.aso?.enabled) {
      if (business.aso.has_data) {
        const aso = business.aso;
        md += `### ASO 优化\n\n`;
        md += `| 优化词 | T1 到榜 | T3 到榜 | T3率 | 消耗 |\n|---|---:|---:|---:|---:|\n`;
        md += `| ${aso.current?.optimized_keywords || 0} | ${aso.current?.t1_keywords || 0} | ${aso.current?.t3_keywords || 0} | ${fmtPercent(aso.current?.t3_rate)} | ¥${fmtMoney(aso.current?.total_cost)} |\n\n`;
      } else {
        md += `### ASO 优化\n\n本周暂无 ASO 日报数据\n\n`;
      }
    }
    if (business?.cps?.enabled) {
      if (business.cps.has_data) {
        const cps = business.cps;
        md += `### CPS 投流\n\n`;
        md += `| 实收 | 签约 | 较前一日实收 | 退款 | 预警 |\n|---:|---:|---:|---:|---:|\n`;
        md += `| ¥${fmtMoney(cps.current?.actual_amount)} | ${cps.current?.actual_count || 0} | ${fmtCpsDayOverDay(cps)} | ${cps.current?.refund_count || 0} | ${cps.current?.alert_count || 0} |\n\n`;
      } else {
        md += `### CPS 投流\n\n本周暂无 CPS 投流数据\n\n`;
      }
    }

    md += `\n## 二、重点工作进展\n\n`;
    const visiblePp = (project_progress || []).filter(p => !p._hidden);
    if (visiblePp.length) {
      md += `| 部门 | 项目名称 | 本周进展 | 进度 | 状态 |\n|------|----------|----------|------|------|\n`;
      visiblePp.forEach(p => { md += `| ${p.dept_name} | ${p.name} | ${p.weekly_progress || '-'} | ${p.progress_pct}% | ${p.status} |\n`; });
    } else { md += `本周无更新项目\n`; }
    md += `\n## 三、风险与预警\n\n`;
    const riskProjects = Array.isArray(risk_and_warnings?.risk_projects) ? risk_and_warnings.risk_projects : [];
    if (riskProjects.length) {
      md += `### 风险项目\n\n| 部门 | 项目名称 | 风险描述 |\n|------|----------|----------|\n`;
      riskProjects.forEach(p => { md += `| ${p.dept_name} | ${p.name} | ${p.risk_desc || '-'} |\n`; });
      md += `\n`;
    }
    if (!riskProjects.length && !(risk_and_warnings?.severe_warnings?.length)) {
      md += `本周无风险项目或严重预警指标\n\n`;
    }
    md += `## 四、下周重点工作\n\n`;
    const visibleKeyWork = keyWorkItems.filter(p => !p._hidden);
    if (visibleKeyWork.length) {
      md += `| 部门 | 项目名称 | 下周重点工作 | 进度 | 状态 |\n|------|----------|-------------|------|------|\n`;
      visibleKeyWork.forEach(p => { md += `| ${p.dept_name} | ${p.name} | ${p.next_week_focus || p.due_date || '-'} | ${p.progress_pct}% | ${p.status || '-'} |\n`; });
      md += `\n`;
    }
    md += `## 五、新增成果\n\n`;
    if (new_achievements?.length) {
      md += `| 部门 | 项目/工作 | 成果类型 | 量化结果 | 优先级 |\n|------|----------|----------|----------|--------|\n`;
      new_achievements.forEach(a => { md += `| ${a.dept_name} | ${a.project_name} | ${a.achievement_type} | ${a.quantified_result || '-'} | ${a.priority} |\n`; });
    } else { md += `本周无新增成果\n`; }
    md += `\n---\n\n自动生成于 ${content.generated_at}\n`;
    return md;
  };

  const generateDocHtml = (content) => {
    const { kpi_summary, project_progress, risk_and_warnings, next_week_key_work, next_week_focus, new_achievements } = content;
    const keyWorkItems = Array.isArray(next_week_key_work) ? next_week_key_work : (Array.isArray(next_week_focus?.upcoming_projects) ? next_week_focus.upcoming_projects : []);
    const conclusion = getConclusion(content);
    const business = getBusinessSummary(content);
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
.business-row { display: flex; gap: 12px; margin: 14px 0; }
.business-card { flex: 1; border: 1px solid #E5E7EB; border-left: 4px solid #3B5AFB; border-radius: 10px; padding: 14px 16px; background: #fff; }
.business-card h3 { margin: 0 0 10px 0; color: #111827; }
.metric-line { font-size: 13px; line-height: 1.9; color: #374151; }
.metric-line strong { color: #111827; }
.footer { margin-top: 30px; color: #8c8c8c; font-size: 12px; border-top: 1px solid #d9d9d9; padding-top: 10px; }
</style></head><body>`;
    html += `<h1>增长组业务周报</h1><p><strong>周期</strong>：${content.week_start} 至 ${content.week_end}</p>`;
    if (conclusion) {
      html += `<div class="conclusion-box"><strong>本周结论</strong><br/>${textToHtml(conclusion)}</div>`;
    }
    html += `<h2>一、本周数据摘要</h2>`;
    if (kpi_summary?.length) {
      const grouped = content.kpi_summary_grouped;
      const tp = grouped?.time_progress;
      if (tp != null) html += `<p style="color:#8c8c8c;font-size:12px">季度时间进度：${tp}%</p>`;
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

    html += `<h2>一、重点业务速览</h2><div class="business-row">`;
    if (business?.aso?.enabled) {
      const aso = business.aso;
      html += `<div class="business-card"><h3>ASO 优化</h3>`;
      html += aso.has_data
        ? `<div class="metric-line"><strong>优化词</strong> ${aso.current?.optimized_keywords || 0} · <strong>T1</strong> ${aso.current?.t1_keywords || 0} · <strong>T3</strong> ${aso.current?.t3_keywords || 0}</div><div class="metric-line"><strong>T3率</strong> ${fmtPercent(aso.current?.t3_rate)} · <strong>消耗</strong> ¥${fmtMoney(aso.current?.total_cost)}</div>`
        : `<div class="metric-line">本周暂无 ASO 日报数据</div>`;
      html += `</div>`;
    }
    if (business?.cps?.enabled) {
      const cps = business.cps;
      html += `<div class="business-card" style="border-left-color:#16A34A"><h3>CPS 投流</h3>`;
      html += cps.has_data
        ? `<div class="metric-line"><strong>实收</strong> ¥${fmtMoney(cps.current?.actual_amount)} · <strong>签约</strong> ${cps.current?.actual_count || 0}单 · <strong>较前一日</strong> ${fmtCpsDayOverDay(cps)}</div><div class="metric-line"><strong>退款</strong> ${cps.current?.refund_count || 0}笔 · <strong>预警</strong> ${cps.current?.alert_count || 0}项</div>`
        : `<div class="metric-line">本周暂无 CPS 投流数据</div>`;
      html += `</div>`;
    }
    html += `</div>`;

    html += `<h2>二、重点工作进展</h2>`;
    {
      const visiblePp = (project_progress || []).filter(p => !p._hidden);
      if (visiblePp.length) {
        html += `<table><colgroup><col style="width:80px"/><col style="width:180px"/><col/><col style="width:60px"/><col style="width:70px"/></colgroup>`;
        html += `<thead><tr><th>部门</th><th>项目名称</th><th>本周进展</th><th>进度</th><th>状态</th></tr></thead><tbody>`;
        html += buildMergedHtmlRows(visiblePp, p => textToHtml(p.weekly_progress));
        html += `</tbody></table>`;
      } else { html += `<p>本周无更新项目</p>`; }
    }

    html += `<h2>三、风险与预警</h2>`;
    if (riskProjects.length) {
      html += `<h3>风险项目（${riskProjects.length} 项）</h3>`;
      html += `<table><thead><tr><th style="width:80px">部门</th><th style="width:180px">项目名称</th><th>风险描述</th></tr></thead><tbody>`;
      riskProjects.forEach(p => { html += `<tr style="background:#FEF2F2"><td>${p.dept_name}</td><td>${p.name}</td><td class="text-cell">${textToHtml(p.risk_desc)}</td></tr>`; });
      html += `</tbody></table>`;
    }
    if (severeWarnings.length) {
      html += `<h3>严重预警指标（${severeWarnings.length} 项）</h3>`;
      html += `<table><thead><tr><th>部门</th><th>业务类型</th><th>指标</th><th>完成率</th><th>差额</th></tr></thead><tbody>`;
      severeWarnings.forEach(w => { html += `<tr><td>${w.dept_name}</td><td>${w.business_type}</td><td>${w.indicator}</td><td style="color:#DC2626;font-weight:600">${w.completion_rate}%</td><td>${w.gap}</td></tr>`; });
      html += `</tbody></table>`;
    }
    if (!riskProjects.length && !severeWarnings.length) {
      html += `<p style="color:#16A34A">本周无风险项目或严重预警指标</p>`;
    }

    html += `<h2>四、下周重点工作</h2>`;
    {
      const visibleKeyWork = keyWorkItems.filter(p => !p._hidden);
      if (visibleKeyWork.length) {
        html += `<table><colgroup><col style="width:80px"/><col style="width:180px"/><col/><col style="width:60px"/><col style="width:70px"/></colgroup>`;
        html += `<thead><tr><th>部门</th><th>项目名称</th><th>下周重点工作</th><th>进度</th><th>状态</th></tr></thead><tbody>`;
        html += buildMergedHtmlRows(visibleKeyWork, p => textToHtml(p.next_week_focus || p.due_date));
        html += `</tbody></table>`;
      } else { html += `<p>暂无项目填写下周重点工作</p>`; }
    }

    html += `<h2>五、新增成果</h2>`;
    if (new_achievements?.length) {
      html += `<table><tr><th>部门</th><th>项目/工作</th><th>成果类型</th><th>量化结果</th><th>优先级</th></tr>`;
      new_achievements.forEach(a => { html += `<tr><td>${a.dept_name}</td><td>${a.project_name}</td><td>${a.achievement_type}</td><td class="text-cell">${textToHtml(a.quantified_result)}</td><td>${a.priority}</td></tr>`; });
      html += `</table>`;
    } else { html += `<p>本周无新增成果</p>`; }

    html += `<div class="footer">自动生成于 ${content.generated_at}</div></body></html>`;
    return html;
  };

  const docEsc = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const docText = (value) => {
    const displayValue = value === undefined || value === null || value === '' ? '-' : value;
    const escaped = docEsc(displayValue);
    return escaped
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2563EB;text-decoration:underline">$1</a>')
      .replace(/\n/g, '<br/>');
  };

  const docColorByRate = (value) => {
    const n = Number(value || 0);
    if (n >= 90) return '#15803D';
    if (n >= 60) return '#B45309';
    return '#B91C1C';
  };

  const docStatusTag = (status) => {
    const isRisk = status === '风险';
    return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${isRisk ? '#FEE2E2' : '#F3F4F6'};color:${isRisk ? '#B91C1C' : '#374151'};font-size:12px;line-height:18px">${docEsc(status || '-')}</span>`;
  };

  const docTable = (headers, rows, widths = []) => {
    if (!rows.length) {
      return `<div style="padding:12px 14px;border:1px solid #E5E7EB;background:#F9FAFB;color:#6B7280;font-size:13px;line-height:1.7">暂无数据</div>`;
    }

    const colgroup = widths.length
      ? `<colgroup>${widths.map(width => `<col style="width:${width}"/>`).join('')}</colgroup>`
      : '';

    return `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;table-layout:fixed;margin:10px 0 18px 0;border:1px solid #E5E7EB">
      ${colgroup}
      <thead>
        <tr>
          ${headers.map(label => `<th style="background:#F3F4F6;color:#374151;font-weight:700;font-size:13px;text-align:left;padding:9px 10px;border:1px solid #E5E7EB;line-height:1.5">${docEsc(label)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `<tr>${row.map(cell => `<td style="vertical-align:top;color:#111827;font-size:13px;text-align:left;padding:9px 10px;border:1px solid #E5E7EB;line-height:1.65;word-break:break-word;overflow-wrap:anywhere">${cell}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>`;
  };

  const docSection = (title, subtitle = '') => (
    `<div style="margin:24px 0 10px 0;padding-left:10px;border-left:4px solid #3B5AFB">
      <div style="font-size:17px;font-weight:700;line-height:1.4;color:#111827">${docEsc(title)}</div>
      ${subtitle ? `<div style="font-size:12px;line-height:1.6;color:#6B7280;margin-top:2px">${docEsc(subtitle)}</div>` : ''}
    </div>`
  );

  const metricCard = (label, value, note, color = '#111827') => (
    `<td style="width:33.33%;padding:10px 12px;border:1px solid #E5E7EB;background:#F9FAFB;text-align:center;vertical-align:top">
      <div style="font-size:12px;line-height:1.5;color:#6B7280">${docEsc(label)}</div>
      <div style="font-size:26px;line-height:1.25;font-weight:800;color:${color};margin-top:2px">${docEsc(value)}</div>
      <div style="font-size:11px;line-height:1.5;color:#9CA3AF;margin-top:2px">${docEsc(note)}</div>
    </td>`
  );

  const generateMeetingDocPlainText = (content) => generateMarkdown(content);

  const generateMeetingDocHtml = (content) => {
    const { kpi_summary, project_progress, risk_and_warnings, next_week_key_work, next_week_focus, new_achievements, key_changes } = content;
    const keyWorkItems = Array.isArray(next_week_key_work) ? next_week_key_work : (Array.isArray(next_week_focus?.upcoming_projects) ? next_week_focus.upcoming_projects : []);
    const visibleProjects = (project_progress || []).filter(p => !p._hidden);
    const visibleKeyWork = keyWorkItems.filter(p => !p._hidden);
    const riskProjects = Array.isArray(risk_and_warnings?.risk_projects) ? risk_and_warnings.risk_projects : [];
    const severeWarnings = Array.isArray(risk_and_warnings?.severe_warnings) ? risk_and_warnings.severe_warnings : [];
    const achievements = Array.isArray(new_achievements) ? new_achievements : [];
    const business = getBusinessSummary(content);
    const conclusion = getConclusion(content);
    const riskCount = riskProjects.length + severeWarnings.length;

    const projectRows = visibleProjects.map(p => [
      docText(p.dept_name),
      `<strong style="color:#111827">${docText(p.name)}</strong>`,
      docText(p.weekly_progress),
      `<span style="font-weight:700;color:${docColorByRate(p.progress_pct)}">${docEsc(p.progress_pct ?? 0)}%</span>`,
      docStatusTag(p.status),
    ]);

    const riskRows = [
      ...riskProjects.map(p => [
        docText(p.dept_name),
        `<strong style="color:#111827">${docText(p.name)}</strong>`,
        `<span style="color:#B91C1C">${docText(p.risk_desc)}</span>`,
      ]),
      ...severeWarnings.map(w => [
        docText(w.dept_name),
        `<strong style="color:#111827">${docText(w.business_type)} · ${docText(w.indicator)}</strong>`,
        `<span style="color:#B91C1C">完成率 ${docEsc(w.completion_rate ?? 0)}%，差额 ${docEsc(w.gap ?? '-')}</span>`,
      ]),
    ];

    const nextRows = visibleKeyWork.map(p => [
      docText(p.dept_name),
      `<strong style="color:#111827">${docText(p.name)}</strong>`,
      docText(p.next_week_focus || p.due_date),
      `<span style="font-weight:700;color:${docColorByRate(p.progress_pct)}">${docEsc(p.progress_pct ?? 0)}%</span>`,
      docStatusTag(p.status),
    ]);

    const achievementRows = achievements.map(a => [
      docText(a.dept_name),
      `<strong style="color:#111827">${docText(a.project_name)}</strong>`,
      docText(a.achievement_type),
      docText(a.quantified_result),
      docText(a.priority),
    ]);

    const kpiRows = [];
    const grouped = content.kpi_summary_grouped;
    if (grouped?.row1?.length) {
      grouped.row1.forEach(k => kpiRows.push([
        docText(k.label),
        `<span style="font-weight:700;color:${docColorByRate(k.rate)}">${docEsc(k.rate)}%</span>`,
        docText(`${k.target ?? '-'}${k.unit || ''}`),
        docText(`${k.actual ?? '-'}${k.unit || ''}`),
      ]));
    }
    if (grouped?.row2?.length) {
      grouped.row2.forEach(k => kpiRows.push([
        docText(k.label),
        `<span style="font-weight:700;color:${docColorByRate(k.completion_rate)}">${docEsc(k.completion_rate)}%</span>`,
        docText(`${k.target ?? '-'}${k.unit || ''}`),
        docText(`${k.actual ?? '-'}${k.unit || ''}`),
      ]));
    }
    if (grouped?.row3?.length) {
      grouped.row3.forEach(k => kpiRows.push([
        docText(k.label),
        `<span style="font-weight:700;color:${docColorByRate(k.completion_rate)}">${docEsc(k.completion_rate)}%</span>`,
        docText(`${k.target ?? '-'}${k.unit || ''}`),
        docText(`${k.actual ?? '-'}${k.unit || ''}`),
      ]));
    }
    if (!kpiRows.length && kpi_summary?.length) {
      kpi_summary.forEach(k => kpiRows.push([
        docText(`${k.dept_name || '-'} · ${k.indicator || '-'}`),
        `<span style="font-weight:700;color:${docColorByRate(k.completion_rate)}">${docEsc(k.completion_rate ?? 0)}%</span>`,
        docText(`${k.target ?? '-'}${k.unit || ''}`),
        docText(`${k.actual ?? '-'}${k.unit || ''}`),
      ]));
    }

    const businessCards = [];
    if (business?.aso?.enabled) {
      const aso = business.aso;
      businessCards.push(`<td style="width:50%;vertical-align:top;padding:12px;border:1px solid #E5E7EB;border-left:4px solid #3B5AFB;background:#FFFFFF">
        <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:8px">ASO 优化</div>
        ${aso.has_data
          ? `<div style="font-size:13px;line-height:1.8;color:#374151">优化词 <strong>${docEsc(aso.current?.optimized_keywords || 0)}</strong> · T1 <strong>${docEsc(aso.current?.t1_keywords || 0)}</strong> · T3 <strong>${docEsc(aso.current?.t3_keywords || 0)}</strong><br/>T3率 <strong>${docEsc(fmtPercent(aso.current?.t3_rate))}</strong> · 消耗 <strong>¥${docEsc(fmtMoney(aso.current?.total_cost))}</strong></div>`
          : `<div style="font-size:13px;line-height:1.8;color:#6B7280">本周暂无 ASO 日报数据</div>`}
      </td>`);
    }
    if (business?.cps?.enabled) {
      const cps = business.cps;
      businessCards.push(`<td style="width:50%;vertical-align:top;padding:12px;border:1px solid #E5E7EB;border-left:4px solid #16A34A;background:#FFFFFF">
        <div style="font-size:15px;font-weight:700;color:#111827;margin-bottom:8px">CPS 投流</div>
        ${cps.has_data
          ? `<div style="font-size:13px;line-height:1.8;color:#374151">实收 <strong>¥${docEsc(fmtMoney(cps.current?.actual_amount))}</strong> · 签约 <strong>${docEsc(cps.current?.actual_count || 0)}</strong> 单 · 较前一日 <strong>${docEsc(fmtCpsDayOverDay(cps))}</strong><br/>退款 <strong>${docEsc(cps.current?.refund_count || 0)}</strong> 笔 · 预警 <strong>${docEsc(cps.current?.alert_count || 0)}</strong> 项</div>`
          : `<div style="font-size:13px;line-height:1.8;color:#6B7280">本周暂无 CPS 投流数据</div>`}
      </td>`);
    }

    const keyChangeHtml = Array.isArray(key_changes) && key_changes.length
      ? `<div style="margin:12px 0 18px 0">${key_changes.map(c => `<div style="font-size:13px;line-height:1.7;color:#374151;padding:6px 10px;margin:4px 0;background:#F9FAFB;border-left:3px solid ${c.type === 'risk' ? '#DC2626' : c.type === 'achieved' ? '#16A34A' : '#3B5AFB'}">${docText(c.text)}</div>`).join('')}</div>`
      : '';
    const sectionNumbers = ['一', '二', '三', '四', '五', '六', '七', '八'];
    let sectionIndex = 0;
    const nextSection = (title, subtitle = '') => {
      const sectionNumber = sectionNumbers[sectionIndex] || `${sectionIndex + 1}`;
      sectionIndex += 1;
      return docSection(`${sectionNumber}、${title}`, subtitle);
    };

    const fragment = `<div style="max-width:860px;margin:0 auto;font-family:Arial,'Microsoft YaHei','PingFang SC',sans-serif;color:#111827;background:#FFFFFF;line-height:1.6">
      <div style="text-align:center;padding:8px 0 14px 0;border-bottom:3px solid #3B5AFB;margin-bottom:16px">
        <div style="font-size:26px;font-weight:800;line-height:1.35;color:#111827">增长组业务周报</div>
        <div style="font-size:13px;color:#6B7280;margin-top:4px">${docEsc(content.week_start || '')} 至 ${docEsc(content.week_end || '')}</div>
      </div>

      ${conclusion ? `<div style="background:#F0F4FF;border:1px solid #C7D7FE;border-left:4px solid #3B5AFB;padding:14px 16px;margin:14px 0 16px 0">
        <div style="font-size:13px;font-weight:700;color:#1E40AF;margin-bottom:6px">本周核心结论</div>
        <div style="font-size:14px;color:#111827;line-height:1.8">${docText(conclusion)}</div>
      </div>` : ''}

      ${keyChangeHtml}

      <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;table-layout:fixed;margin:12px 0 18px 0">
        <tr>
          ${metricCard('关键成果', achievements.length, '本周新增')}
          ${metricCard('风险事项', riskCount, riskCount > 0 ? '需要关注' : '一切正常', riskCount > 0 ? '#B91C1C' : '#15803D')}
          ${metricCard('下周重点', visibleKeyWork.length, '已填写重点工作')}
        </tr>
      </table>

      ${nextSection('本周数据摘要', grouped?.time_progress != null ? `季度时间进度 ${grouped.time_progress}%` : '')}
      ${docTable(['指标', '完成率', '目标', '实际'], kpiRows, ['36%', '18%', '23%', '23%'])}

      ${businessCards.length ? `${nextSection('重点业务速览', 'ASO 与 CPS 投流 · 本周')}<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;border-spacing:0 0;margin:10px 0 18px 0;table-layout:fixed"><tr>${businessCards.join('')}</tr></table>` : ''}

      ${nextSection('重点工作进展', `更新 ${visibleProjects.length} 项`)}
      ${docTable(['部门', '项目名称', '本周进展', '进度', '状态'], projectRows, ['12%', '22%', '42%', '10%', '14%'])}

      ${nextSection('风险与预警', riskCount > 0 ? `${riskCount} 项需关注` : '本周无风险项目或严重预警指标')}
      ${riskRows.length ? docTable(['部门', '事项', '说明'], riskRows, ['16%', '28%', '56%']) : `<div style="padding:12px 14px;border:1px solid #BBF7D0;background:#F0FDF4;color:#15803D;font-size:13px;line-height:1.7">本周无风险项目或严重预警指标</div>`}

      ${nextSection('下周重点工作', `${visibleKeyWork.length} 项`)}
      ${docTable(['部门', '项目名称', '下周重点工作', '进度', '状态'], nextRows, ['12%', '22%', '42%', '10%', '14%'])}

      ${nextSection('新增成果', `${achievements.length} 项`)}
      ${docTable(['部门', '项目/工作', '成果类型', '量化结果', '优先级'], achievementRows, ['14%', '22%', '16%', '36%', '12%'])}

      <div style="margin-top:22px;padding-top:10px;border-top:1px solid #E5E7EB;color:#9CA3AF;font-size:12px;line-height:1.6">本周报基础数据由系统自动汇总生成于 ${docEsc(content.generated_at || '')}</div>
    </div>`;

    return `<!doctype html><html><head><meta charset="utf-8"></head><body><!--StartFragment-->${fragment}<!--EndFragment--></body></html>`;
  };

  const meetingDocPlainValue = (value) => {
    if (value === undefined || value === null || value === '') return '-';
    return String(value).replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() || '-';
  };

  const meetingDocRateText = (value) => {
    const display = meetingDocPlainValue(value ?? 0);
    return display.includes('%') ? display : `${display}%`;
  };

  const meetingDocColorByRate = (value) => {
    const n = Number.parseFloat(String(value ?? 0).replace('%', '')) || 0;
    if (n >= 90) return '#15803D';
    if (n >= 60) return '#B45309';
    return '#B91C1C';
  };

  const getMeetingDocContext = (content) => {
    const {
      kpi_summary,
      project_progress,
      risk_and_warnings,
      next_week_key_work,
      next_week_focus,
      new_achievements,
      key_changes,
    } = content;
    const keyWorkItems = Array.isArray(next_week_key_work)
      ? next_week_key_work
      : (Array.isArray(next_week_focus?.upcoming_projects) ? next_week_focus.upcoming_projects : []);
    const grouped = content.kpi_summary_grouped;
    const kpiRows = [];
    const pushKpi = (label, rate, target, actual, unit = '') => {
      kpiRows.push({
        label,
        rate: rate ?? 0,
        target: `${target ?? '-'}${unit || ''}`,
        actual: `${actual ?? '-'}${unit || ''}`,
      });
    };

    if (grouped?.row1?.length) grouped.row1.forEach(k => pushKpi(k.label, k.rate, k.target, k.actual, k.unit));
    if (grouped?.row2?.length) grouped.row2.forEach(k => pushKpi(k.label, k.completion_rate, k.target, k.actual, k.unit));
    if (grouped?.row3?.length) grouped.row3.forEach(k => pushKpi(k.label, k.completion_rate, k.target, k.actual, k.unit));
    if (!kpiRows.length && kpi_summary?.length) {
      kpi_summary.forEach(k => pushKpi(`${k.dept_name || '-'} · ${k.indicator || '-'}`, k.completion_rate, k.target, k.actual, k.unit));
    }

    return {
      business: getBusinessSummary(content),
      conclusion: getConclusion(content),
      grouped,
      keyChanges: Array.isArray(key_changes) ? key_changes : [],
      kpiRows,
      visibleProjects: (project_progress || []).filter(p => !p._hidden),
      visibleKeyWork: keyWorkItems.filter(p => !p._hidden),
      riskProjects: Array.isArray(risk_and_warnings?.risk_projects) ? risk_and_warnings.risk_projects : [],
      severeWarnings: Array.isArray(risk_and_warnings?.severe_warnings) ? risk_and_warnings.severe_warnings : [],
      achievements: Array.isArray(new_achievements) ? new_achievements : [],
    };
  };

  const meetingDocSection = (title) => (
    `<h2 style="font-size:18px;font-weight:700;line-height:1.45;margin:22px 0 10px 0;color:#111827">${docEsc(title)}</h2>`
  );

  const meetingDocSubhead = (title) => (
    `<p style="margin:12px 0 4px 0;line-height:1.65;color:#111827"><strong>${docText(title)}</strong></p>`
  );

  const meetingDocKpiTable = (rows) => {
    if (!rows.length) {
      return '<p style="margin:4px 0 12px 0;color:#6B7280;line-height:1.7">暂无数据</p>';
    }

    return `<table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:8px 0 16px 0">
      <thead>
        <tr>
          ${['指标', '完成率', '目标', '实际'].map(label => `<th style="background:#F4F5F7;color:#222;font-weight:700;text-align:left;padding:7px 9px;border:1px solid #DADDE3;line-height:1.5">${docEsc(label)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map(row => `<tr>
          <td style="vertical-align:top;color:#222;padding:7px 9px;border:1px solid #DADDE3;line-height:1.55">${docText(row.label)}</td>
          <td style="vertical-align:top;color:${meetingDocColorByRate(row.rate)};font-weight:700;padding:7px 9px;border:1px solid #DADDE3;line-height:1.55">${docEsc(meetingDocRateText(row.rate))}</td>
          <td style="vertical-align:top;color:#222;padding:7px 9px;border:1px solid #DADDE3;line-height:1.55">${docText(row.target)}</td>
          <td style="vertical-align:top;color:#222;padding:7px 9px;border:1px solid #DADDE3;line-height:1.55">${docText(row.actual)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  };

  const meetingDocWorkBlock = (item, label, body) => (
    `<div style="margin:10px 0 14px 0;line-height:1.7">
      <p style="margin:0 0 2px 0;color:#374151">${docText(item.dept_name)}</p>
      <p style="margin:0 0 4px 0;color:#111827"><strong>${docText(item.name)}</strong> ｜ <span style="font-weight:700;color:${meetingDocColorByRate(item.progress_pct)}">${docEsc(meetingDocRateText(item.progress_pct))}</span> ｜ ${docText(item.status || '进行中')}</p>
      <p style="margin:0;color:#222"><strong>${docEsc(label)}：</strong>${docText(body)}</p>
    </div>`
  );

  const meetingDocRiskBlock = (item) => (
    `<div style="margin:10px 0 14px 0;line-height:1.7">
      <p style="margin:0 0 2px 0;color:#374151">${docText(item.dept_name)}</p>
      <p style="margin:0 0 4px 0;color:#111827"><strong>${docText(item.name)}</strong></p>
      <p style="margin:0;color:#B91C1C"><strong>风险说明：</strong>${docText(item.risk_desc)}</p>
    </div>`
  );

  const meetingDocWarningBlock = (item) => (
    `<div style="margin:10px 0 14px 0;line-height:1.7">
      <p style="margin:0 0 2px 0;color:#374151">${docText(item.dept_name)}</p>
      <p style="margin:0 0 4px 0;color:#111827"><strong>${docText(item.business_type)} · ${docText(item.indicator)}</strong></p>
      <p style="margin:0;color:#B91C1C"><strong>预警：</strong>完成率 ${docEsc(meetingDocRateText(item.completion_rate))}，差额 ${docText(item.gap)}</p>
    </div>`
  );

  const meetingDocAchievementBlock = (item) => (
    `<div style="margin:10px 0 14px 0;line-height:1.7">
      <p style="margin:0 0 2px 0;color:#374151">${docText(item.dept_name)}</p>
      <p style="margin:0 0 4px 0;color:#111827"><strong>${docText(item.project_name)}</strong> ｜ ${docText(item.achievement_type)} ｜ ${docText(item.priority)}</p>
      <p style="margin:0;color:#222"><strong>量化结果：</strong>${docText(item.quantified_result)}</p>
    </div>`
  );

  const generateMeetingDocEditorPlainText = (content) => {
    const { business, conclusion, grouped, keyChanges, kpiRows, visibleProjects, visibleKeyWork, riskProjects, severeWarnings, achievements } = getMeetingDocContext(content);
    const lines = [];
    const sectionNumbers = ['一', '二', '三', '四', '五', '六', '七', '八'];
    let sectionIndex = 0;
    const addBlank = () => {
      if (lines[lines.length - 1] !== '') lines.push('');
    };
    const addSection = (title) => {
      addBlank();
      const sectionNumber = sectionNumbers[sectionIndex] || `${sectionIndex + 1}`;
      sectionIndex += 1;
      lines.push(`${sectionNumber}、${title}`);
      lines.push('');
    };
    const addWork = (item, label, body) => {
      lines.push(meetingDocPlainValue(item.dept_name));
      lines.push(`${meetingDocPlainValue(item.name)}｜${meetingDocRateText(item.progress_pct)}｜${meetingDocPlainValue(item.status || '进行中')}`);
      lines.push(`${label}：${meetingDocPlainValue(body)}`);
      lines.push('');
    };

    lines.push(`增长组业务周报｜${meetingDocPlainValue(content.week_start)} 至 ${meetingDocPlainValue(content.week_end)}`);
    if (conclusion) {
      lines.push('');
      lines.push('本周核心结论');
      lines.push(meetingDocPlainValue(conclusion));
    }
    if (keyChanges.length) {
      addSection('本周关键变化');
      keyChanges.forEach(item => lines.push(`- ${meetingDocPlainValue(item.text)}`));
    }

    addSection('本周数据摘要');
    if (grouped?.time_progress != null) lines.push(`季度时间进度 ${grouped.time_progress}%`);
    if (kpiRows.length) {
      lines.push('指标\t完成率\t目标\t实际');
      kpiRows.forEach(row => lines.push(`${meetingDocPlainValue(row.label)}\t${meetingDocRateText(row.rate)}\t${meetingDocPlainValue(row.target)}\t${meetingDocPlainValue(row.actual)}`));
    } else {
      lines.push('暂无数据');
    }

    if (business?.aso?.enabled || business?.cps?.enabled) {
      addSection('重点业务速览');
      if (business?.aso?.enabled) {
        const aso = business.aso;
        lines.push('ASO 优化');
        lines.push(aso.has_data
          ? `优化词 ${aso.current?.optimized_keywords || 0} · T1 ${aso.current?.t1_keywords || 0} · T3 ${aso.current?.t3_keywords || 0} · T3率 ${fmtPercent(aso.current?.t3_rate)} · 消耗 ¥${fmtMoney(aso.current?.total_cost)}`
          : '本周暂无 ASO 日报数据');
        lines.push('');
      }
      if (business?.cps?.enabled) {
        const cps = business.cps;
        lines.push('CPS 投流');
        lines.push(cps.has_data
          ? `实收 ¥${fmtMoney(cps.current?.actual_amount)} · 签约 ${cps.current?.actual_count || 0} 单 · 较前一日 ${fmtCpsDayOverDay(cps)} · 退款 ${cps.current?.refund_count || 0} 笔 · 预警 ${cps.current?.alert_count || 0} 项`
          : '本周暂无 CPS 投流数据');
      }
    }

    addSection('重点工作进展');
    lines.push(`更新 ${visibleProjects.length} 项`);
    lines.push('');
    if (visibleProjects.length) {
      visibleProjects.forEach(item => addWork(item, '本周进展', item.weekly_progress));
    } else {
      lines.push('本周无更新项目');
    }

    addSection('风险与预警');
    if (riskProjects.length || severeWarnings.length) {
      riskProjects.forEach(item => {
        lines.push(meetingDocPlainValue(item.dept_name));
        lines.push(meetingDocPlainValue(item.name));
        lines.push(`风险说明：${meetingDocPlainValue(item.risk_desc)}`);
        lines.push('');
      });
      severeWarnings.forEach(item => {
        lines.push(meetingDocPlainValue(item.dept_name));
        lines.push(`${meetingDocPlainValue(item.business_type)} · ${meetingDocPlainValue(item.indicator)}`);
        lines.push(`预警：完成率 ${meetingDocRateText(item.completion_rate)}，差额 ${meetingDocPlainValue(item.gap)}`);
        lines.push('');
      });
    } else {
      lines.push('本周无风险项目或严重预警指标');
    }

    addSection('下周重点工作');
    lines.push(`${visibleKeyWork.length} 项`);
    lines.push('');
    if (visibleKeyWork.length) {
      visibleKeyWork.forEach(item => addWork(item, '下周重点', item.next_week_focus || item.due_date));
    } else {
      lines.push('暂无项目填写下周重点工作');
    }

    addSection('新增成果');
    lines.push(`${achievements.length} 项`);
    lines.push('');
    if (achievements.length) {
      achievements.forEach(item => {
        lines.push(meetingDocPlainValue(item.dept_name));
        lines.push(`${meetingDocPlainValue(item.project_name)}｜${meetingDocPlainValue(item.achievement_type)}｜${meetingDocPlainValue(item.priority)}`);
        lines.push(`量化结果：${meetingDocPlainValue(item.quantified_result)}`);
        lines.push('');
      });
    } else {
      lines.push('暂无数据');
    }

    addBlank();
    lines.push(`本周报基础数据由系统自动汇总生成于 ${meetingDocPlainValue(content.generated_at)}`);
    return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
  };

  const generateMeetingDocEditorHtml = (content) => {
    const { business, conclusion, grouped, keyChanges, kpiRows, visibleProjects, visibleKeyWork, riskProjects, severeWarnings, achievements } = getMeetingDocContext(content);
    const riskCount = riskProjects.length + severeWarnings.length;
    const sectionNumbers = ['一', '二', '三', '四', '五', '六', '七', '八'];
    let sectionIndex = 0;
    const nextSection = (title) => {
      const sectionNumber = sectionNumbers[sectionIndex] || `${sectionIndex + 1}`;
      sectionIndex += 1;
      return meetingDocSection(`${sectionNumber}、${title}`);
    };

    const keyChangeHtml = keyChanges.length
      ? `${nextSection('本周关键变化')}
        <ul style="margin:4px 0 16px 22px;padding:0;line-height:1.75">
          ${keyChanges.map(item => `<li style="margin:2px 0;color:#222">${docText(item.text)}</li>`).join('')}
        </ul>`
      : '';

    const businessHtml = [];
    if (business?.aso?.enabled) {
      const aso = business.aso;
      businessHtml.push(`${meetingDocSubhead('ASO 优化')}
        <p style="margin:0 0 10px 0;line-height:1.75;color:#222">${aso.has_data
          ? `优化词 <strong>${docEsc(aso.current?.optimized_keywords || 0)}</strong> · T1 <strong>${docEsc(aso.current?.t1_keywords || 0)}</strong> · T3 <strong>${docEsc(aso.current?.t3_keywords || 0)}</strong><br/>T3率 <strong>${docEsc(fmtPercent(aso.current?.t3_rate))}</strong> · 消耗 <strong>¥${docEsc(fmtMoney(aso.current?.total_cost))}</strong>`
          : '本周暂无 ASO 日报数据'}</p>`);
    }
    if (business?.cps?.enabled) {
      const cps = business.cps;
      businessHtml.push(`${meetingDocSubhead('CPS 投流')}
        <p style="margin:0 0 10px 0;line-height:1.75;color:#222">${cps.has_data
          ? `实收 <strong>¥${docEsc(fmtMoney(cps.current?.actual_amount))}</strong> · 签约 <strong>${docEsc(cps.current?.actual_count || 0)}</strong> 单 · 较前一日 <strong>${docEsc(fmtCpsDayOverDay(cps))}</strong><br/>退款 <strong>${docEsc(cps.current?.refund_count || 0)}</strong> 笔 · 预警 <strong>${docEsc(cps.current?.alert_count || 0)}</strong> 项`
          : '本周暂无 CPS 投流数据'}</p>`);
    }

    const fragment = `<div style="font-family:Arial,'Microsoft YaHei','PingFang SC',sans-serif;color:#222;line-height:1.7">
      <h1 style="font-size:20px;font-weight:700;line-height:1.45;margin:0 0 10px 0;color:#111827">增长组业务周报｜${docEsc(content.week_start || '')} 至 ${docEsc(content.week_end || '')}</h1>

      ${conclusion ? `<h2 style="font-size:18px;font-weight:700;line-height:1.45;margin:18px 0 8px 0;color:#111827">本周核心结论</h2>
        <p style="margin:0 0 14px 0;line-height:1.85;color:#222">${docText(conclusion)}</p>` : ''}

      ${keyChangeHtml}

      ${nextSection('本周数据摘要')}
      ${grouped?.time_progress != null ? `<p style="margin:0 0 8px 0;line-height:1.7;color:#374151">季度时间进度 ${docEsc(grouped.time_progress)}%</p>` : ''}
      ${meetingDocKpiTable(kpiRows)}

      ${businessHtml.length ? `${nextSection('重点业务速览')}${businessHtml.join('')}` : ''}

      ${nextSection('重点工作进展')}
      <p style="margin:0 0 8px 0;line-height:1.7;color:#374151">更新 ${docEsc(visibleProjects.length)} 项</p>
      ${visibleProjects.length ? visibleProjects.map(item => meetingDocWorkBlock(item, '本周进展', item.weekly_progress)).join('') : '<p style="margin:0 0 12px 0;color:#6B7280;line-height:1.7">本周无更新项目</p>'}

      ${nextSection('风险与预警')}
      <p style="margin:0 0 8px 0;line-height:1.7;color:#374151">${riskCount > 0 ? `${docEsc(riskCount)} 项需关注` : '本周无风险项目或严重预警指标'}</p>
      ${riskProjects.map(meetingDocRiskBlock).join('')}
      ${severeWarnings.map(meetingDocWarningBlock).join('')}
      ${riskCount === 0 ? '<p style="margin:0 0 12px 0;color:#15803D;line-height:1.7">本周无风险项目或严重预警指标</p>' : ''}

      ${nextSection('下周重点工作')}
      <p style="margin:0 0 8px 0;line-height:1.7;color:#374151">${docEsc(visibleKeyWork.length)} 项</p>
      ${visibleKeyWork.length ? visibleKeyWork.map(item => meetingDocWorkBlock(item, '下周重点', item.next_week_focus || item.due_date)).join('') : '<p style="margin:0 0 12px 0;color:#6B7280;line-height:1.7">暂无项目填写下周重点工作</p>'}

      ${nextSection('新增成果')}
      <p style="margin:0 0 8px 0;line-height:1.7;color:#374151">${docEsc(achievements.length)} 项</p>
      ${achievements.length ? achievements.map(meetingDocAchievementBlock).join('') : '<p style="margin:0 0 12px 0;color:#6B7280;line-height:1.7">暂无数据</p>'}

      <p style="margin:18px 0 0 0;padding-top:8px;border-top:1px solid #E5E7EB;color:#6B7280;font-size:12px;line-height:1.6">本周报基础数据由系统自动汇总生成于 ${docText(content.generated_at)}</p>
    </div>`;

    return `<!doctype html><html><head><meta charset="utf-8"></head><body><!--StartFragment-->${fragment}<!--EndFragment--></body></html>`;
  };

  // ===== 周报内容渲染 =====

  const getBusinessSummary = (data) => data.business_summary || {
    aso: data.aso_summary,
    cps: data.cps_summary,
  };

  const renderExecutiveMetrics = (data, compact) => {
    const grouped = data.kpi_summary_grouped || {};
    const row1 = Array.isArray(grouped.row1) ? grouped.row1 : [];
    const row2 = Array.isArray(grouped.row2) ? grouped.row2 : [];
    const row3 = Array.isArray(grouped.row3) ? grouped.row3 : [];
    const tp = grouped.time_progress;

    // 顶部3个核心卡片
    const cards = row1.slice(0, 2).map((item, idx) => ({
      label: item.label,
      value: item.rate,
      suffix: '%',
      target: `目标 ${item.target}${item.unit}`,
      actual: `实际 ${item.actual}${item.unit}`,
      color: item.rate >= 90 ? '#16A34A' : item.rate >= 60 ? '#F59E0B' : '#DC2626',
      icon: idx === 0 ? <BarChartOutlined /> : <DollarOutlined />,
    }));

    if (tp != null) {
      cards.push({
        label: '季度时间进度',
        value: tp,
        suffix: '%',
        target: data.week_start,
        actual: data.week_end,
        color: '#3B5AFB',
        icon: <ScheduleOutlined />,
      });
    }

    if (!cards.length && !row2.length && !row3.length) return null;

    return (
      <div style={{ marginBottom: 20 }}>
        {/* 核心卡片行 */}
        {cards.length > 0 && (
          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            {cards.map((card, idx) => (
              <Col xs={24} sm={12} md={8} key={card.label}>
                <div className="surface-card" style={{ position: 'relative', overflow: 'hidden', padding: compact ? 14 : 20, height: '100%', '--stagger-index': idx }}>
                  <div style={{ position: 'absolute', top: 0, right: 0, width: 64, height: 4, background: card.color }} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>{card.label}</div>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: `${card.color}14`, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {card.icon}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: compact ? 26 : 36, lineHeight: 1, fontWeight: 700, color: card.color }}>{card.value}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{card.suffix}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{card.target} · {card.actual}</div>
                </div>
              </Col>
            ))}
          </Row>
        )}

        {/* 部门指标行：row2 + row3 紧凑内联 */}
        {(row2.length > 0 || row3.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px', background: 'rgba(0,0,0,0.015)', borderRadius: 8 }}>
            {row2.map(k => {
              const color = k.completion_rate >= 90 ? '#16A34A' : k.completion_rate >= 60 ? '#F59E0B' : '#DC2626';
              return (
                <Tooltip key={k.label} title={`目标 ${k.target}${k.unit || '万元'} · 完成 ${k.actual}${k.unit || '万元'}${tp != null ? ` · 时间 ${tp}%` : ''}`}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 5, background: '#fff', border: '1px solid #E5E7EB', fontSize: compact ? 11 : 12 }}>
                    <span style={{ color: '#6B7280' }}>{k.label.replace(' GMV', '')}</span>
                    <span style={{ fontWeight: 700, color }}>{k.completion_rate}%</span>
                  </span>
                </Tooltip>
              );
            })}
            {row3.map(k => {
              const color = k.completion_rate >= 90 ? '#16A34A' : k.completion_rate >= 60 ? '#F59E0B' : '#DC2626';
              return (
                <Tooltip key={k.label} title={`目标 ${k.target}${k.unit || ''} · 完成 ${k.actual}${k.unit || ''}${tp != null ? ` · 时间 ${tp}%` : ''}`}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 5, background: '#fff', border: '1px solid #E5E7EB', fontSize: compact ? 11 : 12 }}>
                    <span style={{ color: '#6B7280' }}>{k.label}</span>
                    <span style={{ fontWeight: 700, color }}>{k.completion_rate}%</span>
                  </span>
                </Tooltip>
              );
            })}
            {tp != null && row2.length === 0 && row3.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>时间进度 {tp}%</span>
            )}
          </div>
        )}

        {/* 兜底：旧数据无分组时用 kpi_summary */}
        {cards.length === 0 && (data.kpi_summary || []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px', background: 'rgba(0,0,0,0.015)', borderRadius: 8 }}>
            {(data.kpi_summary || []).map(k => {
              const color = k.completion_rate >= 90 ? '#16A34A' : k.completion_rate >= 60 ? '#F59E0B' : '#DC2626';
              return (
                <Tooltip key={`${k.dept_name}-${k.indicator}`} title={`目标 ${k.target}${k.unit || ''} · 完成 ${k.actual}${k.unit || ''}`}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 5, background: '#fff', border: '1px solid #E5E7EB', fontSize: compact ? 11 : 12 }}>
                    <span style={{ color: '#6B7280' }}>{k.dept_name}·{k.indicator}</span>
                    <span style={{ fontWeight: 700, color }}>{k.completion_rate}%</span>
                  </span>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderBusinessSummary = (data, compact) => {
    const business = getBusinessSummary(data);
    const aso = business?.aso;
    const cps = business?.cps;
    if (!aso?.enabled && !cps?.enabled) return null;

    return (
      <div style={{ marginBottom: 22 }}>
        <SectionHeader
          title="重点业务速览"
          subtitle="ASO 与 CPS 投流 · 本周"
          icon={<BarChartOutlined style={{ color: '#3B5AFB' }} />}
        />
        <Row gutter={[12, 12]}>
          {aso?.enabled && (
            <Col xs={24} lg={12}>
              <div className="surface-card-secondary" style={{ padding: compact ? 12 : 16, height: '100%' }}>
                <SectionHeader
                  title="ASO 优化"
                  subtitle={aso.has_data ? `${aso.period?.start || data.week_start} ~ ${aso.period?.end || data.week_end}` : '本周暂无 ASO 日报数据'}
                  icon={<TrophyOutlined style={{ color: '#3B5AFB' }} />}
                  color="#111827"
                />
                {aso.has_data ? (
                  <>
                    <Row gutter={[8, 8]}>
                      <Col xs={12} sm={6}><MiniMetric label="优化词" value={aso.current?.optimized_keywords || 0} delta={aso.delta?.optimized_keywords} /></Col>
                      <Col xs={12} sm={6}><MiniMetric label="T1 到榜" value={aso.current?.t1_keywords || 0} delta={aso.delta?.t1_keywords} color="#3B5AFB" /></Col>
                      <Col xs={12} sm={6}><MiniMetric label="T3 到榜" value={aso.current?.t3_keywords || 0} delta={aso.delta?.t3_keywords} color="#16A34A" /></Col>
                      <Col xs={12} sm={6}><MiniMetric label="消耗" value={`¥${fmtMoney(aso.current?.total_cost)}`} delta={aso.delta?.total_cost} /></Col>
                    </Row>
                    <div style={{ marginTop: 10 }}>
                      <Sparkline data={(aso.trend_7d || []).map(item => item.t3_keywords)} color="#16A34A" height={compact ? 30 : 44} tooltipName="T3 到榜" />
                    </div>
                    {!!aso.keyword_changes?.new_t1?.length && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-2)' }}>
                        新到 T1：{aso.keyword_changes.new_t1.slice(0, 4).map(word => <Tag key={word} color="success" style={{ margin: '0 4px 4px 0' }}>{word}</Tag>)}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', background: 'var(--bg-muted)', borderRadius: 10 }}>暂无可用于周报的 ASO 数据</div>
                )}
              </div>
            </Col>
          )}

          {cps?.enabled && (
            <Col xs={24} lg={12}>
              <div className="surface-card-secondary" style={{ padding: compact ? 12 : 16, height: '100%' }}>
                <SectionHeader
                  title="CPS 投流"
                  subtitle={cps.has_data ? `${cps.period?.start || data.week_start} ~ ${cps.period?.end || data.week_end}` : '本周暂无 CPS 投流数据'}
                  icon={<DollarOutlined style={{ color: '#16A34A' }} />}
                  color="#111827"
                />
                {cps.has_data ? (
                  <>
                      <Row gutter={[8, 8]}>
                        <Col xs={12} sm={6}><MiniMetric label="实收" value={`¥${fmtMoney(cps.current?.actual_amount)}`} delta={cps.delta?.actual_amount} color="#16A34A" /></Col>
                        <Col xs={12} sm={6}><MiniMetric label="签约" value={fmtCompact(cps.current?.actual_count)} suffix="单" delta={cps.delta?.actual_count} /></Col>
                        <Col xs={12} sm={6}><MiniMetric label="较前一日" value={cps.day_over_day?.current_date ? fmtSignedMoney(cps.day_over_day?.actual_amount_delta) : '暂无'} delta={cps.day_over_day?.actual_amount_delta_pct ?? undefined} deltaSuffix="%" /></Col>
                        <Col xs={12} sm={6}><MiniMetric label="预警" value={cps.current?.alert_count || 0} alert={(cps.current?.alert_count || 0) > 0} /></Col>
                      </Row>
                      <div style={{ marginTop: 10 }}>
                        <Sparkline data={(cps.trend_7d || []).map(item => item.amount)} color="#16A34A" height={compact ? 30 : 44} tooltipName="实收" />
                      </div>
                      {cps.day_over_day?.current_date && (
                        <div style={{ marginTop: 8, color: 'var(--text-3)', fontSize: 12 }}>
                          {cps.day_over_day.current_date} 对比 {cps.day_over_day.compare_date}：签约 {fmtSignedCount(cps.day_over_day.actual_count_delta)} 单，退款 {fmtSignedCount(cps.day_over_day.refund_count_delta)} 笔。
                        </div>
                      )}
                    </>
                ) : (
                  <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)', background: 'var(--bg-muted)', borderRadius: 10 }}>暂无可用于周报的 CPS 投流数据</div>
                )}
              </div>
            </Col>
          )}
        </Row>
      </div>
    );
  };

  const renderReportContent = (content, compact = false) => {
    if (!content) return <Empty description="暂无周报数据" />;
    const data = editing && !compact ? editData : content;
    if (!data || typeof data !== 'object') return <Empty description="周报数据格式异常" />;
    const project_progress = data.project_progress || [];
    const risk_and_warnings = data.risk_and_warnings || {};
    const next_week_key_work = data.next_week_key_work;
    const next_week_focus = data.next_week_focus;
    const new_achievements = data.new_achievements || [];
    const week_attention = data.week_attention || [];
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
          {data.week_start} 至 {data.week_end}
          {editing && <Tag color="orange" style={{ marginLeft: 8 }}>编辑中</Tag>}
        </div>

        {/* 本周结论（可编辑，合并了管理评语） */}
        <div style={{
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F0F4FF 100%)',
          border: '1px solid #E5E7EB',
          borderLeft: '4px solid #3B5AFB',
          borderRadius: 'var(--radius-card)',
          padding: compact ? '14px 16px' : '20px 24px',
          marginBottom: 20,
          fontSize: compact ? 12 : 16,
          color: '#111827',
          lineHeight: 1.8,
          boxShadow: compact ? 'none' : 'var(--shadow-md)',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: compact ? 13 : 14, color: 'var(--text-2)', letterSpacing: 0.5 }}>本周核心结论 · KEY TAKEAWAYS</span>
            {editing ? <Tag color="orange" style={{ margin: 0 }}>编辑中</Tag> : <Tag color="blue" style={{ margin: 0 }}>自动生成</Tag>}
          </div>
          {editing && !compact ? (
            <TextArea
              value={data.week_conclusion || ''}
              onChange={e => updateEditField(['week_conclusion'], e.target.value)}
              placeholder="补充管理评语、复盘结论..."
              autoSize={{ minRows: 3, maxRows: 10 }}
              style={{ color: '#1E40AF', fontSize: 13 }}
            />
          ) : renderTextLines(conclusion)}
        </div>

        {renderExecutiveMetrics(data, compact)}

        {/* 关键变化 — 紧凑网格布局 */}
        {Array.isArray(data.key_changes) && data.key_changes.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionHeader
              title="本周关键变化"
              subtitle={`${data.key_changes.length} 条 · 红色优先处理`}
              icon={<WarningOutlined style={{ color: '#F59E0B' }} />}
            />
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 6,
            }}>
              {data.key_changes.map((c, idx) => {
                const dotMap = {
                  risk: { label: '风险', color: '#DC2626', textColor: '#991B1B' },
                  deviation: { label: '偏差', color: '#F59E0B', textColor: '#92400E' },
                  progress: { label: '进展', color: '#16A34A', textColor: '#14532D' },
                  achieved: { label: '达成', color: '#3B5AFB', textColor: '#1E3A8A' },
                };
                const cfg = dotMap[c.type] || { label: '事项', color: '#9CA3AF', textColor: '#111827' };
                return (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: compact ? '4px 8px' : '6px 10px',
                    borderRadius: 6,
                    fontSize: compact ? 11 : 12,
                    background: 'rgba(0,0,0,0.02)',
                  }}>
                    <Tooltip title={cfg.label}>
                      <span style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: cfg.color,
                        flexShrink: 0,
                      }} />
                    </Tooltip>
                    {editing && !compact ? (
                      <Input value={c.text} onChange={e => updateEditField(['key_changes', idx, 'text'], e.target.value)} style={{ flex: 1, fontSize: 12 }} size="small" />
                    ) : (
                      <span style={{ color: cfg.textColor, fontWeight: 500, lineHeight: 1.4 }}>{c.text}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {renderBusinessSummary(data, compact)}

        {/* 摘要卡片行 */}
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} md={8}>
            <Card className="surface-card" styles={{ body: { padding: 16 } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <TrophyOutlined style={{ fontSize: 18, color: '#3B5AFB' }} />
                <span className="metric-label">关键成果</span>
              </div>
              <div className="metric-value" style={{ fontSize: compact ? 22 : 28 }}>{achievementCount}</div>
              <div className="subtle-text" style={{ fontSize: 11 }}>本周新增</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card className="surface-card" styles={{ body: { padding: 16 } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <WarningOutlined style={{ fontSize: 18, color: riskCount > 0 ? '#DC2626' : '#16A34A' }} />
                <span className="metric-label">风险事项</span>
              </div>
              <div className="metric-value" style={{ fontSize: compact ? 22 : 28, color: riskCount > 0 ? '#DC2626' : '#16A34A' }}>{riskCount}</div>
              <div className="subtle-text" style={{ fontSize: 11 }}>{riskCount > 0 ? '需要关注' : '一切正常'}</div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card className="surface-card" styles={{ body: { padding: 16 } }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <ScheduleOutlined style={{ fontSize: 18, color: '#F59E0B' }} />
                <span className="metric-label">下周重点</span>
              </div>
              <div className="metric-value" style={{ fontSize: compact ? 22 : 28 }}>{nextWeekCount}</div>
              <div className="subtle-text" style={{ fontSize: 11 }}>已填写重点工作</div>
            </Card>
          </Col>
        </Row>

        {/* 本周关注 — 紧凑卡片网格 */}
        {week_attention.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionHeader
              title="本周关注"
              subtitle={`${week_attention.length} 项 · 高优/需决策/风险`}
              icon={<WarningOutlined style={{ color: '#F59E0B' }} />}
            />
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 8,
            }}>
              {week_attention.map((p, idx) => {
                const reasons = [];
                if (p.priority === '高') reasons.push('高优先');
                if (p.decision_needed) reasons.push('需决策');
                if (p.status === '风险') reasons.push('风险');
                const isRisk = p.status === '风险';
                const progressColor = p.progress_pct >= 80 ? '#16A34A' : p.progress_pct >= 50 ? '#F59E0B' : '#DC2626';
                return (
                  <div key={idx} style={{
                    padding: compact ? '6px 10px' : '8px 12px',
                    borderRadius: 8,
                    background: isRisk ? '#FEF2F2' : 'rgba(0,0,0,0.02)',
                    borderLeft: `3px solid ${isRisk ? '#DC2626' : '#E5E7EB'}`,
                    fontSize: compact ? 11 : 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 600, color: '#111827' }}>{p.name}</span>
                        <Tag color={isRisk ? 'error' : 'default'} style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{p.dept_name}</Tag>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: progressColor }}>{p.progress_pct}%</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {reasons.map((r, ri) => (
                        <span key={ri} style={{ fontSize: 10, color: isRisk ? '#991B1B' : '#6B7280' }}>{r}</span>
                      ))}
                      {p.risk_desc && <span style={{ fontSize: 10, color: '#DC2626' }}>— {p.risk_desc}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 重点工作进展（同组合并） */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>一、重点工作进展（更新 {project_progress.filter(p => !p._hidden).length} 项{editing && project_progress.some(p => p._hidden) ? `，已隐藏 ${project_progress.filter(p => p._hidden).length} 项` : ''}）</div>
          {project_progress.length > 0 ? (
            renderMergedTable(project_progress, { textTitle: '本周进展', textField: 'weekly_progress' }, ['project_progress'])
          ) : (
            <p className="subtle-text">本周无更新项目</p>
          )}
          {/* 已隐藏项目恢复区（仅编辑模式） */}
          {editing && project_progress.some(p => p._hidden) && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#F9FAFB', borderRadius: 8, border: '1px dashed #D1D5DB' }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 600 }}>
                已隐藏项目（点击眼睛恢复显示）
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {project_progress.map((p, idx) => p._hidden ? (
                  <Tag key={idx} style={{ cursor: 'pointer', margin: 0, background: '#FFF', border: '1px solid #E5E7EB' }}
                    onClick={() => updateEditField(['project_progress', idx, '_hidden'], false)}>
                    <EyeOutlined style={{ marginRight: 4, color: '#3B5AFB' }} />
                    {p.dept_name} · {p.name}
                  </Tag>
                ) : null)}
              </div>
            </div>
          )}
        </div>

        {/* 风险与预警 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>二、风险与预警</div>
          {riskProjects.length > 0 && (
            <>
              <h4 style={{ color: '#DC2626', fontSize: compact ? 13 : 14 }}>风险项目（{riskProjects.length} 项）</h4>
              {isMobile ? (
                <div className="weekly-mobile-card-list">
                  {riskProjects.map((p, idx) => (
                    <div key={idx} className="weekly-mobile-card is-risk">
                      <div className="weekly-mobile-card-head">
                        <div className="weekly-mobile-title-wrap">
                          <div className="weekly-mobile-title">{p.name || '-'}</div>
                          <div className="weekly-mobile-meta">
                            <Tag style={{ margin: 0 }}>{p.dept_name || '未分组'}</Tag>
                            <Tag color="error" style={{ margin: 0 }}>风险</Tag>
                          </div>
                        </div>
                      </div>
                      <div className="weekly-mobile-field">
                        <div className="weekly-mobile-label">风险描述</div>
                        <div className="weekly-mobile-text">
                          <EditableCell
                            editing={editing}
                            value={p.risk_desc}
                            path={['risk_and_warnings', 'risk_projects', idx, 'risk_desc']}
                            rows={3}
                            onChange={updateEditField}
                            cellStyle={cellStyle}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <table style={{ fontSize, tableLayout: 'fixed', width: '100%' }}>
                  <colgroup>
                    <col style={{ width: 80 }} />
                    <col style={{ width: 180 }} />
                    <col />
                  </colgroup>
                  <thead><tr><th>部门</th><th>项目名称</th><th>风险描述</th></tr></thead>
                  <tbody>
                    {riskProjects.map((p, idx) => (
                      <tr key={idx} style={{ background: '#FEF2F2' }}><td>{p.dept_name}</td><td>{p.name}</td>
                        <td style={cellStyle}>
                          <EditableCell
                            editing={editing}
                            value={p.risk_desc}
                            path={['risk_and_warnings', 'risk_projects', idx, 'risk_desc']}
                            onChange={updateEditField}
                            cellStyle={cellStyle}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
          {severeWarnings.length > 0 && (
            <>
              <h4 style={{ color: '#F59E0B', marginTop: 16, fontSize: compact ? 13 : 14 }}>严重预警指标（{severeWarnings.length} 项）</h4>
              {isMobile ? (
                <div className="weekly-mobile-card-list">
                  {severeWarnings.map((w, idx) => (
                    <div key={idx} className="weekly-mobile-card is-warning">
                      <div className="weekly-mobile-card-head">
                        <div className="weekly-mobile-title-wrap">
                          <div className="weekly-mobile-title">{w.indicator || '-'}</div>
                          <div className="weekly-mobile-meta">
                            <Tag style={{ margin: 0 }}>{w.dept_name || '未分组'}</Tag>
                            <Tag color="warning" style={{ margin: 0 }}>{w.business_type || '-'}</Tag>
                          </div>
                        </div>
                        <div className="weekly-mobile-rate">{w.completion_rate}%</div>
                      </div>
                      <div className="weekly-mobile-field">
                        <div className="weekly-mobile-label">差额</div>
                        <div className="weekly-mobile-text">{w.gap || '-'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <table style={{ fontSize }}>
                  <thead><tr><th>部门</th><th>业务类型</th><th>指标</th><th>完成率</th><th>差额</th></tr></thead>
                  <tbody>
                    {severeWarnings.map((w, idx) => (
                      <tr key={idx}><td>{w.dept_name}</td><td>{w.business_type}</td><td>{w.indicator}</td>
                      <td style={{ color: '#DC2626', fontWeight: 600 }}>{w.completion_rate}%</td><td>{w.gap}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
          {riskProjects.length === 0 && severeWarnings.length === 0 && (
            <p style={{ color: '#16A34A' }}>本周无风险项目或严重预警指标</p>
          )}
        </div>

        {/* 下周重点工作（同组合并） */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>三、下周重点工作{editing && keyWorkItems.some(p => p._hidden) ? `（已隐藏 ${keyWorkItems.filter(p => p._hidden).length} 项）` : ''}</div>
          {keyWorkItems.length > 0 ? (
            renderMergedTable(keyWorkItems, { textTitle: '下周重点工作', textField: 'next_week_focus' }, ['next_week_key_work'])
          ) : (
            <p className="subtle-text">暂无项目填写下周重点工作</p>
          )}
          {/* 已隐藏的下周重点工作恢复区（仅编辑模式） */}
          {editing && keyWorkItems.some(p => p._hidden) && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#F9FAFB', borderRadius: 8, border: '1px dashed #D1D5DB' }}>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, fontWeight: 600 }}>
                已隐藏项目（点击恢复显示）
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {keyWorkItems.map((p, idx) => p._hidden ? (
                  <Tag key={idx} style={{ cursor: 'pointer', margin: 0, background: '#FFF', border: '1px solid #E5E7EB' }}
                    onClick={() => updateEditField(['next_week_key_work', idx, '_hidden'], false)}>
                    <EyeOutlined style={{ marginRight: 4, color: '#3B5AFB' }} />
                    {p.dept_name} · {p.name}
                  </Tag>
                ) : null)}
              </div>
            </div>
          )}
        </div>

        {/* 新增成果 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>四、新增成果（{achievementCount} 项）</div>
          {new_achievements.length > 0 ? (
            isMobile ? (
              <div className="weekly-mobile-card-list">
                {new_achievements.map((a, idx) => (
                  <div key={idx} className="weekly-mobile-card">
                    <div className="weekly-mobile-card-head">
                      <div className="weekly-mobile-title-wrap">
                        <div className="weekly-mobile-title">{a.project_name || '-'}</div>
                        <div className="weekly-mobile-meta">
                          <Tag style={{ margin: 0 }}>{a.dept_name || '未分组'}</Tag>
                          <Tag style={{ margin: 0 }}>{a.achievement_type || '-'}</Tag>
                          <Tag color={a.priority === '高' ? 'error' : a.priority === '中' ? 'warning' : 'default'} style={{ margin: 0 }}>{a.priority || '-'}</Tag>
                        </div>
                      </div>
                    </div>
                    <div className="weekly-mobile-field">
                      <div className="weekly-mobile-label">量化结果</div>
                      <div className="weekly-mobile-text">
                        <EditableCell
                          editing={editing}
                          value={a.quantified_result}
                          path={['new_achievements', idx, 'quantified_result']}
                          rows={3}
                          onChange={updateEditField}
                          cellStyle={cellStyle}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table style={{ fontSize, tableLayout: 'fixed', width: '100%' }}>
                <colgroup>
                  <col style={{ width: 80 }} />
                  <col style={{ width: 180 }} />
                  <col style={{ width: 80 }} />
                  <col />
                  <col style={{ width: 60 }} />
                </colgroup>
                <thead><tr><th>部门</th><th>项目/工作</th><th>成果类型</th><th>量化结果</th><th>优先级</th></tr></thead>
                <tbody>
                  {new_achievements.map((a, idx) => (
                    <tr key={idx}><td>{a.dept_name}</td><td>{a.project_name}</td><td>{a.achievement_type}</td>
                      <td style={cellStyle}>
                        <EditableCell
                          editing={editing}
                          value={a.quantified_result}
                          path={['new_achievements', idx, 'quantified_result']}
                          onChange={updateEditField}
                          cellStyle={cellStyle}
                        />
                      </td>
                      <td><Tag color={a.priority === '高' ? 'error' : a.priority === '中' ? 'warning' : 'default'}>{a.priority}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : (
            <p className="subtle-text">本周无新增成果 — 请在「季度成果」页面录入，或项目完成时系统将自动生成草稿</p>
          )}
        </div>

        <div className="footer" style={{ marginTop: 20, borderTop: '1px solid #E5E7EB', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#9CA3AF', fontSize: 12 }}>本周报基础数据由系统自动汇总生成于 {data.generated_at}</span>
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
      {currentReport?.id && (
        <Button icon={<PictureOutlined />} onClick={() => setImagesDrawerOpen(true)}>配图</Button>
      )}
      <Button icon={<CopyOutlined />} onClick={() => handleCopyMeetingDoc()}>复制会议文档</Button>
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
          <Button key="ai_operating" icon={<RobotOutlined />} loading={aiBriefLoading} onClick={handleGenerateAiBrief}>AI 备会分析</Button>,
          <Button key="ai_brief" icon={<RobotOutlined />} onClick={() => window.__aiAssistant?.generateBriefing('brief', 'weekly_reports')}>AI 简报</Button>,
          <Button key="ai_agenda" icon={<RobotOutlined />} onClick={() => window.__aiAssistant?.runAction('generate_agenda', 'weekly_reports')}>AI 周会议程</Button>,
          <Button key="gen" type="primary" icon={<FileTextOutlined />} onClick={handleGenerate} loading={generating}>
            生成周报
          </Button>,
          isAdmin && currentReport && !editing && (
            <Tooltip key="edit" title="编辑周报内容、补充结论和复盘">
              <Button icon={<EditOutlined />} onClick={handleStartEdit}>编辑</Button>
            </Tooltip>
          ),
          isAdmin && editing && (
            <Button key="save" type="primary" icon={<SaveOutlined />} onClick={handleSaveEdit} loading={saving}>保存</Button>
          ),
          isAdmin && editing && (
            <Button key="cancel" icon={<CloseOutlined />} onClick={handleCancelEdit}>取消</Button>
          ),
          currentReport && !editing && <ExportButtons key="export" />,
        ]}
      />

      <Tabs defaultActiveKey="current">
        <Tabs.TabPane tab="当前周报" key="current">
          {generating ? (
            <div style={{ textAlign: 'center', padding: isMobile ? 36 : 80 }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: '#6B7280', fontSize: 14 }}>正在生成周报...</div>
            </div>
          ) : currentReport ? (
            <div style={{ background: '#F5F7FB', padding: isMobile ? 8 : 24, borderRadius: isMobile ? 10 : 14 }}>
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
        title="AI 备会分析"
        open={aiBriefVisible}
        onCancel={() => setAiBriefVisible(false)}
        width={isMobile ? 'calc(100vw - 24px)' : 820}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={() => { navigator.clipboard?.writeText(aiBrief?.copy_material || aiBrief?.summary || ''); message.success('已复制备会素材'); }}>复制素材</Button>,
          <Button key="close" type="primary" onClick={() => setAiBriefVisible(false)}>关闭</Button>,
        ]}
      >
        <div style={{ color: '#6B7280', marginBottom: 12 }}>这是经营分析/备会辅助材料，不会覆盖正式周报。</div>
        <Card size="small" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{aiBrief?.summary || '暂无摘要'}</div>
          {aiBrief?.copy_material && <div style={{ whiteSpace: 'pre-wrap', color: '#374151' }}>{aiBrief.copy_material}</div>}
        </Card>
        {(aiBrief?.sections || []).map(section => (
          <Card key={section.title} size="small" title={section.title} style={{ marginBottom: 12 }}>
            {(section.items || []).map((item, idx) => <div key={idx} style={{ marginBottom: 6 }}>- {item}</div>)}
          </Card>
        ))}
        {(aiBrief?.decision_topics || []).length > 0 && (
          <Card size="small" title="会上拍板" style={{ marginBottom: 12 }}>
            {aiBrief.decision_topics.map((item, idx) => <div key={idx} style={{ marginBottom: 6 }}>- {item}</div>)}
          </Card>
        )}
      </Modal>

      <Modal
        title={historyReport ? `周报：${historyReport.week_start} 至 ${historyReport.week_end}` : '周报详情'}
        open={historyModalVisible}
        onCancel={() => { setHistoryModalVisible(false); setHistoryReport(null); }}
        width={isMobile ? 'calc(100vw - 24px)' : 900}
        footer={[
          <Button key="close" onClick={() => { setHistoryModalVisible(false); setHistoryReport(null); }}>关闭</Button>,
          <Button key="png" icon={<FileImageOutlined />} onClick={() => { message.info('请在当前周报Tab中导出PNG'); }}>导出 PNG</Button>,
          <Button key="copy" icon={<CopyOutlined />} onClick={() => handleCopyMeetingDoc(historyReport?.content || historyReport)}>复制会议文档</Button>,
          <Button key="word" icon={<FileWordOutlined />} onClick={() => handleExportDoc(historyReport?.content || historyReport)}>导出 Word</Button>,
          <Button key="md" icon={<FileMarkdownOutlined />} onClick={() => handleExportMarkdown(historyReport?.content || historyReport)}>导出 MD</Button>,
        ]}
      >
        <div style={{ background: '#F5F7FB', padding: isMobile ? 8 : 20, borderRadius: isMobile ? 10 : 14, maxHeight: isMobile ? '72vh' : '70vh', overflowY: 'auto' }}>
          {renderReportContent(historyReport?.content || historyReport, true)}
        </div>
      </Modal>

      <ReportImagesDrawer
        open={imagesDrawerOpen}
        onClose={() => setImagesDrawerOpen(false)}
        reportId={currentReport?.id}
        projects={(getContent()?.project_progress) || []}
      />
    </div>
  );
}

export default WeeklyReportPage;
