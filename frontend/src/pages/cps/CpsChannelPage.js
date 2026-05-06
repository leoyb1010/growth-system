import React, { useEffect, useState } from 'react';
import { Button, Card, Drawer, Form, Input, InputNumber, message, Popconfirm, Space, Table, Switch } from 'antd';
import { cpsService } from '../../services/cpsService';

export default function CpsChannelPage() {
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const res = await cpsService.getChannels();
      if (res.code === 0) setChannels(res.data || []);
    } catch (err) {
      message.error(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchChannels(); }, []);

  const openEdit = (record) => {
    setEditing(record || {});
    form.setFieldsValue(record || {});
  };

  const save = async () => {
    const values = await form.validateFields();
    try {
      if (editing?.id) await cpsService.updateChannel(editing.id, values);
      else await cpsService.createChannel(values);
      message.success('保存成功');
      setEditing(null);
      fetchChannels();
    } catch (err) {
      message.error(err.message || '保存失败');
    }
  };

  const columns = [
    { title: '编码', dataIndex: 'code' },
    { title: '名称', dataIndex: 'name' },
    { title: '联系人', dataIndex: 'contact_name' },
    { title: '佣金率', dataIndex: 'commission_rate' },
    { title: '状态', dataIndex: 'status' },
    {
      title: '操作',
      render: (_, record) => <Button size="small" onClick={() => openEdit(record)}>编辑</Button>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>连包投流 · 渠道管理</h2>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" onClick={() => openEdit(null)}>新增渠道</Button>
        </Space>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={channels} />
      </Card>

      <Drawer title={editing?.id ? '编辑渠道' : '新增渠道'} open={!!editing} onClose={() => setEditing(null)} width={480}
        extra={<Button type="primary" onClick={save}>保存</Button>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码"><Input /></Form.Item>
          <Form.Item name="contact_name" label="联系人"><Input /></Form.Item>
          <Form.Item name="contact_info" label="联系方式"><Input /></Form.Item>
          <Form.Item name="commission_rate" label="佣金率"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="status" label="状态" valuePropName="checked"><Switch checkedChildren="启用" unCheckedChildren="禁用" /></Form.Item>
          {editing?.id && <Form.Item name="reset_token" label="重置Token" valuePropName="checked"><Switch /></Form.Item>}
          <Form.Item name="remark" label="备注"><Input.TextArea /></Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
