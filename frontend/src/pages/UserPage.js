import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Tag, Row, Col, Card, Statistic, Popconfirm, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, KeyOutlined, StopOutlined, CheckCircleOutlined, UserOutlined, SafetyOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { api } from '../hooks/useAuth';

const { Option } = Select;

const ROLE_MAP = {
  admin: { label: '超级管理员', color: 'red' },
  super_admin: { label: '超级管理员', color: 'red' },
  dept_manager: { label: '部门负责人', color: 'blue' },
  dept: { label: '部门负责人', color: 'blue' },
  dept_staff: { label: '普通成员', color: 'default' },
  department_member: { label: '普通成员', color: 'default' },
};

const STATUS_MAP = {
  active: { label: '启用', color: 'green' },
  disabled: { label: '停用', color: 'red' },
  pending: { label: '待激活', color: 'orange' },
};

function UserPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [resetPwdModalVisible, setResetPwdModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetPwdUser, setResetPwdUser] = useState(null);
  const [form] = Form.useForm();
  const [resetPwdForm] = Form.useForm();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      if (res.code === 0) setUsers(res.data);
    } catch (err) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, values);
        message.success('用户更新成功');
      } else {
        await api.post('/users', values);
        message.success('用户创建成功');
      }
      setModalVisible(false);
      setEditingUser(null);
      form.resetFields();
      fetchUsers();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/users/${id}`);
      message.success('用户删除成功');
      fetchUsers();
    } catch (err) {
      message.error('删除失败');
    }
  };

  const handleResetPassword = async (values) => {
    try {
      await api.post(`/users/${resetPwdUser.id}/reset-password`, { new_password: values.new_password });
      message.success('密码重置成功');
      setResetPwdModalVisible(false);
      setResetPwdUser(null);
      resetPwdForm.resetFields();
    } catch (err) {
      message.error('密码重置失败');
    }
  };

  const handleToggleStatus = async (user) => {
    try {
      const action = user.status === 'disabled' ? 'enable' : 'disable';
      await api.post(`/users/${user.id}/${action}`);
      message.success(user.status === 'disabled' ? '用户已启用' : '用户已禁用');
      fetchUsers();
    } catch (err) {
      message.error('操作失败');
    }
  };

  // 统计数据
  const totalUsers = users.length;
  const activeUsers = users.filter(u => (u.status || 'active') === 'active').length;
  const adminUsers = users.filter(u => ['admin', 'super_admin'].includes(u.role)).length;

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', key: 'username', width: 100 },
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role) => {
        const info = ROLE_MAP[role] || { label: role, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      }
    },
    {
      title: '部门',
      dataIndex: ['Department', 'name'],
      key: 'dept',
      width: 100,
      render: (dept) => dept || '-'
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 140,
      render: (v) => v || '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => {
        const s = status || 'active';
        const info = STATUS_MAP[s] || { label: s, color: 'default' };
        return <Tag color={info.color}>{info.label}</Tag>;
      }
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      key: 'last_login',
      width: 150,
      render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => { setEditingUser(record); form.setFieldsValue(record); setModalVisible(true); }}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => { setResetPwdUser(record); resetPwdForm.resetFields(); setResetPwdModalVisible(true); }}>
            重置密码
          </Button>
          {record.username !== 'admin' && (
            record.status === 'disabled' ? (
              <Button type="link" size="small" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }} onClick={() => handleToggleStatus(record)}>
                启用
              </Button>
            ) : (
              <Popconfirm title={`确定禁用 ${record.name}？`} onConfirm={() => handleToggleStatus(record)}>
                <Button type="link" size="small" danger icon={<StopOutlined />}>禁用</Button>
              </Popconfirm>
            )
          )}
          {record.username !== 'admin' && (
            <Popconfirm title={`确定删除 ${record.name}？此操作不可恢复`} onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 统计卡 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={6}>
          <Card size="small"><Statistic title="总用户数" value={totalUsers} prefix={<UserOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="启用中" value={activeUsers} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="高权限账号" value={adminUsers} valueStyle={{ color: '#cf1322' }} prefix={<SafetyOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="停用账号" value={totalUsers - activeUsers} valueStyle={{ color: '#999' }} prefix={<StopOutlined />} /></Card>
        </Col>
      </Row>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>用户管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingUser(null); form.resetFields(); setModalVisible(true); }}>
          新增用户
        </Button>
      </div>

      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} scroll={{ x: 'max-content' }} size="small" />

      {/* 用户编辑/创建弹窗 */}
      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => { setModalVisible(false); setEditingUser(null); }}
        width={560}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
                <Input disabled={!!editingUser} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          {!editingUser && (
            <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
              <Input.Password placeholder="不少于6位" />
            </Form.Item>
          )}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="email" label="邮箱">
                <Input placeholder="user@example.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="mobile" label="手机号">
                <Input placeholder="13800138000" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="role" label="角色" rules={[{ required: true }]} initialValue="dept_manager">
                <Select>
                  <Option value="admin">超级管理员</Option>
                  <Option value="dept_manager">部门负责人</Option>
                  <Option value="dept_staff">普通成员</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="dept_id" label="所属部门">
                <Select allowClear placeholder="管理员可不选">
                  <Option value={1}>拓展组</Option>
                  <Option value={2}>运营组</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="status" label="账号状态" initialValue="active">
                <Select>
                  <Option value="active">启用</Option>
                  <Option value="disabled">停用</Option>
                  <Option value="pending">待激活</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="must_change_password" label="首次登录改密" valuePropName="checked" initialValue={false}>
                <Select>
                  <Option value={false}>否</Option>
                  <Option value={true}>是</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 重置密码弹窗（管理员重置他人密码，不需要旧密码） */}
      <Modal
        title={`重置密码 - ${resetPwdUser?.name || ''}`}
        open={resetPwdModalVisible}
        onOk={() => resetPwdForm.submit()}
        onCancel={() => { setResetPwdModalVisible(false); setResetPwdUser(null); }}
      >
        <div style={{ marginBottom: 16, padding: '8px 12px', background: '#fff7e6', borderRadius: 6, fontSize: 13, color: '#ad6800' }}>
          ⚠️ 管理员重置密码操作将被审计日志记录。重置后请通知用户尽快修改密码。
        </div>
        <Form form={resetPwdForm} onFinish={handleResetPassword} layout="vertical">
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6, message: '密码不少于6位' }]}>
            <Input.Password placeholder="输入新密码（不少于6位）" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认密码"
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default UserPage;
