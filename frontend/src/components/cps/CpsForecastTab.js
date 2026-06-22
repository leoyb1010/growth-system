import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Select, Segmented, Slider, Switch, InputNumber, Button, Spin, Empty, Tag, Tooltip, Modal, Space, message } from 'antd';
import { RobotOutlined, InfoCircleOutlined, ThunderboltOutlined, AimOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkAreaComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { cpsApi } from '../../services/cpsService';
import SectionHeader from '../ui/SectionHeader';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, MarkAreaComponent, CanvasRenderer]);

const COLORS = { primary: '#3B5AFB', success: '#16A34A', warning: '#F59E0B', error: '#DC2626', muted: '#9CA3AF' };

const CONFIDENCE = {
  high: { label: '高置信', color: COLORS.success, bg: '#DCFCE7' },
  medium: { label: '中置信', color: COLORS.warning, bg: '#FEF3C7' },
  low: { label: '低置信·情景参考', color: COLORS.muted, bg: '#F3F4F6' },
};

const FACTOR_PRESETS = [
  { label: '停投', value: 0 },
  { label: '腰斩', value: 50 },
  { label: '维持', value: 100 },
  { label: '加投', value: 150 },
];

const fmtMoney = (value) => {
  const n = Number(value || 0);
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)}万`;
  return n.toFixed(0);
};
const fmtPct = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v}%`);

function ConfidenceBadge({ level }) {
  const c = CONFIDENCE[level] || CONFIDENCE.low;
  return <span style={{ fontSize: 11, fontWeight: 600, color: c.color, background: c.bg, padding: '2px 8px', borderRadius: 6 }}>{c.label}</span>;
}

function ForecastCard({ h, scenarioActive }) {
  const deltaNeg = (h.delta?.amount || 0) < 0;
  const deltaColor = (h.delta?.amount || 0) === 0 ? 'var(--text-3)' : deltaNeg ? COLORS.error : COLORS.success;
  return (
    <div className="surface-card-secondary" style={{ padding: 18, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, right: 0, width: 56, height: 4, background: COLORS.primary }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{h.label}</span>
        <ConfidenceBadge level={h.confidence} />
      </div>
      <div style={{ fontSize: 26, lineHeight: 1.1, fontWeight: 700, color: 'var(--text-1)' }}>¥{fmtMoney(h.baseline.p50)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>中性区间 ¥{fmtMoney(h.baseline.p25)} ~ ¥{fmtMoney(h.baseline.p75)}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
        已落袋 ¥{fmtMoney(h.actual_to_date)} · 待预测 {h.projected_days} 天
      </div>
      {scenarioActive && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-soft)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>情景预测</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>¥{fmtMoney(h.scenario.p50)}</span>
          </div>
          <div style={{ marginTop: 4, textAlign: 'right', fontSize: 13, fontWeight: 700, color: deltaColor }}>
            {deltaNeg ? '▼' : (h.delta.amount > 0 ? '▲' : '')} ¥{fmtMoney(Math.abs(h.delta.amount))}（{fmtPct(h.delta.pct)}）
          </div>
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-3)', display: 'flex', justifyContent: 'space-between' }}>
        <span>续费地板 ¥{fmtMoney(h.breakdown.renewal_floor)}</span>
        <span>新签 ¥{fmtMoney(scenarioActive ? h.breakdown.newsign_scenario : h.breakdown.newsign_baseline)}</span>
      </div>
    </div>
  );
}

function CpsForecastTab({ channelId }) {
  const [channels, setChannels] = useState([]);
  const [products, setProducts] = useState([]);
  const [selChannels, setSelChannels] = useState([]);
  const [selProducts, setSelProducts] = useState([]);

  const [factor, setFactor] = useState(100);          // 新签强度 %
  const [recover, setRecover] = useState(false);
  const [recoverDays, setRecoverDays] = useState(14);
  const [decay, setDecay] = useState(0);              // 续费衰减 %/月
  const [targetProducts, setTargetProducts] = useState([]); // 情景作用的产品线(空=全部)

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true); // 初始即加载态，避免首屏闪"暂无数据"
  const [aiInsight, setAiInsight] = useState(null);
  const [aiVisible, setAiVisible] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const scenarioActive = factor !== 100 || decay > 0;

  useEffect(() => {
    cpsApi.getChannels().then(res => { if (res.code === 0) setChannels(res.data || []); }).catch(() => {});
    cpsApi.getProducts().then(res => { if (res.code === 0) setProducts(res.data || []); }).catch(() => {});
  }, []);

  const buildScenarioParams = useCallback(() => {
    const p = {};
    if (selChannels.length) p.channel_ids = selChannels.join(',');
    if (selProducts.length) p.product_ids = selProducts.join(',');
    p.new_sign_factor = factor / 100;
    if (recover) p.recover_after_days = recoverDays;
    if (decay > 0) p.renewal_decay_monthly = decay / 100;
    if (targetProducts.length) p.target_product_ids = targetProducts.join(',');
    return p;
  }, [selChannels, selProducts, factor, recover, recoverDays, decay, targetProducts]);

  const fetchForecast = useCallback(async () => {
    setLoading(true);
    try {
      const res = await cpsApi.getForecast(buildScenarioParams());
      if (res.code === 0) setData(res.data);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [buildScenarioParams]);

  // 防抖：拖动滑块/连续调参时合并为一次请求，避免猛刷线上接口
  useEffect(() => {
    const t = setTimeout(() => { fetchForecast(); }, 350);
    return () => clearTimeout(t);
  }, [fetchForecast]);

  const openAi = async () => {
    setAiLoading(true);
    try {
      const res = await cpsApi.forecastInsight(buildScenarioParams());
      if (res.code === 0) { setAiInsight(res.data); setAiVisible(true); }
      else message.error(res.message || 'AI 解读失败');
    } catch {
      message.error('AI 解读失败');
    } finally {
      setAiLoading(false);
    }
  };

  const model = data?.model || {};
  const series = useMemo(() => data?.series_weekly || [], [data]);

  const chartOption = useMemo(() => {
    if (!series.length) return null;
    const dates = series.map(s => String(s.week).slice(5));
    const lastActualIdx = series.reduce((acc, s, i) => (s.actual != null ? i : acc), 0);
    const seriesArr = [
      {
        name: '历史实际', type: 'line', smooth: true, symbol: 'circle', symbolSize: 5,
        data: series.map(s => s.actual), connectNulls: false,
        lineStyle: { width: 2.5, color: COLORS.primary },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(59,90,251,0.18)' }, { offset: 1, color: 'rgba(59,90,251,0.01)' }]) },
        markLine: {
          symbol: 'none', silent: true,
          data: [{ xAxis: dates[lastActualIdx], label: { formatter: '今天', color: COLORS.muted, fontSize: 10 }, lineStyle: { type: 'dashed', color: COLORS.muted } }],
        },
      },
      { name: '基准预测', type: 'line', smooth: true, symbol: 'none', data: series.map(s => s.baseline), connectNulls: true, lineStyle: { width: 2, color: COLORS.success, type: 'dashed' } },
    ];
    if (scenarioActive) {
      seriesArr.push({ name: '情景预测', type: 'line', smooth: true, symbol: 'none', data: series.map(s => s.scenario), connectNulls: true, lineStyle: { width: 2, color: COLORS.error, type: 'dashed' } });
    }
    return {
      tooltip: { trigger: 'axis', valueFormatter: v => (v == null ? '—' : `¥${fmtMoney(v)}`) },
      legend: { bottom: 0, data: seriesArr.map(s => s.name) },
      grid: { left: 56, right: 24, top: 16, bottom: 44 },
      xAxis: { type: 'category', data: dates, axisLabel: { fontSize: 10, color: COLORS.muted, rotate: dates.length > 18 ? 35 : 0 } },
      yAxis: { type: 'value', name: '周实收(万)', axisLabel: { color: COLORS.muted, formatter: v => (v / 10000).toFixed(0) }, splitLine: { lineStyle: { type: 'dashed', color: '#E5E7EB' } } },
      series: seriesArr,
    };
  }, [series, scenarioActive]);

  if (!data && !loading) return <Empty description="暂无预测数据" />;
  const insufficient = data?.insufficient_data;

  return (
    <Spin spinning={loading}>
      {/* 维度筛选 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 14, borderBottom: '1px solid var(--border-soft)' }}>
        {!channelId && (
          <Select mode="multiple" placeholder="渠道(全部)" allowClear value={selChannels} onChange={setSelChannels} style={{ minWidth: 170 }} maxTagCount={2}>
            {channels.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
          </Select>
        )}
        <Select mode="multiple" placeholder="产品(全部)" allowClear value={selProducts} onChange={setSelProducts} style={{ minWidth: 170 }} maxTagCount={2}>
          {products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
        </Select>
        <Button size="small" type="primary" ghost icon={<RobotOutlined />} loading={aiLoading} onClick={openAi} disabled={insufficient}>AI 预测解读</Button>
      </div>

      {insufficient ? (
        <Empty description={data?.message || '连续日数据不足，无法给出可信预测'} />
      ) : (
        <>
          {/* 新签情景模拟器 */}
          <Card size="small" style={{ marginBottom: 16, background: 'var(--bg-muted)' }}
            title={<Space><ThunderboltOutlined style={{ color: COLORS.warning }} /><span>新签情景模拟</span>
              <Tooltip title="续费(连包)是稳定地板，业务波动主要来自新签。拨动下面的新签强度，看它对各周期结果的冲击。">
                <InfoCircleOutlined style={{ color: 'var(--text-3)' }} />
              </Tooltip></Space>}>
            <Row gutter={[20, 12]} align="middle">
              <Col xs={24} md={10}>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>新签强度（相对近期日均）：<b style={{ color: factor < 100 ? COLORS.error : factor > 100 ? COLORS.success : 'var(--text-1)' }}>{factor}%</b></div>
                <Segmented size="small" options={FACTOR_PRESETS} value={factor} onChange={setFactor} style={{ marginBottom: 8 }} />
                <Slider min={0} max={300} step={10} value={factor} onChange={setFactor} marks={{ 0: '0', 100: '维持', 200: '2x', 300: '3x' }} />
              </Col>
              <Col xs={24} md={7}>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>
                  <Switch size="small" checked={recover} onChange={setRecover} /> <span style={{ marginLeft: 6 }}>设定恢复</span>
                </div>
                <Space>
                  <InputNumber size="small" min={1} max={180} disabled={!recover} value={recoverDays} onChange={v => setRecoverDays(v || 1)} addonAfter="天后恢复" style={{ width: 150 }} />
                </Space>
              </Col>
              <Col xs={24} md={7}>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>续费月衰减：<b>{decay}%/月</b>
                  <Tooltip title="情景假设：从生效日起，(目标)产品线的续费按此比例逐月线性流失，可蚀到 0。用于模拟停止获客后续包用户的自然跑掉。独立于新签强度——只拉这个也会生效。">
                    <InfoCircleOutlined style={{ color: 'var(--text-3)', marginLeft: 4 }} />
                  </Tooltip>
                </div>
                <Slider min={0} max={40} step={1} value={decay} onChange={setDecay} marks={{ 0: '0', 20: '20%', 40: '40%' }} />
              </Col>
            </Row>
            <Row style={{ marginTop: 4 }}>
              <Col span={24}>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 6 }}>情景作用范围
                  <Tooltip title="默认作用于全部产品线。选定某条/某几条产品线后，上面的新签强度与续费衰减只作用于这些线，其余产品线维持基准——用于'停某条产品线'的测算。">
                    <InfoCircleOutlined style={{ color: 'var(--text-3)', marginLeft: 4 }} />
                  </Tooltip>
                </div>
                <Select mode="multiple" allowClear placeholder="全部产品线（不指定）" value={targetProducts} onChange={setTargetProducts}
                  style={{ width: '100%' }} maxTagCount={4} optionFilterProp="children">
                  {(data?.product_breakdown || []).map(p => (
                    <Select.Option key={p.product_id} value={p.product_id}>{p.name}（日均¥{fmtMoney(p.total_daily)}·{p.share_pct}%）</Select.Option>
                  ))}
                </Select>
              </Col>
            </Row>
          </Card>

          {/* 模型口径 */}
          <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--text-2)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Tag color="blue">锚点 {data?.as_of}</Tag>
            <span>连续数据 {data?.data_days} 天</span>
            <span>· 续费日均 ¥{fmtMoney(model.renewal_daily)}</span>
            <span>· 新签日均 ¥{fmtMoney(model.newsign_daily)}</span>
            <Tag color={model.renewal_share_pct >= 60 ? 'green' : 'gold'}>续费占比 {model.renewal_share_pct}%</Tag>
            <span>· 日波动 ¥{fmtMoney(model.daily_volatility)}</span>
            <span>· 趋势 R² {model.trend_r2}</span>
          </div>

          {/* 产品线拆分 */}
          {(data?.product_breakdown || []).length > 0 && (
            <Card size="small" title={<Space><span>产品线拆分</span>
              <Tooltip title="按近窗净日均拆分各产品线。点「停此线」= 该线新签归零 + 续费按30%/月跑掉(可在上方继续调衰减)，看停掉这条线对各周期的影响。">
                <InfoCircleOutlined style={{ color: 'var(--text-3)' }} /></Tooltip></Space>} style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                {data.product_breakdown.slice(0, 12).map(p => {
                  const isTarget = targetProducts.includes(p.product_id);
                  return (
                    <div key={p.product_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-soft)', background: isTarget ? '#FEF2F2' : 'var(--bg-muted)' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>日均 ¥{fmtMoney(p.total_daily)} · 占{p.share_pct}% · 新签{fmtMoney(p.newsign_daily)}/续费{fmtMoney(p.renewal_daily)}</div>
                      </div>
                      <Button size="small" danger={!isTarget} type={isTarget ? 'primary' : 'default'}
                        onClick={() => {
                          if (isTarget) { setTargetProducts([]); setFactor(100); setDecay(0); }
                          else { setTargetProducts([p.product_id]); setFactor(0); setDecay(30); }
                        }}>{isTarget ? '恢复' : '停此线'}</Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <SectionHeader title="分周期预测" subtitle="中性值 + 区间 + 置信度；情景开启后显示对比与缺口" icon={<AimOutlined style={{ color: COLORS.primary }} />} />
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            {(data?.horizons || []).map(h => (
              <Col xs={24} sm={12} lg={6} key={h.key}><ForecastCard h={h} scenarioActive={scenarioActive} /></Col>
            ))}
          </Row>

          {chartOption && (
            <Card size="small" title="周实收：历史实际 → 预测分叉" style={{ marginBottom: 8 }}>
              <ReactEChartsCore echarts={echarts} option={chartOption} style={{ height: 300 }} notMerge />
            </Card>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            * 预测为统计模型(续费地板+新签弹性+阻尼趋势)推演，越长周期不确定性越大；本年度等长周期请按"情景参考"看待。
          </div>
        </>
      )}

      <Modal title="AI 预测解读" open={aiVisible} onCancel={() => setAiVisible(false)} footer={<Button type="primary" onClick={() => setAiVisible(false)}>关闭</Button>} width={760}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{aiInsight?.headline || '暂无结论'}</div>
        {aiInsight?.confidence_note && <p style={{ color: 'var(--text-2)' }}>{aiInsight.confidence_note}</p>}
        {(aiInsight?.drivers || []).length > 0 && <Card size="small" title="关键因子" style={{ marginBottom: 12 }}>{aiInsight.drivers.map((d, i) => <div key={i} style={{ marginBottom: 6 }}>- <b>{d.factor}</b>：{d.reading}（{d.evidence}）</div>)}</Card>}
        {(aiInsight?.horizon_reads || []).length > 0 && <Card size="small" title="分周期解读" style={{ marginBottom: 12 }}>{aiInsight.horizon_reads.map((h, i) => <div key={i} style={{ marginBottom: 6 }}>- <b>{h.horizon}</b>（{h.confidence}）：{h.read}</div>)}</Card>}
        {aiInsight?.scenario_read && <Card size="small" title="情景解读" style={{ marginBottom: 12 }}><div>{aiInsight.scenario_read}</div></Card>}
        {(aiInsight?.risks || []).length > 0 && <Card size="small" title="风险关注" style={{ marginBottom: 12 }}>{aiInsight.risks.map((r, i) => <div key={i} style={{ marginBottom: 6 }}>- [{r.level}] {r.risk}：{r.evidence ? `${r.evidence}，` : ''}{r.suggestion}</div>)}</Card>}
        {(aiInsight?.actions || []).length > 0 && <Card size="small" title="建议动作">{aiInsight.actions.map((a, i) => <div key={i} style={{ marginBottom: 6 }}>- {a.owner} {a.action} {a.priority ? `（${a.priority}）` : ''}{a.watch_metric ? `｜盯：${a.watch_metric}` : ''}</div>)}</Card>}
      </Modal>
    </Spin>
  );
}

export default CpsForecastTab;
