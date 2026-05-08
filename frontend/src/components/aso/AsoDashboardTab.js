import React, { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Statistic, DatePicker, Select, Spin, Empty, Space, Tag } from 'antd';
import { RiseOutlined, FallOutlined, TrophyOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { asoApi, asoBus } from '../../services/asoService';
import dayjs from 'dayjs';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '4px 0' }}>
      <div style={{ fontSize: 11, color: '#999' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: color || '#333', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function AsoDashboardTab() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [range, setRange] = useState([dayjs().subtract(7, 'day'), dayjs()]);
  const [products, setProducts] = useState([]);
  const [selProducts, setSelProducts] = useState([]);

  useEffect(() => {
    asoApi.getProducts().then(res => { if (res.code === 0) setProducts(res.data || []); }).catch(() => {});
  }, []);

  useEffect(() => { fetchDashboard(); }, [range, selProducts]);
  useEffect(() => { const off = asoBus.on(() => { fetchDashboard(); }); return off; }, []);

  async function fetchDashboard() {
    setLoading(true);
    try {
      const params = {};
      if (range?.[0] && range?.[1]) {
        params.start_date = range[0].format('YYYY-MM-DD');
        params.end_date = range[1].format('YYYY-MM-DD');
      }
      if (selProducts.length) params.product_ids = selProducts.join(',');
      const res = await asoApi.getDashboard(params);
      if (res.code === 0) setData(res.data);
    } catch { setData(null); }
    finally { setLoading(false); }
  }

  const summary = data?.summary || {};

  const trendOption = useMemo(() => {
    if (!data?.trend?.length) return null;
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, data: ['到榜T3词数', '量级'] },
      grid: { left: 60, right: 60, top: 20, bottom: 50 },
      xAxis: { type: 'category', data: data.trend.map(item => String(item.date).slice(5)), axisLabel: { fontSize: 11 } },
      yAxis: [
        { type: 'value', name: '词数', position: 'left', splitLine: { lineStyle: { type: 'dashed', color: '#eee' } } },
        { type: 'value', name: '量级', position: 'right', splitLine: { show: false } },
      ],
      series: [
        { name: '到榜T3词数', type: 'line', yAxisIndex: 0, data: data.trend.map(item => item.t3_keywords), smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { width: 2.5, color: '#52c41a' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(82,196,26,0.25)' }, { offset: 1, color: 'rgba(82,196,26,0.02)' }]) } },
        { name: '量级', type: 'line', yAxisIndex: 1, data: data.trend.map(item => item.total_volume), smooth: true, symbol: 'none', lineStyle: { width: 1.8, color: '#1890ff' } },
      ],
    };
  }, [data]);

  if (!data && !loading) return <Empty description="暂无数据，请先导入日报" />;

  return (
    <Spin spinning={loading}>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <DatePicker.RangePicker value={range} onChange={setRange} allowClear size="small" />
          <Select mode="multiple" placeholder="产品(全部)" allowClear value={selProducts} onChange={setSelProducts} style={{ minWidth: 180 }} maxTagCount={2}>
            {products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
          </Select>
        </Space>
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="优化关键词" value={summary.optimized_keywords || 0} suffix="个" valueStyle={{ fontSize: 22 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="T3到榜词数" value={summary.t3_keywords || 0} suffix="个" valueStyle={{ color: '#52c41a', fontSize: 22 }} prefix={<TrophyOutlined />} />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>T3到榜率 {((summary.t3_rate || 0) * 100).toFixed(1)}%</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="T1-2到榜词数" value={summary.t1_2_keywords || 0} suffix="个" valueStyle={{ color: '#1890ff', fontSize: 22 }} />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>T1-2到榜率 {((summary.t1_2_rate || 0) * 100).toFixed(1)}%</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="总量级" value={summary.total_volume || 0} suffix="" valueStyle={{ fontSize: 22 }} />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>消耗 ¥{Number(summary.total_cost || 0).toFixed(0)}</div>
          </Card>
        </Col>
      </Row>

      {trendOption && (
        <Card size="small" title="T3到榜词数 & 量级趋势" style={{ marginBottom: 12 }}>
          <ReactEChartsCore echarts={echarts} option={trendOption} style={{ height: 280 }} notMerge />
        </Card>
      )}

      {data?.baseline?.length > 0 && (
        <Card size="small" title="产品基础指标">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e8e8e8' }}>
                  <th style={{ padding: 8, textAlign: 'left' }}>日期</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>关键词覆盖</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>有效覆盖</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>T3词数</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>T10词数</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>总榜排名</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>分类榜排名</th>
                  <th style={{ padding: 8, textAlign: 'center' }}>评分</th>
                </tr>
              </thead>
              <tbody>
                {data.baseline.slice(0, 10).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: 8 }}>{row.stat_date}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>{row.keyword_coverage ?? '-'}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>{row.effective_keyword_coverage ?? '-'}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>{row.effective_t3_keywords ?? '-'}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>{row.effective_t10_keywords ?? '-'}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>{row.overall_rank ?? '-'}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>{row.category_rank ?? '-'}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>{row.rating ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Spin>
  );
}

export default AsoDashboardTab;
