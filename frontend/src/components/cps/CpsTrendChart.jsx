import React, { useMemo } from 'react';
import { Card, Empty } from 'antd';
import ReactECharts from 'echarts-for-react';

export default function CpsTrendChart({ data = [] }) {
  const option = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['新签约数', '续费订单', '有效收入', '退款数'] },
    grid: { left: 48, right: 56, top: 48, bottom: 40 },
    xAxis: { type: 'category', data: data.map(d => d.x) },
    yAxis: [
      { type: 'value', name: '订单数' },
      { type: 'value', name: '金额', position: 'right' },
    ],
    series: [
      { name: '新签约数', type: 'line', smooth: true, data: data.map(d => d.new_sign_count || 0) },
      { name: '续费订单', type: 'line', smooth: true, data: data.map(d => d.renewal_count || 0) },
      { name: '有效收入', type: 'line', smooth: true, yAxisIndex: 1, data: data.map(d => d.effective_amount || 0) },
      { name: '退款数', type: 'bar', data: data.map(d => d.refund_count || 0) },
    ],
  }), [data]);

  return (
    <Card title="趋势" style={{ marginTop: 16 }}>
      {data.length ? <ReactECharts option={option} style={{ height: 360 }} /> : <Empty />}
    </Card>
  );
}
