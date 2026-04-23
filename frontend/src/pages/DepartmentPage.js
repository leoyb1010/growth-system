import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Tag, Popconfirm, Statistic, Row, Col, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, BankOutlined } from '@ant-design/icons';
import { api, useAuth } from '../hooks/useAuth';
import PageHeader from '../components/ui/PageHeader';

function DepartmentPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const { isAdmin } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/departments');
      if (res.code === 0) {
        setData(res.data || []);
      }
    } catch (err) {
      message.error('获取部门列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingRecord) {
        await api.put(`/departments/${editingRecord.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/departments', values);
        message.success('创建成功');
      }
      setModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error(err?.response?.data?.message || '操作失败');
    }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/departments/${id}`);
      message.success('删除成功');
      fetchData();
    } catch (err) {
      message.error(err?.response?.data?.message || '删除失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
    { title: '部门名称', dataIndex: 'name', key: 'name', width: 200 },
    {
      title: '用户数', dataIndex: 'user_count', key: 'user_count', width: 100,
      render: (count) => <Tag color="blue">{count}</Tag>
    },
    {
      title: '部门负责人', key: 'managers', width: 200,
      render: (_, record) => {
        const managers = (record.Users || []).filter(u => u.role === 'dept' || u.role === 'dept_manager');
        return managers.length > 0
          ? managers.map(m => <Tag key={m.id}>{m.name}</Tag>)
          : <span style={{ color: '#9CA3AF' }}>未指定</span>;
      }
    },
    {
      title: '操作', key: 'action', width: 150, fixed: 'right',
      render: (_, record) => (
        <span>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm
            title="确定删除该部门？"
            description="如果部门下有用户或业务数据，将无法删除"
            onConfirm={() => handleDelete(record.id)}
            okType="danger"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </span>
      )
    }
  ];

  const totalUsers = data.reduce((s, d) => s + (d.user_count || 0), 0);

  return (
    <div>
      <PageHeader
        title="部门管理"
        subtitle="管理组织架构中的部门，支持新增、编辑和删除"
        extra={[
          <Button key="refresh" onClick={fetchData}>刷新</Button>,
          isAdmin && (
            <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRecord(null); form.resetFields(); setModalVisible(true); }}>
              新增部门
            </Button>
          ),
        ]}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}>
          <Card className="surface-card hover-lift" bodyStyle={{ padding: 16 }}>
            <Statistic title="部门总数" value={data.length} prefix={<BankOutlined />} valueStyle={{ color: '#3B5AFB' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="surface-card hover-lift" bodyStyle={{ padding: 16 }}>
            <Statistic title="总用户数" value={totalUsers} valueStyle={{ color: '#16A34A' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card className="surface-card hover-lift" bodyStyle={{ padding: 16 }}>
            <Statistic title="平均每部门" value={data.length > 0 ? (totalUsers / data.length).toFixed(1) : 0} suffix="人" valueStyle={{ color: '#7C3AED' }} />
          </Card>
        </Col>
      </Row>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingRecord ? '编辑部门' : '新增部门'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => { setModalVisible(false); setEditingRecord(null); }}
        width={480}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="name" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input placeholder="如：拓展组、运营组" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default DepartmentPage;
