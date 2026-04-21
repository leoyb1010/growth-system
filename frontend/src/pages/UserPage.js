import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons';
import { api } from '../hooks/useAuth';

const { Option } = Select;

function UserPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [changingPasswordUser, setChangingPasswordUser] = useState(null);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      if (res.code === 0) {
        setUsers(res.data);
      }
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

  const handleChangePassword = async (values) => {
    try {
      await api.post('/auth/change-password', {
        user_id: changingPasswordUser.id,
        new_password: values.new_password
      });
      message.success('密码修改成功');
      setPasswordModalVisible(false);
      setChangingPasswordUser(null);
      passwordForm.resetFields();
    } catch (err) {
      message.error('密码修改失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={role === 'admin' ? 'red' : 'blue'}>
          {role === 'admin' ? '管理员' : '部门账号'}
        </Tag>
      )
    },
    {
      title: '部门',
      dataIndex: ['Department', 'name'],
      key: 'dept',
      render: (dept) => dept || '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <span>
          <Button type="link" icon={<EditOutlined />} onClick={() => { setEditingUser(record); form.setFieldsValue(record); setModalVisible(true); }}>
            编辑
          </Button>
          <Button type="link" icon={<LockOutlined />} onClick={() => { setChangingPasswordUser(record); setPasswordModalVisible(true); }}>
            改密
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </span>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>用户管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingUser(null); form.resetFields(); setModalVisible(true); }}>
          新增用户
        </Button>
      </div>

      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} />

      {/* 用户编辑/创建弹窗 */}
      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => { setModalVisible(false); setEditingUser(null); }}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input disabled={!!editingUser} />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          {!editingUser && (
            <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
              <Input.Password placeholder="不少于6位" />
            </Form.Item>
          )}
          <Form.Item name="role" label="角色" rules={[{ required: true }]} initialValue="dept">
            <Select>
              <Option value="admin">管理员</Option>
              <Option value="dept">部门账号</Option>
            </Select>
          </Form.Item>
          <Form.Item name="dept_id" label="所属部门">
            <Select allowClear placeholder="管理员可不选">
              <Option value={1}>拓展组</Option>
              <Option value={2}>运营组</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 修改密码弹窗 */}
      <Modal
        title={`修改密码 - ${changingPasswordUser?.name || ''}`}
        open={passwordModalVisible}
        onOk={() => passwordForm.submit()}
        onCancel={() => { setPasswordModalVisible(false); setChangingPasswordUser(null); }}
      >
        <Form form={passwordForm} onFinish={handleChangePassword} layout="vertical">
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="不少于6位" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认密码"
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default UserPage;
