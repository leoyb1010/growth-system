import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Table, Tag, Button, message, Progress, Segmented } from 'antd';
import { WarningOutlined, FileTextOutlined, FundOutlined, RiseOutlined, DollarOutlined, TeamOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../hooks/useAuth';
import moment from 'moment';

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

  // 四张核心卡片配置
  const kpiCards = [
    {
      title: '部门 GMV',
      subtitle: '拓展+运营合计',
      icon: <TeamOutlined style={{ fontSize: 26, color: '#fff' }} />,
      rate: data.kpi_cards?.total_gmv_rate || 0,
      target: data.kpi_cards?.total_gmv_target || 0,
      actual: data.kpi_cards?.total_gmv_actual || 0,
      color: '#1677ff',
      gradient: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)',
    },
    {
      title: '部门利润',
      subtitle: '拓展+运营合计',
      icon: <DollarOutlined style={{ fontSize: 26, color: '#fff' }} />,
      rate: data.kpi_cards?.total_profit_rate || 0,
      target: data.kpi_cards?.total_profit_target || 0,
      actual: data.kpi_cards?.total_profit_actual || 0,
      color: '#eb2f96',
      gradient: 'linear-gradient(135deg, #eb2f96 0%, #f759ab 100%)',
    },
    {
      title: '拓展组 GMV',
      subtitle: '拓展部门',
      icon: <FundOutlined style={{ fontSize: 26, color: '#fff' }} />,
      rate: data.kpi_cards?.expand_gmv_rate || 0,
      target: data.kpi_cards?.expand_gmv_target || 0,
      actual: data.kpi_cards?.expand_gmv_actual || 0,
      color: '#722ed1',
      gradient: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
    },
    {
      title: '运营组 GMV',
      subtitle: '运营部门',
      icon: <RiseOutlined style={{ fontSize: 26, color: '#fff' }} />,
      rate: data.kpi_cards?.ops_gmv_rate || 0,
      target: data.kpi_cards?.ops_gmv_target || 0,
      actual: data.kpi_cards?.ops_gmv_actual || 0,
      color: '#13c2c2',
      gradient: 'linear-gradient(135deg, #13c2c2 0%, #36cfc9 100%)',
    },
  ];

  // 季度对比柱状图（全年模式显示）
  const quarterChartOption = {
    title: { text: '各季度 GMV 完成', left: 'center', textStyle: { fontSize: 15 } },
    tooltip: { trigger: 'axis' },
    legend: { data: ['拓展组', '运营组'], bottom: 0 },
    grid: { left: 50, right: 20, top: 40, bottom: 40 },
    xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4'] },
    yAxis: { type: 'value', name: '万元' },
    series: [
      {
        name: '拓展组',
        type: 'bar',
        data: (data.quarter_comparison || []).map(q => q.expand_gmv_actual),
        itemStyle: { color: '#722ed1', borderRadius: [4, 4, 0, 0] },
        barWidth: '30%',
      },
      {
        name: '运营组',
        type: 'bar',
        data: (data.quarter_comparison || []).map(q => q.ops_gmv_actual),
        itemStyle: { color: '#13c2c2', borderRadius: [4, 4, 0, 0] },
        barWidth: '30%',
      }
    ]
  };

  // 指标对比雷达图
  const radarOption = {
    title: { text: '核心指标完成概览', left: 'center', textStyle: { fontSize: 15 } },
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
        areaStyle: { color: 'rgba(22, 119, 255, 0.15)' },
        lineStyle: { color: '#1677ff', width: 2 },
        itemStyle: { color: '#1677ff' }
      }]
    }]
  };

  // 工作状态分布饼图
  const statusChartOption = {
    title: { text: '重点工作状态分布', left: 'center', textStyle: { fontSize: 15 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c}个 ({d}%)' },
    legend: { bottom: 0 },
    series: [{
      name: '状态',
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{c}个' },
      data: (data.project_status_distribution || []).map(item => ({
        name: item.status,
        value: item.count,
        itemStyle: {
          color: item.status === '完成' ? '#52c41a' :
                 item.status === '进行中' ? '#1677ff' :
                 item.status === '风险' ? '#ff4d4f' : '#bfbfbf'
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
    <div>
      {/* 顶部栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>仪表盘</h2>
          <p style={{ margin: '4px 0 0 0', color: '#8c8c8c', fontSize: 14 }}>
            {data.current_year}年 · {modeLabel} · 实时数据概览
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Segmented
            value={viewMode}
            onChange={(v) => setViewMode(v)}
            options={[
              { label: `${data.current_quarter} 季度`, value: 'quarter' },
              { label: '全年累计', value: 'year' },
            ]}
          />
          <Button type="primary" icon={<FileTextOutlined />} onClick={handleGenerateReport}>
            生成周报
          </Button>
        </div>
      </div>

      {/* 四张核心指标卡片 - 大卡片 */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {kpiCards.map((card, idx) => (
          <Col xs={24} sm={12} xl={6} key={idx}>
            <Card
              style={{ borderRadius: 16, overflow: 'hidden', border: 'none' }}
              bodyStyle={{ padding: 0 }}
            >
              {/* 顶部渐变头部 */}
              <div style={{
                background: card.gradient,
                padding: '20px 24px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{card.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{card.subtitle}</div>
                </div>
                <div style={{
                  width: 46, height: 46, borderRadius: 12,
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {card.icon}
                </div>
              </div>
              {/* 数据区 */}
              <div style={{ padding: '18px 24px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 8 }}>
                  <span style={{ fontSize: 36, fontWeight: 700, color: card.color, lineHeight: 1, whiteSpace: 'nowrap' }}>
                    {card.rate}%
                  </span>
                  <span style={{
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontWeight: 600,
                    flexShrink: 0,
                    background: card.rate >= 90 ? '#f6ffed' : card.rate >= 60 ? '#fffbe6' : '#fff2f0',
                    color: card.rate >= 90 ? '#52c41a' : card.rate >= 60 ? '#faad14' : '#ff4d4f',
                  }}>
                    {card.rate >= 90 ? '✓ 达标' : card.rate >= 60 ? '⚡ 追赶中' : '⚠ 落后'}
                  </span>
                </div>
                <Progress
                  percent={Math.min(card.rate, 100)}
                  strokeColor={card.color}
                  trailColor="#f0f0f0"
                  showInfo={false}
                  strokeWidth={8}
                  style={{ marginBottom: 12 }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ textAlign: 'center', flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>目标</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{Number(card.target).toLocaleString()}<span style={{ fontSize: 12, color: '#8c8c8c' }}> 万</span></div>
                  </div>
                  <div style={{ width: 1, background: '#f0f0f0' }} />
                  <div style={{ textAlign: 'center', flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>实际</div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: card.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{Number(card.actual).toLocaleString()}<span style={{ fontSize: 12, color: '#8c8c8c' }}> 万</span></div>
                  </div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 风险项目提醒 */}
      {(data.kpi_cards?.risk_project_count || 0) > 0 && (
        <Card
          style={{ marginBottom: 24, background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 12 }}
          bodyStyle={{ padding: '12px 20px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <WarningOutlined style={{ fontSize: 20, color: '#ff4d4f' }} />
            <span style={{ fontSize: 15, color: '#cf1322', fontWeight: 500 }}>
              当前有 <strong>{data.kpi_cards.risk_project_count}</strong> 个风险项目需要关注，
              <Button type="link" size="small" onClick={() => navigate('/projects')} style={{ padding: 0, height: 'auto' }}>立即查看</Button>
            </span>
          </div>
        </Card>
      )}

      {/* 图表区 */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {viewMode === 'year' && (
          <Col xs={24} lg={8}>
            <Card style={{ borderRadius: 12 }}>
              <ReactECharts option={quarterChartOption} style={{ height: 300 }} />
            </Card>
          </Col>
        )}
        <Col xs={24} lg={viewMode === 'year' ? 8 : 12}>
          <Card style={{ borderRadius: 12 }}>
            <ReactECharts option={radarOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col xs={24} lg={viewMode === 'year' ? 8 : 12}>
          <Card style={{ borderRadius: 12 }}>
            <ReactECharts option={statusChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
      </Row>

      {/* 列表区 */}
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={12}>
          <Card title="最近更新项目 (Top 10)" style={{ borderRadius: 12 }}>
            <Table
              dataSource={data.recent_projects || []}
              columns={recentColumns}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="即将到期项目 (7天内)" style={{ borderRadius: 12 }}>
            <Table
              dataSource={data.due_soon_projects || []}
              columns={dueSoonColumns}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default DashboardPage;
