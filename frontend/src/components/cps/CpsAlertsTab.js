import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, message, Select } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { cpsApi, cpsBus } from '../../services/cpsService';
import { useAuth } from '../../hooks/useAuth';
import { can } from '../../permissions/ability';

const levelColors = { critical: 'red', warning: 'orange', info: 'blue' };
const statusColors = { open: 'error', ack: 'processing', closed: 'default' };

function CpsAlertsTab() {
  const { user } = useAuth();
  const role = user?.role || 'dept_staff';
  const cpsRole = user?.cps_role;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('open');

  useEffect(() => { fetchData(); }, [status]);

  useEffect(() => {
    const off = cpsBus.on((event) => {
      if (event === 'alerts:changed' || event === 'metrics:changed') fetchData();
    });
    return off;
  }, [status]);

  const fetchData = async () => {
    setLoading(true);
    try { const res = await cpsApi.getAlerts({ status, limit: 200 }); if (res.code === 0) setData(res.data || []); }
    catch { message.error('加载预警失败'); }
    setLoading(false);
  };

  const handleAck = async (id) => {
    try { await cpsApi.ackAlert(id); message.success('已确认'); fetchData(); }
    catch { message.error('确认失败'); }
  };

  const columns = [
    { title: '级别', dataIndex: 'level', width: 80, render: v => <Tag color={levelColors[v]}>{v}</Tag> },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '日期', dataIndex: 'stat_date', width: 110 },
    { title: '渠道', dataIndex: ['channel', 'name'], width: 100 },
    { title: '产品', dataIndex: ['product', 'name'], width: 100 },
    { title: '指标', dataIndex: 'metric', width: 100 },
    { title: '阈值', dataIndex: 'threshold_value', width: 80, render: v => Number(v).toFixed(4) },
    { title: '状态', dataIndex: 'status', width: 80, render: v => <Tag color={statusColors[v]}>{v}</Tag> },
    { title: '操作', key: 'actions', width: 100, render: (_, r) => r.status === 'open' && can(role, 'cps.write', cpsRole) ? (
      <Button size="small" type="primary" ghost icon={<CheckOutlined />} onClick={() => handleAck(r.id)}>确认</Button>
    ) : null },
  ];

  return (
    <div>
      <Select value={status} onChange={setStatus} style={{ width: 120, marginBottom: 16 }}>
        <Select.Option value="open">未处理</Select.Option>
        <Select.Option value="ack">已确认</Select.Option>
        <Select.Option value="closed">已关闭</Select.Option>
      </Select>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 20 }} />
    </div>
  );
}

export default CpsAlertsTab;
