import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, DatePicker, Select, Modal, Form, Input, InputNumber, Popconfirm, message, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, HistoryOutlined } from '@ant-design/icons';
import { asoApi, asoBus } from '../../services/asoService';
import { useAuth } from '../../hooks/useAuth';
import { can } from '../../permissions/ability';
import dayjs from 'dayjs';

function AsoKeywordsTab() {
  const { user } = useAuth();
  const role = user?.role || 'dept_staff';
  const asoRole = user?.aso_role;
  const canWrite = can(role, 'aso.write', null, asoRole);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [products, setProducts] = useState([]);
  const [keywords, setKeywords] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [snapshotVisible, setSnapshotVisible] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({});

  useEffect(() => {
    const loadProducts = () => asoApi.getProducts().then(r => { if (r.code === 0) setProducts(r.data || []); }).catch(() => {});
    loadProducts();
    const off = asoBus.on((event) => { if (event === 'products:changed') loadProducts(); });
    return off;
  }, []);
  useEffect(() => { asoApi.getKeywords({ pageSize: 500 }).then(r => { if (r.code === 0) setKeywords(r.data.rows || []); }).catch(() => {}); }, []);

  const updateFilters = (patch) => { setFilters(f => ({ ...f, ...patch })); setPagination(p => ({ ...p, page: 1 })); };

  const fetchData = () => {
    setLoading(true);
    asoApi.getDailyMetrics({ ...filters, page: pagination.page, pageSize: pagination.pageSize })
      .then(res => { if (res.code === 0) { setData(res.data.rows || []); setPagination(p => ({ ...p, total: res.data.total || 0 })); } })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [filters, pagination.page, pagination.pageSize]);
  useEffect(() => { const off = asoBus.on((event) => { if (event === 'daily-metrics:changed') fetchData(); }); return off; }, []);

  const rankDelta = (v) => {
    if (v === null || v === undefined) return '-';
    if (v > 0) return <Tag color="green">+{v}</Tag>;
    if (v < 0) return <Tag color="red">{v}</Tag>;
    return <Tag>0</Tag>;
  };

  const columns = [
    { title: '日期', dataIndex: 'stat_date', width: 100, fixed: 'left' },
    { title: '产品', dataIndex: ['product', 'name'], width: 100 },
    { title: '关键词', dataIndex: ['keyword', 'keyword'], width: 120 },
    { title: '搜索指数', dataIndex: 'search_index', width: 80 },
    { title: '流行度', dataIndex: 'popularity', width: 70 },
    { title: '初始排名', dataIndex: 'initial_rank', width: 80 },
    { title: '所选日期排名', dataIndex: 'current_rank', width: 100, render: (v, r) => <span style={{ fontWeight: 600 }}>{v ?? '-'}</span> },
    { title: '排名变化', dataIndex: 'rank_delta', width: 90, render: v => rankDelta(v) },
    { title: '量级', dataIndex: 'today_volume', width: 80 },
    { title: '消耗金额', dataIndex: 'cost_amount', width: 90, render: v => `¥${Number(v || 0).toFixed(0)}` },
    ...(canWrite ? [{ title: '操作', key: 'actions', width: 180, fixed: 'right', render: (_, r) => (
      <Space size="small">
        <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
        <Button size="small" icon={<HistoryOutlined />} onClick={() => viewSnapshots(r.id)} />
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ) }] : []),
  ];

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
      const res = editingRecord ? await asoApi.updateDailyMetric(editingRecord.id, payload) : await asoApi.upsertDailyMetric(payload);
      if (res.code === 0) { message.success(editingRecord ? '已更新' : '已创建'); setModalVisible(false); fetchData(); }
      else message.error(res.message);
    } catch (e) { if (!e?.errorFields) message.error('保存失败'); }
  };

  const handleDelete = async (id) => { await asoApi.deleteDailyMetric(id); message.success('已删除'); fetchData(); };

  const viewSnapshots = async (id) => {
    try { const res = await asoApi.getSnapshots(id); if (res.code === 0) setSnapshots(res.data || []); setSnapshotVisible(true); }
    catch { message.error('获取快照失败'); }
  };

  const handleExport = async () => {
    try { const res = await asoApi.exportDailyMetrics(filters); const url = window.URL.createObjectURL(new Blob([res])); const a = document.createElement('a'); a.href = url; a.download = `aso_metrics_${dayjs().format('YYYYMMDD')}.csv`; a.click(); }
    catch { message.error('导出失败'); }
  };

  return (
    <div>
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col><DatePicker.RangePicker onChange={(dates) => {
          if (!dates) return updateFilters({ start_date: undefined, end_date: undefined });
          updateFilters({ start_date: dates[0].format('YYYY-MM-DD'), end_date: dates[1].format('YYYY-MM-DD') });
        }} /></Col>
        <Col><Select placeholder="产品" allowClear onChange={v => updateFilters({ product_ids: v })} style={{ width: 150 }}>{products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select></Col>
        {canWrite && (
          <Col><Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>导出CSV</Button>
          </Space></Col>
        )}
      </Row>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 1500 }}
        pagination={{ current: pagination.page, pageSize: pagination.pageSize, total: pagination.total, onChange: p => setPagination(prev => ({ ...prev, page: p })) }} size="small" />

      <Modal title={editingRecord ? '编辑日报数据' : '新增日报数据'} open={modalVisible} onOk={handleSave} onCancel={() => setModalVisible(false)} width={700}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="stat_date" label="日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="product_id" label="产品" rules={[{ required: true }]}><Select>{products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="keyword_id" label="关键词" rules={[{ required: true }]}><Select showSearch placeholder="选择关键词" filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} options={keywords.map(k => ({ label: k.keyword, value: k.id }))} /></Form.Item></Col>
            <Col span={12}><Form.Item name="keyword_status" label="关键词状态"><Input placeholder="如：权重较弱、到榜维护" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="search_index" label="搜索指数"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="popularity" label="流行度"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="yesterday_volume" label="昨日量级"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
            <Col span={6}><Form.Item name="today_volume" label="今日量级"><InputNumber style={{ width: '100%' }} min={0} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="initial_rank" label="初始排名"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
            <Col span={6}><Form.Item name="yesterday_rank" label="昨日排名"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
            <Col span={6}><Form.Item name="current_rank" label="当前排名"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
            <Col span={6}><Form.Item name="best_rank" label="最高排名"><InputNumber style={{ width: '100%' }} min={1} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="cost_amount" label="消耗金额"><InputNumber style={{ width: '100%' }} min={0} step={0.01} /></Form.Item></Col>
            <Col span={12}><Form.Item name="remark" label="备注"><Input /></Form.Item></Col>
          </Row>
        </Form>
      </Modal>

      <Modal title="版本快照" open={snapshotVisible} onCancel={() => setSnapshotVisible(false)} footer={null} width={700}>
        <Table dataSource={snapshots} rowKey="id" columns={[
          { title: '版本', dataIndex: 'version', width: 70 },
          { title: '修改人', dataIndex: 'changed_by_name', width: 100 },
          { title: '原因', dataIndex: 'change_reason', width: 120 },
          { title: '时间', dataIndex: 'created_at', width: 160 },
        ]} size="small" pagination={false} />
      </Modal>
    </div>
  );
}

export default AsoKeywordsTab;
