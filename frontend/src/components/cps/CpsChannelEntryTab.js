import React, { useEffect, useState } from 'react';
import { Form, InputNumber, Select, DatePicker, Button, message, Card, Space, Typography, Upload } from 'antd';
import { SaveOutlined, UploadOutlined } from '@ant-design/icons';
import { cpsApi } from '../../services/cpsService';
import { useAuth } from '../../hooks/useAuth';
import { fmtMoney } from '../../utils/cpsFormat';
import MoneyInput from './MoneyInput';
import dayjs from 'dayjs';

const { Title } = Typography;

function CpsChannelEntryTab() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form] = Form.useForm();
  const channelId = user?.cps_channel_id;

  useEffect(() => {
    cpsApi.getProducts().then(r => { if (r.code === 0) setProducts(r.data || []); }).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    try {
      const vals = await form.validateFields();
      if (!channelId) { message.error('未绑定渠道，请联系管理员'); return; }
      setSaving(true);
      const res = await cpsApi.channelEntry({
        stat_date: vals.stat_date.format('YYYY-MM-DD'),
        channel_id: channelId,
        product_id: vals.product_id,
        unit_price: vals.unit_price || 0,
        new_sign_count: vals.new_sign_count || 0,
        new_terminate_count: vals.new_terminate_count || 0,
        new_refund_count: vals.new_refund_count || 0,
        renewal_count: vals.renewal_count || 0,
        renewal_refund_count: vals.renewal_refund_count || 0,
        after_sale_refund_count: vals.after_sale_refund_count || 0,
        complaint_count: vals.complaint_count || 0,
        source: 'channel_entry',
      });
      if (res.code === 0) {
        message.success(`数据已提交！有效签约 ${res.data?.effective_count || 0}，有效收入 ${fmtMoney(res.data?.effective_amount, { decimals: 2 })}`);
        form.setFieldValue('stat_date', dayjs().subtract(1, 'day'));
        // 不重置字段，方便连续录入（只更新日期）
      } else {
        message.error(res.message || '提交失败');
      }
    } catch (e) {
      if (!e?.errorFields) message.error('提交失败');
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (file) => {
    if (!channelId) { message.error('未绑定渠道'); return; }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await cpsApi.channelImportMetrics(formData);
      if (res.code === 0) {
        const d = res.data;
        if ((d.success || 0) === 0) {
          message.error(`导入未写入任何数据。成功 0 条，跳过 ${d.skip || 0} 条。请检查 Excel 是否包含产品列或在上传时选择默认产品。`, 8);
          if (d.errors?.length) message.warning(d.errors.slice(0, 3).join('；'), 6);
        } else {
          message.success(`导入完成：成功${d.success || 0}，跳过${d.skip || 0}${d.errors?.length ? '，错误' + d.errors.length : ''}`);
          if (d.errors?.length) message.warning(d.errors.slice(0, 3).join('；'), 6);
        }
      } else {
        message.error(res.message || '导入失败');
      }
    } catch (e) {
      message.error('导入请求失败');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card style={{ maxWidth: 600 }}>
      <Title level={5}>渠道日报录入</Title>
      <Form form={form} layout="vertical" initialValues={{ stat_date: dayjs().subtract(1, 'day') }}>
        <Form.Item name="stat_date" label="数据日期" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="product_id" label="产品" rules={[{ required: true }]}>
          <Select placeholder="选择产品">
            {products.map(p => <Select.Option key={p.id} value={p.id}>{p.name} (￥{Number(p.unit_price).toFixed(2)})</Select.Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="unit_price" label="产品金额"><MoneyInput /></Form.Item>
        <Space style={{ width: '100%' }} direction="vertical">
          <Space>
            <Form.Item name="new_sign_count" label="新签数" style={{ width: 110 }}><InputNumber /></Form.Item>
            <Form.Item name="new_terminate_count" label="解约数" style={{ width: 110 }}><InputNumber /></Form.Item>
            <Form.Item name="new_refund_count" label="退款数" style={{ width: 110 }}><InputNumber /></Form.Item>
          </Space>
          <Space>
            <Form.Item name="renewal_count" label="续费数" style={{ width: 110 }}><InputNumber /></Form.Item>
            <Form.Item name="renewal_refund_count" label="续费退款" style={{ width: 110 }}><InputNumber /></Form.Item>
            <Form.Item name="after_sale_refund_count" label="售后" style={{ width: 110 }}><InputNumber /></Form.Item>
          </Space>
        </Space>
        <Form.Item name="complaint_count" label="客诉数"><InputNumber style={{ width: 120 }} /></Form.Item>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSubmit} loading={saving} size="large" block>
            提交数据
          </Button>
          <Upload accept=".xlsx,.csv" showUploadList={false} beforeUpload={handleImport} disabled={importing}>
            <Button icon={<UploadOutlined />} loading={importing} block>Excel 批量导入</Button>
          </Upload>
        </Space>
      </Form>
    </Card>
  );
}

export default CpsChannelEntryTab;
