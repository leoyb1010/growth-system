import React from 'react';
import { Tag, Button, Space } from 'antd';

const TYPE_STYLE_MAP = {
  danger: { bg: '#fff1f0', border: '#ffa39e', tag: 'error' },
  warning: { bg: '#fff7e6', border: '#ffd591', tag: 'warning' },
  info: { bg: '#e6f7ff', border: '#91d5ff', tag: 'processing' },
  success: { bg: '#f6ffed', border: '#b7eb8f', tag: 'success' },
  action: { bg: '#e6f7ff', border: '#91d5ff', tag: 'blue' },
};

/**
 * AI 洞察卡片
 */
export default function AIInsightCard({ card, onAction }) {
  const style = TYPE_STYLE_MAP[card.type] || TYPE_STYLE_MAP.info;

  return (
    <div style={{
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        {card.icon && <span style={{ fontSize: 16 }}>{card.icon}</span>}
        <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{card.title}</span>
        {card.tags?.map((tag, i) => (
          <Tag key={i} color={style.tag} style={{ fontSize: 11, margin: 0 }}>{tag}</Tag>
        ))}
      </div>
      {card.description && (
        <div style={{ color: '#595959', fontSize: 13, lineHeight: 1.6, marginBottom: card.actions?.length ? 8 : 0 }}>
          {card.description}
        </div>
      )}
      {card.actions?.length > 0 && (
        <Space size={4} style={{ marginTop: 4 }}>
          {card.actions.map((action, i) => (
            <Button
              key={i}
              size="small"
              type={action.type === 'primary' ? 'primary' : 'default'}
              onClick={() => onAction?.(action)}
              style={{ fontSize: 12 }}
            >
              {action.label}
            </Button>
          ))}
        </Space>
      )}
    </div>
  );
}
