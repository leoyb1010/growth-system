import React, { useEffect, useState, useRef } from 'react';
import { Row, Col, Card, Statistic, DatePicker, Select, Spin, Empty, Space, Tooltip } from 'antd';
import { DollarOutlined, TeamOutlined, RiseOutlined, AlertOutlined, FallOutlined, FileTextOutlined } from '@ant-design/icons';
import { cpsApi, cpsBus } from '../../services/cpsService';
import dayjs from 'dayjs';

function CpsDashboardTab({ channelId }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [range, setRange] = useState(null);
  const [channels, setChannels] = useState([]);
  const [products, setProducts] = useState([]);
  const [selChannels, setSelChannels] = useState(channelId ? [channelId] : []);
  const [selProducts, setSelProducts] = useState([]);
  const canvasRef = useRef(null);

  useEffect(() => {
    cpsApi.getChannels().then(r => { if (r.code === 0) setChannels(r.data || []); }).catch(() => {});
    cpsApi.getProducts().then(r => { if (r.code === 0) setProducts(r.data || []); }).catch(() => {});
  }, []);

  useEffect(() => { fetchData(); }, [range, selChannels, selProducts]);
  useEffect(() => { const off = cpsBus.on((e) => { if (e === 'metrics:changed' || e === 'alerts:changed') fetchData(); }); return off; }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (range && range[0] && range[1]) { params.start_date = range[0].format('YYYY-MM-DD'); params.end_date = range[1].format('YYYY-MM-DD'); }
      if (selChannels.length) params.channel_ids = selChannels.join(',');
      if (selProducts.length) params.product_ids = selProducts.join(',');
      const res = await cpsApi.getDashboard(params);
      if (res.code === 0) setData(res.data);
    } catch (err) {}
    setLoading(false);
  };

  useEffect(() => {
    if (!data?.trend?.length || !canvasRef.current) return;
    drawTrend(canvasRef.current, data.trend);
  }, [data]);

  const fmt = (v) => {
    const n = Number(v || 0);
    if (Math.abs(n) >= 10000) return (n / 10000).toFixed(1) + '万';
    return Number(n.toFixed(0)).toLocaleString();
  };
  const fmtRate = (v) => (Number(v || 0) * 100).toFixed(1) + '%';

  const renderRow = (title, d, extra = null) => (
    <Card size="small" title={<span style={{ fontSize: 13, fontWeight: 500 }}>{title}</span>} extra={extra} style={{ marginBottom: 8 }}>
      <Row gutter={8}>
        <Col span={4}><Statistic title="有效签约" value={fmt(d?.effective_count || 0)} valueStyle={{ fontSize: 18, fontWeight: 600 }} /></Col>
        <Col span={4}><Statistic title="有效收入" value={fmt(d?.effective_amount)} prefix="¥" valueStyle={{ fontSize: 18, fontWeight: 600, color: '#1890ff' }} /></Col>
        <Col span={4}><Statistic title="新签退款" value={fmt(d?.new_refund || 0)} valueStyle={{ fontSize: 18, color: '#cf1322' }} /></Col>
        <Col span={3}><Statistic title="新签" value={fmt(d?.new_sign || 0)} valueStyle={{ fontSize: 18 }} /></Col>
        <Col span={3}><Statistic title="续费" value={fmt(d?.renewal || 0)} valueStyle={{ fontSize: 18 }} /></Col>
        {extra}
      </Row>
    </Card>
  );

  return (
    <Spin spinning={loading}>
      <div style={{ marginBottom: 12 }}>
        <Space wrap>
          <DatePicker.RangePicker value={range} onChange={setRange} allowClear placeholder={['开始', '结束']} size="small" />
          {!channelId && <Select mode="multiple" placeholder="渠道" allowClear size="small" value={selChannels} onChange={setSelChannels} style={{ minWidth: 150 }} maxTagCount={2}>{channels.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}</Select>}
          <Select mode="multiple" placeholder="产品" allowClear size="small" value={selProducts} onChange={setSelProducts} style={{ minWidth: 150 }} maxTagCount={2}>{products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select>
        </Space>
      </div>

      {!data ? <Empty description="暂无数据" /> : (
        <>
          {/* Row 1: 年度 */}
          {renderRow(`📊 年度数据 (${new Date().getFullYear()})`, data.yearly,
            <Col span={6}><Statistic title="活跃渠道" value={data.channel_count || 0} prefix={<TeamOutlined />} valueStyle={{ fontSize: 18 }} /></Col>
          )}

          {/* Row 2: 当季 */}
          {renderRow(`📅 当季数据 (Q${Math.ceil((new Date().getMonth()+1)/3)})`, data.quarterly,
            <>
              <Col span={3}><Statistic title="退款率" value={fmtRate(data.quarterly?.refund_rate)} valueStyle={{ fontSize: 18, color: (data.quarterly?.refund_rate||0) > 0.05 ? '#cf1322' : '#3f8600' }} /></Col>
              <Col span={3}><Statistic title="预警" value={data.alert_count || 0} prefix={<AlertOutlined />} valueStyle={{ fontSize: 18, color: data.alert_count > 0 ? '#cf1322' : '#3f8600' }} /></Col>
            </>
          )}

          {/* Row 3: T-1 */}
          {renderRow(`📋 昨日数据 (${dayjs().subtract(1,'day').format('MM-DD')})`, data.daily,
            <Col span={6}><Statistic title="开放预警" value={data.alert_count || 0} prefix={<AlertOutlined />} valueStyle={{ fontSize: 18, color: data.alert_count > 0 ? '#cf1322' : '#3f8600' }} /></Col>
          )}

          {/* Trend Chart */}
          <Card size="small" title="📈 趋势图" style={{ marginTop: 8 }}>
            <canvas ref={canvasRef} width={760} height={200} style={{ width: '100%', maxHeight: 220 }} />
          </Card>
        </>
      )}
    </Spin>
  );
}

function drawTrend(canvas, trend) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { top: 20, right: 20, bottom: 30, left: 70 };
  const pw = W - pad.left - pad.right, ph = H - pad.top - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  const amounts = trend.map(t => t.effective_amount);
  const max = Math.max(...amounts, 1);
  const points = trend.length;
  const xStep = points > 1 ? pw / (points - 1) : pw;

  // Grid
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (ph * i / 4);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
    ctx.fillStyle = '#999'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(max * (4-i) / 4 / 10000) + '万', pad.left - 5, y + 3);
  }

  // Area fill
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + ph);
  trend.forEach((t, i) => {
    const x = pad.left + i * xStep;
    const y = pad.top + ph - (t.effective_amount / max) * ph;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(pad.left + (points - 1) * xStep, pad.top + ph);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ph);
  grad.addColorStop(0, 'rgba(24,144,255,0.3)');
  grad.addColorStop(1, 'rgba(24,144,255,0.02)');
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = '#1890ff';
  ctx.lineWidth = 2;
  trend.forEach((t, i) => {
    const x = pad.left + i * xStep;
    const y = pad.top + ph - (t.effective_amount / max) * ph;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Date labels (every 10th)
  ctx.fillStyle = '#666'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
  trend.forEach((t, i) => {
    if (i % Math.max(1, Math.floor(points / 8)) === 0 || i === points - 1) {
      const x = pad.left + i * xStep;
      ctx.fillText(t.date.slice(5), x, H - 5);
    }
  });
}

export default CpsDashboardTab;
