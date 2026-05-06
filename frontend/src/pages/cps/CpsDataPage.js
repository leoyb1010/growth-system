import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Drawer, Form, InputNumber, message, Modal, Space, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { cpsService } from '../../services/cpsService';
import CpsFilterBar from '../../components/cps/CpsFilterBar';

export default function CpsDataPage() {
  const [range, setRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);
  const [channels, setChannels] = useState([]);
  const [products, setProducts] = useState([]);
  const [channelIds, setChannelIds] = useState([]);
  const [productIds, setProductIds] = useState([]);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    cpsService.getChannels().then(res => setChannels(res.data || [])).catch(() => {});
    cpsService.getProducts().then(res => setProducts(res.data || [])).catch(() => {});
  }, []);

  const params = useMemo(() => ({
    start_date: range?.[0]?.format('YYYY-MM-DD'),
    end_date: range?.[1]?.format('YYYY-MM-DD'),
    channel_ids: channelIds.join(','),
    product_ids: productIds.join(','),
    page,
    pageSize,
  }), [range, channelIds, productIds, page, pageSize]);

  const fetchRows = async () => {
    setLoading(true);
    try {
      const res = await cpsService.getMetrics(params);
      if (res.code === 0) {
        setRows(res.data.rows || []);
        setTotal(res.data.total || 0);
      }
    } catch (err) {
      message.error(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRows(); }, [params]);

  const openEdit = (record) => {
    setEditing(record);
    form.setFieldsValue(record);
  };

  const save = async () => {
    const values = await form.validateFields();
    try {
      if (editing?.id) await cpsService.updateMetric(editing.id, values);
      else await cpsService.upsertMetric(values);
      message.success('保存成功');
      setEditing(null);
      fetchRows();
    } catch (err) {
      message.error(err.message || '保存失败');
    }
  };

  const columns = [
    { title: '日期', dataIndex: 'stat_date', width: 110, fixed: 'left' },
    { title: '渠道', dataIndex: ['channel', 'name'], width: 100 },
    { title: '产品', dataIndex: ['product', 'name'], width: 160 },
    { title: '单价', dataIndex: 'unit_price', width: 80 },
    { title: '新签', dataIndex: 'new_sign_count', width: 80 },
    { title: '新签解约', dataIndex: 'new_terminate_count', width: 90 },
    { title: '新签退款', dataIndex: 'new_refund_count', width: 90 },
    { title: '新签退款率', dataIndex: 'new_refund_rate', width: 110, render: v => `${((v || 0) * 100).toFixed(2)}%` },
    { title: '续费', dataIndex: 'renewal_count', width: 80 },
    { title: '续费退款', dataIndex: 'renewal_refund_count', width: 90 },
    { title: '续费退款率', dataIndex: 'renewal_refund_rate', width: 110, render: v => `${((v || 0) * 100).toFixed(2)}%` },
    { title: '售后退款', dataIndex: 'after_sale_refund_count', width: 90 },
    { title: '有效签约', dataIndex: 'effective_count', width: 90 },
    { title: '有效收入', dataIndex: 'effective_amount', width: 100 },
    { title: '实际订单', dataIndex: 'actual_count', width: 90 },
    { title: '实际金额', dataIndex: 'actual_amount', width: 100 },
    { title: '客诉', dataIndex: 'complaint_count', width: 70 },
    { title: '来源', dataIndex: 'source', width: 120, render: v => <Tag>{v}</Tag> },
    { title: '版本', dataIndex: 'version', width: 70 },
    { title: '操作', fixed: 'right', width: 120, render: (_, record) => <Button size="small" onClick={() => openEdit(record)}>编辑</Button> },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 16 }}>连包投流 · 数据明细</h2>
      <CpsFilterBar
        showGranularity={false}
        range={range}
        onRangeChange={setRange}
        channels={channels}
        products={products}
        channelIds={channelIds}
        productIds={productIds}
        onChannelChange={setChannelIds}
        onProductChange={setProductIds}
      />

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" onClick={() => { setEditing({}); form.resetFields(); }}>新增</Button>
          <Button>Excel 导入</Button>
          <Button>Excel 导出</Button>
        </Space>
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1800 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>

      <Drawer
        title={editing?.id ? '编辑 CPS 数据' : '新增 CPS 数据'}
        open={!!editing}
        onClose={() => setEditing(null)}
        width={520}
        extra={<Button type="primary" onClick={save}>保存</Button>}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="stat_date" label="日期" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="channel_id" label="渠道 ID" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="product_id" label="产品 ID" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="new_sign_count" label="新签约数"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="new_terminate_count" label="新签解约数"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="new_refund_count" label="新签退款数"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="renewal_count" label="续费订单"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="renewal_refund_count" label="续费退款"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="after_sale_refund_count" label="售后退款数"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="complaint_count" label="客诉数"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Drawer>
    </div>
  );
}
