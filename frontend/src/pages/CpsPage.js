import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Tabs, Button, message, Space, Statistic } from 'antd';
import { DollarOutlined, BarChartOutlined, AlertOutlined, SettingOutlined } from '@ant-design/icons';
import { cpsApi } from '../services/cpsService';
import { useAuth } from '../hooks/useAuth';
import { can } from '../permissions/ability';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import CpsDashboardTab from '../components/cps/CpsDashboardTab';
import CpsMetricsTab from '../components/cps/CpsMetricsTab';
import CpsAlertsTab from '../components/cps/CpsAlertsTab';
import CpsAdminTab from '../components/cps/CpsAdminTab';

function CpsPage() {
  const { user } = useAuth();
  const role = user?.role || 'dept_staff';

  const tabItems = [
    { key: 'dashboard', label: <span><BarChartOutlined /> 看板</span>, children: <CpsDashboardTab /> },
    { key: 'metrics', label: '明细数据', children: <CpsMetricsTab /> },
    { key: 'alerts', label: <span><AlertOutlined /> 预警</span>, children: <CpsAlertsTab /> },
  ];

  if (can(role, 'cps.admin')) {
    tabItems.push({ key: 'admin', label: <span><SettingOutlined /> 字典管理</span>, children: <CpsAdminTab /> });
  }

  return (
    <div>
      <PageHeader title="连包投流" subtitle="CPS 渠道签约数据看板、明细、预警与字典管理" />
      <PanelCard>
        <Tabs defaultActiveKey="dashboard" items={tabItems} />
      </PanelCard>
    </div>
  );
}

export default CpsPage;
