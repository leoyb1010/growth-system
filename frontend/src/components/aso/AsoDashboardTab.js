import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, DatePicker, Select, Spin, Empty, Space, Tag } from 'antd';
import { BarChartOutlined, DollarOutlined, RiseOutlined, TrophyOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { asoApi, asoBus } from '../../services/asoService';
import DeltaPill from '../ui/DeltaPill';
import SectionHeader from '../ui/SectionHeader';
import Sparkline from '../ui/Sparkline';
import dayjs from 'dayjs';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const COLORS = {
  primary: '#3B5AFB',
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#DC2626',
  muted: '#9CA3AF',
};

const fmtMoney = (value) => {
  const n = Number(value || 0);
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toFixed(0);
};

function AsoKpiCard({ label, value, suffix, delta, inverse, color, icon, sparkline, hint }) {
  return (
    <div className="surface-card-secondary" style={{ position: 'relative', overflow: 'hidden', padding: 20, height: '100%' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 58, height: 4, background: color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, marginBottom: 8 }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 30, lineHeight: 1, fontWeight: 700, color: 'var(--text-1)' }}>{value}</span>
            {suffix ? <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{suffix}</span> : null}
          </div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}14`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
        {delta !== undefined ? <DeltaPill value={delta} inverse={inverse} size="sm" /> : <span style={{ fontSize: 12, color: 'var(--text-3)' }}>暂无对比</span>}
        {hint ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{hint}</span> : null}
      </div>
      {sparkline?.length ? <div style={{ marginTop: 12 }}><Sparkline data={sparkline} color={color} height={36} tooltipName={label} /></div> : null}
    </div>
  );
}

function KeywordChangeBlock({ changes }) {
  const newT1 = changes?.new_t1 || [];
  const newT3 = changes?.new_t3 || [];
  const lostT3 = changes?.lost_t3 || [];
  if (!newT1.length && !newT3.length && !lostT3.length) return null;

  return (
    <Card size="small" title="关键词变化" style={{ marginTop: 12 }}>
      <Row gutter={[16, 12]}>
        <Col xs={24} md={8}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-success)', marginBottom: 8 }}>新到 T1（{newT1.length}）</div>
          <Space wrap>{newT1.map(word => <Tag color="success" key={word}>{word}</Tag>)}</Space>
          {!newT1.length && <span style={{ color: 'var(--text-3)', fontSize: 12 }}>暂无</span>}
        </Col>
        <Col xs={24} md={8}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 8 }}>新到 T3（{newT3.length}）</div>
          <Space wrap>{newT3.map(word => <Tag color="processing" key={word}>{word}</Tag>)}</Space>
          {!newT3.length && <span style={{ color: 'var(--text-3)', fontSize: 12 }}>暂无</span>}
        </Col>
        <Col xs={24} md={8}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-error)', marginBottom: 8 }}>掉出 T3（{lostT3.length}）</div>
          <Space wrap>{lostT3.map(word => <Tag color="error" key={word}>{word}</Tag>)}</Space>
          {!lostT3.length && <span style={{ color: 'var(--text-3)', fontSize: 12 }}>暂无</span>}
        </Col>
      </Row>
    </Card>
  );
}

function AsoDashboardTab() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [products, setProducts] = useState([]);
  const [selProducts, setSelProducts] = useState(undefined);
  const [trendData, setTrendData] = useState(null);

  useEffect(() => {
    const loadProducts = () => asoApi.getProducts().then(res => { if (res.code === 0) setProducts(res.data || []); }).catch(() => {});
    loadProducts();
    const off = asoBus.on((event) => { if (event === 'products:changed') loadProducts(); });
    return off;
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        date: selectedDate.format('YYYY-MM-DD'),
        compare_date: selectedDate.subtract(1, 'day').format('YYYY-MM-DD'),
      };
      if (selProducts) params.product_ids = selProducts;
      const res = await asoApi.getDashboard(params);
      if (res.code === 0) setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selProducts]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { const off = asoBus.on(() => { fetchDashboard(); }); return off; }, [fetchDashboard]);

  useEffect(() => {
    async function fetchTrend() {
      try {
        const params = {
          start_date: selectedDate.subtract(6, 'day').format('YYYY-MM-DD'),
          end_date: selectedDate.format('YYYY-MM-DD'),
        };
        if (selProducts) params.product_ids = selProducts;
        const res = await asoApi.getDashboard(params);
        if (res.code === 0) setTrendData(res.data);
      } catch {
        setTrendData(null);
      }
    }
    fetchTrend();
  }, [selectedDate, selProducts]);

  const current = data?.current || {};
  const delta = data?.delta || {};
  const rangeTrend = useMemo(() => trendData?.trend || [], [trendData]);
  const keywordChanges = trendData?.keyword_changes || {};
  const noDataToday = !current.has_data;

  const trendOption = useMemo(() => {
    if (!rangeTrend.length) return null;
    return {
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0, data: ['T3 到榜', '总量级'] },
      grid: { left: 52, right: 40, top: 20, bottom: 48 },
      xAxis: { type: 'category', data: rangeTrend.map(item => String(item.date).slice(5)), axisLabel: { fontSize: 11, color: COLORS.muted } },
      yAxis: { type: 'value', name: '词数/量级', splitLine: { lineStyle: { type: 'dashed', color: '#E5E7EB' } }, axisLabel: { color: COLORS.muted } },
      series: [
        { name: 'T3 到榜', type: 'bar', data: rangeTrend.map(item => item.t3_keywords), barWidth: 16, itemStyle: { color: COLORS.success, borderRadius: [4, 4, 0, 0] } },
        { name: '总量级', type: 'line', data: rangeTrend.map(item => item.total_volume), smooth: true, symbol: 'circle', symbolSize: 6, lineStyle: { width: 2.4, color: COLORS.primary } },
      ],
    };
  }, [rangeTrend]);

  return (
    <Spin spinning={loading}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 16, borderBottom: '1px solid var(--border-soft)' }}>
        <DatePicker value={selectedDate} onChange={v => setSelectedDate(v || dayjs())} allowClear={false} size="small" />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>vs {selectedDate.subtract(1, 'day').format('YYYY-MM-DD')}</span>
        <Select placeholder="产品" allowClear value={selProducts} onChange={setSelProducts} style={{ minWidth: 180 }}>
          {products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
        </Select>
      </div>

      {noDataToday && !loading ? (
        <Empty description={`${selectedDate.format('YYYY-MM-DD')} 暂无日报数据，请先导入日报`} style={{ padding: 40 }}>
          <span style={{ color: 'var(--text-3)', fontSize: 13 }}>前往「日报导入」Tab 上传当日 ASO 关键词数据</span>
        </Empty>
      ) : (
        <>
          <SectionHeader title="核心指标" subtitle="关键词覆盖与排名表现" icon={<BarChartOutlined style={{ color: COLORS.primary }} />} />
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} lg={8}>
              <AsoKpiCard label="优化关键词" value={current.optimized_keywords || 0} suffix="个" delta={delta.optimized_keywords} color={COLORS.primary} icon={<BarChartOutlined />} sparkline={rangeTrend.map(item => item.total_volume)} hint="近 7 天" />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <AsoKpiCard label="到榜 T1" value={current.t1_keywords || 0} suffix="个" delta={delta.t1_keywords} color={COLORS.primary} icon={<TrophyOutlined />} sparkline={rangeTrend.map(item => item.t3_keywords)} hint="日对比" />
            </Col>
            <Col xs={24} sm={12} lg={8}>
              <AsoKpiCard label="到榜 T3" value={current.t3_keywords || 0} suffix="个" delta={delta.t3_keywords} color={COLORS.success} icon={<RiseOutlined />} sparkline={rangeTrend.map(item => item.t3_keywords)} hint="日对比" />
            </Col>
          </Row>

          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24} md={6}>
              <AsoKpiCard label="总榜排名" value={current.overall_rank != null ? `#${current.overall_rank}` : '--'} delta={current.overall_rank != null ? delta.overall_rank : undefined} inverse color={COLORS.warning} icon={<TrophyOutlined />} />
            </Col>
            <Col xs={24} md={6}>
              <AsoKpiCard label="分类榜排名" value={current.category_rank != null ? `#${current.category_rank}` : '--'} delta={current.category_rank != null ? delta.category_rank : undefined} inverse color={COLORS.warning} icon={<TrophyOutlined />} />
            </Col>
            <Col xs={24} md={6}>
              <AsoKpiCard label="总量级" value={fmtMoney(current.total_volume)} delta={delta.total_volume} color={COLORS.primary} icon={<BarChartOutlined />} />
            </Col>
            <Col xs={24} md={6}>
              <AsoKpiCard label="消耗金额" value={`¥${fmtMoney(current.total_cost)}`} delta={delta.total_cost} color={COLORS.error} icon={<DollarOutlined />} />
            </Col>
          </Row>

          {trendOption && (
            <Card size="small" title="近 7 天趋势" style={{ marginBottom: 12 }}>
              <ReactEChartsCore echarts={echarts} option={trendOption} style={{ height: 260 }} notMerge />
            </Card>
          )}

          <KeywordChangeBlock changes={keywordChanges} />
        </>
      )}
    </Spin>
  );
}

export default AsoDashboardTab;
