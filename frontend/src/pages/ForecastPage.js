import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Segmented, Slider, Button, Spin, Empty, Tag, Tooltip, Collapse, message } from 'antd';
import { InfoCircleOutlined, AimOutlined, ThunderboltOutlined, RiseOutlined } from '@ant-design/icons';
import { api } from '../hooks/useAuth';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';

const COLORS = { primary: '#3B5AFB', success: '#16A34A', warning: '#F59E0B', error: '#DC2626', purple: '#8B5CF6', muted: '#9CA3AF' };
const CONF = { high: { label: '高置信', color: COLORS.success }, medium: { label: '中置信', color: COLORS.warning }, low: { label: '低·情景参考', color: COLORS.muted } };
const SCENARIOS = [{ label: '保守', value: 'conservative' }, { label: '中性', value: 'neutral' }, { label: '乐观', value: 'optimistic' }];
const PRIMARY = ['GMV', '净利润'];

const fmt = (v, unit) => {
  const n = Number(v || 0);
  const s = Math.abs(n) >= 10000 ? `${(n / 10000).toFixed(1)}万` : `${Math.round(n)}`;
  return unit ? `${s}${unit}` : s;
};

function ConfBadge({ level }) {
  const c = CONF[level] || CONF.low;
  return <span style={{ fontSize: 11, fontWeight: 600, color: c.color, background: `${c.color}1A`, padding: '2px 8px', borderRadius: 6 }}>{c.label}</span>;
}

function HorizonRow({ h, unit }) {
  return (
    <div style={{ flex: 1, minWidth: 0, padding: '8px 10px', background: 'var(--bg-muted)', borderRadius: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{h.label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginTop: 2 }}>{fmt(h.p50, unit)}</div>
      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{fmt(h.p25)}~{fmt(h.p75)}</div>
      <div style={{ marginTop: 3 }}><ConfBadge level={h.confidence} /></div>
    </div>
  );
}

function IndicatorCard({ ind }) {
  const b = ind.basis || {};
  return (
    <Card size="small" style={{ marginBottom: 12 }} title={
      <span>{ind.name} <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>{ind.unit}</span></span>
    } extra={
      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>本季实际 {fmt(b.current_actual)} / 目标 {fmt(b.current_target)} · 用增速 {b.applied_growth_pct}%</span>
    }>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ind.horizons.map(h => <HorizonRow key={h.key} h={h} unit={ind.unit} />)}
      </div>
    </Card>
  );
}

function ForecastPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scenario, setScenario] = useState('neutral');
  const [growth, setGrowth] = useState(0);      // 季度环比增速 %（叠加在历史之上）
  const [season, setSeason] = useState(100);    // 季节系数 %
  const [event, setEvent] = useState(0);        // 事件加成 %

  const buildFactors = useCallback(() => ({
    scenario,
    global_growth: growth,
    season_factor: season / 100,
    event_pct: event,
  }), [scenario, growth, season, event]);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post('/dashboard/forecast', { factors: buildFactors() });
      if (res.code === 0) setData(res.data);
    } catch {
      message.error('获取经营预测失败');
    } finally {
      setLoading(false);
    }
  }, [buildFactors]);

  useEffect(() => {
    const t = setTimeout(() => fetchForecast(), 350);
    return () => clearTimeout(t);
  }, [fetchForecast]);

  const primary = useMemo(() => (data?.indicators || []).filter(i => PRIMARY.includes(i.name)), [data]);
  const others = useMemo(() => (data?.indicators || []).filter(i => !PRIMARY.includes(i.name)), [data]);

  return (
    <div className="app-page">
      <PageHeader title="经营预测" subtitle="自然季度口径（Q1–Q4）· 基于本季度流速 + 历史环比 + 可调因素" />

      {/* 影响因素面板 */}
      <Card size="small" style={{ marginBottom: 16, background: 'var(--bg-muted)' }}
        title={<span><ThunderboltOutlined style={{ color: COLORS.warning, marginRight: 6 }} />影响因素
          <Tooltip title="预测基准 = 本季度收官(实际流速与目标按时间进度加权) + 历史季度环比。下面的因素叠加在基准之上，实时重算。"><InfoCircleOutlined style={{ color: 'var(--text-3)', marginLeft: 6 }} /></Tooltip>
        </span>}>
        <Row gutter={[20, 12]} align="middle">
          <Col xs={24} md={6}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>情景</div>
            <Segmented options={SCENARIOS} value={scenario} onChange={setScenario} block />
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>乐观/保守 = 增速 ±10%</div>
          </Col>
          <Col xs={24} md={6}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>季度环比增速：<b>{growth > 0 ? '+' : ''}{growth}%</b></div>
            <Slider min={-50} max={100} step={5} value={growth} onChange={setGrowth} marks={{ '-50': '-50%', 0: '0', 100: '+100%' }} />
          </Col>
          <Col xs={24} md={6}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>季节系数：<b>{(season / 100).toFixed(2)}×</b></div>
            <Slider min={50} max={150} step={5} value={season} onChange={setSeason} marks={{ 50: '0.5', 100: '1.0', 150: '1.5' }} />
          </Col>
          <Col xs={24} md={6}>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>事件加成：<b>{event > 0 ? '+' : ''}{event}%</b>
              <Tooltip title="已知的大促/政策/新渠道等一次性加成或拖累，叠加到未来季度。"><InfoCircleOutlined style={{ color: 'var(--text-3)', marginLeft: 4 }} /></Tooltip>
            </div>
            <Slider min={-50} max={50} step={5} value={event} onChange={setEvent} marks={{ '-50': '-50%', 0: '0', 50: '+50%' }} />
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {!data ? <Empty description="暂无预测数据" /> : (
          <>
            <div style={{ marginBottom: 12, fontSize: 12, color: 'var(--text-2)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Tag color="blue">锚点 {data.as_of}</Tag>
              <span>本季 {data.current_quarter} · 时间进度 {data.quarter_time_progress_pct}%</span>
              <span>· 年度时间进度 {data.year_time_progress_pct}%</span>
            </div>

            {primary.map(ind => <IndicatorCard key={ind.name} ind={ind} />)}

            {others.length > 0 && (
              <Collapse ghost items={[{
                key: 'others',
                label: <span>其他指标预测 <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{others.length}</span></span>,
                children: others.map(ind => <IndicatorCard key={ind.name} ind={ind} />),
              }]} />
            )}

            {/* CPS 业务联动 */}
            {data.cps_linkage && (
              <PanelCard title={<span><RiseOutlined style={{ color: COLORS.success, marginRight: 6 }} />CPS 业务联动</span>}
                subtitle={`有真实日流速(锚点 ${data.cps_linkage.as_of}) · 续费日均 ¥${fmt(data.cps_linkage.renewal_daily)}/新签日均 ¥${fmt(data.cps_linkage.newsign_daily)}`}
                style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {data.cps_linkage.horizons.map(h => (
                    <div key={h.key} style={{ flex: 1, minWidth: 130, padding: '8px 10px', background: 'var(--bg-muted)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{h.label}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', marginTop: 2 }}>¥{fmt(h.p50)}</div>
                      <ConfBadge level={h.confidence} />
                    </div>
                  ))}
                </div>
              </PanelCard>
            )}

            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-3)' }}>
              * KPI 为季度快照口径：本季度已过 {data.quarter_time_progress_pct}%，置信较高；越靠后的季度越依赖外推与因素假设，请按"情景参考"看待。
            </div>
          </>
        )}
      </Spin>
    </div>
  );
}

export default ForecastPage;
