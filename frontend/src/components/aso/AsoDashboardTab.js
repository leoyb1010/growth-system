import React, { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Statistic, DatePicker, Select, Spin, Empty, Space, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, TrophyOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { asoApi, asoBus } from '../../services/asoService';
import dayjs from 'dayjs';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

function DeltaTag({ value, inverse }) {
  if (value == null || value === 0) return <span style={{ fontSize: 12, color: '#999' }}>持平</span>;
  const isUp = inverse ? value < 0 : value > 0;
  const color = isUp ? '#52c41a' : '#cf1322';
  const icon = isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />;
  const absVal = Math.abs(value);
  const suffix = Number.isInteger(absVal) ? absVal : absVal.toFixed(1);
  return <span style={{ fontSize: 12, color, fontWeight: 500 }}>{icon} {suffix}</span>;
}

function AsoDashboardTab() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [products, setProducts] = useState([]);
  const [selProducts, setSelProducts] = useState(undefined);

  useEffect(() => {
    const loadProducts = () => asoApi.getProducts().then(res => { if (res.code === 0) setProducts(res.data || []); }).catch(() => {});
    loadProducts();
    const off = asoBus.on((event) => { if (event === 'products:changed') loadProducts(); });
    return off;
  }, []);

  useEffect(() => { fetchDashboard(); }, [selectedDate, selProducts]);
  useEffect(() => { const off = asoBus.on(() => { fetchDashboard(); }); return off; }, []);

  async function fetchDashboard() {
    setLoading(true);
    try {
      const params = {
        date: selectedDate.format('YYYY-MM-DD'),
        compare_date: selectedDate.subtract(1, 'day').format('YYYY-MM-DD'),
      };
      if (selProducts) params.product_ids = selProducts;
      const res = await asoApi.getDashboard(params);
      if (res.code === 0) setData(res.data);
    } catch { setData(null); }
    finally { setLoading(false); }
  }

  const current = data?.current || {};
  const compare = data?.compare || {};
  const delta = data?.delta || {};
  const noDataToday = !current.has_data;

  // 趋势用 range 模式获取近 7 天数据
  const [trendData, setTrendData] = useState(null);
  useEffect(() => {
    async function fetchTrend() {
      try {
        const params = {
          start_date: selectedDate.subtract(6, 'day').format('YYYY-MM-DD'),
          end_date: selectedDate.format('YYYY-MM-DD'),
        };
        if (selProducts) params.product_ids = selProducts;
        const res = await asoApi.getDashboard(params);
        if (res.code === 0 && res.data?.trend) setTrendData(res.data.trend);
      } catch { setTrendData(null); }
    }
    fetchTrend();
  }, [selectedDate, selProducts]);

  const trendOption = useMemo(() => {
    if (!trendData?.length) return null;
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, data: ['T3词数', '优化词数'] },
      grid: { left: 60, right: 60, top: 20, bottom: 50 },
      xAxis: { type: 'category', data: trendData.map(item => String(item.date).slice(5)), axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value', name: '词数', splitLine: { lineStyle: { type: 'dashed', color: '#eee' } } },
      series: [
        { name: 'T3词数', type: 'bar', data: trendData.map(item => item.t3_keywords), barWidth: 16, itemStyle: { color: '#52c41a', borderRadius: [4, 4, 0, 0] } },
        { name: '优化词数', type: 'line', data: trendData.map(item => item.total_volume), smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { width: 2, color: '#1890ff' } },
      ],
    };
  }, [trendData]);

  return (
    <Spin spinning={loading}>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <DatePicker value={selectedDate} onChange={setSelectedDate} allowClear={false} size="small" />
          <span style={{ fontSize: 12, color: '#999' }}>对比日期：{selectedDate.subtract(1, 'day').format('YYYY-MM-DD')}</span>
          <Select placeholder="选择产品" allowClear value={selProducts} onChange={setSelProducts} style={{ minWidth: 180 }}>
            {products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
          </Select>
        </Space>
      </Card>

      {noDataToday && !loading ? (
        <Empty description={`${selectedDate.format('YYYY-MM-DD')} 暂无日报数据，请先导入日报`} style={{ padding: 40 }}>
          <span style={{ color: '#999', fontSize: 13 }}>前往「日报导入」Tab 上传当日 ASO 关键词数据</span>
        </Empty>
      ) : (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col xs={24} sm={12} lg={8}>
              <Card size="small">
                <Statistic title="优化关键词" value={current.optimized_keywords || 0} suffix="个" valueStyle={{ fontSize: 22 }} />
                <div style={{ marginTop: 4 }}><DeltaTag value={delta.optimized_keywords} /></div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Card size="small">
                <Statistic title="到榜 T1" value={current.t1_keywords || 0} suffix="个" valueStyle={{ color: '#1890ff', fontSize: 22 }} prefix={<TrophyOutlined />} />
                <div style={{ marginTop: 4 }}><DeltaTag value={delta.t1_keywords} /></div>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <Card size="small">
                <Statistic title="到榜 T3" value={current.t3_keywords || 0} suffix="个" valueStyle={{ color: '#52c41a', fontSize: 22 }} prefix={<TrophyOutlined />} />
                <div style={{ marginTop: 4 }}><DeltaTag value={delta.t3_keywords} /></div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col xs={24} sm={12}>
              <Card size="small">
                <Statistic title="总榜排名" value={current.overall_rank != null ? current.overall_rank : '--'} valueStyle={{ fontSize: 22 }} />
                <div style={{ marginTop: 4 }}>
                  {current.overall_rank != null ? <DeltaTag value={delta.overall_rank} inverse /> : <span style={{ fontSize: 12, color: '#999' }}>暂无数据</span>}
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card size="small">
                <Statistic title="分类榜排名" value={current.category_rank != null ? current.category_rank : '--'} valueStyle={{ fontSize: 22 }} />
                <div style={{ marginTop: 4 }}>
                  {current.category_rank != null ? <DeltaTag value={delta.category_rank} inverse /> : <span style={{ fontSize: 12, color: '#999' }}>暂无数据</span>}
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col xs={24} sm={12}>
              <Card size="small">
                <Statistic title="总量级" value={current.total_volume || 0} valueStyle={{ fontSize: 20 }} />
                <div style={{ marginTop: 4 }}><DeltaTag value={delta.total_volume} /></div>
              </Card>
            </Col>
            <Col xs={24} sm={12}>
              <Card size="small">
                <Statistic title="消耗金额" value={`¥${Number(current.total_cost || 0).toFixed(2)}`} valueStyle={{ fontSize: 20 }} />
                <div style={{ marginTop: 4 }}><DeltaTag value={delta.total_cost} /></div>
              </Card>
            </Col>
          </Row>

          {trendOption && (
            <Card size="small" title="近 7 天趋势">
              <ReactEChartsCore echarts={echarts} option={trendOption} style={{ height: 260 }} notMerge />
            </Card>
          )}
        </>
      )}
    </Spin>
  );
}

export default AsoDashboardTab;
