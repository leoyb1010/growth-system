import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, message, Tag, Row, Col, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { api, useAuth } from '../hooks/useAuth';
import DepartmentSelect from '../components/DepartmentSelect';

const { Option } = Select;

function PerformancePage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const { isDeptManager } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/performances');
      if (res.code === 0) {
        setData(res.data);
      }
    } catch (err) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingRecord) {
        await api.put(`/performances/${editingRecord.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/performances', values);
        message.success('创建成功');
      }
      setModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/performances/${id}`);
      message.success('删除成功');
      fetchData();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const getWarningColor = (status) => {
    switch (status) {
      case '正常': return 'success';
      case '预警': return 'warning';
      case '严重': return 'error';
      default: return 'default';
    }
  };

  const columns = [
    { title: '部门', dataIndex: ['Department', 'name'], key: 'dept', width: 100 },
    { title: '业务类型', dataIndex: 'business_type', key: 'type', width: 150 },
    { title: '指标', dataIndex: 'indicator', key: 'indicator', width: 150 },
    { title: '单位', dataIndex: 'unit', key: 'unit', width: 80 },
    { title: 'Q1目标', dataIndex: 'q1_target', key: 'q1t', width: 100 },
    { title: 'Q1完成', dataIndex: 'q1_actual', key: 'q1a', width: 100 },
    { title: 'Q2目标', dataIndex: 'q2_target', key: 'q2t', width: 100 },
    { title: 'Q2完成', dataIndex: 'q2_actual', key: 'q2a', width: 100 },
    { title: 'Q3目标', dataIndex: 'q3_target', key: 'q3t', width: 100 },
    { title: 'Q3完成', dataIndex: 'q3_actual', key: 'q3a', width: 100 },
    { title: 'Q4目标', dataIndex: 'q4_target', key: 'q4t', width: 100 },
    { title: 'Q4完成', dataIndex: 'q4_actual', key: 'q4a', width: 100 },
    {
      title: '累计完成率',
      key: 'rate',
      width: 120,
      render: (_, record) => (
        <span style={{ fontWeight: 600, color: record.time_progress !== undefined ? (record.completion_rate >= record.time_progress + 5 ? '#52c41a' : record.completion_rate >= record.time_progress - 5 ? '#faad14' : '#ff4d4f') : (record.completion_rate >= 90 ? '#52c41a' : record.completion_rate >= 60 ? '#faad14' : '#ff4d4f') }}>
          {record.completion_rate}%
        </span>
      )
    },
    {
      title: '预警状态',
      dataIndex: 'warning_status',
      key: 'warning',
      width: 100,
      render: (status) => <Tag color={getWarningColor(status)}>{status}</Tag>
    },
    ...(isDeptManager ? [{
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <span>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该业绩记录？" onConfirm={() => handleDelete(record.id)} okType="danger"><Button type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>
        </span>
      )
    }] : [])
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>业务线业绩追踪</h2>
        {isDeptManager && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setModalVisible(true); }}>
            新增业绩
          </Button>
        )}
      </div>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title={editingRecord ? '编辑业绩' : '新增业绩'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => { setModalVisible(false); setEditingRecord(null); }}
        width={800}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="dept_id" label="部门" rules={[{ required: true }]}>
            <DepartmentSelect />
          </Form.Item>
          <Form.Item name="business_type" label="业务类型" rules={[{ required: true }]}>
            <Input placeholder="如：SaaS订阅、广告收入" />
          </Form.Item>
          <Form.Item name="indicator" label="指标" rules={[{ required: true }]}>
            <Input placeholder="如：订阅收入、广告营收" />
          </Form.Item>
          <Form.Item name="unit" label="单位" initialValue="万元">
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="q1_target" label="Q1目标" initialValue={0}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="q1_actual" label="Q1完成" initialValue={0}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="q2_target" label="Q2目标" initialValue={0}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="q2_actual" label="Q2完成" initialValue={0}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="q3_target" label="Q3目标" initialValue={0}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="q3_actual" label="Q3完成" initialValue={0}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="q4_target" label="Q4目标" initialValue={0}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="q4_actual" label="Q4完成" initialValue={0}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}

export default PerformancePage;
