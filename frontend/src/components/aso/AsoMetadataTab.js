import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Select, DatePicker, Modal, Form, Input, InputNumber, message, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, UploadOutlined } from '@ant-design/icons';
import { asoApi, asoBus } from '../../services/asoService';
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
    asoApi.getBaselineMetrics(params).then(res => { if (res.code === 0) setData(res.data || []); }).catch(() => {}).finally(() => setLoading(false));
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({ ...record, stat_date: record.stat_date ? dayjs(record.stat_date) : null });
    setModalVisible(true);
  };
  const handleAdd = () => { setEditingRecord(null); form.resetFields(); form.setFieldsValue({ stat_date: dayjs() }); setModalVisible(true); };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      const payload = { ...vals, stat_date: vals.stat_date.format('YYYY-MM-DD') };
      const res = await asoApi.upsertBaselineMetric(payload);
      if (res.code === 0) { message.success('数据已更新'); setModalVisible(false); fetchData(); }
      else message.error(res.message);
    } catch (e) { if (!e?.errorFields) message.error('保存失败'); }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      if (selProduct) fd.append('default_product_id', selProduct);
      try {
        const res = await asoApi.importBaselineMetrics(fd);
        if (res.code === 0) {
          message.success(`成功导入 ${res.data.success || 0} 条基准数据`);
          fetchData();
        } else {
          message.error(res.message || '导入失败');
        }
      } catch { message.error('导入出错'); }
    };
    input.click();
  };

  const columns = [
    { title: '产品', dataIndex: ['product', 'name'], width: 120, fixed: 'left' },
    { title: '日期', dataIndex: 'stat_date', width: 110 },
    { title: '总覆盖', dataIndex: 'keyword_coverage', width: 90 },
    { title: '有效覆盖', dataIndex: 'effective_keyword_coverage', width: 90 },
    { title: '有效 T3', dataIndex: 'effective_t3_keywords', width: 90, render: v => <Tag color="green">{v}</Tag> },
    { title: '有效 T10', dataIndex: 'effective_t10_keywords', width: 90, render: v => <Tag color="blue">{v}</Tag> },
    { title: '总榜排名', dataIndex: 'overall_rank', width: 90 },
    { title: '分类榜排名', dataIndex: 'category_rank', width: 100 },
    { title: '来源', dataIndex: 'source', width: 100, render: v => <Tag>{v === 'excel_import' ? 'Excel导入' : '手动录入'}</Tag> },
    ...(canWrite ? [{ title: '操作', key: 'actions', width: 80, fixed: 'right', render: (_, r) => (
      <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
    ) }] : []),
  ];

  return (
    <div>
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col><Select placeholder="产品(全部)" allowClear value={selProduct} onChange={setSelProduct} style={{ width: 180 }}>{products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select></Col>
        {canWrite && (
          <Col><Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>更新信息</Button>
            <Button icon={<UploadOutlined />} onClick={handleImport}>批量导入</Button>
          </Space></Col>
        )}
      </Row>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="small" pagination={{ pageSize: 20 }} scroll={{ x: 1000 }} />

      <Modal title={editingRecord ? '编辑基准指标' : '新增基准指标'} open={modalVisible} onOk={handleSave} onCancel={() => setModalVisible(false)} width={650}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="product_id" label="产品" rules={[{ required: true }]}><Select>{products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="stat_date" label="日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="keyword_coverage" label="关键词覆盖数"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            <Col span={12}><Form.Item name="effective_keyword_coverage" label="有效关键词覆盖数"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="effective_t3_keywords" label="有效 T3 关键词数"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            <Col span={12}><Form.Item name="effective_t10_keywords" label="有效 T10 关键词数"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="overall_rank" label="总榜排名"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
            <Col span={12}><Form.Item name="category_rank" label="分类榜排名"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

export default AsoMetadataTab;
