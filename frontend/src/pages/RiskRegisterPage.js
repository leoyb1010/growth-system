import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Modal, Form, Input, Select, message, Tag, Table, Space, Alert } from 'antd';
import { PlusOutlined, FireOutlined, AlertOutlined, SafetyOutlined } from '@ant-design/icons';
import { fetchRisks, createRisk, updateRisk } from '../services/riskRegisterService';
import { api } from '../hooks/useAuth';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';

const { TextArea } = Input;
const { Option } = Select;

const levelColors = { critical: 'red', high: 'orange', medium: 'blue', low: 'default' };
const levelLabels = { critical: '严重', high: '高', medium: '中', low: '低' };
const statusColors = { open: 'error', monitoring: 'processing', mitigated: 'warning', closed: 'default' };
const statusLabels = { open: '开放', monitoring: '监控中', mitigated: '已缓解', closed: '已关闭' };

function RiskRegisterPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [filters, setFilters] = useState({ risk_level: '', status: '' });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [form] = Form.useForm();
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);

  const stats = {
    critical: data.filter(r => r.risk_level === 'critical').length,
    high: data.filter(r => r.risk_level === 'high').length,
    open: data.filter(r => r.status === 'open').length,
  };

  useEffect(() => { fetchData(); }, [filters, pagination.page]);

  useEffect(() => {
    api.get('/users').then(res => { if (res.code === 0) setUsers(res.data || []); }).catch(() => {});
    api.get('/projects').then(res => { if (res.code === 0) setProjects(res.data || []); }).catch(() => {});
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetchRisks({ ...filters, page: pagination.page, pageSize: pagination.pageSize });
      if (res.code === 0) {
        setData(res.data.data || []);
        setPagination(prev => ({ ...prev, total: res.data.pagination?.total || 0 }));
      }
    } catch (err) {
      message.error('获取风险台账失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingRecord) {
        await updateRisk(editingRecord.id, values);
        message.success('更新成功');
      } else {
        await createRisk(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      setEditingRecord(null);
      fetchData();
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || '操作失败');
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({
      ...record,
      project_id: record.project_id || undefined,
      owner_id: record.owner_id || undefined
    });
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ risk_level: 'medium', status: 'open', probability: 'medium', detected_by: 'manual', project_id: undefined, owner_id: undefined });
    setModalVisible(true);
  };

  const handleMitigate = async (record) => {
    await updateRisk(record.id, { status: 'mitigated' });
    message.success('已标记缓解');
    fetchData();
  };

  const columns = [
    { title: '风险项', dataIndex: 'title', key: 'title', render: (text, record) => (
      <Space>
        <Tag color={levelColors[record.risk_level]}>{levelLabels[record.risk_level]}</Tag>
        <span style={{ fontWeight: 600 }}>{text}</span>
      </Space>
    )},
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: v => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag> },
    { title: '关联项目', dataIndex: 'Project', key: 'project', width: 150, render: v => v?.name || '-' },
    { title: '负责人', dataIndex: 'Owner', key: 'owner', width: 100, render: v => v?.name || '-' },
    { title: '检测方式', dataIndex: 'detected_by', key: 'detected_by', width: 100, render: v => v === 'ai' ? <Tag color="purple">AI</Tag> : <Tag>人工</Tag> },
    { title: '操作', key: 'actions', width: 200, render: (_, record) => (
      <Space>
        <Button size="small" onClick={() => handleEdit(record)}>编辑</Button>
        {!['mitigated', 'closed'].includes(record.status) && (
          <Button size="small" type="primary" ghost icon={<SafetyOutlined />} onClick={() => handleMitigate(record)}>缓解</Button>
        )}
      </Space>
    )}
  ];

  const expandedRowRender = (record) => (
    <div style={{ padding: 8 }}>
      {record.description && <p><b>描述：</b>{record.description}</p>}
      {record.impact && <Alert message={`影响：${record.impact}`} type="warning" showIcon style={{ marginBottom: 8 }} />}
      {record.mitigation_plan && <Alert message={`缓解方案：${record.mitigation_plan}`} type="info" showIcon />}
      <Space style={{ marginTop: 8 }}>
        <span>风险类型：{record.risk_type || '-'}</span>
        <span>概率：{record.probability || '-'}</span>
        <span>来源：{record.source_type || '-'}</span>
      </Space>
    </div>
  );

  return (
    <div>
      <PageHeader title="风险台账" subtitle="持续追踪项目、资源、质量、进度和 KPI 风险，避免风险只停留在会议里" />
      
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <PanelCard><Card size="small"><div style={{ textAlign: 'center' }}><FireOutlined style={{ fontSize: 24, color: '#ff4d4f' }} /><h3>{stats.critical}</h3><div>严重风险</div></div></Card></PanelCard>
        </Col>
        <Col span={8}>
          <PanelCard><Card size="small"><div style={{ textAlign: 'center' }}><AlertOutlined style={{ fontSize: 24, color: '#fa8c16' }} /><h3>{stats.high}</h3><div>高风险</div></div></Card></PanelCard>
        </Col>
        <Col span={8}>
          <PanelCard><Card size="small"><div style={{ textAlign: 'center' }}><SafetyOutlined style={{ fontSize: 24, color: '#1890ff' }} /><h3>{stats.open}</h3><div>开放中</div></div></Card></PanelCard>
        </Col>
      </Row>

      <PanelCard>
        <Space style={{ marginBottom: 16 }}>
          <Select placeholder="风险等级" allowClear value={filters.risk_level || undefined} onChange={v => setFilters(f => ({ ...f, risk_level: v || '' }))} style={{ width: 120 }}>
            {Object.entries(levelLabels).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
          </Select>
          <Select placeholder="状态" allowClear value={filters.status || undefined} onChange={v => setFilters(f => ({ ...f, status: v || '' }))} style={{ width: 120 }}>
            {Object.entries(statusLabels).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建风险</Button>
        </Space>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          expandable={{ expandedRowRender }}
          pagination={{ current: pagination.page, pageSize: pagination.pageSize, total: pagination.total, onChange: (p) => setPagination(prev => ({ ...prev, page: p })) }}
          size="middle"
        />
      </PanelCard>

      <Modal title={editingRecord ? '编辑风险' : '新建风险'} open={modalVisible} onOk={handleSave} onCancel={() => { setModalVisible(false); form.resetFields(); }} width={560}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="风险标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="风险标题" />
          </Form.Item>
          <Form.Item name="description" label="描述"><TextArea rows={2} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="risk_level" label="风险等级"><Select>{Object.entries(levelLabels).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="status" label="状态"><Select>{Object.entries(statusLabels).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}</Select></Form.Item></Col>
          </Row>
          <Form.Item name="impact" label="影响"><TextArea rows={2} /></Form.Item>
          <Form.Item name="mitigation_plan" label="缓解方案"><TextArea rows={2} /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="risk_type" label="风险类型"><Select allowClear>{['schedule', 'quality', 'resource', 'cost', 'communication', 'other'].map(v => <Option key={v} value={v}>{v}</Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="probability" label="概率"><Select>{['low', 'medium', 'high'].map(v => <Option key={v} value={v}>{v}</Option>)}</Select></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="project_id" label="关联项目"><Select allowClear placeholder="选择项目">{projects.map(p => <Option key={p.id} value={p.id}>{p.name}</Option>)}</Select></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="owner_id" label="负责人"><Select allowClear placeholder="选择负责人">{users.map(u => <Option key={u.id} value={u.id}>{u.name || u.username}</Option>)}</Select></Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

export default RiskRegisterPage;
