import React, { useEffect, useState } from 'react';
import { Tabs } from 'antd';
import MonthlyTaskPage from './MonthlyTaskPage';
import AchievementPage from './AchievementPage';
import PageHeader from '../components/ui/PageHeader';

/**
 * 沉淀页 — 月度工作 + 季度成果合并入口
 * 两个子页面保留完整功能，通过 Tab 切换
 */
function SettlementPage() {
  return (
    <div className="app-page">
      <PageHeader
        title="沉淀"
        subtitle="月度复盘与季度成果沉淀"
      />
      <Tabs
        defaultActiveKey="monthly"
        items={[
          {
            key: 'monthly',
            label: '📅 月度工作',
            children: <MonthlyTaskPage />,
          },
          {
            key: 'achievement',
            label: '🏆 季度成果',
            children: <AchievementPage />,
          },
        ]}
      />
    </div>
  );
}

export default SettlementPage;
