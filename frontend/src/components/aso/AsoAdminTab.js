import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, Popconfirm, message, Divider, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { asoApi } from '../../services/asoService';

const KEYWORD_TYPES = [
  { value: 'brand', label: '品牌词' },
  { value: 'function', label: '功能词' },
  { value: 'long_tail', label: '长尾词' },
  { value: 'competitor', label: '竞品词' },
  { value: 'trend', label: '趋势词' },
  { value: 'custom', label: '自定义' },
];

function AsoAdminTab() {
  const [products, setProducts] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [prodModal, setProdModal] = useState(false);
  const [kwModal, setKwModal] = useState(false);
  const [editProd, setEditProd] = useState(null);
  const [editKw, setEditKw] = useState(null);
  const [prodForm] = Form.useForm();
  const [kwForm] = Form.useForm();
  const [kwPagination, setKwPagination] = useState({ page: 1, pageSize: 20, total: 0 });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [p, kw] = await Promise.all([asoApi.getProducts(), asoApi.getKeywords({ pageSize: 200 })]);
      if (p.code === 0) setProducts(p.data || []);
      if (kw.code === 0) { setKeywords(kw.data.rows || []); setKwPagination(prev => ({ ...prev, total: kw.data.total || 0 })); }
    } catch {}
  };

  const saveProduct = async () => {
    try { const vals = await prodForm.validateFields(); const res = editProd ? await asoApi.updateProduct(editProd.id, vals) : await asoApi.createProduct(vals);
      if (res.code === 0) { setProdModal(false); loadAll(); message.success(editProd ? '已更新' : '产品已创建'); }
    } catch (e) { if (!e?.errorFields) message.error('保存失败'); }
  };

  const saveKeyword = async () => {
    try { const vals = await kwForm.validateFields(); const res = editKw ? await asoApi.updateKeyword(editKw.id, vals) : await asoApi.createKeyword(vals);
      if (res.code === 0) { setKwModal(false); loadAll(); message.success(editKw ? '已更新' : '关键词已创建'); }
    } catch (e) { if (!e?.errorFields) message.error('保存失败'); }
  };

  const deleteKeyword = async (id) => { await asoApi.deleteDailyMetric(id); /* soft delete not available for keywords, reuse by disabling */
    /* for now, just update status */
    try {
      await asoApi.updateKeyword(id, { status: 'inactive' });
      message.success('已停用'); loadAll();
    } catch { message.error('操作失败'); }
  };

  return (
    <div>
      <h4>产品管理</h4>
      <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { setEditProd(null); prodForm.resetFields(); setProdModal(true); }} style={{ marginBottom: 12 }}>新增产品</Button>
      <Table dataSource={products} rowKey="id" size="small" pagination={false} columns={[
        { title: '编码', dataIndex: 'code', width: 130 },
        { title: '名称', dataIndex: 'name', width: 120 },
        { title: 'App Store ID', dataIndex: 'app_store_id', width: 110 },
        { title: 'Bundle ID', dataIndex: 'bundle_id', width: 130, ellipsis: true },
        { title: '分类', dataIndex: 'category', width: 80 },
        { title: '负责人', dataIndex: 'owner_name', width: 80 },
        { title: '状态', dataIndex: 'status', width: 70, render: v => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
        { title: '操作', key: 'actions', width: 80, render: (_, r) => (
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditProd(r); prodForm.setFieldsValue(r); setProdModal(true); }} />
        ) },
      ]} />

      <Divider />
      <h4>关键词字典</h4>
      <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { setEditKw(null); kwForm.resetFields(); setKwModal(true); }} style={{ marginBottom: 12 }}>新增关键词</Button>
      <Table dataSource={keywords} rowKey="id" size="small" pagination={{ ...kwPagination, onChange: p => setKwPagination(prev => ({ ...prev, page: p })) }} columns={[
        { title: '关键词', dataIndex: 'keyword', width: 130 },
        { title: '产品', dataIndex: ['product', 'name'], width: 110 },
        { title: '类型', dataIndex: 'keyword_type', width: 80, render: v => { const t = KEYWORD_TYPES.find(k => k.value === v); return t ? <Tag>{t.label}</Tag> : v; } },
        { title: '分组', dataIndex: 'keyword_group', width: 80 },
        { title: '搜索指数', dataIndex: 'search_index', width: 80 },
        { title: '流行度', dataIndex: 'popularity', width: 70 },
        { title: '状态', dataIndex: 'status', width: 70, render: v => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
        { title: '操作', key: 'actions', width: 130, render: (_, r) => (
          <Space size="small">
            <Button size="small" icon={<EditOutlined />} onClick={() => { setEditKw(r); kwForm.setFieldsValue(r); setKwModal(true); }} />
            <Popconfirm title="停用此关键词？" onConfirm={() => deleteKeyword(r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
          </Space>
        ) },
      ]} />

      {/* Product Modal */}
      <Modal title={editProd ? '编辑产品' : '新增产品'} open={prodModal} onOk={saveProduct} onCancel={() => setProdModal(false)}>
        <Form form={prodForm} layout="vertical">
          <Form.Item name="name" label="产品名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="编码" tooltip="留空自动生成"><Input /></Form.Item>
          <Form.Item name="app_store_id" label="App Store ID"><Input /></Form.Item>
          <Form.Item name="bundle_id" label="Bundle ID"><Input /></Form.Item>
          <Form.Item name="category" label="分类"><Input /></Form.Item>
          <Form.Item name="owner_name" label="负责人"><Input /></Form.Item>
          <Form.Item name="status" label="状态"><Select>
            <Select.Option value="active">活跃</Select.Option>
            <Select.Option value="inactive">停用</Select.Option>
          </Select></Form.Item>
        </Form>
      </Modal>

      {/* Keyword Modal */}
      <Modal title={editKw ? '编辑关键词' : '新增关键词'} open={kwModal} onOk={saveKeyword} onCancel={() => setKwModal(false)}>
        <Form form={kwForm} layout="vertical">
          <Form.Item name="product_id" label="产品" rules={[{ required: true }]}><Select>{products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select></Form.Item>
          <Form.Item name="keyword" label="关键词" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="keyword_type" label="类型"><Select allowClear>{KEYWORD_TYPES.map(t => <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>)}</Select></Form.Item>
          <Form.Item name="keyword_group" label="分组"><Input /></Form.Item>
          <Form.Item name="language" label="语言"><Input placeholder="如 zh-CN" /></Form.Item>
          <Form.Item name="search_index" label="搜索指数"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
          <Form.Item name="popularity" label="流行度"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default AsoAdminTab;
