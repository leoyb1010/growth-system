import React, { useState } from 'react';
import { Tabs } from 'antd';
import { CalendarOutlined, FormOutlined, StarOutlined } from '@ant-design/icons';
import WeekPage from './WeekPage';
import MonthlyTaskPage from './MonthlyTaskPage';
import AchievementPage from './AchievementPage';

// 周｜月｜季度 三合一：月/季度使用频次低，并入本周下的子 tab（按需懒加载）
function WorkPage() {
  const [tab, setTab] = useState('week');
  return (
    <div className="app-page">
      <Tabs
        activeKey={tab}
        onChange={setTab}
        size="large"
        items={[
          { key: 'week', label: <span><CalendarOutlined /> 周</span>, children: <WeekPage /> },
          { key: 'month', label: <span><FormOutlined /> 月度</span>, children: <MonthlyTaskPage /> },
          { key: 'quarter', label: <span><StarOutlined /> 季度</span>, children: <AchievementPage /> },
        ]}
      />
    </div>
  );
}

export default WorkPage;
