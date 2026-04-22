import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Avatar, Dropdown, Badge, Tooltip, Drawer, Grid } from 'antd';
import {
  DashboardOutlined,
  BarChartOutlined,
  ProjectOutlined,
  CalendarOutlined,
  StarOutlined,
  TeamOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HistoryOutlined,
  FormOutlined,
  FileTextOutlined,
  ContainerOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  ContainerOutlined as ArchiveOutlined,
} from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.md;          // < 768px 视为移动端
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // 侧边栏菜单 — 结构收敛型：今日更新从驾驶舱弹出，不走独立菜单
  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '总览' },
    { key: '/week', icon: <CalendarOutlined />, label: '本周管理' },
    { key: '/projects', icon: <ProjectOutlined />, label: '项目推进' },
    { key: '/kpis', icon: <BarChartOutlined />, label: '指标与目标' },
    { key: '/monthly-tasks', icon: <FormOutlined />, label: '月度任务' },
    { key: '/achievements', icon: <StarOutlined />, label: '季度成果' },
    { key: '/weekly-reports', icon: <FileTextOutlined />, label: '周报与复盘' },
    ...(isAdmin ? [
      { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
    ] : [])
  ];

  // 数据录入快捷下拉项 — 合并月度重点、季度成果
  const dataEntryItems = [
    { key: '/projects?entry=new', label: '录入项目', icon: <ProjectOutlined /> },
    { key: '/kpis?entry=new', label: '录入指标', icon: <BarChartOutlined /> },
    { key: '/monthly-tasks?entry=new', label: '录入月度重点', icon: <FormOutlined /> },
    { key: '/achievements?entry=new', label: '录入季度成果', icon: <StarOutlined /> },
  ];

  // 头像下拉菜单 — 只保留低频管理操作
  const userMenuItems = [
    { key: 'profile', label: user?.name || '用户', icon: <UserOutlined />, disabled: true },
    { type: 'divider' },
    ...(isAdmin ? [
      { key: '/audit-logs', label: '审计日志', icon: <HistoryOutlined /> },
      { key: '/archives', label: '归档管理', icon: <ArchiveOutlined /> },
    ] : []),
    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true }
  ];

  const handleMenuClick = ({ key }) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
    } else if (key.startsWith('/')) {
      const [path, search] = key.split('?');
      navigate(path + (search ? `?${search}` : ''));
    }
    // 移动端关闭 Drawer
    if (isMobile) setMobileMenuOpen(false);
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ===== 桌面端侧边栏 ===== */}
      {!isMobile && (
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
      )}

      {/* ===== 移动端 Drawer 菜单 ===== */}
      {isMobile && (
        <Drawer
          title="网易有道 X 增长部门"
          placement="left"
          onClose={() => setMobileMenuOpen(false)}
          open={mobileMenuOpen}
          width={220}
          bodyStyle={{ padding: 0 }}
        >
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => handleMenuClick({ key })}
            style={{ borderRight: 0 }}
          />
        </Drawer>
      )}

      <Layout>
        <Header style={{
          background: '#fff',
          padding: isMobile ? '0 12px' : '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 移动端汉堡菜单 */}
            {isMobile && (
              <Button
                type="text"
                icon={<MenuUnfoldOutlined />}
                onClick={() => setMobileMenuOpen(true)}
              />
            )}
            {/* 桌面端折叠按钮 */}
            {!isMobile && (
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
              />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12 }}>
            {/* 数据录入入口 */}
            {isAdmin && (
              <Dropdown menu={{ items: dataEntryItems, onClick: handleMenuClick }} placement="bottomRight">
                <Button type="primary" icon={<FormOutlined />} style={{ fontWeight: 600, fontSize: isMobile ? 12 : 14, padding: isMobile ? '0 8px' : undefined }}>
                  {isMobile ? '录入' : '数据录入'}
                </Button>
              </Dropdown>
            )}
            <Dropdown menu={{ items: userMenuItems, onClick: handleMenuClick }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8 }}>
                <Avatar icon={<UserOutlined />} size={isMobile ? 'small' : 'default'} />
                {!isMobile && <span>{user?.name}</span>}
                <Badge status={user?.role === 'admin' ? 'error' : 'processing'} />
              </div>
            </Dropdown>
          </div>
        </Header>

        <Content style={{
          margin: isMobile ? 8 : 24,
          padding: isMobile ? 12 : 24,
          background: '#fff',
          borderRadius: 8,
          minHeight: 280
        }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default AppLayout;
