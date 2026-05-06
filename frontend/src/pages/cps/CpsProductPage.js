import React, { useEffect, useState } from 'react';
import { Button, Card, Drawer, Form, Input, InputNumber, message, Space, Table } from 'antd';
import { cpsService } from '../../services/cpsService';

export default function CpsProductPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await cpsService.getProducts();
      if (res.code === 0) setProducts(res.data || []);
    } catch (err) {
      message.error(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  const openEdit = (record) => {
    setEditing(record || {});
    form.setFieldsValue(record || {});
  };

  const save = async () => {
    const values = await form.validateFields();
    try {
      if (editing?.id) await cpsService.updateProduct(editing.id, values);
      else await cpsService.createProduct(values);
      message.success('保存成功');
      setEditing(null);
      fetchProducts();
    } catch (err) {
      message.error(err.message || '保存失败');
    }
  };

  const columns = [
    { title: '编码', dataIndex: 'code' },
    { title: '名称', dataIndex: 'name' },
    { title: '类型', dataIndex: 'product_type' },
    { title: '单价', dataIndex: 'unit_price', render: v => Number(v).toFixed(2) },
    { title: '状态', dataIndex: 'status' },
    {
      title: '操作',
      render: (_, record) => <Button size="small" onClick={() => openEdit(record)}>编辑</Button>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>连包投流 · 产品管理</h2>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" onClick={() => openEdit(null)}>新增产品</Button>
        </Space>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={products} />
      </Card>

      <Drawer title={editing?.id ? '编辑产品' : '新增产品'} open={!!editing} onClose={() => setEditing(null)} width={480}
        extra={<Button type="primary" onClick={save}>保存</Button>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码"><Input /></Form.Item>
          <Form.Item name="product_type" label="类型"><Input /></Form.Item>
          <Form.Item name="unit_price" label="单价"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="status" label="状态"><Input placeholder="active / inactive" /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea /></Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
