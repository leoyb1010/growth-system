import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, DatePicker, Select, Spin, Empty, Space, Segmented, Tag, Tooltip } from 'antd';
import { AlertOutlined, DollarOutlined, InfoCircleOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { cpsApi, cpsBus } from '../../services/cpsService';
import DeltaPill from '../ui/DeltaPill';
import SectionHeader from '../ui/SectionHeader';
import Sparkline from '../ui/Sparkline';
import dayjs from 'dayjs';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, CanvasRenderer]);

const COLORS = {
  primary: '#3B5AFB',
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#DC2626',
  cyan: '#0891B2',
  muted: '#9CA3AF',
};

const QUICK_RANGES = [
  { label: '今日', value: 'today', range: () => [dayjs(), dayjs()], granularity: 'day' },
  { label: '本周', value: 'this_week', range: () => [dayjs().startOf('week'), dayjs()], granularity: 'day' },
  { label: '近7天', value: '7d', range: () => [dayjs().subtract(6, 'day'), dayjs()], granularity: 'day' },
  { label: '本月', value: 'this_month', range: () => [dayjs().startOf('month'), dayjs()], granularity: 'day' },
  { label: '近30天', value: '30d', range: () => [dayjs().subtract(29, 'day'), dayjs()], granularity: 'day' },
];

const fmtMoney = (value) => {
  const number = Number(value || 0);
  if (Math.abs(number) >= 10000) return `${(number / 10000).toFixed(1)}万`;
  return number.toFixed(0);
};

const fmtRate = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`;

function CpsKpiCard({ label, value, suffix, sub, delta, color, icon, alert = false, sparkline }) {
  return (
    <div className="surface-card-secondary" style={{ position: 'relative', overflow: 'hidden', padding: 20, height: '100%', borderColor: alert ? '#FECACA' : undefined, background: alert ? 'linear-gradient(135deg,#fff 0%,#FEF2F2 100%)' : undefined }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 58, height: 4, background: alert ? COLORS.error : color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, marginBottom: 8 }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 30, lineHeight: 1, fontWeight: 700, color: alert ? COLORS.error : 'var(--text-1)' }}>{value}</span>
            {suffix ? <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{suffix}</span> : null}
          </div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${alert ? COLORS.error : color}14`, color: alert ? COLORS.error : color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      </div>
      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
        {delta !== undefined ? <DeltaPill value={delta} size="sm" /> : null}
        {sub ? <span style={{ fontSize: 11, color: alert ? '#991B1B' : 'var(--text-3)' }}>{sub}</span> : null}
      </div>
      {sparkline?.length ? <div style={{ marginTop: 12 }}><Sparkline data={sparkline} color={alert ? COLORS.error : color} height={34} tooltipName={label} /></div> : null}
    </div>
  );
}

function RefundRateCard({ period, delta }) {
  const threshold = 0.05;
  const rate = Number(period.refund_rate || 0);
  const refundCount = (Number(period.new_refund) || 0) + (Number(period.renewal_refund) || 0);
  const isBreach = rate > threshold;
  const pct = Math.min((rate / 0.1) * 100, 100);
  const thresholdPct = Math.min((threshold / 0.1) * 100, 100);

  return (
    <div className="surface-card-secondary" style={{ padding: 20, height: '100%', borderColor: isBreach ? '#FECACA' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 600, marginBottom: 8 }}>退款率</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 30, lineHeight: 1, fontWeight: 700, color: isBreach ? COLORS.error : COLORS.success }}>{fmtRate(rate)}</span>
            <DeltaPill value={delta?.refund_rate_pt} suffix="pt" size="sm" />
          </div>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${isBreach ? COLORS.error : COLORS.success}14`, color: isBreach ? COLORS.error : COLORS.success, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <WarningOutlined />
        </div>
      </div>
      <div style={{ position: 'relative', height: 7, background: 'var(--bg-subtle)', borderRadius: 999, marginTop: 14 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: isBreach ? COLORS.error : COLORS.success, borderRadius: 999 }} />
        <div style={{ position: 'absolute', top: -3, left: `${thresholdPct}%`, width: 2, height: 13, background: 'var(--text-2)' }} />
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: isBreach ? '#991B1B' : 'var(--text-3)' }}>
        退款 {refundCount} 笔 · 阈值 5%{isBreach ? ` · 超出 ${((rate - threshold) * 100).toFixed(2)}pt` : ''}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '4px 0' }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || 'var(--text-1)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function TopChannelsCard({ channels }) {
  if (!channels?.length) return null;
  const maxAmount = Math.max(...channels.map(ch => Number(ch.amount) || 0), 1);
  return (
    <Card size="small" title="渠道贡献 TOP 5" style={{ height: '100%' }}>
      {channels.map((ch, idx) => (
        <div key={ch.channel_id || idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: idx < channels.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
          <span style={{ width: 22, fontSize: 13, color: 'var(--text-2)' }}>{idx + 1}</span>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.channel_name}</span>
          <div style={{ width: 90, height: 5, background: 'var(--bg-subtle)', borderRadius: 999 }}>
            <div style={{ width: `${Math.min((Number(ch.amount || 0) / maxAmount) * 100, 100)}%`, height: '100%', background: COLORS.primary, borderRadius: 999 }} />
          </div>
          <span style={{ width: 72, textAlign: 'right', fontSize: 13, fontWeight: 700 }}>¥{fmtMoney(ch.amount)}</span>
          {ch.amount_delta_pct != null ? <DeltaPill value={ch.amount_delta_pct * 100} suffix="%" size="sm" /> : null}
        </div>
      ))}
    </Card>
  );
}

function CpsDashboardTab({ channelId }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [range, setRange] = useState([dayjs().subtract(6, 'day'), dayjs()]);
  const [activeRange, setActiveRange] = useState('7d');
  const [granularity, setGranularity] = useState('day');
  const [channels, setChannels] = useState([]);
  const [products, setProducts] = useState([]);
  const [selChannels, setSelChannels] = useState(channelId ? [channelId] : []);
  const [selProducts, setSelProducts] = useState([]);

  useEffect(() => {
    cpsApi.getChannels().then(res => { if (res.code === 0) setChannels(res.data || []); }).catch(() => {});
    cpsApi.getProducts().then(res => { if (res.code === 0) setProducts(res.data || []); }).catch(() => {});
  }, []);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const params = { granularity };
      if (range?.[0] && range?.[1]) {
        params.start_date = range[0].format('YYYY-MM-DD');
        params.end_date = range[1].format('YYYY-MM-DD');
      }
      if (selChannels.length) params.channel_ids = selChannels.join(',');
      if (selProducts.length) params.product_ids = selProducts.join(',');
      const res = await cpsApi.getDashboard(params);
      if (res.code === 0) setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [granularity, range, selChannels, selProducts]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);
  useEffect(() => { const off = cpsBus.on(() => { fetchDashboard(); }); return off; }, [fetchDashboard]);

  const handleQuickRange = (value) => {
    setActiveRange(value);
    const item = QUICK_RANGES.find(r => r.value === value);
    if (!item) return;
    setRange(item.range());
    setGranularity(item.granularity);
  };

  const period = data?.period || {};
  const yearly = data?.yearly || {};
  const quarterly = data?.quarterly || {};
  const daily = data?.daily || {};
  const trend = useMemo(() => data?.trend || [], [data]);
  const refundDelta = data?.period && data?.trend ? undefined : undefined;

  const trendOption = useMemo(() => {
    if (!trend.length) return null;
    const dates = trend.map(item => granularity === 'day' ? String(item.date).slice(5) : item.date);
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { bottom: 0, data: ['实际收入', '新签', '续费', '退款'] },
      grid: { left: 58, right: 58, top: 20, bottom: 50 },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 11, color: COLORS.muted, rotate: dates.length > 15 ? 30 : 0 } },
      yAxis: [
        {
          type: 'value',
          name: '金额(万)',
          axisLabel: { color: COLORS.muted, formatter: value => (value / 10000).toFixed(0) },
          splitLine: { lineStyle: { type: 'dashed', color: '#E5E7EB' } },
        },
        { type: 'value', name: '笔数', axisLabel: { color: COLORS.muted }, splitLine: { show: false } },
      ],
      series: [
        {
          name: '实际收入',
          type: 'line',
          yAxisIndex: 0,
          data: trend.map(item => item.amount),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.5, color: COLORS.primary },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59,90,251,0.22)' },
              { offset: 1, color: 'rgba(59,90,251,0.02)' },
            ]),
          },
        },
        { name: '新签', type: 'line', yAxisIndex: 1, data: trend.map(item => item.new_sign), smooth: true, symbol: 'none', lineStyle: { width: 1.8, color: COLORS.success } },
        { name: '续费', type: 'line', yAxisIndex: 1, data: trend.map(item => item.renewal), smooth: true, symbol: 'none', lineStyle: { width: 1.8, color: COLORS.warning } },
        { name: '退款', type: 'line', yAxisIndex: 1, data: trend.map(item => item.refund), smooth: true, symbol: 'none', lineStyle: { width: 1.6, color: COLORS.error, type: 'dashed' } },
      ],
    };
  }, [trend, granularity]);

  if (!data && !loading) return <Empty description="暂无数据" />;

  const refundCount = (Number(period.new_refund) || 0) + (Number(period.renewal_refund) || 0);
  const isRefundBreach = Number(period.refund_rate || 0) > 0.05;

  return (
    <Spin spinning={loading}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 16, borderBottom: '1px solid var(--border-soft)' }}>
        <Segmented options={QUICK_RANGES.map(item => ({ label: item.label, value: item.value }))} value={activeRange} onChange={handleQuickRange} />
        <DatePicker.RangePicker
          value={range}
          onChange={value => { setRange(value || []); setActiveRange('custom'); }}
          allowClear={false}
          placeholder={['开始', '结束']}
          size="small"
        />
        {!channelId && (
          <Select mode="multiple" placeholder="渠道(全部)" allowClear value={selChannels} onChange={setSelChannels} style={{ minWidth: 170 }} maxTagCount={2}>
            {channels.map(channel => <Select.Option key={channel.id} value={channel.id}>{channel.name}</Select.Option>)}
          </Select>
        )}
        <Select mode="multiple" placeholder="产品(全部)" allowClear value={selProducts} onChange={setSelProducts} style={{ minWidth: 170 }} maxTagCount={2}>
          {products.map(product => <Select.Option key={product.id} value={product.id}>{product.name}</Select.Option>)}
        </Select>
      </div>

      <div style={{ marginBottom: 12, color: 'var(--text-2)', fontSize: 13 }}>
        <Tag color="blue">{data?.period_range ? `${data.period_range.start} ~ ${data.period_range.end}` : '全部数据'}</Tag>
        共 {data?.total?.actual_count || 0} 单 · ¥{fmtMoney(data?.total?.actual_amount || 0)}
      </div>

      <SectionHeader title="核心指标" subtitle="收入、签约、退款与预警" icon={<DollarOutlined style={{ color: COLORS.success }} />} />
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <CpsKpiCard label="实际收入" value={`¥${fmtMoney(period.actual_amount)}`} sub={`有效收入 ¥${fmtMoney(period.effective_amount)}`} color={COLORS.primary} icon={<DollarOutlined />} sparkline={trend.map(item => item.amount)} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <CpsKpiCard label="实际签约" value={period.actual_count || 0} suffix="单" sub={`新签 ${period.new_sign || 0} / 续费 ${period.renewal || 0}`} color={COLORS.success} icon={<TeamOutlined />} sparkline={trend.map(item => item.count)} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <RefundRateCard period={period} delta={refundDelta} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <CpsKpiCard label="开放预警" value={data?.alert_count || 0} sub={`客诉 ${period.complaints || 0} 件 · 退款 ${refundCount} 笔`} color={COLORS.error} icon={<AlertOutlined />} alert={(data?.alert_count || 0) > 0 || isRefundBreach} />
        </Col>
      </Row>

      {trendOption && (
        <Card size="small" title="实际收入与签约趋势" style={{ marginBottom: 16 }}>
          <ReactEChartsCore key={granularity + (trend.length || 0)} echarts={echarts} option={trendOption} style={{ height: 280 }} notMerge />
        </Card>
      )}

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <TopChannelsCard channels={data?.top_channels || []} />
        </Col>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            title={(
              <Space>
                <span>固定窗口对照</span>
                <Tooltip title="这三组数据是固定时间窗口，不受上方时间筛选影响，只跟随渠道和产品筛选。">
                  <InfoCircleOutlined style={{ color: 'var(--text-3)' }} />
                </Tooltip>
              </Space>
            )}
          >
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={8}>
                <div style={miniBox}>
                  <div style={miniTitle}>年累计 · {new Date().getFullYear()}</div>
                  <Row gutter={8}>
                    <Col span={12}><MiniStat label="实际收入" value={`¥${fmtMoney(yearly.actual_amount)}`} color={COLORS.primary} /></Col>
                    <Col span={12}><MiniStat label="实际签约" value={yearly.actual_count || 0} /></Col>
                  </Row>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={miniBox}>
                  <div style={miniTitle}>当季 · Q{Math.ceil((new Date().getMonth() + 1) / 3)}</div>
                  <Row gutter={8}>
                    <Col span={12}><MiniStat label="实际收入" value={`¥${fmtMoney(quarterly.actual_amount)}`} color={COLORS.primary} /></Col>
                    <Col span={12}><MiniStat label="退款率" value={fmtRate(quarterly.refund_rate)} color={quarterly.refund_rate > 0.05 ? COLORS.error : COLORS.success} /></Col>
                  </Row>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div style={miniBox}>
                  <div style={miniTitle}>昨日 · {dayjs().subtract(1, 'day').format('MM-DD')}</div>
                  <Row gutter={8}>
                    <Col span={12}><MiniStat label="实际收入" value={`¥${fmtMoney(daily.actual_amount)}`} color={COLORS.primary} /></Col>
                    <Col span={12}><MiniStat label="实际签约" value={daily.actual_count || 0} /></Col>
                  </Row>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}

const miniBox = { background: 'var(--bg-muted)', border: '1px solid var(--border-soft)', borderRadius: 10, padding: 10, height: '100%' };
const miniTitle = { fontSize: 12, color: 'var(--text-2)', marginBottom: 6, fontWeight: 600 };

export default CpsDashboardTab;
