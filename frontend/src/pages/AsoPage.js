import React from 'react';
import { Tabs } from 'antd';
import { BarChartOutlined, TableOutlined, UploadOutlined, SettingOutlined, FileSearchOutlined, FormOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import { can } from '../permissions/ability';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import AsoDashboardTab from '../components/aso/AsoDashboardTab';
import AsoKeywordsTab from '../components/aso/AsoKeywordsTab';
import AsoCampaignsTab from '../components/aso/AsoCampaignsTab';
import AsoDailyImportTab from '../components/aso/AsoDailyImportTab';
import AsoMetadataTab from '../components/aso/AsoMetadataTab';
import AsoAdminTab from '../components/aso/AsoAdminTab';

function AsoPage() {
  const { user } = useAuth();
  const role = user?.role || 'dept_staff';
  const asoRole = user?.aso_role;

  const tabItems = [
    { key: 'dashboard', label: <span><BarChartOutlined /> 看板</span>, children: <AsoDashboardTab /> },
    { key: 'keywords', label: <span><TableOutlined /> 关键词明细</span>, children: <AsoKeywordsTab /> },
    { key: 'campaigns', label: <span><FileSearchOutlined /> 投放计划</span>, children: <AsoCampaignsTab /> },
    { key: 'daily', label: <span><UploadOutlined /> 日报导入</span>, children: <AsoDailyImportTab /> },
    { key: 'coverage', label: <span><FormOutlined /> 关键词覆盖</span>, children: <AsoMetadataTab /> },
  ];

  if (can(role, 'aso.admin', null, asoRole)) {
    tabItems.push({ key: 'admin', label: <span><SettingOutlined /> 字典管理</span>, children: <AsoAdminTab /> });
  }

  return (
    <div>
      <PageHeader title="ASO 优化管理" subtitle="苹果商店关键词优化、排名追踪、量级计划、日报复盘与关键词覆盖管理" />
      <PanelCard><Tabs defaultActiveKey="dashboard" items={tabItems} /></PanelCard>
    </div>
  );
}

export default AsoPage;
