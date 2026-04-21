import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Table, Tag, Button, message, Progress, Segmented } from 'antd';
import { WarningOutlined, FileTextOutlined, FundOutlined, RiseOutlined, DollarOutlined, TeamOutlined, ClockCircleOutlined, AlertOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../hooks/useAuth';
import moment from 'moment';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import MetricCard from '../components/ui/MetricCard';

function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('quarter');
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboard();
  }, [viewMode]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/dashboard?mode=${viewMode}`);
      if (res.code === 0) {
        setData(res.data);
      }
    } catch (err) {
      message.error('获取仪表盘数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    try {
      const res = await api.post('/weekly-reports/generate', {});
      if (res.code === 0) {
        message.success('周报生成成功，可在周报管理页面查看');
        navigate('/weekly-reports');
      }
    } catch (err) {
      message.error('生成周报失败');
    }
  };

  if (!data) return <div style={{ textAlign: 'center', padding: 80, fontSize: 16, color: '#8c8c8c' }}>加载中...</div>;

  const modeLabel = viewMode === 'year' ? '全年累计' : `${data.current_quarter} 季度`;
  const riskCount = data.kpi_cards?.risk_project_count || 0;

  // 四张核心指标 — 白底克制风格
  const kpiCards = [
    {
      title: '部门 GMV',
      value: `${data.kpi_cards?.total_gmv_rate || 0}%`,
      suffix: '完成率',
      hint: `目标 ${(data.kpi_cards?.total_gmv_target || 0).toLocaleString()} 万 · 实际 ${(data.kpi_cards?.total_gmv_actual || 0).toLocaleString()} 万`,
      status: (data.kpi_cards?.total_gmv_rate || 0) >= 90 ? 'success' : (data.kpi_cards?.total_gmv_rate || 0) >= 60 ? 'warning' : 'error',
      icon: <TeamOutlined style={{ fontSize: 20, color: '#3B5AFB' }} />,
    },
    {
      title: '部门利润',
      value: `${data.kpi_cards?.total_profit_rate || 0}%`,
      suffix: '完成率',
      hint: `目标 ${(data.kpi_cards?.total_profit_target || 0).toLocaleString()} 万 · 实际 ${(data.kpi_cards?.total_profit_actual || 0).toLocaleString()} 万`,
      status: (data.kpi_cards?.total_profit_rate || 0) >= 90 ? 'success' : (data.kpi_cards?.total_profit_rate || 0) >= 60 ? 'warning' : 'error',
      icon: <DollarOutlined style={{ fontSize: 20, color: '#16A34A' }} />,
    },
    {
      title: '拓展组 GMV',
      value: `${data.kpi_cards?.expand_gmv_rate || 0}%`,
      suffix: '完成率',
      hint: `目标 ${(data.kpi_cards?.expand_gmv_target || 0).toLocaleString()} 万 · 实际 ${(data.kpi_cards?.expand_gmv_actual || 0).toLocaleString()} 万`,
      status: (data.kpi_cards?.expand_gmv_rate || 0) >= 90 ? 'success' : (data.kpi_cards?.expand_gmv_rate || 0) >= 60 ? 'warning' : 'error',
      icon: <FundOutlined style={{ fontSize: 20, color: '#7C3AED' }} />,
    },
    {
      title: '运营组 GMV',
      value: `${data.kpi_cards?.ops_gmv_rate || 0}%`,
      suffix: '完成率',
      hint: `目标 ${(data.kpi_cards?.ops_gmv_target || 0).toLocaleString()} 万 · 实际 ${(data.kpi_cards?.ops_gmv_actual || 0).toLocaleString()} 万`,
      status: (data.kpi_cards?.ops_gmv_rate || 0) >= 90 ? 'success' : (data.kpi_cards?.ops_gmv_rate || 0) >= 60 ? 'warning' : 'error',
      icon: <RiseOutlined style={{ fontSize: 20, color: '#0891B2' }} />,
    },
  ];

  // 季度对比柱状图（仅全年模式）
  const quarterChartOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['拓展组', '运营组'], bottom: 0, textStyle: { fontSize: 12 } },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4'], axisLabel: { fontSize: 12 } },
    yAxis: { type: 'value', name: '万元', nameTextStyle: { fontSize: 11 }, axisLabel: { fontSize: 11 } },
    series: [
      { name: '拓展组', type: 'bar', data: (data.quarter_comparison || []).map(q => q.expand_gmv_actual), itemStyle: { color: '#7C3AED', borderRadius: [4, 4, 0, 0] }, barWidth: '28%' },
      { name: '运营组', type: 'bar', data: (data.quarter_comparison || []).map(q => q.ops_gmv_actual), itemStyle: { color: '#0891B2', borderRadius: [4, 4, 0, 0] }, barWidth: '28%' },
    ]
  };

  // 工作状态分布饼图
  const statusChartOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c}个 ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [{
      name: '状态',
      type: 'pie',
      radius: ['42%', '72%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{c}个', fontSize: 12 },
      data: (data.project_status_distribution || []).map(item => ({
        name: item.status,
        value: item.count,
        itemStyle: {
          color: item.status === '完成' ? '#16A34A' :
                 item.status === '进行中' ? '#3B5AFB' :
                 item.status === '风险' ? '#DC2626' : '#9CA3AF'
        }
      }))
    }]
  };

  const recentColumns = [
    { title: '项目名称', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '部门', dataIndex: ['Department', 'name'], key: 'dept', width: 80 },
    { title: '负责人', dataIndex: 'owner_name', key: 'owner', width: 80 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (s) => (
      <Tag color={s === '完成' ? 'success' : s === '风险' ? 'error' : s === '进行中' ? 'processing' : 'default'}>{s}</Tag>
    )},
    { title: '进度', dataIndex: 'progress_pct', key: 'progress', width: 70, render: (p) => `${p}%` },
    { title: '更新', dataIndex: 'updated_at', key: 'updated', width: 90, render: (t) => moment(t).format('MM-DD HH:mm') }
  ];

  const dueSoonColumns = [
    { title: '项目名称', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '部门', dataIndex: ['Department', 'name'], key: 'dept', width: 80 },
    { title: '到期日', dataIndex: 'due_date', key: 'due', width: 100 },
    { title: '剩余', dataIndex: 'days_until', key: 'days', width: 70, render: (d) => <Tag color="warning">{d}天</Tag> }
  ];

  return (
    <div className="app-page">
      {/* 摘要头部 */}
      <PageHeader
        title="增长业务驾驶舱"
        subtitle={`${data.current_year}年 · ${modeLabel} · 聚焦目标达成、重点项目推进与近期风险变化`}
        extra={[
          <Segmented
            key="mode"
            value={viewMode}
            onChange={(v) => setViewMode(v)}
            options={[
              { label: `${data.current_quarter} 季度`, value: 'quarter' },
              { label: '全年累计', value: 'year' },
            ]}
          />,
          <Button key="report" type="primary" icon={<FileTextOutlined />} onClick={handleGenerateReport}>
            生成周报
          </Button>,
        ]}
      />

      {/* 风险提示条 */}
      {riskCount > 0 && (
        <div style={{
          marginBottom: 20,
          padding: '10px 20px',
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <AlertOutlined style={{ fontSize: 18, color: '#DC2626' }} />
          <span style={{ fontSize: 14, color: '#991B1B' }}>
            当前有 <strong>{riskCount}</strong> 个风险项目需要关注
          </span>
          <Button type="link" size="small" onClick={() => navigate('/projects')} style={{ padding: 0, height: 'auto', fontWeight: 600 }}>
            立即查看 →
          </Button>
        </div>
      )}

      {/* KPI 指标行 — 白底克制 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {kpiCards.map((card, idx) => (
          <Col xs={24} sm={12} xl={6} key={idx}>
            <Card className="surface-card hover-lift" bodyStyle={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div className="metric-label">{card.title}</div>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: '#F5F7FB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {card.icon}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                <span className="metric-value">{card.value}</span>
                <span className="subtle-text" style={{ fontSize: 13 }}>{card.suffix}</span>
              </div>
              <Progress
                percent={Math.min(parseFloat(card.value), 100)}
                strokeColor={card.status === 'success' ? '#16A34A' : card.status === 'warning' ? '#F59E0B' : '#DC2626'}
                trailColor="#F1F5F9"
                showInfo={false}
                strokeWidth={6}
                style={{ marginBottom: 10 }}
              />
              <div className="subtle-text" style={{ fontSize: 12 }}>{card.hint}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 今日变化 + 本周关注（双列） */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <PanelCard
            title={<span><ClockCircleOutlined style={{ color: '#3B5AFB', marginRight: 8 }} />今日变化</span>}
            extra={data.today_changes?.length > 0 && <span className="subtle-text" style={{ fontSize: 12 }}>{data.today_changes.length} 条</span>}
          >
            {(!data.today_changes || data.today_changes.length === 0) ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>
                <ClockCircleOutlined style={{ fontSize: 28, marginBottom: 8, display: 'block', opacity: 0.4 }} />
                <div style={{ fontSize: 13 }}>今日暂无数据变更</div>
              </div>
            ) : (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {data.today_changes.slice(0, 15).map((c, idx) => {
                  const tableLabel = { projects: '项目', kpis: '指标', performances: '业绩', monthly_tasks: '月度', achievements: '成果' }[c.table_name] || c.table_name;
                  const actionConfig = { create: { label: '新增', color: '#16A34A', tag: 'success' }, update: { label: '更新', color: '#3B5AFB', tag: 'processing' }, delete: { label: '删除', color: '#DC2626', tag: 'error' } }[c.action] || { label: c.action, color: '#9CA3AF', tag: 'default' };
                  return (
                    <div key={c.id || idx} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '8px 0', borderBottom: idx < Math.min(data.today_changes.length, 15) - 1 ? '1px solid #F1F5F9' : 'none'
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: actionConfig.color, marginTop: 7, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: '#111827', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Tag color={actionConfig.tag} style={{ margin: 0, fontSize: 11, lineHeight: '18px', padding: '0 4px' }}>{actionConfig.label}</Tag>
                          <span>{tableLabel}</span>
                          {c.operator_name && <span className="subtle-text" style={{ marginLeft: 4 }}>by {c.operator_name}</span>}
                        </div>
                        <div className="subtle-text" style={{ fontSize: 11, marginTop: 2 }}>{moment(c.created_at).format('HH:mm')}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </PanelCard>
        </Col>
        <Col xs={24} lg={12}>
          <PanelCard
            title={<span><AlertOutlined style={{ color: '#F59E0B', marginRight: 8 }} />本周关注</span>}
            extra={data.week_focus?.length > 0 && <span className="subtle-text" style={{ fontSize: 12 }}>{data.week_focus.reduce((s, f) => s + f.count, 0)} 项</span>}
          >
            {(!data.week_focus || data.week_focus.length === 0) ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#9CA3AF' }}>
                <AlertOutlined style={{ fontSize: 28, marginBottom: 8, display: 'block', opacity: 0.4 }} />
                <div style={{ fontSize: 13 }}>本周暂无特别关注事项</div>
              </div>
            ) : (
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {data.week_focus.map((f, idx) => {
                  const iconMap = { due_soon: '⏰', risk: '🔴', stale: '💤', deviation: '📉' };
                  const bgMap = { due_soon: '#FFFBEB', risk: '#FEF2F2', stale: '#F9FAFB', deviation: '#F5F3FF' };
                  return (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', marginBottom: idx < data.week_focus.length - 1 ? 8 : 0,
                      background: bgMap[f.type] || '#F9FAFB', borderRadius: 8
                    }}>
                      <span style={{ fontSize: 18, flexShrink: 0 }}>{iconMap[f.type] || '📌'}</span>
                      <div style={{ flex: 1, fontSize: 13, color: '#111827', fontWeight: 500 }}>{f.text}</div>
                      <Tag color={f.type === 'risk' ? 'error' : f.type === 'due_soon' ? 'warning' : 'default'} style={{ flexShrink: 0 }}>
                        {f.count}
                      </Tag>
                    </div>
                  );
                })}
              </div>
            )}
          </PanelCard>
        </Col>
      </Row>

      {/* 图表区 — 状态分布 + 趋势对比 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={viewMode === 'year' ? 12 : 14}>
          <PanelCard title="重点工作状态分布">
            <ReactECharts option={statusChartOption} style={{ height: 280 }} />
          </PanelCard>
        </Col>
        <Col xs={24} lg={viewMode === 'year' ? 12 : 10}>
          <PanelCard title={viewMode === 'year' ? '各季度 GMV 完成' : '核心指标完成概览'}>
            <ReactECharts
              option={viewMode === 'year' ? quarterChartOption : {
                tooltip: {},
                radar: {
                  indicator: [
                    { name: '部门GMV', max: 100 },
                    { name: '部门利润', max: 100 },
                    { name: '拓展GMV', max: 100 },
                    { name: '运营GMV', max: 100 },
                    { name: '拓展利润', max: 100 },
                    { name: '运营利润', max: 100 },
                  ],
                  shape: 'circle',
                  radius: '65%',
                },
                series: [{
                  type: 'radar',
                  data: [{
                    value: [
                      Math.min(data.kpi_cards?.total_gmv_rate || 0, 100),
                      Math.min(data.kpi_cards?.total_profit_rate || 0, 100),
                      Math.min(data.kpi_cards?.expand_gmv_rate || 0, 100),
                      Math.min(data.kpi_cards?.ops_gmv_rate || 0, 100),
                      Math.min(data.kpi_cards?.expand_profit_rate || 0, 100),
                      Math.min(data.kpi_cards?.ops_profit_rate || 0, 100),
                    ],
                    name: '完成率 %',
                    areaStyle: { color: 'rgba(59, 90, 251, 0.12)' },
                    lineStyle: { color: '#3B5AFB', width: 2 },
                    itemStyle: { color: '#3B5AFB' }
                  }]
                }]
              }}
              style={{ height: 280 }}
            />
          </PanelCard>
        </Col>
      </Row>

      {/* 行动列表区 — 风险项目 + 即将到期 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <PanelCard
            title={<span><AlertOutlined style={{ color: '#DC2626', marginRight: 8 }} />高风险项目</span>}
            extra={<Button type="link" size="small" onClick={() => navigate('/projects')}>查看全部</Button>}
          >
            {(data.recent_projects || []).filter(p => p.status === '风险').slice(0, 5).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>暂无风险项目 ✌️</div>
            ) : (
              <Table
                dataSource={(data.recent_projects || []).filter(p => p.status === '风险').slice(0, 5)}
                columns={recentColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            )}
          </PanelCard>
        </Col>
        <Col xs={24} lg={12}>
          <PanelCard
            title={<span><ClockCircleOutlined style={{ color: '#F59E0B', marginRight: 8 }} />7天内到期</span>}
            extra={<Button type="link" size="small" onClick={() => navigate('/projects')}>查看全部</Button>}
          >
            {(data.due_soon_projects || []).length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>暂无即将到期项目</div>
            ) : (
              <Table
                dataSource={(data.due_soon_projects || []).slice(0, 5)}
                columns={dueSoonColumns}
                rowKey="id"
                pagination={false}
                size="small"
              />
            )}
          </PanelCard>
        </Col>
      </Row>
    </div>
  );
}

export default DashboardPage;
