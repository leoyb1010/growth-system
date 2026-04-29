import React from 'react';
import { Badge, Tooltip } from 'antd';
import { RobotOutlined } from '@ant-design/icons';

/**
 * AI 悬浮按钮 - 固定右下角
 * V7: 更大、更醒目、品牌色脉冲+文字标签
 */
export default function AIFloatingButton({ badgeData = {}, onClick }) {
  const { totalBadge = 0 } = badgeData;

  return (
    <Tooltip title="AI 业务副驾驶" placement="left">
      <div
        onClick={onClick}
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 'var(--z-ai-fab, 1090)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 0,
        }}
      >
        <Badge count={totalBadge} overflowCount={99} offset={[-2, 2]}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #3B5AFB 0%, #2B4AE0 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(59, 90, 251, 0.35)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            position: 'relative',
          }}
          className="ai-fab-btn"
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(59, 90, 251, 0.5)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(59, 90, 251, 0.35)';
          }}
          >
            <RobotOutlined style={{ fontSize: 24, color: '#fff' }} />
          </div>
        </Badge>
      </div>

      {/* 脉冲动画 — 仅在有 badge 时显示 */}
      <style>{`
        .ai-fab-btn::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 18px;
          border: 2px solid rgba(59, 90, 251, 0.3);
          animation: aiFabPulse ${totalBadge > 0 ? '2s' : '0s'} ease-in-out infinite;
        }
        @keyframes aiFabPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0; }
        }
      `}</style>
    </Tooltip>
  );
}
