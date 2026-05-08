import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, message, Select, Space } from 'antd';
import { CheckOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { cpsApi, cpsBus } from '../../services/cpsService';
import { useAuth } from '../../hooks/useAuth';
import { can } from '../../permissions/ability';

const levelColors = { critical: 'red', warning: 'orange', info: 'blue' };
const statusColors = { open: 'error', ack: 'processing', closed: 'default' };
const RATE_METRICS = ['new_refund_rate', 'renewal_refund_rate', 'after_sale_refund_rate', 'new_terminate_rate'];

function fmtThreshold(metric, value) {
  if (RATE_METRICS.includes(metric)) return `${(Number(value || 0) * 100).toFixed(1)}%`;
  return Number(value || 0).toFixed(0);
}

function CpsAlertsTab() {
  const { user } = useAuth();
  const role = user?.role || 'dept_staff';
  const cpsRole = user?.cps_role;
  const isAdmin = can(role, 'cps.admin', cpsRole);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState('open');

  useEffect(() => { fetchData(); }, [status]);

  useEffect(() => {
    const off = cpsBus.on((event) => {
      if (event === 'alerts:changed' || event === 'metrics:changed') fetchData();
    });
    return off;
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await cpsApi.getAlerts({ status, limit: 200 });
      if (res.code === 0) setData(res.data || []);
      else message.error(res.message || '加载预警失败');
    } catch (e) { message.error(typeof e === 'string' ? e : '加载预警失败'); }
    setLoading(false);
  };

  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const res = await cpsApi.checkAlertsNow();
      if (res.code === 0) {
        message.success(`预警检查完成，昨日产生了 ${res.data?.events_count || 0} 条预警`);
        fetchData();
      } else {
        message.error(res.message || '检查失败');
      }
    } catch (e) { message.error(typeof e === 'string' ? e : '预警检查失败'); }
    setChecking(false);
  };

  const handleAck = async (id) => {
    try { await cpsApi.ackAlert(id); message.success('已确认'); fetchData(); }
    catch (e) { message.error(typeof e === 'string' ? e : '确认失败'); }
  };

  const columns = [
    { title: '级别', dataIndex: 'level', width: 80, render: v => <Tag color={levelColors[v]}>{v}</Tag> },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '日期', dataIndex: 'stat_date', width: 110 },
    { title: '渠道', dataIndex: ['channel', 'name'], width: 100 },
    { title: '产品', dataIndex: ['product', 'name'], width: 100 },
    { title: '指标', dataIndex: 'metric', width: 100 },
    { title: '阈值', dataIndex: 'threshold_value', width: 80, render: (value, record) => fmtThreshold(record.metric, value) },
    { title: '状态', dataIndex: 'status', width: 80, render: v => <Tag color={statusColors[v]}>{v}</Tag> },
    { title: '操作', key: 'actions', width: 100, render: (_, r) => r.status === 'open' && can(role, 'cps.write', cpsRole) ? (
      <Button size="small" type="primary" ghost icon={<CheckOutlined />} onClick={() => handleAck(r.id)}>确认</Button>
    ) : null },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Select value={status} onChange={setStatus} style={{ width: 120 }}>
          <Select.Option value="open">未处理</Select.Option>
          <Select.Option value="ack">已确认</Select.Option>
          <Select.Option value="closed">已关闭</Select.Option>
        </Select>
        {isAdmin && (
          <Button icon={<ThunderboltOutlined />} onClick={handleCheckNow} loading={checking}>
            检查昨日预警
          </Button>
        )}
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 20 }} />
    </div>
  );
}

export default CpsAlertsTab;
