import React, { useEffect, useState } from 'react';
import { Button, Card, message, Space, Table, Tag } from 'antd';
import { cpsService } from '../../services/cpsService';

export default function CpsAlertPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await cpsService.getAlerts({});
      if (res.code === 0) setAlerts(res.data || []);
    } catch (err) {
      message.error(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAlerts(); }, []);

  const ack = async (id) => {
    try {
      await cpsService.ackAlert(id);
      message.success('已确认');
      fetchAlerts();
    } catch (err) {
      message.error(err.message || '操作失败');
    }
  };

  const columns = [
    { title: '标题', dataIndex: 'title' },
    { title: '级别', dataIndex: 'level', render: v => <Tag color={v === 'critical' ? 'red' : v === 'high' ? 'orange' : 'gold'}>{v}</Tag> },
    { title: '消息', dataIndex: 'message' },
    { title: '状态', dataIndex: 'status', render: v => <Tag>{v}</Tag> },
    { title: '时间', dataIndex: 'created_at' },
    {
      title: '操作',
      render: (_, record) => record.status === 'open' ? (
        <Button size="small" onClick={() => ack(record.id)}>确认</Button>
      ) : null,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>连包投流 · 业务预警</h2>
      <Card>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={alerts} />
      </Card>
    </div>
  );
}
