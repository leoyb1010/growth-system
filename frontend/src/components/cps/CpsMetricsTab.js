import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, DatePicker, Select, Modal, Form, Input, InputNumber, Popconfirm, message, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, DownloadOutlined, UploadOutlined, HistoryOutlined } from '@ant-design/icons';
import { cpsApi, cpsBus } from '../../services/cpsService';
import { useAuth } from '../../hooks/useAuth';
import { can } from '../../permissions/ability';
import { fmtMoney, fmtRate } from '../../utils/cpsFormat';
import MoneyInput from './MoneyInput';
import dayjs from 'dayjs';

function CpsMetricsTab({ channelId }) {
  const { user } = useAuth();
  const role = user?.role || 'dept_staff';
  const cpsRole = user?.cps_role;
  const canWrite = can(role, 'cps.write', cpsRole) || can(role, 'cps.channel_upload', cpsRole);
  const isChannelUser = role === 'cps_channel_user';

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [channels, setChannels] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [snapshotVisible, setSnapshotVisible] = useState(false);
  const [snapshots, setSnapshots] = useState([]);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState(channelId ? { channel_ids: String(channelId) } : {});

  useEffect(() => { cpsApi.getChannels().then(r => { if (r.code === 0) setChannels(r.data || []); }).catch(() => {}); }, []);
  useEffect(() => { cpsApi.getProducts().then(r => { if (r.code === 0) setProducts(r.data || []); }).catch(() => {}); }, []);

  const updateFilters = (patch) => {
    setFilters(f => ({ ...f, ...patch }));
    setPagination(p => ({ ...p, page: 1 }));
  };

  const fetchData = () => {
    setLoading(true);
    cpsApi.getMetrics({ ...filters, page: pagination.page, pageSize: pagination.pageSize })
      .then(res => { if (res.code === 0) { setData(res.data.rows || []); setPagination(p => ({ ...p, total: res.data.total || 0 })); } })
      .catch(() => { /* 不弹错误，空态自然展示 */ })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [filters, pagination.page, pagination.pageSize]);

  // 事件总线：只注册一次，稳定监听所有变更
  useEffect(() => {
    const off = cpsBus.on((event) => {
      if (event === 'metrics:changed') fetchData();
    });
    return off;
  }, []);

  const columns = [
    { title: '日期', dataIndex: 'stat_date', width: 100, sorter: true, fixed: 'left' },
    { title: '渠道', dataIndex: ['channel', 'name'], width: 90 },
    { title: '产品', dataIndex: ['product', 'name'], width: 90 },
    { title: '单价', dataIndex: 'unit_price', width: 70, render: v => Number(v).toFixed(0) },
    { title: '新签', dataIndex: 'new_sign_count', width: 60, render: v => <Tag color="blue">{v}</Tag> },
    { title: '新签金额', dataIndex: 'new_sign_amount', width: 90, render: v => fmtMoney(v) },
    { title: '解约', dataIndex: 'new_terminate_count', width: 60, render: v => <Tag color="red">{v}</Tag> },
    { title: '解约率', dataIndex: 'new_terminate_rate', width: 70, render: v => fmtRate(v) },
    { title: '退款', dataIndex: 'new_refund_count', width: 60 },
    { title: '退款率', dataIndex: 'new_refund_rate', width: 70, render: v => fmtRate(v) },
    { title: '续费', dataIndex: 'renewal_count', width: 60, render: v => <Tag color="green">{v}</Tag> },
    { title: '续费金额', dataIndex: 'renewal_amount', width: 90, render: v => fmtMoney(v) },
    { title: '续费退款', dataIndex: 'renewal_refund_count', width: 70 },
    { title: '售后', dataIndex: 'after_sale_refund_count', width: 60 },
    { title: '售后率', dataIndex: 'after_sale_refund_rate', width: 70, render: v => fmtRate(v) },
    { title: '有效签约', dataIndex: 'effective_count', width: 70 },
    { title: '有效收入', dataIndex: 'effective_amount', width: 100, render: v => <strong>{fmtMoney(v)}</strong> },
    { title: '实际订单', dataIndex: 'actual_count', width: 70 },
    { title: '实际金额', dataIndex: 'actual_amount', width: 90, render: v => fmtMoney(v) },
    { title: '客诉', dataIndex: 'complaint_count', width: 60, render: v => v > 0 ? <Tag color="volcano">{v}</Tag> : v },
    { title: '版本', dataIndex: 'version', width: 50 },
    { title: '来源', dataIndex: 'source', width: 80, render: v => <Tag>{v}</Tag> },
    { title: '操作', key: 'actions', width: 180, fixed: 'right', render: (_, r) => canWrite ? (
      <Space size="small">
        <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
        <Button size="small" icon={<HistoryOutlined />} onClick={() => viewSnapshots(r.id)} />
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ) : null }
  ];

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({ ...record, stat_date: record.stat_date ? dayjs(record.stat_date) : null });
    setModalVisible(true);
  };

  const handleAdd = () => { setEditingRecord(null); form.resetFields(); form.setFieldsValue({ stat_date: dayjs(), channel_id: channelId || undefined }); setModalVisible(true); };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      const payload = { ...vals, stat_date: vals.stat_date.format('YYYY-MM-DD'), channel_id: vals.channel_id, product_id: vals.product_id };
      const res = editingRecord ? await cpsApi.updateMetric(editingRecord.id, payload) : await cpsApi.upsertMetric(payload);
      if (res.code === 0) { message.success(editingRecord ? '已更新' : '已创建'); setModalVisible(false); fetchData(); }
      else message.error(res.message);
    } catch (e) { if (!e?.errorFields) message.error('保存失败'); }
  };

  const handleDelete = async (id) => { await cpsApi.deleteMetric(id); message.success('已删除'); fetchData(); };

  const viewSnapshots = async (id) => {
    try { const res = await cpsApi.getSnapshots(id); if (res.code === 0) setSnapshots(res.data || []); setSnapshotVisible(true); }
    catch { message.error('获取快照失败'); }
  };

  const [importChannelId, setImportChannelId] = useState(null);
  const [importModalVisible, setImportModalVisible] = useState(false);

  const handleImport = async () => {
    // 先选渠道再上传文件
    setImportModalVisible(true);
  };

  const doImport = async () => {
    if (!importChannelId) { message.warning('请选择导入渠道'); return; }
    setImportModalVisible(false);
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const fd = new FormData(); fd.append('file', file); fd.append('auto_create_dim', 'true');
      fd.append('forced_channel_id', importChannelId);
      try {
        const res = await cpsApi.importMetrics(fd);
        if (res.code === 0) {
          const d = res.data || {};
          message.success(`导入完成：成功 ${d.success || 0} 条`);
          if (d.errors?.length) {
            Modal.warning({ title: '部分行导入失败', content: <pre style={{ whiteSpace: 'pre-wrap' }}>{d.errors.join('\n')}</pre>, width: 720 });
          }
        }
        fetchData();
      } catch { message.error('导入失败'); }
    };
    input.click();
  };

  const handleExport = async () => {
    try { const res = await cpsApi.exportMetrics(filters); const url = window.URL.createObjectURL(new Blob([res])); const a = document.createElement('a'); a.href = url; a.download = `cps_metrics_${dayjs().format('YYYYMMDD')}.xlsx`; a.click(); }
    catch { message.error('导出失败'); }
  };

  return (
    <div>
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col><DatePicker.RangePicker onChange={(dates) => {
          if (!dates) return updateFilters({ start_date: undefined, end_date: undefined });
          updateFilters({ start_date: dates[0].format('YYYY-MM-DD'), end_date: dates[1].format('YYYY-MM-DD') });
        }} /></Col>
        {!isChannelUser && <Col><Select placeholder="渠道" allowClear onChange={v => updateFilters({ channel_ids: v })} style={{ width: 150 }}>{channels.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}</Select></Col>}
        <Col><Select placeholder="产品" allowClear onChange={v => updateFilters({ product_ids: v })} style={{ width: 150 }}>{products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select></Col>
        {canWrite && (
          <Col><Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增</Button>
            {!isChannelUser && <><Button icon={<UploadOutlined />} onClick={handleImport}>导入Excel</Button>
            <Button icon={<DownloadOutlined />} onClick={handleExport}>导出</Button></>}
          </Space></Col>
        )}
      </Row>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading} scroll={{ x: 1300 }}
        pagination={{ current: pagination.page, pageSize: pagination.pageSize, total: pagination.total, onChange: p => setPagination(prev => ({ ...prev, page: p })) }} size="small" />

      <Modal title={editingRecord ? '编辑数据' : '新增数据'} open={modalVisible} onOk={handleSave} onCancel={() => setModalVisible(false)} width={600}>
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}><Form.Item name="stat_date" label="日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
            {!isChannelUser && <Col span={12}><Form.Item name="channel_id" label="渠道" rules={[{ required: true }]}><Select>{channels.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}</Select></Form.Item></Col>}
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="product_id" label="产品" rules={[{ required: true }]}><Select>{products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="unit_price" label="单价"><MoneyInput /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="new_sign_count" label="新签数"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="new_terminate_count" label="解约数"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="new_refund_count" label="新签退款"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="renewal_count" label="续费数"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="renewal_refund_count" label="续费退款"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="after_sale_refund_count" label="售后退款"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="complaint_count" label="客诉数"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
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

      {/* 导入渠道选择 */}
      <Modal title="选择导入渠道" open={importModalVisible} onOk={doImport} onCancel={() => setImportModalVisible(false)}>
        <Select placeholder="请选择数据归属渠道" value={importChannelId} onChange={setImportChannelId} style={{ width: '100%' }}>
          {channels.map(c => <Select.Option key={c.id} value={c.id}>{c.name}</Select.Option>)}
        </Select>
      </Modal>
    </div>
  );
}

export default CpsMetricsTab;
