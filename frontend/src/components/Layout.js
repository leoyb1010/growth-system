import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Avatar, Dropdown, Badge, Tooltip, Drawer, Grid, Input, Modal, List, Tag, Spin, Empty, Form, message } from 'antd';
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
  InboxOutlined,
  SearchOutlined,
  SettingOutlined,
  ImportOutlined,
  FileProtectOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import { api } from '../hooks/useAuth';
import { can, canSeeMenu } from '../permissions/ability';
import AIFloatingButton from './ai/AIFloatingButton';
import AIAssistantDrawer from './ai/AIAssistantDrawer';
import useAIAssistant from '../hooks/useAIAssistant';
import useAIContext from '../hooks/useAIContext';

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [changePwdForm] = Form.useForm();
  const searchInputRef = useRef(null);
  const screens = useBreakpoint();
  const isMobile = !screens.md;          // < 768px 视为移动端
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role || 'dept_staff';

  // ===== AI 助手 =====
  const aiAssistant = useAIAssistant();
  const aiContext = useAIContext();

  // 定期刷新角标
  useEffect(() => {
    aiAssistant.refreshBadge(aiContext.currentPage);
    const timer = setInterval(() => aiAssistant.refreshBadge(aiContext.currentPage), 60000);
    return () => clearInterval(timer);
  }, [aiContext.currentPage]);

  // 处理 AI 动作
  const handleAIAction = (actionKey, currentPage, currentObject) => {
    aiAssistant.runAction(actionKey, currentPage || aiContext.currentPage, currentObject || aiContext.currentObject);
  };

  // 暴露 AI 助手到 window，供页面内按钮调用
  useEffect(() => {
    window.__aiAssistant = {
      openDrawer: (mode) => {
        aiAssistant.openDrawer(mode);
        aiAssistant.loadPanel(mode || 'today_judgment', aiContext.currentPage, aiContext.currentObject);
      },
      runAction: handleAIAction,
      generateBriefing: aiAssistant.generateBriefing,
    };
    return () => { delete window.__aiAssistant; };
  }, [aiContext.currentPage, aiContext.currentObject]);

  // 全局搜索
  const handleSearch = async (value) => {
    setSearchQuery(value);
    if (!value || value.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await api.get('/search', { params: { q: value.trim() } });
      if (res.code === 0) setSearchResults(res.data);
    } catch (err) { /* 静默 */ }
    setSearchLoading(false);
  };

  const handleSelectResult = (item) => {
    setSearchVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    navigate(item.url);
  };

  useEffect(() => {
    if (searchVisible && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchVisible]);

  // ========== 主导航菜单（业务主线）==========
  const businessMenuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '总览' },
    { key: '/week', icon: <CalendarOutlined />, label: '本周' },
    { key: '/kpis', icon: <BarChartOutlined />, label: '指标与目标' },
    { key: '/projects', icon: <ProjectOutlined />, label: '项目推进' },
    { key: '/monthly-tasks', icon: <FormOutlined />, label: '月度任务' },
    { key: '/achievements', icon: <StarOutlined />, label: '季度成果' },
    { key: '/weekly-reports', icon: <FileTextOutlined />, label: '周报与复盘' },
  ].filter(item => canSeeMenu(role, item.key));

  // ========== 系统管理菜单（仅 super_admin）==========
  const systemMenuItems = can(role, 'user.read') ? [
    { type: 'divider' },
    { key: 'system-group', label: '系统管理', type: 'group', children: [
      { key: '/departments', icon: <BankOutlined />, label: '部门管理' },
      { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
      { key: '/audit-logs', icon: <HistoryOutlined />, label: '审计日志' },
      { key: '/archives', icon: <InboxOutlined />, label: '归档管理' },
    ]}
  ] : [];

  const menuItems = [...businessMenuItems, ...systemMenuItems];

  // 数据录入快捷下拉项 — department_manager 及以上可见
  const dataEntryItems = [
    { key: '/projects?entry=new', label: '录入项目', icon: <ProjectOutlined /> },
    { key: '/kpis?entry=new', label: '录入指标', icon: <BarChartOutlined /> },
    { key: '/monthly-tasks?entry=new', label: '录入月度重点', icon: <FormOutlined /> },
    { key: '/achievements?entry=new', label: '录入季度成果', icon: <StarOutlined /> },
  ];

  // 修改密码弹窗
  const [changePwdVisible, setChangePwdVisible] = useState(false);
  const [changePwdLoading, setChangePwdLoading] = useState(false);

  const handleChangePassword = async (values) => {
    setChangePwdLoading(true);
    try {
      const res = await api.post('/auth/change-password', {
        old_password: values.old_password,
        new_password: values.new_password,
      });
      if (res.code === 0) {
        message.success('密码修改成功，请重新登录');
        setChangePwdVisible(false);
        changePwdForm.resetFields();
        logout();
        navigate('/login');
      } else {
        message.error(res.message || '修改失败');
      }
    } catch (err) {
      message.error(err.message || '修改失败');
    } finally {
      setChangePwdLoading(false);
    }
  };

  // 头像下拉菜单
  const userMenuItems = [
    { key: 'profile', label: user?.name || '用户', icon: <UserOutlined />, disabled: true },
    { type: 'divider' },
    { key: 'change-password', label: '修改密码', icon: <SettingOutlined /> },
    { key: 'logout', label: '退出登录', icon: <LogoutOutlined />, danger: true }
  ];

  const handleMenuClick = ({ key }) => {
    if (key === 'logout') {
      logout();
      navigate('/login');
    } else if (key === 'change-password') {
      changePwdForm.resetFields();
      setChangePwdVisible(true);
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
            selectedKeys={[location.pathname === '/settlement' ? '/monthly-tasks' : location.pathname]}
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
            selectedKeys={[location.pathname === '/settlement' ? '/monthly-tasks' : location.pathname]}
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
            {/* 全局搜索入口 */}
            <Tooltip title="全局搜索">
              <Button
                type="text"
                icon={<SearchOutlined />}
                onClick={() => setSearchVisible(true)}
                style={{ fontSize: 16 }}
              />
            </Tooltip>

            {/* 录入指引 — department_manager 及以上可见 */}
            {can(role, 'project.create') && (
              <Dropdown menu={{ items: dataEntryItems, onClick: handleMenuClick }} placement="bottomRight">
                <Button type="primary" icon={<FormOutlined />} style={{ fontWeight: 600, fontSize: isMobile ? 12 : 14, padding: isMobile ? '0 8px' : undefined }}>
                  录入指引
                </Button>
              </Dropdown>
            )}
            <Dropdown menu={{ items: userMenuItems, onClick: handleMenuClick }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 8 }}>
                <Avatar icon={<UserOutlined />} size={isMobile ? 'small' : 'default'} />
                {!isMobile && <span>{user?.name}</span>}
                <Badge status={can(role, 'user.read') ? 'error' : 'processing'} />
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

      {/* ===== 全局搜索弹窗 ===== */}
      <Modal
        open={searchVisible}
        onCancel={() => { setSearchVisible(false); setSearchQuery(''); setSearchResults([]); }}
        footer={null}
        title="全局搜索"
        width={isMobile ? '90%' : 600}
        bodyStyle={{ padding: '12px 24px 24px' }}
      >
        <Input.Search
          ref={searchInputRef}
          placeholder="搜索项目、指标、月度工作、季度成果..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          allowClear
          enterButton
          loading={searchLoading}
          style={{ marginBottom: 16 }}
        />
        {searchLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : searchResults.length === 0 ? (
          searchQuery.trim().length > 0 ? (
            <Empty description="未找到相关结果" />
          ) : (
            <Empty description="输入关键词开始搜索" />
          )
        ) : (
          <List
            dataSource={searchResults}
            renderItem={(item) => (
              <List.Item
                onClick={() => handleSelectResult(item)}
                style={{ cursor: 'pointer', padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}
                className="search-result-item"
              >
                <List.Item.Meta
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{item.title}</span>
                      <Tag size="small" color={
                        item.type === 'project' ? 'blue' :
                        item.type === 'kpi' ? 'green' :
                        item.type === 'monthly_task' ? 'orange' : 'purple'
                      }>{item.typeLabel}</Tag>
                    </div>
                  }
                  description={
                    <div>
                      <div style={{ color: '#666', fontSize: 13 }}>{item.subtitle}</div>
                      <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>{item.meta}</div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>

      {/* ===== 修改密码弹窗 ===== */}
      <Modal
        title="修改密码"
        open={changePwdVisible}
        onCancel={() => setChangePwdVisible(false)}
        onOk={() => changePwdForm.submit()}
        confirmLoading={changePwdLoading}
        okText="确认修改"
      >
        <Form form={changePwdForm} onFinish={handleChangePassword} layout="vertical">
          <Form.Item name="old_password" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password placeholder="输入当前密码" />
          </Form.Item>
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6, message: '新密码不少于6位' }]}>
            <Input.Password placeholder="输入新密码（不少于6位）" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="确认新密码"
            rules={[
              { required: true, message: '请确认新密码' },
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

      {/* ===== AI 助手 ===== */}
      <AIFloatingButton
        badgeData={aiAssistant.badgeData}
        onClick={() => aiAssistant.openDrawer('today_judgment')}
      />
      <AIAssistantDrawer
        open={aiAssistant.open}
        onClose={aiAssistant.closeDrawer}
        activeMode={aiAssistant.activeMode}
        loading={aiAssistant.loading}
        data={aiAssistant.data}
        chatHistory={aiAssistant.chatHistory}
        onModeChange={(mode) => {
          aiAssistant.setActiveMode(mode);
          if (mode !== 'free_ask') {
            aiAssistant.loadPanel(mode, aiContext.currentPage, aiContext.currentObject);
          }
        }}
        onAction={handleAIAction}
        onChat={aiAssistant.sendChat}
        onLoadPanel={aiAssistant.loadPanel}
      />
    </Layout>
  );
}

export default AppLayout;
