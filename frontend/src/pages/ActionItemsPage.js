import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Modal, Form, Input, Select, DatePicker, message, Tag, Table, Popconfirm, Space } from 'antd';
import { PlusOutlined, CheckCircleOutlined, ClockCircleOutlined, SyncOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { fetchActionItems, createActionItem, updateActionItem, deleteActionItem } from '../services/actionItemService';
import { api } from '../hooks/useAuth';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';

const { TextArea } = Input;
const { Option } = Select;

const priorityColors = { urgent: 'red', high: 'orange', medium: 'blue', low: 'default' };
const priorityLabels = { urgent: '紧急', high: '高', medium: '中', low: '低' };
const statusColors = { pending: 'default', in_progress: 'processing', done: 'success', cancelled: 'default' };
const statusLabels = { pending: '待处理', in_progress: '进行中', done: '已完成', cancelled: '已取消' };

function ActionItemsPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [filters, setFilters] = useState({ status: '', priority: '' });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [form] = Form.useForm();

  const stats = {
    pending: data.filter(i => i.status === 'pending').length,
    inProgress: data.filter(i => i.status === 'in_progress').length,
    done: data.filter(i => i.status === 'done').length,
  };

  useEffect(() => { fetchData(); }, [filters, pagination.page]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetchActionItems({ ...filters, page: pagination.page, pageSize: pagination.pageSize });
      if (res.code === 0) {
        setData(res.data.data || []);
        setPagination(prev => ({ ...prev, total: res.data.pagination?.total || 0 }));
      }
    } catch (err) {
      message.error('获取行动项失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : null,
      };
      if (editingRecord) {
        await updateActionItem(editingRecord.id, payload);
        message.success('更新成功');
      } else {
        await createActionItem(payload);
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
    form.setFieldsValue({ ...record, due_date: record.due_date ? undefined : undefined });
    setModalVisible(true);
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ priority: 'medium', status: 'pending' });
    setModalVisible(true);
  };

  const handleMarkDone = async (record) => {
    await updateActionItem(record.id, { status: 'done' });
    message.success('已标记完成');
    fetchData();
  };

  const handleDelete = async (id) => {
    await deleteActionItem(id);
    message.success('已删除');
    fetchData();
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', render: (text, record) => (
      <Space>
        {record.created_by_ai && <Tag color="purple">AI建议</Tag>}
        {!record.confirmed_by_user && <Tag color="warning">待确认</Tag>}
        <span style={{ fontWeight: 600 }}>{text}</span>
      </Space>
    )},
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 90, render: v => <Tag color={priorityColors[v]}>{priorityLabels[v] || v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: v => <Tag color={statusColors[v]}>{statusLabels[v] || v}</Tag> },
    { title: '负责人', dataIndex: 'Owner', key: 'owner', width: 120, render: v => v?.name || '-' },
    { title: '截止日期', dataIndex: 'due_date', key: 'due_date', width: 120, render: v => v || '-' },
    { title: '操作', key: 'actions', width: 200, render: (_, record) => (
      <Space>
        <Button size="small" onClick={() => handleEdit(record)}>编辑</Button>
        {record.status !== 'done' && (
          <Button size="small" type="primary" ghost icon={<CheckCircleOutlined />} onClick={() => handleMarkDone(record)}>完成</Button>
        )}
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
          <Button size="small" danger>删除</Button>
        </Popconfirm>
      </Space>
    )}
  ];

  return (
    <div>
      <PageHeader title="行动项" subtitle="承接 AI 建议、项目风险、KPI 异常和报告问题，推动管理动作闭环" />
      
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <PanelCard><Card size="small"><div style={{ textAlign: 'center' }}><ClockCircleOutlined style={{ fontSize: 24, color: '#faad14' }} /><h3>{stats.pending}</h3><div>待处理</div></div></Card></PanelCard>
        </Col>
        <Col span={8}>
          <PanelCard><Card size="small"><div style={{ textAlign: 'center' }}><SyncOutlined spin style={{ fontSize: 24, color: '#1890ff' }} /><h3>{stats.inProgress}</h3><div>进行中</div></div></Card></PanelCard>
        </Col>
        <Col span={8}>
          <PanelCard><Card size="small"><div style={{ textAlign: 'center' }}><CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} /><h3>{stats.done}</h3><div>已完成</div></div></Card></PanelCard>
        </Col>
      </Row>

      <PanelCard>
        <Space style={{ marginBottom: 16 }}>
          <Select placeholder="状态" allowClear value={filters.status || undefined} onChange={v => setFilters(f => ({ ...f, status: v || '' }))} style={{ width: 120 }}>
            {Object.entries(statusLabels).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
          </Select>
          <Select placeholder="优先级" allowClear value={filters.priority || undefined} onChange={v => setFilters(f => ({ ...f, priority: v || '' }))} style={{ width: 120 }}>
            {Object.entries(priorityLabels).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建行动项</Button>
        </Space>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={{ current: pagination.page, pageSize: pagination.pageSize, total: pagination.total, onChange: (p) => setPagination(prev => ({ ...prev, page: p })) }}
          size="middle"
        />
      </PanelCard>

      <Modal title={editingRecord ? '编辑行动项' : '新建行动项'} open={modalVisible} onOk={handleSave} onCancel={() => { setModalVisible(false); form.resetFields(); }} width={560}>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="行动项标题" />
          </Form.Item>
          <Form.Item name="description" label="描述"><TextArea rows={3} placeholder="补充说明" /></Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="priority" label="优先级"><Select>{Object.entries(priorityLabels).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}</Select></Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态"><Select>{Object.entries(statusLabels).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}</Select></Form.Item>
            </Col>
          </Row>
          <Form.Item name="due_date" label="截止日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ActionItemsPage;
