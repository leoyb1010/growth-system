import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Avatar, Dropdown, Badge, Tooltip } from 'antd';
import {
  DashboardOutlined,
  BarChartOutlined,
  ProjectOutlined,
  TrophyOutlined,
  CalendarOutlined,
  StarOutlined,
  TeamOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HistoryOutlined,
  FormOutlined
} from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';

const { Header, Sider, Content } = Layout;

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 侧边栏菜单 - 精简后
  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '/kpis', icon: <BarChartOutlined />, label: '核心指标' },
    { key: '/projects', icon: <ProjectOutlined />, label: '重点工作' },
    { key: '/performances', icon: <TrophyOutlined />, label: '业务线业绩' },
    { key: '/monthly-tasks', icon: <CalendarOutlined />, label: '月度工作' },
    { key: '/achievements', icon: <StarOutlined />, label: '季度成果' },
    ...(isAdmin ? [
      { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
    ] : [])
  ];

  // 头像下拉菜单 - 审计日志移到这里
  const userMenuItems = [
    { key: 'profile', label: user?.name || '用户', icon: <UserOutlined />, disabled: true },
    { type: 'divider' },
    ...(isAdmin ? [
      { key: '/audit-logs', label: '审计日志', icon: <HistoryOutlined /> },
    ] : []),
    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true }
  ];

  const handleMenuClick = ({ key }) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
    } else if (key.startsWith('/')) {
      navigate(key);
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="light">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <h3 style={{ margin: 0, fontSize: collapsed ? 11 : 14, color: '#1890ff', whiteSpace: 'nowrap', lineHeight: 1.3, textAlign: 'center' }}>
            {collapsed ? '有道' : '网易有道 X 增长部门管理系统'}
          </h3>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* 数据录入按钮 - 头像前面 */}
            {isAdmin && (
              <Tooltip title="数据录入">
                <Button
                  type={location.pathname === '/data-entry' ? 'primary' : 'default'}
                  icon={<FormOutlined />}
                  onClick={() => navigate('/data-entry')}
                >
                  数据录入
                </Button>
              </Tooltip>
            )}
            <Dropdown menu={{ items: userMenuItems, onClick: handleMenuClick }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.name}</span>
                <Badge status={user?.role === 'admin' ? 'error' : 'processing'} />
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default AppLayout;
