import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Modal, Form, Input, InputNumber, Select, message, Tag, Progress, Drawer, Descriptions, Table, Tabs } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, FundOutlined, RiseOutlined, DollarOutlined, TeamOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { api, useAuth } from '../hooks/useAuth';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import PerformancePage from './PerformancePage';

const { Option } = Select;

function KpiPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [form] = Form.useForm();
  const { isAdmin, isDeptManager, user } = useAuth();

  const now = new Date();
  const currentQuarter = now.getMonth() < 3 ? 'Q1' : now.getMonth() < 6 ? 'Q2' : now.getMonth() < 9 ? 'Q3' : 'Q4';
  const [filters, setFilters] = useState({ quarter: currentQuarter, year: now.getFullYear() });
  const [performances, setPerformances] = useState([]);
  const [mainTab, setMainTab] = useState('kpi');

  useEffect(() => { fetchData(); fetchPerformances(); }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/kpis', { params: filters });
      if (res.code === 0) setData(res.data);
    } catch (err) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPerformances = async () => {
    try {
      const res = await api.get('/performances');
      if (res.code === 0) setPerformances(res.data);
    } catch (err) { /* 静默处理 */ }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingRecord) { await api.put(`/kpis/${editingRecord.id}`, values); message.success('更新成功'); }
      else { await api.post('/kpis', values); message.success('创建成功'); }
      setModalVisible(false); setEditingRecord(null); form.resetFields(); fetchData();
    } catch (err) { message.error('操作失败'); }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/kpis/${id}`); message.success('删除成功'); fetchData(); }
    catch (err) { message.error('删除失败'); }
  };

  const showDetail = (record) => { setDetailRecord(record); setDrawerVisible(true); };

  const getCompletionColor = (rate) => {
    if (rate >= 90) return '#52c41a';
    if (rate >= 60) return '#faad14';
    return '#ff4d4f';
  };

  // 按部门和指标分组
  const grouped = {};
  data.forEach(item => {
    const dept = item.Department?.name || '未知';
    if (!grouped[dept]) grouped[dept] = [];
    grouped[dept].push(item);
  });

  // 指标卡片颜色
  const indicatorColors = {
    'GMV': { color: '#1677ff', gradient: 'linear-gradient(135deg, #1677ff 0%, #4096ff 100%)', icon: <FundOutlined /> },
    '净利润': { color: '#eb2f96', gradient: 'linear-gradient(135deg, #eb2f96 0%, #f759ab 100%)', icon: <DollarOutlined /> },
    '新客数': { color: '#722ed1', gradient: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)', icon: <TeamOutlined /> },
    '客单价': { color: '#13c2c2', gradient: 'linear-gradient(135deg, #13c2c2 0%, #36cfc9 100%)', icon: <RiseOutlined /> },
  };
  const defaultColor = { color: '#fa8c16', gradient: 'linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)', icon: <FundOutlined /> };

  // 按指标名分组生成独立柱状图
  const getBarOptionByIndicator = (indicatorName, items) => {
    const cfg = indicatorColors[indicatorName] || defaultColor;
    const unit = items[0]?.unit || '';
    return {
      title: {
        text: `${indicatorName} · 目标 vs 实际`,
        left: 'center',
        textStyle: { fontSize: 14, fontWeight: 600 },
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          let s = `${params[0].axisValue}<br/>`;
          params.forEach(p => {
            s += `${p.marker}${p.seriesName}: ${Number(p.value).toLocaleString()} ${unit}<br/>`;
          });
          return s;
        },
      },
      legend: { data: ['目标', '实际'], bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 50, right: 16, top: 40, bottom: 36 },
      xAxis: {
        type: 'category',
        data: items.map(d => d.Department?.name || '-'),
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        name: unit,
        nameTextStyle: { fontSize: 11 },
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          name: '目标',
          type: 'bar',
          data: items.map(d => parseFloat(d.target)),
          itemStyle: { color: '#bfbfbf', borderRadius: [4, 4, 0, 0] },
          barWidth: '30%',
          barGap: '20%',
        },
        {
          name: '实际',
          type: 'bar',
          data: items.map(d => parseFloat(d.actual)),
          itemStyle: {
            color: (params) => getCompletionColor(items[params.dataIndex]?.completion_rate || 0),
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: '30%',
        },
      ],
    };
  };

  // 按指标名分组
  const indicatorGroups = {};
  data.forEach(item => {
    const name = item.indicator_name;
    if (!indicatorGroups[name]) indicatorGroups[name] = [];
    indicatorGroups[name].push(item);
  });

  // 单个指标仪表盘配置
  const getGaugeOption = (item) => ({
    series: [{
      type: 'gauge',
      center: ['50%', '55%'],
      radius: '85%',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 120,
      detail: {
        formatter: '{value}%',
        fontSize: 18,
        fontWeight: 700,
        color: getCompletionColor(item.completion_rate),
        offsetCenter: [0, '72%'],
      },
      data: [{ value: item.completion_rate }],
      axisLine: {
        lineStyle: {
          width: 10,
          color: [[0.6, '#ff4d4f'], [0.8, '#faad14'], [1, '#52c41a']],
        }
      },
      pointer: { width: 4, length: '60%' },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      title: { show: false },
    }]
  });

  return (
    <div className="app-page">
      <PageHeader title="指标与目标" subtitle="核心指标 + 业务线业绩统一管理中心" />
      <Tabs
        activeKey={mainTab}
        onChange={setMainTab}
        style={{ marginBottom: 16 }}
        items={[
          { key: 'kpi', label: '核心指标' },
          { key: 'performance', label: '业务线业绩' },
        ]}
      />
      {mainTab === 'performance' ? <PerformancePage /> : (
      <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>核心指标管理</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Select value={filters.quarter} onChange={(v) => setFilters({ ...filters, quarter: v })} style={{ width: 100 }}>
            <Option value="Q1">Q1</Option><Option value="Q2">Q2</Option><Option value="Q3">Q3</Option><Option value="Q4">Q4</Option>
          </Select>
          <InputNumber value={filters.year} onChange={(v) => setFilters({ ...filters, year: v })} style={{ width: 100 }} />
          {isDeptManager && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setModalVisible(true); }}>
              新增指标
            </Button>
          )}
        </div>
      </div>

      {/* 指标卡片 - 按部门分组 */}
      {Object.keys(grouped).length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#bfbfbf' }}>暂无指标数据，请先录入</div>
      )}
      {Object.entries(grouped).map(([dept, items]) => {
        return (
        <div key={dept} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#262626', marginBottom: 12, paddingBottom: 8, borderBottom: '2px solid #1677ff', display: 'inline-block' }}>
            {dept}
          </div>
          <Row gutter={[16, 16]}>
            {items.map(item => {
              const cfg = indicatorColors[item.indicator_name] || defaultColor;
              return (
                <Col xs={24} sm={12} md={8} lg={6} key={item.id}>
                  <Card
                    hoverable
                    style={{ borderRadius: 12, overflow: 'hidden', border: 'none', height: '100%' }}
                    bodyStyle={{ padding: 0, display: 'flex', flexDirection: 'column', height: '100%' }}
                    onClick={() => showDetail(item)}
                  >
                    {/* 渐变头部 */}
                    <div style={{ background: cfg.gradient, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                      <span style={{ color: '#fff', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{item.indicator_name}</span>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, flexShrink: 0 }}>
                        {cfg.icon}
                      </div>
                    </div>
                    {/* 数据区 */}
                    <div style={{ padding: '14px 16px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      {/* 完成率 + 状态标签 */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 26, fontWeight: 700, color: getCompletionColor(item.completion_rate), lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                            {item.completion_rate}%
                          </span>
                          <span style={{
                            fontSize: 11,
                            padding: '1px 6px',
                            borderRadius: 4,
                            flexShrink: 0,
                            lineHeight: '18px',
                            background: item.completion_rate >= 90 ? '#f6ffed' : item.completion_rate >= 60 ? '#fffbe6' : '#fff2f0',
                            color: item.completion_rate >= 90 ? '#52c41a' : item.completion_rate >= 60 ? '#faad14' : '#ff4d4f',
                          }}>
                            {item.completion_rate >= 90 ? '达标' : item.completion_rate >= 60 ? '追赶' : '落后'}
                          </span>
                        </div>
                        <Progress percent={Math.min(item.completion_rate, 100)} strokeColor={getCompletionColor(item.completion_rate)} trailColor="#f0f0f0" showInfo={false} strokeWidth={6} />
                      </div>
                      {/* 目标/实际值 - 上下排列避免遮挡 */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: '#8c8c8c', flexShrink: 0 }}>目标</span>
                          <span style={{ fontSize: 15, fontWeight: 600, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{Number(item.target).toLocaleString()}</span>
                          <span style={{ fontSize: 11, color: '#8c8c8c', flexShrink: 0 }}>{item.unit}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 11, color: '#8c8c8c', flexShrink: 0 }}>实际</span>
                          <span style={{ fontSize: 15, fontWeight: 600, color: cfg.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{Number(item.actual).toLocaleString()}</span>
                          <span style={{ fontSize: 11, color: '#8c8c8c', flexShrink: 0 }}>{item.unit}</span>
                        </div>
                      </div>
                      {isDeptManager && (
                        <div style={{ marginTop: 10, display: 'flex', gap: 8, borderTop: '1px solid #f5f5f5', paddingTop: 10 }}>
                          <Button size="small" type="link" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>编辑</Button>
                          <Button size="small" type="link" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}>删除</Button>
                        </div>
                      )}
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </div>
        );
      })}

      {/* 图表区 - 按指标分组，每个指标一个独立可视化卡片 */}
      {data.length > 0 && (
        <>
          <div style={{ marginTop: 24, marginBottom: 12, fontSize: 15, fontWeight: 600, color: '#262626' }}>
            指标可视化
          </div>
          <Row gutter={[16, 16]}>
            {Object.entries(indicatorGroups).map(([name, items]) => {
              const cfg = indicatorColors[name] || defaultColor;
              const avgRate = items.reduce((s, d) => s + d.completion_rate, 0) / items.length;
              return (
                <Col xs={24} sm={12} lg={8} key={name}>
                  <Card
                    style={{ borderRadius: 12 }}
                    bodyStyle={{ padding: '12px 12px 8px' }}
                  >
                    {/* 指标标题行 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ width: 4, height: 16, borderRadius: 2, background: cfg.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#262626' }}>{name}</span>
                      <span style={{
                        fontSize: 11, padding: '1px 6px', borderRadius: 4, marginLeft: 'auto',
                        background: avgRate >= 90 ? '#f6ffed' : avgRate >= 60 ? '#fffbe6' : '#fff2f0',
                        color: avgRate >= 90 ? '#52c41a' : avgRate >= 60 ? '#faad14' : '#ff4d4f',
                      }}>
                        均值 {avgRate.toFixed(0)}%
                      </span>
                    </div>
                    <ReactECharts option={getBarOptionByIndicator(name, items)} style={{ height: 200 }} />
                  </Card>
                </Col>
              );
            })}
          </Row>

          {/* 完成率仪表盘 */}
          <div style={{ marginTop: 20, marginBottom: 8, fontSize: 15, fontWeight: 600, color: '#262626' }}>
            各项指标完成率
          </div>
          <Row gutter={[12, 12]}>
            {data.map(item => {
              const cfg = indicatorColors[item.indicator_name] || defaultColor;
              return (
                <Col xs={8} sm={6} md={4} lg={3} key={item.id}>
                  <Card
                    style={{ borderRadius: 12, textAlign: 'center' }}
                    bodyStyle={{ padding: '8px 4px 6px' }}
                    hoverable
                    onClick={() => showDetail(item)}
                  >
                    <ReactECharts option={getGaugeOption(item)} style={{ height: 110 }} />
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.Department?.name}·{item.indicator_name}
                    </div>
                    <div style={{ fontSize: 10, color: '#8c8c8c' }}>
                      {Number(item.actual).toLocaleString()}/{Number(item.target).toLocaleString()}
                    </div>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </>
      )}



      {/* 详情抽屉 */}
      <Drawer
        title={detailRecord ? `${detailRecord.Department?.name} · ${detailRecord.indicator_name}` : '指标详情'}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setDetailRecord(null); }}
        width={480}
        extra={isDeptManager && detailRecord ? (
          <Button type="primary" icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit(detailRecord); }}>编辑</Button>
        ) : null}
      >
        {detailRecord && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Progress
                type="dashboard"
                percent={Math.min(detailRecord.completion_rate, 100)}
                strokeColor={getCompletionColor(detailRecord.completion_rate)}
                format={() => `${detailRecord.completion_rate}%`}
                size={160}
              />
              <div style={{ marginTop: 12, fontSize: 16, fontWeight: 600, color: getCompletionColor(detailRecord.completion_rate) }}>
                {detailRecord.completion_rate >= 90 ? '✓ 已达标' : detailRecord.completion_rate >= 60 ? '⚡ 追赶中' : '⚠ 落后'}
              </div>
            </div>
            <Descriptions column={1} bordered size="small" labelStyle={{ fontWeight: 600, background: '#fafafa', width: 100 }}>
              <Descriptions.Item label="部门">{detailRecord.Department?.name}</Descriptions.Item>
              <Descriptions.Item label="指标">{detailRecord.indicator_name}</Descriptions.Item>
              <Descriptions.Item label="季度">{detailRecord.quarter}</Descriptions.Item>
              <Descriptions.Item label="目标值">{Number(detailRecord.target).toLocaleString()} {detailRecord.unit}</Descriptions.Item>
              <Descriptions.Item label="完成值">{Number(detailRecord.actual).toLocaleString()} {detailRecord.unit}</Descriptions.Item>
              <Descriptions.Item label="差距">{(parseFloat(detailRecord.actual) - parseFloat(detailRecord.target)).toLocaleString(undefined, { maximumFractionDigits: 2 })} {detailRecord.unit}</Descriptions.Item>
              <Descriptions.Item label="完成率">
                <span style={{ color: getCompletionColor(detailRecord.completion_rate), fontWeight: 600 }}>{detailRecord.completion_rate}%</span>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>

      {/* 编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑指标' : '新增指标'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => { setModalVisible(false); setEditingRecord(null); }}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dept_id" label="部门" rules={[{ required: true }]} initialValue={1}>
                <Select><Option value={1}>拓展组</Option><Option value={2}>运营组</Option></Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="quarter" label="季度" rules={[{ required: true }]} initialValue={currentQuarter}>
                <Select><Option value="Q1">Q1</Option><Option value="Q2">Q2</Option><Option value="Q3">Q3</Option><Option value="Q4">Q4</Option></Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="indicator_name" label="指标名" rules={[{ required: true }]}>
            <Input placeholder="如：GMV、净利润" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="target" label="目标值" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} placeholder="目标值" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="actual" label="完成值" rules={[{ required: true }]}>
                <InputNumber style={{ width: '100%' }} placeholder="完成值" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="unit" label="单位" initialValue="万元">
            <Input placeholder="如：万元、个、%" />
          </Form.Item>
        </Form>
      </Modal>
      </>)}
    </div>
  );
}

export default KpiPage;
