import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Select, Modal, Form, Input, InputNumber, message, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { asoApi } from '../../services/asoService';
import { useAuth } from '../../hooks/useAuth';
import { can } from '../../permissions/ability';
import dayjs from 'dayjs';

function AsoMetadataTab() {
  const { user } = useAuth();
  const role = user?.role || 'dept_staff';
  const asoRole = user?.aso_role;
  const canWrite = can(role, 'aso.write', null, asoRole);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [form] = Form.useForm();
  const [selProduct, setSelProduct] = useState(undefined);

  useEffect(() => { asoApi.getProducts().then(r => { if (r.code === 0) setProducts(r.data || []); }).catch(() => {}); }, []);
  useEffect(() => { fetchData(); }, [selProduct]);

  const fetchData = () => {
    setLoading(true);
    const params = {};
    if (selProduct) params.product_ids = String(selProduct);
    asoApi.getMetadataVersions(params).then(res => { if (res.code === 0) setData(res.data || []); }).catch(() => {}).finally(() => setLoading(false));
  };

  const handleEdit = (record) => { setEditingRecord(record); form.setFieldsValue({ ...record, version_date: record.version_date ? dayjs(record.version_date) : null }); setModalVisible(true); };
  const handleAdd = () => { setEditingRecord(null); form.resetFields(); setModalVisible(true); };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      const payload = { ...vals, version_date: vals.version_date ? vals.version_date.format('YYYY-MM-DD') : undefined };
      const res = editingRecord ? await asoApi.updateMetadataVersion(editingRecord.id, payload) : await asoApi.createMetadataVersion(payload);
      if (res.code === 0) { message.success(editingRecord ? '已更新' : '已创建'); setModalVisible(false); fetchData(); }
      else message.error(res.message);
    } catch (e) { if (!e?.errorFields) message.error('保存失败'); }
  };

  const viewDetail = (record) => { setDetailRecord(record); setDetailVisible(true); };

  const statusTag = { draft: 'default', submitted: 'blue', effective: 'green', reviewed: 'orange' };

  const columns = [
    { title: '产品', dataIndex: ['product', 'name'], width: 120 },
    { title: '版本日期', dataIndex: 'version_date', width: 100 },
    { title: '语言', dataIndex: 'locale', width: 100 },
    { title: '调整类型', dataIndex: 'change_type', width: 80, render: v => { const t = { update: '修改', add: '新增', delete: '删除', unchanged: '不变' }; return <Tag>{t[v] || v}</Tag>; } },
    { title: '状态', dataIndex: 'status', width: 80, render: v => <Tag color={statusTag[v] || 'default'}>{v}</Tag> },
    { title: '预期效果', dataIndex: 'expected_effect', width: 160, ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', width: 110, render: v => v ? String(v).slice(0, 10) : '-' },
    { title: '操作', key: 'actions', width: 160, render: (_, r) => (
      <Space size="small">
        <Button size="small" onClick={() => viewDetail(r)}>查看</Button>
        {canWrite && <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />}
      </Space>
    ) },
  ];

  return (
    <div>
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col><Select placeholder="产品(全部)" allowClear value={selProduct} onChange={setSelProduct} style={{ width: 180 }}>{products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select></Col>
        {canWrite && <Col><Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增版本</Button></Col>}
      </Row>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 20 }} />

      <Modal title={editingRecord ? '编辑元数据版本' : '新增元数据版本'} open={modalVisible} onOk={handleSave} onCancel={() => setModalVisible(false)} width={600}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="product_id" label="产品" rules={[{ required: true }]}><Select>{products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="locale" label="语言" rules={[{ required: true }]}><Select><Select.Option value="简体中文">简体中文</Select.Option><Select.Option value="英国英语">英国英语</Select.Option><Select.Option value="韩语">韩语</Select.Option><Select.Option value="日语">日语</Select.Option></Select></Form.Item></Col>
          </Row>
          <Form.Item name="version_date" label="版本日期" rules={[{ required: true }]}><Input placeholder="如 2026-05-01" /></Form.Item>
          <Form.Item name="change_type" label="调整类型" initialValue="update"><Select>
            <Select.Option value="add">新增</Select.Option>
            <Select.Option value="update">修改</Select.Option>
            <Select.Option value="delete">删除</Select.Option>
            <Select.Option value="unchanged">不变</Select.Option>
          </Select></Form.Item>
          <Form.Item name="before_keywords" label="调整前关键词串"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="after_keywords" label="调整后关键词串"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="expected_effect" label="预期影响"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="status" label="状态" initialValue="draft"><Select>
            <Select.Option value="draft">草稿</Select.Option>
            <Select.Option value="submitted">已提交</Select.Option>
            <Select.Option value="effective">已生效</Select.Option>
            <Select.Option value="reviewed">已复盘</Select.Option>
          </Select></Form.Item>
        </Form>
      </Modal>

      <Modal title="元数据版本详情" open={detailVisible} onCancel={() => setDetailVisible(false)} footer={null} width={600}>
        {detailRecord && (
          <div>
            <p><strong>产品：</strong>{detailRecord.product?.name}</p>
            <p><strong>版本日期：</strong>{detailRecord.version_date}</p>
            <p><strong>语言：</strong>{detailRecord.locale}</p>
            <p><strong>调整类型：</strong>{detailRecord.change_type}</p>
            <p><strong>调整前关键词串：</strong></p>
            <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, whiteSpace: 'pre-wrap' }}>{detailRecord.before_keywords || '(空)'}</pre>
            <p><strong>调整后关键词串：</strong></p>
            <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, whiteSpace: 'pre-wrap' }}>{detailRecord.after_keywords || '(空)'}</pre>
            <p><strong>预期影响：</strong>{detailRecord.expected_effect || '-'}</p>
            <p><strong>实际效果：</strong>{detailRecord.actual_effect || '-'}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default AsoMetadataTab;
