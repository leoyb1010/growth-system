import React from 'react';
import { Row, Col, Card, Statistic, Tag } from 'antd';

function formatValue(value, isRate) {
  if (isRate) return `${((Number(value) || 0) * 100).toFixed(2)}%`;
  return (Number(value) || 0).toLocaleString();
}

function KpiCard({ title, value, isRate, warningAt, dangerAt, suffix }) {
  const v = Number(value) || 0;
  let color;
  let tag;

  if (isRate && dangerAt !== undefined && v >= dangerAt) {
    color = '#ff4d4f';
    tag = <Tag color="red">严重</Tag>;
  } else if (isRate && warningAt !== undefined && v >= warningAt) {
    color = '#faad14';
    tag = <Tag color="orange">关注</Tag>;
  }

  return (
    <Col xs={24} sm={12} md={8} lg={6} xl={4}>
      <Card size="small">
        <Statistic title={title} value={formatValue(v, isRate)} suffix={suffix} valueStyle={{ color }} />
        {tag && <div style={{ marginTop: 8 }}>{tag}</div>}
      </Card>
    </Col>
  );
}

export default function CpsKpiCards({ summary = {} }) {
  return (
    <Row gutter={[16, 16]}>
      <KpiCard title="新签约数" value={summary.new_sign_count} />
      <KpiCard title="续费订单" value={summary.renewal_count} />
      <KpiCard title="实际订单数" value={summary.actual_count} />
      <KpiCard title="有效签约数" value={summary.effective_count} />
      <KpiCard title="有效收入" value={summary.effective_amount} suffix="元" />
      <KpiCard title="新签退款率" value={summary.new_refund_rate} isRate warningAt={0.1} />
      <KpiCard title="续费退款率" value={summary.renewal_refund_rate} isRate warningAt={0.08} />
      <KpiCard title="售后退款率" value={summary.after_sale_refund_rate} isRate warningAt={0.05} />
      <KpiCard title="7日客诉率" value={summary.complaint_rate_7d} isRate warningAt={0.008} dangerAt={0.01} />
    </Row>
  );
}
