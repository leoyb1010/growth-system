import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Tag, Modal, Form, Select, Input, message, Popconfirm, Space, Typography } from 'antd';
import { useAuth } from '../hooks/useAuth';
import { SafetyCertificateOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';

const { Title } = Typography;

const MODULE_OPTIONS = [
  { value: 'kpis', label: '核心指标' },
  { value: 'projects', label: '重点工作' },
  { value: 'performances', label: '业务线业绩' },
  { value: 'monthly_tasks', label: '月度工作' },
  { value: 'achievements', label: '季度成果' }
];

const QUARTER_OPTIONS = [
  { value: 'Q1', label: 'Q1' },
  { value: 'Q2', label: 'Q2' },
  { value: 'Q3', label: 'Q3' },
  { value: 'Q4', label: 'Q4' }
];

function ArchivePage() {
  const { api } = useAuth();
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();

  const fetchArchives = async () => {
    setLoading(true);
    try {
      const res = await api.get('/archives');
      if (res.code === 0) {
        setArchives(res.data);
      }
    } catch (err) {
      message.error('获取归档列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArchives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (values) => {
    try {
      const res = await api.post('/archives', {
        ...values,
        year: parseInt(values.year)
      });
      if (res.code === 0) {
        message.success('归档成功');
        setModalVisible(false);
        form.resetFields();
        fetchArchives();
      } else {
        message.error(res.message || '归档失败');
      }
    } catch (err) {
      message.error(err.message || '归档失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/archives/${id}`);
      if (res.code === 0) {
        message.success('已取消归档');
        fetchArchives();
      }
    } catch (err) {
      message.error('取消归档失败');
    }
  };

  const columns = [
    {
      title: '模块',
      dataIndex: 'module',
      render: (v) => MODULE_OPTIONS.find(m => m.value === v)?.label || v
    },
    {
      title: '季度',
      dataIndex: 'quarter',
      render: (v) => <Tag color="blue">{v}</Tag>
    },
    {
      title: '年份',
      dataIndex: 'year'
    },
    {
      title: '归档时间',
      dataIndex: 'archived_at',
      render: (v) => new Date(v).toLocaleString('zh-CN')
    },
    {
      title: '备注',
      dataIndex: 'note',
      ellipsis: true
    },
    {
      title: '操作',
      width: 120,
      render: (_, record) => (
        <Popconfirm
          title="确定取消归档？"
          description="取消后该季度数据可再次编辑"
          onConfirm={() => handleDelete(record.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="link" danger icon={<UnlockOutlined />}>取消归档</Button>
        </Popconfirm>
      )
    }
  ];

  return (
    <div>
      <Title level={4}><SafetyCertificateOutlined /> 季度归档管理</Title>
      <Card style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<LockOutlined />} onClick={() => setModalVisible(true)}>
            新建归档
          </Button>
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={archives}
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
          scroll={{ x: 'max-content' }}
        />
      </Card>

      <Modal
        title="新建季度归档"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="module" label="模块" rules={[{ required: true }]}>
            <Select placeholder="选择业务模块" options={MODULE_OPTIONS} />
          </Form.Item>
          <Form.Item name="quarter" label="季度" rules={[{ required: true }]}>
            <Select placeholder="选择季度" options={QUARTER_OPTIONS} />
          </Form.Item>
          <Form.Item name="year" label="年份" rules={[{ required: true }]} initialValue={2026}>
            <Select placeholder="选择年份" options={[{ value: 2025, label: '2025' }, { value: 2026, label: '2026' }, { value: 2027, label: '2027' }]} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} placeholder="可选：填写归档说明" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ArchivePage;
