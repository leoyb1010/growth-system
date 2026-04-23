import React from 'react';
import { Tabs } from 'antd';

const MODES = [
  { key: 'free_ask', label: '💬 问我任何问题' },
  { key: 'today_judgment', label: '💡 今日判断' },
  { key: 'risk_closure', label: '⚠️ 风险与闭环' },
  { key: 'briefing_meeting', label: '📋 汇报与周会' },
];

/**
 * AI Tab 头部 - 四个模式切换
 */
export default function AITabHeader({ activeMode, onModeChange }) {
  return (
    <Tabs
      activeKey={activeMode}
      onChange={onModeChange}
      size="small"
      items={MODES.map(m => ({ key: m.key, label: m.label }))}
      style={{ marginBottom: 0 }}
      tabBarStyle={{ marginBottom: 0, paddingLeft: 4, paddingRight: 4 }}
    />
  );
}
