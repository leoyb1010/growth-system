import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, InputNumber, Select, Switch, Popconfirm, message, Divider, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { cpsApi } from '../../services/cpsService';
import PercentInput from './PercentInput';
import MoneyInput from './MoneyInput';

const METRIC_LABELS = {
  new_refund_rate: '新签退款率', renewal_refund_rate: '续费退款率',
  after_sale_refund_rate: '售后退款率', new_terminate_rate: '解约率',
  complaint_count: '客诉数', effective_amount: '有效收入',
};
const RATE_METRICS = ['new_refund_rate', 'renewal_refund_rate', 'after_sale_refund_rate', 'new_terminate_rate'];

function fmtThreshold(metric, threshold) {
  if (RATE_METRICS.includes(metric)) return `${(Number(threshold) * 100).toFixed(1)}%`;
  return Number(threshold).toFixed(0);
}

function CpsAdminTab() {
  const [channels, setChannels] = useState([]);
  const [products, setProducts] = useState([]);
  const [rules, setRules] = useState([]);
  const [chModal, setChModal] = useState(false);
  const [prModal, setPrModal] = useState(false);
  const [ruleModal, setRuleModal] = useState(false);
  const [editCh, setEditCh] = useState(null);
  const [editPr, setEditPr] = useState(null);
  const [editRule, setEditRule] = useState(null);
  const [chForm] = Form.useForm();
  const [prForm] = Form.useForm();
  const [ruleForm] = Form.useForm();

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [ch, pr, rl] = await Promise.all([cpsApi.getChannels(), cpsApi.getProducts(), cpsApi.getAlertRules()]);
      if (ch.code === 0) setChannels(ch.data || []);
      if (pr.code === 0) setProducts(pr.data || []);
      if (rl.code === 0) setRules(rl.data || []);
    } catch (e) { /* ignore */ }
  };

  const saveChannel = async () => {
    try { const vals = await chForm.validateFields(); const res = editCh ? await cpsApi.updateChannel(editCh.id, vals) : await cpsApi.createChannel(vals);
      if (res.code === 0) { setChModal(false); loadAll(); message.success(editCh ? '已更新' : '渠道已创建'); }
    } catch (e) { if (!e?.errorFields) message.error('保存失败'); }
  };

  const saveProduct = async () => {
    try { const vals = await prForm.validateFields(); const res = editPr ? await cpsApi.updateProduct(editPr.id, vals) : await cpsApi.createProduct(vals);
      if (res.code === 0) { setPrModal(false); loadAll(); }
    } catch (e) { if (!e?.errorFields) message.error('保存失败'); }
  };

  const saveRule = async () => {
    try { const vals = await ruleForm.validateFields(); const code = vals.name ? String(vals.name).trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'') : 'rule'; const res = await cpsApi.upsertAlertRule({ ...vals, code: code || 'rule_'+Date.now().toString(36), id: editRule?.id }); if (res.code === 0) { setRuleModal(false); loadAll(); } }
    catch (e) { if (!e?.errorFields) message.error('保存失败'); }
  };

  return (
    <div>
      <h4>渠道管理</h4>
      <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { setEditCh(null); chForm.resetFields(); setChModal(true); }} style={{ marginBottom: 12 }}>新增渠道</Button>
      <Table dataSource={channels} rowKey="id" size="small" pagination={false} columns={[
        { title: '名称', dataIndex: 'name', width: 120 },
        { title: '联系人', dataIndex: 'contact_name', width: 100 },
        { title: '联系信息', dataIndex: 'contact_info', width: 160, ellipsis: true },
        { title: '佣金率', dataIndex: 'commission_rate', width: 80, render: v => v ? (Number(v) * 100).toFixed(2) + '%' : '-' },
        { title: '状态', dataIndex: 'status', width: 80, render: v => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
        { title: '创建时间', dataIndex: 'created_at', width: 110, render: v => v ? String(v).slice(0, 10) : '-' },
        { title: '操作', key: 'actions', width: 100, render: (_, r) => (
          <Space size="small">
            <Button size="small" icon={<EditOutlined />} onClick={() => { setEditCh(r); chForm.setFieldsValue(r); setChModal(true); }} />
          </Space>
        ) }
      ]} />

      <Divider />
      <h4>产品管理</h4>
      <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { setEditPr(null); prForm.resetFields(); setPrModal(true); }} style={{ marginBottom: 12 }}>新增产品</Button>
      <Table dataSource={products} rowKey="id" size="small" pagination={false} columns={[
        { title: '名称', dataIndex: 'name', width: 120 },
        { title: '类型', dataIndex: 'product_type', width: 80 },
        { title: '单价', dataIndex: 'unit_price', width: 80, render: v => Number(v).toFixed(2) },
        { title: '状态', dataIndex: 'status', width: 80, render: v => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
        { title: '操作', key: 'actions', width: 100, render: (_, r) => (
          <Button size="small" icon={<EditOutlined />} onClick={() => { setEditPr(r); prForm.setFieldsValue(r); setPrModal(true); }} />
        ) }
      ]} />

      <Divider />
      <h4>预警规则</h4>
      <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { setEditRule(null); ruleForm.resetFields(); ruleForm.setFieldsValue({ level: 'warning', operator: '>=', scope_type: 'global', enabled: true }); setRuleModal(true); }} style={{ marginBottom: 12 }}>新增规则</Button>
      <Table dataSource={rules} rowKey="id" size="small" pagination={false} columns={[
        { title: '名称', dataIndex: 'name', width: 140 },
        { title: '指标', dataIndex: 'metric', width: 110, render: v => METRIC_LABELS[v] || v },
        { title: '条件', key: 'cond', width: 100, render: (_, r) => `${r.operator} ${fmtThreshold(r.metric, r.threshold_value)}` },
        { title: '级别', dataIndex: 'level', width: 80, render: v => <Tag color={v==='critical'?'red':'orange'}>{v}</Tag> },
        { title: '启用', dataIndex: 'enabled', width: 60, render: v => v ? '' : '⛔' },
        { title: '操作', key: 'actions', width: 120, render: (_, r) => (
          <Space size="small">
            <Button size="small" icon={<EditOutlined />} onClick={() => { setEditRule(r); ruleForm.setFieldsValue(r); setRuleModal(true); }} />
            <Popconfirm title="确定删除？" onConfirm={async () => { await cpsApi.deleteAlertRule(r.id); loadAll(); }}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
          </Space>
        ) }
      ]} />

      {/* Modal for channels */}
      <Modal title={editCh ? '编辑渠道' : '新增渠道'} open={chModal} onOk={saveChannel} onCancel={() => setChModal(false)}>
        <Form form={chForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="contact_name" label="联系人"><Input /></Form.Item>
          <Form.Item name="contact_info" label="联系信息"><Input /></Form.Item>
          <Form.Item name="commission_rate" label="佣金率"><PercentInput /></Form.Item>
          <Form.Item name="status" label="状态"><Select><Select.Option value="active">活跃</Select.Option><Select.Option value="inactive">停用</Select.Option></Select></Form.Item>
        </Form>
      </Modal>

      {/* Modal for products */}
      <Modal title={editPr ? '编辑产品' : '新增产品'} open={prModal} onOk={saveProduct} onCancel={() => setPrModal(false)}>
        <Form form={prForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="product_type" label="类型"><Input /></Form.Item>
          <Form.Item name="unit_price" label="单价"><MoneyInput /></Form.Item>
          <Form.Item name="status" label="状态"><Select><Select.Option value="active">活跃</Select.Option><Select.Option value="inactive">停用</Select.Option></Select></Form.Item>
        </Form>
      </Modal>

      {/* Modal for rules */}
      <Modal title={editRule ? '编辑规则' : '新增规则'} open={ruleModal} onOk={saveRule} onCancel={() => setRuleModal(false)} width={500}>
        <Form form={ruleForm} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="metric" label="监控指标" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="new_refund_rate">新签退款率</Select.Option>
              <Select.Option value="renewal_refund_rate">续费退款率</Select.Option>
              <Select.Option value="after_sale_refund_rate">售后退款率</Select.Option>
              <Select.Option value="new_terminate_rate">解约率</Select.Option>
              <Select.Option value="complaint_count">客诉数</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="operator" label="操作符"><Select><Select.Option value=">=">大于等于</Select.Option><Select.Option value=">">大于</Select.Option><Select.Option value="<">小于</Select.Option><Select.Option value="<=">小于等于</Select.Option></Select></Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.metric !== cur.metric}>
            {({ getFieldValue }) => {
              const metric = getFieldValue('metric');
              const isRate = RATE_METRICS.includes(metric);
              return (
                <Form.Item name="threshold_value" label="阈值" tooltip={isRate ? '百分比，如输入30表示30%' : '直接输入数值'}>
                  {isRate ? <PercentInput /> : <InputNumber step={1} min={0} style={{ width: '100%' }} />}
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="level" label="预警级别"><Select><Select.Option value="warning">警告</Select.Option><Select.Option value="critical">严重</Select.Option></Select></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default CpsAdminTab;
