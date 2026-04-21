import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';

function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      const res = await login(values.username, values.password);
      if (res.code === 0) {
        message.success('登录成功');
        navigate('/');
      } else {
        message.error(res.message || '登录失败');
      }
    } catch (err) {
      message.error(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      background: '#F5F7FB',
    }}>
      {/* 左侧品牌区 */}
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
        {/* 装饰圆 */}
        <div style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59, 90, 251, 0.12) 0%, transparent 70%)',
          top: -80,
          right: -100,
        }} />
        <div style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59, 90, 251, 0.08) 0%, transparent 70%)',
          bottom: -60,
          left: -80,
        }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'rgba(59, 90, 251, 0.2)',
            border: '1px solid rgba(59, 90, 251, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            fontSize: 24,
            color: '#3B5AFB',
          }}>
            ⚡
          </div>
          <h1 style={{ color: '#FFFFFF', fontSize: 32, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            增长业务管理系统
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, marginTop: 16, lineHeight: 1.6 }}>
            统一管理目标、项目、业绩与周报沉淀
          </p>
          <div style={{ display: 'flex', gap: 32, marginTop: 48, justifyContent: 'center' }}>
            {[
              { icon: '🎯', label: '目标追踪' },
              { icon: '📊', label: '业绩管理' },
              { icon: '📝', label: '周报沉淀' },
            ].map(item => (
              <div key={item.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{item.icon}</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 右侧登录区 */}
      <div style={{
        width: 460,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 64px',
        background: '#FFFFFF',
      }}>
        <div style={{ marginBottom: 40 }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
            欢迎回来
          </h2>
          <p style={{ color: '#6B7280', marginTop: 8, fontSize: 14 }}>
            登录以访问增长业务管理系统
          </p>
        </div>

        <Form onFinish={handleSubmit} autoComplete="off" layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined style={{ color: '#9CA3AF' }} />} placeholder="请输入用户名" size="large" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#9CA3AF' }} />} placeholder="请输入密码" size="large" />
          </Form.Item>
          <Form.Item style={{ marginTop: 8 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" style={{ height: 48, fontSize: 16, fontWeight: 600 }}>
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 16 }}>
          测试账号：admin / expand / ops，密码均为 123456
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
