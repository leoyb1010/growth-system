import React, { useEffect, useState, useRef } from 'react';
import { Button, Card, Table, Tag, message, Tabs, Empty, Modal, Space } from 'antd';
import { FileTextOutlined, EyeOutlined, FileImageOutlined, FileWordOutlined, FileMarkdownOutlined } from '@ant-design/icons';
import { api } from '../hooks/useAuth';
import { toPng } from 'html-to-image';

function WeeklyReportPage() {
  const [reports, setReports] = useState([]);
  const [currentReport, setCurrentReport] = useState(null);
  const [generating, setGenerating] = useState(false);
  const reportRef = useRef(null);

  // 历史周报弹窗
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [historyReport, setHistoryReport] = useState(null);

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
        setCurrentReport({ id: res.data.id, content: res.data });
        fetchReports();
      }
    } catch (err) {
      message.error('生成周报失败');
    } finally {
      setGenerating(false);
    }
  };

  // 查看历史周报 - 直接弹窗
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

  // ===== 导出功能 =====

  const handleExportPng = async (content) => {
    if (!reportRef.current) return;
    try {
      const dataUrl = await toPng(reportRef.current, {
        width: 1200,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      const link = document.createElement('a');
      const c = content || currentReport;
      link.download = `增长组周报_${c?.week_start || ''}_${c?.week_end || ''}.png`;
      link.href = dataUrl;
      link.click();
      message.success('PNG 导出成功');
    } catch (err) {
      message.error('导出 PNG 失败');
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
    const { kpi_summary, project_progress, risk_and_warnings, next_week_focus, new_achievements } = content;
    let md = `# 增长组业务周报\n\n`;
    md += `**周期**：${content.week_start} 至 ${content.week_end}\n\n`;
    md += `---\n\n`;

    md += `## 一、本周数据摘要\n\n`;
    if (kpi_summary?.length) {
      md += `| 部门 | 指标 | 完成率 | 目标 | 实际 | 单位 |\n|------|------|--------|------|------|------|\n`;
      kpi_summary.forEach(k => {
        md += `| ${k.dept_name} | ${k.indicator} | ${k.completion_rate}% | ${k.target} | ${k.actual} | ${k.unit} |\n`;
      });
    } else {
      md += `暂无数据\n`;
    }
    md += `\n`;

    md += `## 二、重点工作进展\n\n`;
    if (project_progress?.length) {
      md += `| 部门 | 项目名称 | 负责人 | 本周进展 | 进度 | 状态 |\n|------|----------|--------|----------|------|------|\n`;
      project_progress.forEach(p => {
        md += `| ${p.dept_name} | ${p.name} | ${p.owner_name} | ${p.weekly_progress || '-'} | ${p.progress_pct}% | ${p.status} |\n`;
      });
    } else {
      md += `本周无更新项目\n`;
    }
    md += `\n`;

    md += `## 三、风险与预警\n\n`;
    if (risk_and_warnings?.risk_projects?.length) {
      md += `### 风险项目\n\n`;
      md += `| 部门 | 项目名称 | 负责人 | 风险描述 |\n|------|----------|--------|----------|\n`;
      risk_and_warnings.risk_projects.forEach(p => {
        md += `| ${p.dept_name} | ${p.name} | ${p.owner_name} | ${p.risk_desc || '-'} |\n`;
      });
      md += `\n`;
    }
    if (risk_and_warnings?.severe_warnings?.length) {
      md += `### 严重预警指标\n\n`;
      md += `| 部门 | 业务类型 | 指标 | 完成率 | 差额 |\n|------|----------|------|--------|------|\n`;
      risk_and_warnings.severe_warnings.forEach(w => {
        md += `| ${w.dept_name} | ${w.business_type} | ${w.indicator} | ${w.completion_rate}% | ${w.gap} |\n`;
      });
      md += `\n`;
    }
    if (!risk_and_warnings?.risk_projects?.length && !risk_and_warnings?.severe_warnings?.length) {
      md += `✅ 本周无风险项目或严重预警指标\n\n`;
    }

    md += `## 四、下周焦点\n\n`;
    if (next_week_focus?.upcoming_projects?.length) {
      md += `### 预计下周完成项目\n\n`;
      md += `| 部门 | 项目名称 | 负责人 | 到期日 | 当前进度 |\n|------|----------|--------|--------|----------|\n`;
      next_week_focus.upcoming_projects.forEach(p => {
        md += `| ${p.dept_name} | ${p.name} | ${p.owner_name} | ${p.due_date} | ${p.progress_pct}% |\n`;
      });
      md += `\n`;
    }
    if (next_week_focus?.follow_up_items?.length) {
      md += `### 下月跟进事项\n\n`;
      md += `| 部门 | 工作事项 | 负责人 | 下月跟进计划 |\n|------|----------|--------|--------------|\n`;
      next_week_focus.follow_up_items.forEach(t => {
        md += `| ${t.dept_name} | ${t.task} | ${t.owner_name} | ${t.next_month_plan} |\n`;
      });
      md += `\n`;
    }

    md += `## 五、新增成果\n\n`;
    if (new_achievements?.length) {
      md += `| 部门 | 项目/工作 | 负责人 | 成果类型 | 量化结果 | 优先级 |\n|------|----------|--------|----------|----------|--------|\n`;
      new_achievements.forEach(a => {
        md += `| ${a.dept_name} | ${a.project_name} | ${a.owner_name} | ${a.achievement_type} | ${a.quantified_result || '-'} | ${a.priority} |\n`;
      });
    } else {
      md += `本周无新增成果\n`;
    }

    md += `\n---\n\n自动生成于 ${content.generated_at}\n`;
    return md;
  };

  const generateDocHtml = (content) => {
    const { kpi_summary, project_progress, risk_and_warnings, next_week_focus, new_achievements } = content;
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>增长组周报</title>
<style>
body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; padding: 40px; color: #262626; }
h1 { color: #1677ff; border-bottom: 3px solid #1677ff; padding-bottom: 10px; }
h2 { color: #262626; border-left: 4px solid #1677ff; padding-left: 10px; margin-top: 30px; }
h3 { color: #595959; }
table { border-collapse: collapse; width: 100%; margin: 12px 0; }
th, td { border: 1px solid #d9d9d9; padding: 8px 12px; font-size: 13px; }
th { background: #fafafa; font-weight: 600; }
.risk { color: #ff4d4f; font-weight: 600; }
.footer { margin-top: 30px; color: #8c8c8c; font-size: 12px; border-top: 1px solid #d9d9d9; padding-top: 10px; }
</style></head><body>`;

    html += `<h1>增长组业务周报</h1>`;
    html += `<p><strong>周期</strong>：${content.week_start} 至 ${content.week_end}</p>`;

    html += `<h2>一、本周数据摘要</h2>`;
    if (kpi_summary?.length) {
      html += `<table><tr><th>部门</th><th>指标</th><th>完成率</th><th>目标</th><th>实际</th><th>单位</th></tr>`;
      kpi_summary.forEach(k => {
        const color = k.completion_rate >= 90 ? '#52c41a' : k.completion_rate >= 60 ? '#faad14' : '#ff4d4f';
        html += `<tr><td>${k.dept_name}</td><td>${k.indicator}</td><td style="color:${color};font-weight:600">${k.completion_rate}%</td><td>${k.target}</td><td>${k.actual}</td><td>${k.unit}</td></tr>`;
      });
      html += `</table>`;
    } else {
      html += `<p>暂无数据</p>`;
    }

    html += `<h2>二、重点工作进展</h2>`;
    if (project_progress?.length) {
      html += `<table><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>本周进展</th><th>进度</th><th>状态</th></tr>`;
      project_progress.forEach(p => {
        const rowStyle = p.status === '风险' ? ' style="background:#fff2f0"' : '';
        html += `<tr${rowStyle}><td>${p.dept_name}</td><td>${p.name}</td><td>${p.owner_name}</td><td>${p.weekly_progress || '-'}</td><td>${p.progress_pct}%</td><td${p.status === '风险' ? ' class="risk"' : ''}>${p.status}</td></tr>`;
      });
      html += `</table>`;
    } else {
      html += `<p>本周无更新项目</p>`;
    }

    html += `<h2>三、风险与预警</h2>`;
    if (risk_and_warnings?.risk_projects?.length) {
      html += `<h3>风险项目（${risk_and_warnings.risk_projects.length} 项）</h3>`;
      html += `<table><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>风险描述</th></tr>`;
      risk_and_warnings.risk_projects.forEach(p => {
        html += `<tr style="background:#fff2f0"><td>${p.dept_name}</td><td>${p.name}</td><td>${p.owner_name}</td><td>${p.risk_desc || '-'}</td></tr>`;
      });
      html += `</table>`;
    }
    if (risk_and_warnings?.severe_warnings?.length) {
      html += `<h3>严重预警指标（${risk_and_warnings.severe_warnings.length} 项）</h3>`;
      html += `<table><tr><th>部门</th><th>业务类型</th><th>指标</th><th>完成率</th><th>差额</th></tr>`;
      risk_and_warnings.severe_warnings.forEach(w => {
        html += `<tr><td>${w.dept_name}</td><td>${w.business_type}</td><td>${w.indicator}</td><td class="risk">${w.completion_rate}%</td><td>${w.gap}</td></tr>`;
      });
      html += `</table>`;
    }
    if (!risk_and_warnings?.risk_projects?.length && !risk_and_warnings?.severe_warnings?.length) {
      html += `<p style="color:#52c41a">✅ 本周无风险项目或严重预警指标</p>`;
    }

    html += `<h2>四、下周焦点</h2>`;
    if (next_week_focus?.upcoming_projects?.length) {
      html += `<h3>预计下周完成项目</h3>`;
      html += `<table><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>到期日</th><th>当前进度</th></tr>`;
      next_week_focus.upcoming_projects.forEach(p => {
        html += `<tr><td>${p.dept_name}</td><td>${p.name}</td><td>${p.owner_name}</td><td>${p.due_date}</td><td>${p.progress_pct}%</td></tr>`;
      });
      html += `</table>`;
    }
    if (next_week_focus?.follow_up_items?.length) {
      html += `<h3>下月跟进事项</h3>`;
      html += `<table><tr><th>部门</th><th>工作事项</th><th>负责人</th><th>下月跟进计划</th></tr>`;
      next_week_focus.follow_up_items.forEach(t => {
        html += `<tr><td>${t.dept_name}</td><td>${t.task}</td><td>${t.owner_name}</td><td>${t.next_month_plan}</td></tr>`;
      });
      html += `</table>`;
    }

    html += `<h2>五、新增成果</h2>`;
    if (new_achievements?.length) {
      html += `<table><tr><th>部门</th><th>项目/工作</th><th>负责人</th><th>成果类型</th><th>量化结果</th><th>优先级</th></tr>`;
      new_achievements.forEach(a => {
        html += `<tr><td>${a.dept_name}</td><td>${a.project_name}</td><td>${a.owner_name}</td><td>${a.achievement_type}</td><td>${a.quantified_result || '-'}</td><td>${a.priority}</td></tr>`;
      });
      html += `</table>`;
    } else {
      html += `<p>本周无新增成果</p>`;
    }

    html += `<div class="footer">自动生成于 ${content.generated_at}</div>`;
    html += `</body></html>`;
    return html;
  };

  const renderReportContent = (content, compact = false) => {
    if (!content) return <Empty description="暂无周报数据" />;

    const { kpi_summary, project_progress, risk_and_warnings, next_week_focus, new_achievements } = content;
    const fontSize = compact ? 12 : 14;
    const headerFontSize = compact ? 16 : 20;

    return (
      <div ref={!compact ? reportRef : undefined} className="weekly-report">
        <h1 style={{ fontSize: headerFontSize, borderBottom: '2px solid #1677ff', paddingBottom: 8 }}>增长组业务周报</h1>
        <div style={{ fontSize, color: '#595959', marginBottom: 16 }}>
          📅 {content.week_start} 至 {content.week_end}
        </div>

        {/* 数据摘要 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>一、本周数据摘要</div>
          <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            {kpi_summary?.map((kpi, idx) => (
              <Card key={idx} size="small">
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>{kpi.dept_name} - {kpi.indicator}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: kpi.completion_rate >= 90 ? '#52c41a' : kpi.completion_rate >= 60 ? '#faad14' : '#ff4d4f', margin: '6px 0' }}>
                  {kpi.completion_rate}%
                </div>
                <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                  目标: {kpi.target}{kpi.unit} / 完成: {kpi.actual}{kpi.unit}
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* 重点工作进展 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>二、重点工作进展（本周更新 {project_progress?.length || 0} 项）</div>
          {project_progress?.length > 0 ? (
            <table style={{ fontSize: compact ? 12 : 13 }}>
              <thead>
                <tr>
                  <th>部门</th>
                  <th>项目名称</th>
                  <th>负责人</th>
                  <th>本周进展</th>
                  <th>进度</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {project_progress.map((p, idx) => (
                  <tr key={idx} className={p.status === '风险' ? 'risk-row' : ''}>
                    <td>{p.dept_name}</td>
                    <td>{p.name}</td>
                    <td>{p.owner_name}</td>
                    <td>{p.weekly_progress || '-'}</td>
                    <td>{p.progress_pct}%</td>
                    <td>
                      {p.status === '风险' ? <span className="risk-tag">风险</span> : p.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#8c8c8c' }}>本周无更新项目</p>
          )}
        </div>

        {/* 风险与预警 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>三、风险与预警</div>
          {risk_and_warnings?.risk_projects?.length > 0 && (
            <>
              <h4 style={{ color: '#ff4d4f' }}>风险项目（{risk_and_warnings.risk_projects.length} 项）</h4>
              <table style={{ fontSize: compact ? 12 : 13 }}>
                <thead><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>风险描述</th></tr></thead>
                <tbody>
                  {risk_and_warnings.risk_projects.map((p, idx) => (
                    <tr key={idx} className="risk-row">
                      <td>{p.dept_name}</td><td>{p.name}</td><td>{p.owner_name}</td><td>{p.risk_desc || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {risk_and_warnings?.severe_warnings?.length > 0 && (
            <>
              <h4 style={{ color: '#fa8c16', marginTop: 16 }}>严重预警指标（{risk_and_warnings.severe_warnings.length} 项）</h4>
              <table style={{ fontSize: compact ? 12 : 13 }}>
                <thead><tr><th>部门</th><th>业务类型</th><th>指标</th><th>完成率</th><th>差额</th></tr></thead>
                <tbody>
                  {risk_and_warnings.severe_warnings.map((w, idx) => (
                    <tr key={idx}>
                      <td>{w.dept_name}</td><td>{w.business_type}</td><td>{w.indicator}</td>
                      <td style={{ color: '#ff4d4f', fontWeight: 600 }}>{w.completion_rate}%</td><td>{w.gap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {(!risk_and_warnings?.risk_projects?.length && !risk_and_warnings?.severe_warnings?.length) && (
            <p style={{ color: '#52c41a' }}>✅ 本周无风险项目或严重预警指标</p>
          )}
        </div>

        {/* 下周焦点 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>四、下周焦点</div>
          {next_week_focus?.upcoming_projects?.length > 0 && (
            <>
              <h4>预计下周完成项目（{next_week_focus.upcoming_projects.length} 项）</h4>
              <table style={{ fontSize: compact ? 12 : 13 }}>
                <thead><tr><th>部门</th><th>项目名称</th><th>负责人</th><th>到期日</th><th>当前进度</th></tr></thead>
                <tbody>
                  {next_week_focus.upcoming_projects.map((p, idx) => (
                    <tr key={idx}><td>{p.dept_name}</td><td>{p.name}</td><td>{p.owner_name}</td><td>{p.due_date}</td><td>{p.progress_pct}%</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {next_week_focus?.follow_up_items?.length > 0 && (
            <>
              <h4 style={{ marginTop: 16 }}>下月跟进事项（{next_week_focus.follow_up_items.length} 项）</h4>
              <table style={{ fontSize: compact ? 12 : 13 }}>
                <thead><tr><th>部门</th><th>工作事项</th><th>负责人</th><th>下月跟进计划</th></tr></thead>
                <tbody>
                  {next_week_focus.follow_up_items.map((t, idx) => (
                    <tr key={idx}><td>{t.dept_name}</td><td>{t.task}</td><td>{t.owner_name}</td><td>{t.next_month_plan}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* 新增成果 */}
        <div className="section">
          <div className="section-title" style={{ fontSize: compact ? 14 : 16 }}>五、新增成果（{new_achievements?.length || 0} 项）</div>
          {new_achievements?.length > 0 ? (
            <table style={{ fontSize: compact ? 12 : 13 }}>
              <thead><tr><th>部门</th><th>项目/工作</th><th>负责人</th><th>成果类型</th><th>量化结果</th><th>优先级</th></tr></thead>
              <tbody>
                {new_achievements.map((a, idx) => (
                  <tr key={idx}>
                    <td>{a.dept_name}</td><td>{a.project_name}</td><td>{a.owner_name}</td><td>{a.achievement_type}</td>
                    <td>{a.quantified_result || '-'}</td>
                    <td><Tag color={a.priority === '高' ? 'error' : a.priority === '中' ? 'warning' : 'default'}>{a.priority}</Tag></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={{ color: '#8c8c8c' }}>本周无新增成果</p>
          )}
        </div>

        <div className="footer" style={{ marginTop: 20, color: '#8c8c8c', fontSize: 12, borderTop: '1px solid #d9d9d9', paddingTop: 10 }}>
          自动生成于 {content.generated_at}
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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>周报管理</h2>
        <Space>
          <Button type="primary" icon={<FileTextOutlined />} onClick={handleGenerate} loading={generating}>
            生成周报
          </Button>
          {currentReport && (
            <>
              <Button icon={<FileImageOutlined />} onClick={() => handleExportPng()}>
                导出 PNG
              </Button>
              <Button icon={<FileWordOutlined />} onClick={() => handleExportDoc()}>
                导出 Word
              </Button>
              <Button icon={<FileMarkdownOutlined />} onClick={() => handleExportMarkdown()}>
                导出 MD
              </Button>
            </>
          )}
        </Space>
      </div>

      <Tabs defaultActiveKey="current">
        <Tabs.TabPane tab="当前周报" key="current">
          {currentReport ? (
            <div style={{ background: '#f5f5f5', padding: 24, borderRadius: 8 }}>
              {renderReportContent(currentReport.content || currentReport)}
            </div>
          ) : (
            <Empty description="暂无周报，点击上方按钮生成" />
          )}
        </Tabs.TabPane>
        <Tabs.TabPane tab="历史周报" key="history">
          <Table dataSource={reports} columns={reportColumns} rowKey="id" />
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
          <Button key="png" icon={<FileImageOutlined />} onClick={() => {
            // 对于弹窗内容，用当前渲染的内容
            message.info('请在当前周报Tab中导出PNG');
          }}>导出 PNG</Button>,
          <Button key="word" icon={<FileWordOutlined />} onClick={() => handleExportDoc(historyReport)}>导出 Word</Button>,
          <Button key="md" icon={<FileMarkdownOutlined />} onClick={() => handleExportMarkdown(historyReport)}>导出 MD</Button>,
        ]}
      >
        <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 8, maxHeight: '70vh', overflowY: 'auto' }}>
          {renderReportContent(historyReport, true)}
        </div>
      </Modal>
    </div>
  );
}

export default WeeklyReportPage;
