import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, Empty, Row, Spin, Button, message } from 'antd';
import dayjs from 'dayjs';
import CpsFilterBar from '../../components/cps/CpsFilterBar';
import CpsKpiCards from '../../components/cps/CpsKpiCards';
import CpsTrendChart from '../../components/cps/CpsTrendChart';
import { cpsService } from '../../services/cpsService';

export default function CpsDashboardPage() {
  const [granularity, setGranularity] = useState('day');
  const [range, setRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);
  const [channels, setChannels] = useState([]);
  const [products, setProducts] = useState([]);
  const [channelIds, setChannelIds] = useState([]);
  const [productIds, setProductIds] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);

  useEffect(() => {
    cpsService.getChannels().then(res => setChannels(res.data || [])).catch(() => {});
    cpsService.getProducts().then(res => setProducts(res.data || [])).catch(() => {});
  }, []);

  const params = useMemo(() => ({
    granularity,
    start_date: range?.[0]?.format('YYYY-MM-DD'),
    end_date: range?.[1]?.format('YYYY-MM-DD'),
    channel_ids: channelIds.join(','),
    product_ids: productIds.join(','),
  }), [granularity, range, channelIds, productIds]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await cpsService.getDashboard(params);
      if (res.code === 0) setData(res.data);
      else message.error(res.message || '加载失败');
    } catch (err) {
      message.error(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [params]);

  const runAi = async () => {
    setAiLoading(true);
    try {
      const res = await cpsService.periodAnalysis(params);
      if (res.code === 0) setAiInsight(res.data);
      else message.error(res.message || 'AI 分析失败');
    } catch (err) {
      message.error(err.message || 'AI 分析失败');
    } finally {
      setAiLoading(false);
    }
  };

  const alerts = data?.alerts_active || [];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>连包投流 · 业务看板</h2>

      <CpsFilterBar
        granularity={granularity}
        onGranularityChange={setGranularity}
        range={range}
        onRangeChange={setRange}
        channels={channels}
        products={products}
        channelIds={channelIds}
        productIds={productIds}
        onChannelChange={setChannelIds}
        onProductChange={setProductIds}
      />

      {alerts.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`当前有 ${alerts.length} 条未处理预警`}
          description={alerts.slice(0, 3).map(a => a.message).join(' ｜ ')}
        />
      )}

      <Spin spinning={loading}>
        <CpsKpiCards summary={data?.summary || {}} />
        <CpsTrendChart data={data?.trend || []} />

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={16}>
            <Card title="渠道-产品矩阵">
              {data?.matrix?.length ? (
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(data.matrix, null, 2)}</pre>
              ) : <Empty />}
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card
              title="AI 周期分析"
              extra={<Button loading={aiLoading} onClick={runAi}>生成分析</Button>}
            >
              {aiInsight ? (
                <pre style={{ whiteSpace: 'pre-wrap' }}>{typeof aiInsight === 'string' ? aiInsight : JSON.stringify(aiInsight, null, 2)}</pre>
              ) : (
                <Empty description="点击生成 AI 分析" />
              )}
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}
