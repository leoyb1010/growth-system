import React from 'react';
import { Card, Row, Col, Segmented, DatePicker, Select } from 'antd';

const GRANULARITY_OPTIONS = [
  { label: '日', value: 'day' },
  { label: '周', value: 'week' },
  { label: '月', value: 'month' },
  { label: '季度', value: 'quarter' },
  { label: '半年', value: 'half_year' },
  { label: '年度', value: 'year' },
];

export default function CpsFilterBar({
  granularity,
  onGranularityChange,
  range,
  onRangeChange,
  channels = [],
  products = [],
  channelIds = [],
  productIds = [],
  onChannelChange,
  onProductChange,
  showGranularity = true,
}) {
  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Row gutter={[12, 12]} align="middle">
        {showGranularity && (
          <Col>
            <Segmented options={GRANULARITY_OPTIONS} value={granularity} onChange={onGranularityChange} />
          </Col>
        )}
        <Col>
          <DatePicker.RangePicker value={range} onChange={onRangeChange} allowClear={false} />
        </Col>
        <Col>
          <Select
            mode="multiple"
            allowClear
            placeholder="渠道：默认全部"
            style={{ width: 260 }}
            value={channelIds}
            onChange={onChannelChange}
            maxTagCount={2}
            options={channels.map(c => ({ label: c.name, value: c.id }))}
          />
        </Col>
        <Col>
          <Select
            mode="multiple"
            allowClear
            placeholder="产品：默认全部"
            style={{ width: 300 }}
            value={productIds}
            onChange={onProductChange}
            maxTagCount={2}
            options={products.map(p => ({ label: p.name, value: p.id }))}
          />
        </Col>
      </Row>
    </Card>
  );
}
