import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Statistic, DatePicker, Select, Spin, Empty, Space, Radio, Tag, Tooltip } from 'antd';
import { AlertOutlined, FallOutlined, InfoCircleOutlined, RiseOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { cpsApi, cpsBus } from '../../services/cpsService';
import dayjs from 'dayjs';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const fmtMoney = (value) => {
  const number = Number(value || 0);
  if (Math.abs(number) >= 10000) return `${(number / 10000).toFixed(1)}万`;
  return number.toFixed(0);
};

const fmtRate = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`;

function MiniStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '4px 0' }}>
      <div style={{ fontSize: 11, color: '#999' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: color || '#333', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function CpsDashboardTab({ channelId }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [range, setRange] = useState(null);
  const [granularity, setGranularity] = useState('day');
  const [channels, setChannels] = useState([]);

  const handleGranularityChange = (g) => {
    setGranularity(g);
    if (g === 'day') setRange([dayjs().subtract(29, 'day'), dayjs()]);
    else if (g === 'week') setRange([dayjs().startOf('week'), dayjs()]);
    else if (g === 'month') setRange([dayjs().startOf('month'), dayjs()]);
  };
  const [products, setProducts] = useState([]);
  const [selChannels, setSelChannels] = useState(channelId ? [channelId] : []);
  const [selProducts, setSelProducts] = useState([]);

  useEffect(() => {
    cpsApi.getChannels().then(res => { if (res.code === 0) setChannels(res.data || []); }).catch(() => {});
    cpsApi.getProducts().then(res => { if (res.code === 0) setProducts(res.data || []); }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
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

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    const off = cpsBus.on(event => {
      if (event === 'metrics:changed') fetchData();
    });
    return off;
  }, [fetchData]);

  const period = data?.period || {};
  const yearly = data?.yearly || {};
  const quarterly = data?.quarterly || {};
  const daily = data?.daily || {};

  const trendOption = useMemo(() => {
    if (!data?.trend?.length) return null;
    const dates = data.trend.map(item => granularity === 'day' ? String(item.date).slice(5) : item.date);

    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      legend: { bottom: 0, data: ['实际收入', '新签', '续费'] },
      grid: { left: 60, right: 60, top: 20, bottom: 50 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { fontSize: 11, rotate: dates.length > 15 ? 30 : 0 },
      },
      yAxis: [
        {
          type: 'value',
          name: '金额(万)',
          position: 'left',
          axisLabel: { formatter: value => (value / 10000).toFixed(0) },
          splitLine: { lineStyle: { type: 'dashed', color: '#eee' } },
        },
        {
          type: 'value',
          name: '笔数',
          position: 'right',
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '实际收入',
          type: 'line',
          yAxisIndex: 0,
          data: data.trend.map(item => item.amount),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2.5, color: '#1890ff' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(24,144,255,0.25)' },
              { offset: 1, color: 'rgba(24,144,255,0.02)' },
            ]),
          },
        },
        {
          name: '新签',
          type: 'line',
          yAxisIndex: 1,
          data: data.trend.map(item => item.new_sign),
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.8, color: '#52c41a' },
        },
        {
          name: '续费',
          type: 'line',
          yAxisIndex: 1,
          data: data.trend.map(item => item.renewal),
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.8, color: '#faad14' },
        },
      ],
    };
  }, [data, granularity]);

  if (!data && !loading) return <Empty description="暂无数据" />;

  return (
    <Spin spinning={loading}>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <DatePicker.RangePicker value={range} onChange={setRange} allowClear placeholder={['开始','结束']} size="small" />
          <Radio.Group value={granularity} onChange={event => handleGranularityChange(event.target.value)} size="small">
            <Radio.Button value="day">按日</Radio.Button>
            <Radio.Button value="week">按周</Radio.Button>
            <Radio.Button value="month">按月</Radio.Button>
          </Radio.Group>
          {!channelId && (
            <Select
              mode="multiple"
              placeholder="渠道(全部)"
              allowClear
              value={selChannels}
              onChange={setSelChannels}
              style={{ minWidth: 160 }}
              maxTagCount={2}
            >
              {channels.map(channel => <Select.Option key={channel.id} value={channel.id}>{channel.name}</Select.Option>)}
            </Select>
          )}
          <Select
            mode="multiple"
            placeholder="产品(全部)"
            allowClear
            value={selProducts}
            onChange={setSelProducts}
            style={{ minWidth: 160 }}
            maxTagCount={2}
          >
            {products.map(product => <Select.Option key={product.id} value={product.id}>{product.name}</Select.Option>)}
          </Select>
        </Space>
      </Card>

      <div style={{ marginBottom: 8, color: '#666', fontSize: 13 }}>
        <Tag color="blue">本期</Tag>{data?.period_range?.start} ~ {data?.period_range?.end}
      </div>
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="实际收入" value={fmtMoney(period.actual_amount)} prefix="¥" valueStyle={{ color: '#1890ff', fontSize: 22 }} />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>有效收入 ¥{fmtMoney(period.effective_amount)}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic title="实际签约" value={period.actual_count || 0} suffix="单" valueStyle={{ fontSize: 22 }} />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>新签 {period.new_sign || 0} / 续费 {period.renewal || 0}</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="退款率"
              value={(Number(period.refund_rate || 0) * 100).toFixed(2)}
              suffix="%"
              valueStyle={{ color: (period.refund_rate || 0) > 0.05 ? '#cf1322' : '#3f8600', fontSize: 22 }}
              prefix={(period.refund_rate || 0) > 0.05 ? <RiseOutlined /> : <FallOutlined />}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>退款 {(period.new_refund || 0) + (period.renewal_refund || 0)} 笔</div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="开放预警"
              value={data?.alert_count || 0}
              prefix={<AlertOutlined />}
              valueStyle={{ color: data?.alert_count > 0 ? '#cf1322' : '#3f8600', fontSize: 22 }}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>客诉 {period.complaints || 0} 件</div>
          </Card>
        </Col>
      </Row>

      {trendOption && (
        <Card size="small" title="实际收入与签约趋势" style={{ marginBottom: 12 }}>
          <ReactEChartsCore echarts={echarts} option={trendOption} style={{ height: 280 }} notMerge />
        </Card>
      )}

      <Card
        size="small"
        title={(
          <Space>
            <span>固定窗口对照</span>
            <Tooltip title="这三组数据是固定时间窗口，不受上方时间筛选影响，只跟随渠道和产品筛选。">
              <InfoCircleOutlined style={{ color: '#999' }} />
            </Tooltip>
          </Space>
        )}
      >
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={8}>
            <div style={miniBox}>
              <div style={miniTitle}>年累计 · {new Date().getFullYear()}</div>
              <Row gutter={8}>
                <Col span={12}><MiniStat label="实际收入" value={`¥${fmtMoney(yearly.actual_amount)}`} color="#1890ff" /></Col>
                <Col span={12}><MiniStat label="实际签约" value={yearly.actual_count || 0} /></Col>
              </Row>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={miniBox}>
              <div style={miniTitle}>当季 · Q{Math.ceil((new Date().getMonth() + 1) / 3)}</div>
              <Row gutter={8}>
                <Col span={12}><MiniStat label="实际收入" value={`¥${fmtMoney(quarterly.actual_amount)}`} color="#1890ff" /></Col>
                <Col span={12}><MiniStat label="退款率" value={fmtRate(quarterly.refund_rate)} color={quarterly.refund_rate > 0.05 ? '#cf1322' : '#3f8600'} /></Col>
              </Row>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={miniBox}>
              <div style={miniTitle}>昨日 · {dayjs().subtract(1, 'day').format('MM-DD')}</div>
              <Row gutter={8}>
                <Col span={12}><MiniStat label="实际收入" value={`¥${fmtMoney(daily.actual_amount)}`} color="#1890ff" /></Col>
                <Col span={12}><MiniStat label="实际签约" value={daily.actual_count || 0} /></Col>
              </Row>
            </div>
          </Col>
        </Row>
      </Card>
    </Spin>
  );
}

const miniBox = { background: '#fafafa', borderRadius: 6, padding: 10 };
const miniTitle = { fontSize: 12, color: '#666', marginBottom: 6, fontWeight: 500 };

export default CpsDashboardTab;
