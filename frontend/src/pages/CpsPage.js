import React from 'react';
import { Tabs } from 'antd';
import { BarChartOutlined, AlertOutlined, SettingOutlined, EditOutlined, TableOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import { can } from '../permissions/ability';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import CpsDashboardTab from '../components/cps/CpsDashboardTab';
import CpsMetricsTab from '../components/cps/CpsMetricsTab';
import CpsAlertsTab from '../components/cps/CpsAlertsTab';
import CpsAdminTab from '../components/cps/CpsAdminTab';
import CpsChannelEntryTab from '../components/cps/CpsChannelEntryTab';

function CpsPage() {
  const { user } = useAuth();
  const role = user?.role || 'dept_staff';
  const channelId = user?.cps_channel_id;
  const isChannelUser = role === 'cps_channel_user';

  // 渠道账号：极简视图——只看自己的明细 + 录入
  if (isChannelUser) {
    const channelTabs = [
      { key: 'entry', label: <span><EditOutlined /> 日报录入</span>, children: <CpsChannelEntryTab /> },
      { key: 'metrics', label: <span><TableOutlined /> 我的数据</span>, children: <CpsMetricsTab channelId={channelId} /> },
    ];
    return (
      <div>
        <PageHeader title="连包投流" subtitle="渠道日报数据录入" />
        <PanelCard><Tabs defaultActiveKey="entry" items={channelTabs} /></PanelCard>
      </div>
    );
  }

  // 管理员/运营：完整视图
  const tabItems = [
    { key: 'dashboard', label: <span><BarChartOutlined /> 看板</span>, children: <CpsDashboardTab channelId={channelId} /> },
    { key: 'metrics', label: '明细数据', children: <CpsMetricsTab channelId={channelId} /> },
    { key: 'alerts', label: <span><AlertOutlined /> 预警</span>, children: <CpsAlertsTab /> },
  ];
  if (can(role, 'cps.admin')) {
    tabItems.push({ key: 'admin', label: <span><SettingOutlined /> 字典管理</span>, children: <CpsAdminTab /> });
  }

  return (
    <div>
      <PageHeader title="连包投流" subtitle="CPS 渠道签约数据看板、明细、预警与字典管理" />
      <PanelCard><Tabs defaultActiveKey="dashboard" items={tabItems} /></PanelCard>
    </div>
  );
}

export default CpsPage;
