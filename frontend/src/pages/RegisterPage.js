import React from 'react';
import { Link } from 'react-router-dom';
import { Result, Button, Grid } from 'antd';

const { useBreakpoint } = Grid;

function RegisterPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;

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

      {/* 右侧提示区 */}
      <div style={{
        width: isMobile ? '100%' : 460,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: isMobile ? '40px 24px' : '60px 64px',
        background: '#FFFFFF',
        flex: isMobile ? 1 : undefined,
      }}>
        <Result
          status="info"
          title="暂不开放注册"
          subTitle="当前系统不开放公开注册，请联系管理员创建账号"
          extra={[
            <Link to="/login" key="login">
              <Button type="primary" size="large">返回登录</Button>
            </Link>
          ]}
        />
      </div>
    </div>
  );
}

export default RegisterPage;
