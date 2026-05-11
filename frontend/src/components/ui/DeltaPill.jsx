import React from 'react';
import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';

function formatValue(value, suffix) {
  const n = Math.abs(Number(value || 0));
  const formatted = Number.isInteger(n) ? String(n) : n.toFixed(n >= 10 ? 1 : 2);
  return `${formatted}${suffix || ''}`;
}

export default function DeltaPill({ value, inverse = false, suffix = '', size = 'md' }) {
  const n = Number(value || 0);
  const isSmall = size === 'sm';
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: isSmall ? '1px 6px' : '2px 8px',
    borderRadius: 999,
    fontSize: isSmall ? 11 : 12,
    fontWeight: 600,
    lineHeight: isSmall ? '18px' : '20px',
    whiteSpace: 'nowrap',
  };

  if (!n) {
    return (
      <span style={{ ...baseStyle, background: 'var(--bg-subtle)', color: 'var(--text-3)' }}>
        <MinusOutlined style={{ fontSize: isSmall ? 9 : 10 }} /> 持平
      </span>
    );
  }

  const positive = inverse ? n < 0 : n > 0;
  const color = positive ? 'var(--color-success)' : 'var(--color-error)';
  const bg = positive ? 'var(--color-success-light)' : 'var(--color-error-light)';
  const Icon = positive ? ArrowUpOutlined : ArrowDownOutlined;

  return (
    <span style={{ ...baseStyle, background: bg, color }}>
      <Icon style={{ fontSize: isSmall ? 9 : 10 }} />
      {formatValue(n, suffix)}
    </span>
  );
}
