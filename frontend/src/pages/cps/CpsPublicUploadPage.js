import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, DatePicker, Form, InputNumber, message, Spin, Table, Typography } from 'antd';
import dayjs from 'dayjs';
import { publicGetCpsContext, publicUploadCps } from '../../services/cpsService';

const { Title, Text } = Typography;

export default function CpsPublicUploadPage() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [context, setContext] = useState(null);
  const [statDate, setStatDate] = useState(dayjs());
  const [data, setData] = useState([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token') || '';
    setToken(t);
    if (!t) {
      setLoading(false);
      return;
    }
    publicGetCpsContext(t).then(res => {
      if (res.code === 0) {
        setContext(res.data);
        setData((res.data.products || []).map(p => ({
          key: p.id,
          product_id: p.id,
          product_name: p.name,
          unit_price: p.unit_price,
          new_sign_count: 0,
          new_terminate_count: 0,
          new_refund_count: 0,
          renewal_count: 0,
          renewal_refund_count: 0,
          after_sale_refund_count: 0,
          complaint_count: 0,
        })));
      } else {
        message.error(res.message || 'token 无效');
      }
    }).finally(() => setLoading(false));
  }, []);

  const updateCell = (record, field, value) => {
    setData(prev => prev.map(row => row.product_id === record.product_id ? { ...row, [field]: value || 0 } : row));
  };

  const columns = useMemo(() => {
    const numberCol = (title, field) => ({
      title,
      dataIndex: field,
      width: 110,
      render: (_, record) => (
        <InputNumber min={0} value={record[field]} onChange={v => updateCell(record, field, v)} style={{ width: '100%' }} />
      ),
    });

    return [
      { title: '产品', dataIndex: 'product_name', fixed: 'left', width: 180 },
      { title: '单价', dataIndex: 'unit_price', width: 80 },
      numberCol('新签约数', 'new_sign_count'),
      numberCol('新签解约数', 'new_terminate_count'),
      numberCol('新签退款数', 'new_refund_count'),
      numberCol('续费订单', 'renewal_count'),
      numberCol('续费退款', 'renewal_refund_count'),
      numberCol('售后退款数', 'after_sale_refund_count'),
      numberCol('客诉数', 'complaint_count'),
    ];
  }, []);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await publicUploadCps(token, {
        stat_date: statDate.format('YYYY-MM-DD'),
        items: data,
      });
      if (res.code === 0) message.success(`提交完成，成功 ${res.data.success_count} 条，失败 ${res.data.error_count} 条`);
      else message.error(res.message || '提交失败');
    } catch (err) {
      message.error(err.message || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spin style={{ margin: 80 }} />;
  if (!token || !context) return <Alert type="error" message="链接无效" description="缺少 token 或 token 已失效，请联系运营重新获取录入链接。" />;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <Card>
        <Title level={3}>连包投流数据上报</Title>
        <Text>当前渠道：{context.channel?.name}</Text>
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 16, marginBottom: 16 }}
          message="请按产品填写当天或昨天数据。历史数据修改请联系运营处理。"
        />
        <div style={{ marginBottom: 16 }}>
          <span style={{ marginRight: 8 }}>业务日期：</span>
          <DatePicker value={statDate} onChange={setStatDate} allowClear={false} />
        </div>
        <Table rowKey="product_id" columns={columns} dataSource={data} pagination={false} scroll={{ x: 1100 }} />
        <Button type="primary" loading={submitting} onClick={submit} style={{ marginTop: 16 }}>
          提交数据
        </Button>
      </Card>
    </div>
  );
}
