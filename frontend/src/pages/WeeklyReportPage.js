import React, { useEffect, useState, useRef } from 'react';
import { Button, Card, Table, Tag, message, Tabs, Empty, Modal, Space, Row, Col } from 'antd';
import { FileTextOutlined, EyeOutlined, FileImageOutlined, FileWordOutlined, FileMarkdownOutlined, CheckCircleOutlined, AlertOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { api } from '../hooks/useAuth';
import { toPng } from 'html-to-image';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import MetricCard from '../components/ui/MetricCard';
import { RobotOutlined } from '@ant-design/icons';

function WeeklyReportPage() {
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef(null);

  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyReport, setHistoryReport] = useState(null);

  // 渲染含换行的文本：\n → <br/>，同时限制最大宽度并自动换行
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

  // 表格单元格样式：自动换行+限制最大宽度
  const cellStyle = { whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: 260 };

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
        // 统一设置 currentReport，content 字段为完整数据
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

  // ===== 导出功能（保持不变） =====

  const handleExportPng = async (content) => {
    if (!reportRef.current) {
      message.error('报告内容未渲染，无法导出');
      return;
    }
    try {
      // 等待一帧确保 DOM 渲染完成
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const dataUrl = await toPng(reportRef.current, {
        width: 1200,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        imagePlaceholder: undefined,
      });
      
      // 空白图检测：base64 长度 < 5KB 说明截图失败
      const base64Data = dataUrl.split(',')[1];
      if (!base64Data || base64Data.length < 5000) {
        message.error('截图生成异常（空白图），请稍后重试');
        return;
      }
      
      const link = document.createElement('a');
      const c = content || currentReport;
      link.download = `增长组周报_${c?.week_start || ''}_${c?.week_end || ''}.png`;
      link.href = dataUrl;
      link.click();
      message.success('PNG 导出成功');
    } catch (err) {
      console.error('PNG导出失败:', err);
      message.error('导出 PNG 失败，请尝试使用 MD 或 Word 格式导出');
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

  const generateMarkdown = (content) => {
    const { kpi_summary, project_progress, risk_and_warnings, next_week_key_work, next_week_focus, new_achievements } = content;
    // 兼容旧周报：next_week_key_work 优先，fallback 到 next_week_focus.upcoming_projects
    const keyWorkItems = next_week_key_work || next_week_focus?.upcoming_projects || [];
    let md = `# 增长组业务周报\n\n`;
    md += `**周期**：${content.week_start} 至 ${content.week_end}\n\n---\n\n`;
    md += `## 一、本周数据摘要\n\n`;
    if (kpi_summary?.length) {
      md += `| 部门 | 指标 | 完成率 | 目标 | 实际 | 单位 |\n|------|------|--------|------|------|------|\n`;
      kpi_summary.forEach(k => { md += `| ${k.dept_name} | ${k.indicator} | ${k.completion_rate}% | ${k.target} | ${k.actual} | ${k.unit} |\n`; });
    } else { md += `暂无数据\n`; }
    md += `\n## 二、重点工作进展\n\n`;
    if (project_progress?.length) {
      md += `| 部门 | 项目名称 | 负责人 | 本周进展 | 进度 | 状态 |\n|------|----------|--------|----------|------|------|\n`;
      project_progress.forEach(p => { md += `| ${p.dept_name} | ${p.name} | ${p.owner_name} | ${p.weekly_progress || '-'} | ${p.progress_pct}% | ${p.status} |\n`; });
    } else { md += `本周无更新项目\n`; }
    md += `\n## 三、风险与预警\n\n`;
    if (risk_and_warnings?.risk_projects?.length) {
      md += `### 风险项目\n\n| 部门 | 项目名称 | 负责人 | 风险描述 |\n|------|----------|--------|----------|\n`;
      risk_and_warnings.risk_projects.forEach(p => { md += `| ${p.dept_name} | ${p.name} | ${p.owner_name} | ${p.risk_desc || '-'} |\n`; });
      md += `\n`;
    }
    if (!risk_and_warnings?.risk_projects?.length && !risk_and_warnings?.severe_warnings?.length) {
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
    const keyWorkItems = next_week_key_work || next_week_focus?.upcoming_projects || [];
    // 文本换行辅助：\n → <br/>
    const textToHtml = (t) => (t || '-').replace(/\n/g, '<br/>');
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
td.text-cell { max-width: 260px; white-space: pre-wrap; }
.risk { color: #DC2626; font-weight: 600; }
.footer { margin-top: 30px; color: #8c8c8c; font-size: 12px; border-top: 1px solid #d9d9d9; padding-top: 10px; }
</style></head><body>`;
    html += `<h1>增长组业务周报</h1><p><strong>周期</strong>：${content.week_start} 至 ${content.week_end}</p>`;
    html += `<h2>一、本周数据摘要</h2>`;
    if (kpi_summary?.length) {
      html += `<table><tr><th>部门</th><th>指标</th><th>完成率</th><th>目标</th><th>实际</th><th>单位</th></tr>`;
      kpi_summary.forEach(k => {
        const color = k.completion_rate >= 90 ? '#16A34A' : k.completion_rate >= 60 ? '#F59E0B' : '#DC2626';
        html += `<tr><td>${k.dept_name}</td><td>${k.indicator}</td><td style="color:${color};font-weight:600">${k.completion_rate}%</td><td>${k.target}</td><td>${k.actual}</td><td>${k.unit}</td></tr>`;
      });
      html += `</table>`;
    } else { html += `<p>暂无数据</p>`; }
    html += `<h2>二、重点工作进展</h2>`;
    if (project_progress?.length) {
      html += `<table><tr><th style="width:60px">部门</th><th style="width:100px">项目名称</th><th style="width:60px">负责人</th><th class="text-cell">本周进展</th><th style="width:50px">进度</th><th style="width:50px">状态</th></tr>`;
      project_progress.forEach(p => {
        const rowStyle = p.status === '风险' ? ' style="background:#FEF2F2"' : '';
        html += `<tr${rowStyle}><td>${p.dept_name}</td><td>${p.name}</td><td>${p.owner_name}</td><td class="text-cell">${textToHtml(p.weekly_progress)}</td><td>${p.progress_pct}%</td><td${p.status === '风险' ? ' class="risk"' : ''}>${p.status}</td></tr>`;
      });
      html += `</table>`;
    } else { html += `<p>本周无更新项目</p>`; }
    html += `<h2>三、风险与预警</h2>`;
    if (risk_and_warnings?.risk_projects?.length) {
      html += `<h3>风险项目（${risk_and_warnings.risk_projects.length} 项）</h3>`;
      html += `<table><tr><th>部门</th><th>项目名称</th><th>负责人</th><th class="text-cell">风险描述</th></tr>`;
      risk_and_warnings.risk_projects.forEach(p => { html += `<tr style="background:#FEF2F2"><td>${p.dept_name}</td><td>${p.name}</td><td>${p.owner_name}</td><td class="text-cell">${textToHtml(p.risk_desc)}</td></tr>`; });
      html += `</table>`;
    }
    if (!risk_and_warnings?.risk_projects?.length && !risk_and_warnings?.severe_warnings?.length) {
      html += `<p style="color:#16A34A">✅ 本周无风险项目或严重预警指标</p>`;
    }
    html += `<h2>四、下周重点工作</h2>`;
    if (keyWorkItems.length) {
      html += `<table><tr><th style="width:60px">部门</th><th style="width:100px">项目名称</th><th style="width:60px">负责人</th><th class="text-cell">下周重点工作</th><th style="width:50px">进度</th><th style="width:50px">状态</th></tr>`;
      keyWorkItems.forEach(p => { html += `<tr><td>${p.dept_name}</td><td>${p.name}</td><td>${p.owner_name}</td><td class="text-cell">${textToHtml(p.next_week_focus || p.due_date)}</td><td>${p.progress_pct}%</td><td>${p.status || '-'}</td></tr>`; });
      html += `</table>`;
    }
    html += `<h2>五、新增成果</h2>`;
    if (new_achievements?.length) {
      html += `<table><tr><th>部门</th><th>项目/工作</th><th>负责人</th><th>成果类型</th><th class="text-cell">量化结果</th><th>优先级</th></tr>`;
      new_achievements.forEach(a => { html += `<tr><td>${a.dept_name}</td><td>${a.project_name}</td><td>${a.owner_name}</td><td>${a.achievement_type}</td><td class="text-cell">${textToHtml(a.quantified_result)}</td><td>${a.priority}</td></tr>`; });
      html += `</table>`;
    } else { html += `<p>本周无新增成果</p>`; }
    html += `<div class="footer">自动生成于 ${content.generated_at}</div></body></html>`;
    return html;
  };

  // ===== 周报内容渲染 =====

  const renderReportContent = (content, compact = false) => {
    if (!content) return <Empty description="暂无周报数据" />;
    const { kpi_summary, project_progress, risk_and_warnings, next_week_key_work, next_week_focus, new_achievements } = content;
    // 兼容旧周报：next_week_key_work 优先，fallback 到 next_week_focus.upcoming_projects
    const keyWorkItems = next_week_key_work || next_week_focus?.upcoming_projects || [];
    const fontSize = compact ? 12 : 13;
    const riskCount = (risk_and_warnings?.risk_projects?.length || 0) + (risk_and_warnings?.severe_warnings?.length || 0);
    const nextWeekCount = keyWorkItems.length;
    const achievementCount = new_achievements?.length || 0;

    return (
      <div ref={!compact ? reportRef : undefined} className="weekly-report">
        <h1 style={{ fontSize: compact ? 18 : 22, borderBottom: `2px solid #3B5AFB`, paddingBottom: 8, color: '#111827' }}>增长组业务周报</h1>
        <div style={{ fontSize, color: '#6B7280', marginBottom: 20 }}>
          📅 {content.week_start} 至 {content.week_end}
        </div>

        {/* 本周结论（新增） */}
        {content.week_conclusion && (
          <div style={{
            background: '#F0F4FF', border: '1px solid #C7D7FE', borderRadius: 10,
            padding: '14px 18px', marginBottom: 20, fontSize: compact ? 12 : 14, color: '#1E40AF', lineHeight: 1.7
          }}>
            <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              📋 本周结论
              <Tag color="blue" style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>自动生成</Tag>
            </div>
            {renderText(content.week_conclusion)}
          </div>
        )}

        {/* 关键变化（新增） */}
        {content.key_changes && content.key_changes.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: compact ? 13 : 15, marginBottom: 8 }}>⚡ 关键变化</div>
            {content.key_changes.map((c, idx) => {
              const iconMap = { risk: '🔴', progress: '📈', deviation: '📉', achieved: '✅' };
              const colorMap = { risk: '#DC2626', progress: '#16A34A', deviation: '#DC2626', achieved: '#16A34A' };
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: compact ? 12 : 13 }}>
                  <span>{iconMap[c.type] || '📌'}</span>
                  <span style={{ color: colorMap[c.type] || '#111827' }}>{c.text}</span>
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

        {/* 数据摘要 — 分组卡片 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>一、本周数据摘要</div>
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 16 }}>
            {kpi_summary?.map((kpi, idx) => (
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
        </div>

        {/* 重点工作进展 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>二、重点工作进展（更新 {project_progress?.length || 0} 项）</div>
          {project_progress?.length > 0 ? (
            <table style={{ fontSize }}>
              <thead><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>本周进展</th><th>进度</th><th>状态</th></tr></thead>
              <tbody>
                {project_progress.map((p, idx) => (
                  <tr key={idx} className={p.status === '风险' ? 'risk-row' : ''}>
                    <td>{p.dept_name}</td><td>{p.name}</td><td>{p.owner_name}</td>
                    <td style={cellStyle}>{renderText(p.weekly_progress)}</td>
                    <td>{p.progress_pct}%</td>
                    <td>{p.status === '风险' ? <span className="risk-tag">风险</span> : p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="subtle-text">本周无更新项目</p>
          )}
        </div>

        {/* 风险与预警 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>三、风险与预警</div>
          {risk_and_warnings?.risk_projects?.length > 0 && (
            <>
              <h4 style={{ color: '#DC2626', fontSize: compact ? 13 : 14 }}>风险项目（{risk_and_warnings.risk_projects.length} 项）</h4>
              <table style={{ fontSize }}>
                <thead><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>风险描述</th></tr></thead>
                <tbody>
                  {risk_and_warnings.risk_projects.map((p, idx) => (
                    <tr key={idx} className="risk-row"><td>{p.dept_name}</td><td>{p.name}</td><td>{p.owner_name}</td><td style={cellStyle}>{renderText(p.risk_desc)}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {risk_and_warnings?.severe_warnings?.length > 0 && (
            <>
              <h4 style={{ color: '#F59E0B', marginTop: 16, fontSize: compact ? 13 : 14 }}>严重预警指标（{risk_and_warnings.severe_warnings.length} 项）</h4>
              <table style={{ fontSize }}>
                <thead><tr><th>部门</th><th>业务类型</th><th>指标</th><th>完成率</th><th>差额</th></tr></thead>
                <tbody>
                  {risk_and_warnings.severe_warnings.map((w, idx) => (
                    <tr key={idx}><td>{w.dept_name}</td><td>{w.business_type}</td><td>{w.indicator}</td>
                    <td style={{ color: '#DC2626', fontWeight: 600 }}>{w.completion_rate}%</td><td>{w.gap}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {(!risk_and_warnings?.risk_projects?.length && !risk_and_warnings?.severe_warnings?.length) && (
            <p style={{ color: '#16A34A' }}>✅ 本周无风险项目或严重预警指标</p>
          )}
        </div>

        {/* 下周重点工作 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>四、下周重点工作</div>
          {keyWorkItems.length > 0 ? (
            <table style={{ fontSize }}>
              <thead><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>下周重点工作</th><th>进度</th><th>状态</th></tr></thead>
              <tbody>
                {keyWorkItems.map((p, idx) => (
                  <tr key={idx}><td>{p.dept_name}</td><td>{p.name}</td><td>{p.owner_name}</td><td style={cellStyle}>{renderText(p.next_week_focus || p.due_date)}</td><td>{p.progress_pct}%</td><td>{p.status || '-'}</td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="subtle-text">暂无项目填写下周重点工作</p>
          )}
        </div>

        {/* 新增成果 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>五、新增成果（{achievementCount} 项）</div>
          {new_achievements?.length > 0 ? (
            <table style={{ fontSize }}>
              <thead><tr><th>部门</th><th>项目/工作</th><th>负责人</th><th>成果类型</th><th>量化结果</th><th>优先级</th></tr></thead>
              <tbody>
                {new_achievements.map((a, idx) => (
                  <tr key={idx}><td>{a.dept_name}</td><td>{a.project_name}</td><td>{a.owner_name}</td><td>{a.achievement_type}</td>
                  <td style={cellStyle}>{renderText(a.quantified_result)}</td>
                  <td><Tag color={a.priority === '高' ? 'error' : a.priority === '中' ? 'warning' : 'default'}>{a.priority}</Tag></td></tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="subtle-text">本周无新增成果</p>
          )}
        </div>

        <div className="footer" style={{ marginTop: 20, borderTop: '1px solid #E5E7EB', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#9CA3AF', fontSize: 12 }}>🤖 本周报基础数据由系统自动汇总生成于 {content.generated_at}</span>
          <span style={{ color: '#3B5AFB', fontSize: 12 }}>管理评语与复盘结论需手动补充</span>
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

  // 统一导出按钮组
  const ExportButtons = ({ content }) => (
    <>
      <Button icon={<FileImageOutlined />} onClick={() => handleExportPng(content)}>PNG</Button>
      <Button icon={<FileWordOutlined />} onClick={() => handleExportDoc(content)}>Word</Button>
      <Button icon={<FileMarkdownOutlined />} onClick={() => handleExportMarkdown(content)}>MD</Button>
    </>
  );

  return (
    <div className="app-page">
      <PageHeader
        title="周报与复盘"
        subtitle="结果输出页 · 周报内容自动生成，只需补充管理评语和复盘结论"
        extra={[
          <Button key="ai_brief" icon={<RobotOutlined />} onClick={() => window.__aiAssistant?.generateBriefing('brief', 'weekly_reports')}>AI 简报</Button>,
          <Button key="ai_agenda" icon={<RobotOutlined />} onClick={() => window.__aiAssistant?.runAction('generate_agenda', 'weekly_reports')}>AI 周会议程</Button>,
          <Button key="gen" type="primary" icon={<FileTextOutlined />} onClick={handleGenerate} loading={generating}>
            生成周报
          </Button>,
          currentReport && <ExportButtons key="export" />,
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

      {/* 历史周报查看弹窗 */}
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
