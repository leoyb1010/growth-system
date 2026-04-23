import React, { useEffect } from 'react';
import { Badge, Button, Tooltip } from 'antd';
import { RobotOutlined } from '@ant-design/icons';

/**
 * AI 悬浮按钮 - 固定右下角
 */
export default function AIFloatingButton({ badgeData = {}, onClick }) {
  const { totalBadge = 0 } = badgeData;

  return (
    <Tooltip title="AI 助手" placement="left">
      <div
        onClick={onClick}
        style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          zIndex: 1000,
          cursor: 'pointer',
        }}
      >
        <Badge count={totalBadge} overflowCount={99} offset={[-4, 4]}>
          <div style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1890ff 0%, #096dd9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(24,144,255,0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(24,144,255,0.6)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(24,144,255,0.4)'; }}
          >
            <RobotOutlined style={{ fontSize: 24, color: '#fff' }} />
          </div>
        </Badge>
      </div>
    </Tooltip>
  );
}
