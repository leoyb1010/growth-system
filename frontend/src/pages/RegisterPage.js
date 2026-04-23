import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, message, Grid } from 'antd';
import { UserOutlined, LockOutlined, IdcardOutlined } from '@ant-design/icons';
import { api } from '../hooks/useAuth';

const { useBreakpoint } = Grid;

function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        username: values.username,
        name: values.name,
        password: values.password,
      });
      if (res.code === 0) {
        // 注册成功，自动登录
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        message.success('注册成功');
        navigate('/');
      } else {
        message.error(res.message || '注册失败');
      }
    } catch (err) {
      message.error(err.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      background: '#F5F7FB',
      flexDirection: isMobile ? 'column' : 'row',
    }}>
      {/* 左侧品牌区 — 移动端隐藏 */}
      {!isMobile && (
        <div style={{
          flex: 1,
          background: 'linear-gradient(160deg, #0F172A 0%, #1E293B 50%, #334155 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '60px 80px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59, 90, 251, 0.12) 0%, transparent 70%)',
            top: -80, right: -100,
          }} />
          <div style={{
            position: 'absolute',
            width: 300, height: 300, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59, 90, 251, 0.08) 0%, transparent 70%)',
            bottom: -60, left: -80,
          }} />
          <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14,
              background: 'rgba(59, 90, 251, 0.2)',
              border: '1px solid rgba(59, 90, 251, 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px', fontSize: 24, color: '#3B5AFB',
            }}>⚡</div>
            <h1 style={{ color: '#FFFFFF', fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              增长业务管理系统
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 16, lineHeight: 1.6 }}>
              统一管理目标、项目、业绩与周报沉淀
            </p>
          </div>
        </div>
      )}

      {/* 右侧注册区 */}
      <div style={{
        width: isMobile ? '100%' : 460,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: isMobile ? '40px 24px' : '60px 64px',
        background: '#FFFFFF',
        flex: isMobile ? 1 : undefined,
      }}>
        {/* 移动端顶部标题 */}
        {isMobile && (
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'rgba(59, 90, 251, 0.1)',
              border: '1px solid rgba(59, 90, 251, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', fontSize: 20, color: '#3B5AFB',
            }}>⚡</div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>
              增长业务管理系统
            </h1>
          </div>
        )}

        {!isMobile && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
              创建账号
            </h2>
            <p style={{ color: '#6B7280', marginTop: 8, fontSize: 14 }}>
              注册后将获得普通成员权限，管理员可后续调整
            </p>
          </div>
        )}

        <Form onFinish={handleSubmit} autoComplete="off" layout="vertical">
          <Form.Item name="username" label="用户名" rules={[
            { required: true, message: '请输入用户名' },
            { min: 2, message: '用户名至少2个字符' },
            { max: 20, message: '用户名不超过20个字符' },
          ]}>
            <Input prefix={<UserOutlined style={{ color: '#9CA3AF' }} />} placeholder="请输入用户名" size="large" />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[
            { required: true, message: '请输入姓名' },
            { max: 50, message: '姓名不超过50个字符' },
          ]}>
            <Input prefix={<IdcardOutlined style={{ color: '#9CA3AF' }} />} placeholder="请输入真实姓名" size="large" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码不少于6位' },
          ]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#9CA3AF' }} />} placeholder="请输入密码（不少于6位）" size="large" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#9CA3AF' }} />} placeholder="再次输入密码" size="large" />
          </Form.Item>
          <Form.Item style={{ marginTop: 8 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ height: 48, fontSize: 16, fontWeight: 600 }}>
              注册
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <span style={{ color: '#9CA3AF', fontSize: 13 }}>已有账号？</span>
          <Link to="/login" style={{ fontSize: 13, marginLeft: 4 }}>去登录</Link>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
