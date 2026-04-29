import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message, Grid } from 'antd';
import { UserOutlined, LockOutlined, RocketOutlined, BarChartOutlined, FileTextOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';

const { useBreakpoint } = Grid;

function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

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

  // 品牌能力点 — 用 Ant Design 图标，不用 emoji
  const capabilities = [
    { icon: <RocketOutlined />, label: '目标追踪', desc: '季度指标与进度实时监控' },
    { icon: <BarChartOutlined />, label: '业绩管理', desc: '多维度业务数据驱动决策' },
    { icon: <FileTextOutlined />, label: '周报沉淀', desc: '智能生成与管理闭环' },
  ];

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
          background: 'linear-gradient(145deg, #0F172A 0%, #1E293B 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '60px 80px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* 底部装饰线 — 克制的视觉元素 */}
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            height: 3,
            background: 'linear-gradient(90deg, #3B5AFB 0%, #2B4AE0 50%, #1E3AB0 100%)',
          }} />

          <div style={{ position: 'relative', zIndex: 1, textAlign: 'left', maxWidth: 380 }}>
            {/* 品牌标识 */}
            <div style={{
              width: 52, height: 52, borderRadius: 12,
              background: 'linear-gradient(135deg, #3B5AFB 0%, #2B4AE0 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 32,
              boxShadow: '0 8px 24px rgba(59, 90, 251, 0.3)',
            }}>
              <SafetyCertificateOutlined style={{ fontSize: 26, color: '#fff' }} />
            </div>

            <h1 style={{
              color: '#FFFFFF', fontSize: 30, fontWeight: 700,
              margin: 0, letterSpacing: '-0.02em', lineHeight: 1.3,
            }}>
              增长业务<br />管理系统
            </h1>
            <p style={{
              color: 'rgba(255,255,255,0.45)', fontSize: 15,
              marginTop: 16, lineHeight: 1.7, letterSpacing: '0.02em',
            }}>
              可信 · 稳重 · 效率<br />
              为经营管理而生的数据工作台
            </p>

            {/* 能力点 */}
            <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {capabilities.map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'rgba(59, 90, 251, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#6B8AFF', fontSize: 16, flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 2 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 右侧登录区 */}
      <div style={{
        width: isMobile ? '100%' : 480,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: isMobile ? '40px 24px' : '60px 72px',
        background: '#FFFFFF',
        flex: isMobile ? 1 : undefined,
      }}>
        {/* 移动端顶部标题 */}
        {isMobile && (
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'linear-gradient(135deg, #3B5AFB 0%, #2B4AE0 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 4px 12px rgba(59, 90, 251, 0.25)',
            }}>
              <SafetyCertificateOutlined style={{ fontSize: 22, color: '#fff' }} />
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>
              增长业务管理系统
            </h1>
            <p style={{ color: '#6B7280', fontSize: 13, marginTop: 8 }}>
              为经营管理而生的数据工作台
            </p>
          </div>
        )}

        {!isMobile && (
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
              欢迎回来
            </h2>
            <p style={{ color: '#6B7280', marginTop: 8, fontSize: 14 }}>
              登录以访问增长业务管理系统
            </p>
          </div>
        )}

        <Form onFinish={handleSubmit} autoComplete="off" layout="vertical" requiredMark={false}>
          <Form.Item name="username" label={<span style={{ fontWeight: 500, color: '#374151' }}>用户名</span>} rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined style={{ color: '#9CA3AF' }} />} placeholder="请输入用户名" size="large" style={{ borderRadius: 8, height: 48 }} />
          </Form.Item>
          <Form.Item name="password" label={<span style={{ fontWeight: 500, color: '#374151' }}>密码</span>} rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#9CA3AF' }} />} placeholder="请输入密码" size="large" style={{ borderRadius: 8, height: 48 }} />
          </Form.Item>
          <Form.Item style={{ marginTop: 12 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large"
              style={{ height: 48, fontSize: 16, fontWeight: 600, borderRadius: 8, boxShadow: '0 2px 8px rgba(59, 90, 251, 0.25)' }}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}

export default LoginPage;
