import React from 'react';
import { Card, Space, Tag } from 'antd';

const MetricCard = ({
  title,
  value,
  suffix,
  hint,
  trend,
  status,
  extra,
}) => {
  const statusMap = {
    success: 'success',
    warning: 'warning',
    error: 'error',
    processing: 'processing',
  };

  return (
    <Card className="surface-card hover-lift" bodyStyle={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div className="metric-label">{title}</div>
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="metric-value">{value}</span>
            {suffix ? <span className="subtle-text">{suffix}</span> : null}
          </div>
          {hint ? <div style={{ marginTop: 8 }} className="subtle-text">{hint}</div> : null}
        </div>
        <Space direction="vertical" align="end" size={8}>
          {status ? <Tag color={statusMap[status] || 'default'}>{status}</Tag> : null}
          {extra || null}
        </Space>
      </div>
      {trend ? <div style={{ marginTop: 14 }} className="subtle-text">{trend}</div> : null}
    </Card>
  );
};

export default MetricCard;
