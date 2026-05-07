import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, DatePicker, Select, Spin, Empty, Space, Divider } from 'antd';
import { DollarOutlined, TeamOutlined, AlertOutlined, FallOutlined, RiseOutlined, FileTextOutlined, UserAddOutlined, SyncOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { cpsApi, cpsBus } from '../../services/cpsService';
import dayjs from 'dayjs';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

function fmt(v) {
  const n = Number(v || 0);
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1) + '万';
  return Number(n.toFixed(0)).toLocaleString();
}

function CpsDashboardTab({ channelId }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [range, setRange] = useState(null);
  const [channels, setChannels] = useState([]);
  const [products, setProducts] = useState([]);
  const [selChannels, setSelChannels] = useState(channelId ? [channelId] : []);
  const [selProducts, setSelProducts] = useState([]);

  useEffect(() => {
    cpsApi.getChannels().then(r => { if (r.code === 0) setChannels(r.data || []); }).catch(() => {});
    cpsApi.getProducts().then(r => { if (r.code === 0) setProducts(r.data || []); }).catch(() => {});
  }, []);

  useEffect(() => { fetchData(); }, [range, selChannels, selProducts]);
  useEffect(() => { const off = cpsBus.on((e) => { if (e === 'metrics:changed') fetchData(); }); return off; }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (range?.[0] && range?.[1]) { params.start_date = range[0].format('YYYY-MM-DD'); params.end_date = range[1].format('YYYY-MM-DD'); }
      if (selChannels.length) params.channel_ids = selChannels.join(',');
      if (selProducts.length) params.product_ids = selProducts.join(',');
      const res = await cpsApi.getDashboard(params);
      if (res.code === 0) setData(res.data);
    } catch {} finally { setLoading(false); }
  };

  if (!data && !loading) return <Empty description="暂无数据" />;

  const y = data?.yearly || {}, q = data?.quarterly || {}, d = data?.daily || {};
  const chartOption = data?.trend?.length ? (() => {
    const dates = data.trend.map(t => t.date.slice(5));
    const step = Math.max(1, Math.floor(dates.length / 10));
    return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, data: ['实际收入', '新签', '续费'] },
    grid: { left: 60, right: 20, top: 10, bottom: 35 },
    xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10, interval: step, rotate: 30 } },
    yAxis: { type: 'value', axisLabel: { formatter: v => (v/10000).toFixed(0)+'万' }, splitLine: { lineStyle: { type: 'dashed', color: '#eee' } } },
    series: [
      { name: '实际收入', type: 'line', data: data.trend.map(t => t.amount), smooth: true, symbol: 'none', lineStyle: { width: 2, color: '#1890ff' }, areaStyle: { color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'rgba(24,144,255,0.3)'},{offset:1,color:'rgba(24,144,255,0.02)'}]) } },
      { name: '新签', type: 'line', data: data.trend.map(t => t.new_sign), smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#52c41a' } },
      { name: '续费', type: 'line', data: data.trend.map(t => t.renewal), smooth: true, symbol: 'none', lineStyle: { width: 1.5, color: '#faad14' } },
    ],
  };
  })() : null;

  const cardStyle = (color) => ({ textAlign: 'center', padding: '6px 8px', background: '#fafafa', borderRadius: 6 });
  const st = (v) => ({ fontSize: 20, fontWeight: 700, color: v > 0 ? '#1890ff' : '#999' });

  return (
    <Spin spinning={loading}>
      <Space wrap style={{ marginBottom: 12 }}>
        <DatePicker.RangePicker value={range} onChange={setRange} allowClear placeholder={['开始','结束']} size="small" />
        {!channelId && <Select mode="multiple" placeholder="渠道" allowClear size="small" value={selChannels} onChange={setSelChannels} style={{ minWidth: 140 }} maxTagCount={2}>{channels.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}</Select>}
        <Select mode="multiple" placeholder="产品" allowClear size="small" value={selProducts} onChange={setSelProducts} style={{ minWidth: 140 }} maxTagCount={2}>{products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select>
      </Space>

      {/* Row 1: 年度 */}
      <Card size="small" title={`📊 年度 · ${new Date().getFullYear()}`} style={{ marginBottom: 10 }}>
        <Row gutter={8}>
          <Col span={4}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>实际签约</div><div style={st(y.actual_count)}>{fmt(y.actual_count)}</div></div></Col>
          <Col span={5}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>实际收入</div><div style={{ fontSize: 20, fontWeight: 700, color: '#1890ff' }}>¥{fmt(y.actual_amount)}</div></div></Col>
          <Col span={4}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>新签退款</div><div style={{ fontSize: 20, fontWeight: 700, color: '#cf1322' }}>{fmt(y.new_refund)}</div></div></Col>
          <Col span={3}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>新签</div><div style={st(y.new_sign)}>{fmt(y.new_sign)}</div></div></Col>
          <Col span={3}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>续费</div><div style={st(y.renewal)}>{fmt(y.renewal)}</div></div></Col>
          <Col span={5}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>活跃渠道</div><div style={st(data?.channel_count)}>{data?.channel_count || 0}</div></div></Col>
        </Row>
      </Card>

      {/* Row 2: 当季 */}
      <Card size="small" title={`📅 当季 · Q${Math.ceil((new Date().getMonth()+1)/3)}`} style={{ marginBottom: 10 }}>
        <Row gutter={8}>
          <Col span={4}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>实际签约</div><div style={st(q.actual_count)}>{fmt(q.actual_count)}</div></div></Col>
          <Col span={4}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>实际收入</div><div style={{ fontSize: 18, fontWeight: 700, color: '#1890ff' }}>¥{fmt(q.actual_amount)}</div></div></Col>
          <Col span={3}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>新签退款</div><div style={{ fontSize: 18, fontWeight: 700, color: '#cf1322' }}>{fmt(q.new_refund)}</div></div></Col>
          <Col span={3}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>新签</div><div style={st(q.new_sign)}>{fmt(q.new_sign)}</div></div></Col>
          <Col span={3}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>续费</div><div style={st(q.renewal)}>{fmt(q.renewal)}</div></div></Col>
          <Col span={3}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>退款率</div><div style={{ fontSize: 18, fontWeight: 700, color: (q.refund_rate||0)>0.05?'#cf1322':'#3f8600' }}>{(Number(q.refund_rate||0)*100).toFixed(1)}%</div></div></Col>
          <Col span={4}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>预警</div><div style={{ fontSize: 18, fontWeight: 700, color: data?.alert_count>0?'#cf1322':'#3f8600' }}><AlertOutlined style={{marginRight:4}}/>{data?.alert_count||0}</div></div></Col>
        </Row>
      </Card>

      {/* Row 3: 昨日 */}
      <Card size="small" title={`📋 昨日 · ${dayjs().subtract(1,'day').format('MM-DD')}`} style={{ marginBottom: 10 }}>
        <Row gutter={8}>
          <Col span={4}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>实际签约</div><div style={st(d.actual_count)}>{fmt(d.actual_count)}</div></div></Col>
          <Col span={4}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>实际收入</div><div style={{ fontSize: 18, fontWeight: 700, color: '#1890ff' }}>¥{fmt(d.actual_amount)}</div></div></Col>
          <Col span={3}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>新签退款</div><div style={{ fontSize: 18, fontWeight: 700, color: '#cf1322' }}>{fmt(d.new_refund)}</div></div></Col>
          <Col span={3}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>新签</div><div style={st(d.new_sign)}>{fmt(d.new_sign)}</div></div></Col>
          <Col span={3}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>续费</div><div style={st(d.renewal)}>{fmt(d.renewal)}</div></div></Col>
          <Col span={3}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>客诉</div><div style={{ fontSize: 18, fontWeight: 700, color: d.complaints>0?'#cf1322':'#999' }}>{d.complaints||0}</div></div></Col>
          <Col span={4}><div style={cardStyle()}><div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>预警</div><div style={{ fontSize: 18, fontWeight: 700, color: data?.alert_count>0?'#cf1322':'#3f8600' }}><AlertOutlined style={{marginRight:4}}/>{data?.alert_count||0}</div></div></Col>
        </Row>
      </Card>

      {/* Trend */}
      {chartOption && (
        <Card size="small" title="📈 实际收入趋势">
          <ReactEChartsCore echarts={echarts} option={chartOption} style={{ height: 220 }} notMerge />
        </Card>
      )}
    </Spin>
  );
}

export default CpsDashboardTab;
