import React, { useEffect, useState } from 'react';
import { Button, Card, Drawer, Form, Input, InputNumber, message, Select, Switch, Table, Tag } from 'antd';
import { cpsService } from '../../services/cpsService';

export default function CpsSettingsPage() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await cpsService.getAlertRules();
      if (res.code === 0) setRules(res.data || []);
    } catch (err) {
      message.error(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRules(); }, []);

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
  };

  const save = async () => {
    const values = await form.validateFields();
    try {
      await cpsService.updateAlertRule(editing.id, values);
      message.success('保存成功');
      setEditing(null);
      fetchRules();
    } catch (err) {
      message.error(err.message || '保存失败');
    }
  };

  const columns = [
    { title: '编码', dataIndex: 'code' },
    { title: '名称', dataIndex: 'name' },
    { title: '级别', dataIndex: 'level', render: v => <Tag color={v === 'critical' ? 'red' : 'orange'}>{v}</Tag> },
    { title: '指标', dataIndex: 'metric' },
    { title: '运算符', dataIndex: 'operator' },
    { title: '阈值', dataIndex: 'threshold_value' },
    { title: '最小基数', dataIndex: 'min_base_value' },
    { title: '启用', dataIndex: 'enabled', render: v => v ? '是' : '否' },
    {
      title: '操作',
      render: (_, record) => <Button size="small" onClick={() => openEdit(record)}>编辑</Button>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>连包投流 · 预警规则</h2>
      <Card>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rules} />
      </Card>

      <Drawer title="编辑预警规则" open={!!editing} onClose={() => setEditing(null)} width={480}
        extra={<Button type="primary" onClick={save}>保存</Button>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称"><Input /></Form.Item>
          <Form.Item name="level" label="级别">
            <Select options={[{ label: 'warning', value: 'warning' }, { label: 'high', value: 'high' }, { label: 'critical', value: 'critical' }]} />
          </Form.Item>
          <Form.Item name="operator" label="运算符">
            <Select options={[{ label: '>=', value: '>=' }, { label: '>', value: '>' }, { label: '<', value: '<' }, { label: '<=', value: '<=' }]} />
          </Form.Item>
          <Form.Item name="threshold_value" label="阈值"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="min_base_value" label="最小基数"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea /></Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
