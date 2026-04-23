import React from 'react';
import { Button, Space } from 'antd';
import {
  AlertOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

const ICON_MAP = {
  view_risk: <AlertOutlined />,
  view_closure: <CheckCircleOutlined />,
  generate_brief: <FileTextOutlined />,
  view_stale: <ThunderboltOutlined />,
  view_behind: <BarChartOutlined />,
  view_owner_load: <TeamOutlined />,
  view_high_risk: <AlertOutlined />,
  view_stale_3d: <ThunderboltOutlined />,
  generate_agenda: <FileTextOutlined />,
  prepare_meeting: <FileTextOutlined />,
  fill_gaps: <CheckCircleOutlined />,
  push_stale: <ThunderboltOutlined />,
  copy_brief: <FileTextOutlined />,
  generate_report: <FileTextOutlined />,
};

/**
 * AI 快捷动作列表
 */
export default function AIActionList({ actions = [], onAction }) {
  if (!actions.length) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 4px' }}>
      {actions.map((action, i) => (
        <Button
          key={action.key || i}
          size="small"
          icon={ICON_MAP[action.key]}
          onClick={() => onAction?.(action)}
          style={{ fontSize: 12, borderRadius: 6 }}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
