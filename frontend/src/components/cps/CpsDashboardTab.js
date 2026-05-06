import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, DatePicker, Select, Spin, Empty, Tag } from 'antd';
import { DollarOutlined, RiseOutlined, FallOutlined, AlertOutlined, TeamOutlined, AppstoreOutlined } from '@ant-design/icons';
import { cpsApi } from '../../services/cpsService';
import dayjs from 'dayjs';

function CpsDashboardTab() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [range, setRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);

  const fmtMoney = (v) => {
    const n = Number(v);
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return n.toFixed(0);
  };

  const fmtRate = (v) => (Number(v) * 100).toFixed(2) + '%';

  useEffect(() => {
    if (!range || !range[0] || !range[1]) return;
    fetchData();
  }, [range]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await cpsApi.getDashboard({
        start_date: range[0].format('YYYY-MM-DD'),
        end_date: range[1].format('YYYY-MM-DD'),
      });
      if (res.code === 0) setData(res.data);
    } catch (err) { /* ignore */ }
    setLoading(false);
  };

  const s = data?.summary || {};

  return (
    <Spin spinning={loading}>
      <div style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker value={range} onChange={setRange} allowClear={false} />
      </div>

      {!data ? <Empty description="暂无数据" /> : (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Card><Statistic title="有效签约数" value={s.effective_count || 0} prefix={<TeamOutlined />} /></Card></Col>
            <Col span={6}><Card><Statistic title="有效收入" value={fmtMoney(s.effective_amount || 0)} prefix={<DollarOutlined />} /></Card></Col>
            <Col span={6}><Card><Statistic title="新签退款率" value={fmtRate(s.new_refund_rate || 0)} valueStyle={{ color: (s.new_refund_rate || 0) > 0.05 ? '#cf1322' : '#3f8600' }} /></Card></Col>
            <Col span={6}><Card><Statistic title="售后退款率" value={fmtRate(s.after_sale_refund_rate || 0)} valueStyle={{ color: (s.after_sale_refund_rate || 0) > 0.03 ? '#cf1322' : '#3f8600' }} /></Card></Col>
          </Row>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}><Card><Statistic title="新签数" value={s.new_sign_count || 0} /></Card></Col>
            <Col span={6}><Card><Statistic title="续费数" value={s.renewal_count || 0} /></Card></Col>
            <Col span={6}><Card><Statistic title="开放预警" value={data.alert_count || 0} valueStyle={{ color: '#cf1322' }} /></Card></Col>
            <Col span={6}><Card><Statistic title="活跃渠道" value={data.channel_count || 0} /></Card></Col>
          </Row>
        </>
      )}
    </Spin>
  );
}

export default CpsDashboardTab;
