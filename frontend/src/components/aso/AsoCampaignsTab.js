import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Select, Modal, Form, Input, InputNumber, Popconfirm, message, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { asoApi, asoBus } from '../../services/asoService';
import { useAuth } from '../../hooks/useAuth';
import { can } from '../../permissions/ability';

function AsoCampaignsTab() {
  const { user } = useAuth();
  const role = user?.role || 'dept_staff';
  const asoRole = user?.aso_role;
  const canWrite = can(role, 'aso.write', null, asoRole);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [selProduct, setSelProduct] = useState(undefined);

  useEffect(() => {
    const loadProducts = () => asoApi.getProducts().then(r => { if (r.code === 0) setProducts(r.data || []); }).catch(() => {});
    loadProducts();
    const off = asoBus.on((event) => { if (event === 'products:changed') loadProducts(); });
    return off;
  }, []);
  useEffect(() => { fetchData(); }, [selProduct]);

  const fetchData = () => {
    setLoading(true);
    const params = {};
    if (selProduct) params.product_ids = String(selProduct);
    asoApi.getCampaigns(params).then(res => { if (res.code === 0) setData(res.data || []); }).catch(() => {}).finally(() => setLoading(false));
  };

  const handleEdit = (record) => { setEditingRecord(record); form.setFieldsValue(record); setModalVisible(true); };
  const handleAdd = () => { setEditingRecord(null); form.resetFields(); setModalVisible(true); };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      const res = editingRecord ? await asoApi.updateCampaign(editingRecord.id, vals) : await asoApi.createCampaign(vals);
      if (res.code === 0) { message.success(editingRecord ? '已更新' : '已创建'); setModalVisible(false); fetchData(); }
      else message.error(res.message);
    } catch (e) { if (!e?.errorFields) message.error('保存失败'); }
  };

  const handleDelete = async (id) => { await asoApi.deleteCampaign(id); message.success('已删除'); fetchData(); };

  const statusTag = { draft: 'default', active: 'blue', completed: 'green', cancelled: 'red' };

  const columns = [
    { title: '月份', dataIndex: 'campaign_month', width: 90 },
    { title: '名称', dataIndex: 'name', width: 200 },
    { title: '产品', dataIndex: ['product', 'name'], width: 120 },
    { title: '计划量级', dataIndex: 'total_plan_volume', width: 100 },
    { title: '计划费用', dataIndex: 'total_plan_cost', width: 100, render: v => `¥${Number(v || 0).toFixed(0)}` },
    { title: '状态', dataIndex: 'status', width: 80, render: v => <Tag color={statusTag[v] || 'default'}>{v}</Tag> },
    { title: '负责人', dataIndex: 'owner_name', width: 100 },
    { title: '创建时间', dataIndex: 'created_at', width: 110, render: v => v ? String(v).slice(0, 10) : '-' },
    { title: '操作', key: 'actions', width: 160, render: (_, r) => canWrite ? (
      <Space size="small">
        <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ) : null },
  ];

  return (
    <div>
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col><Select placeholder="产品(全部)" allowClear value={selProduct} onChange={setSelProduct} style={{ width: 180 }}>{products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select></Col>
        {canWrite && <Col><Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增计划</Button></Col>}
      </Row>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="small"
        pagination={{ pageSize: 20 }} />

      <Modal title={editingRecord ? '编辑投放计划' : '新增投放计划'} open={modalVisible} onOk={handleSave} onCancel={() => setModalVisible(false)} width={500}>
        <Form form={form} layout="vertical">
          <Form.Item name="product_id" label="产品" rules={[{ required: true }]}><Select>{products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select></Form.Item>
          <Form.Item name="campaign_month" label="月份" rules={[{ required: true }]}><Input placeholder="如 2026-05" /></Form.Item>
          <Form.Item name="name" label="计划名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="total_plan_volume" label="计划量级"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            <Col span={12}><Form.Item name="total_plan_cost" label="计划费用"><InputNumber style={{ width: '100%' }} min={0} step={0.01} /></Form.Item></Col>
          </Row>
          <Form.Item name="objective" label="目标"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="strategy" label="策略"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="owner_name" label="负责人"><Input /></Form.Item>
          <Form.Item name="status" label="状态" initialValue="draft"><Select>
            <Select.Option value="draft">草稿</Select.Option>
            <Select.Option value="active">进行中</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
            <Select.Option value="cancelled">已取消</Select.Option>
          </Select></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default AsoCampaignsTab;
