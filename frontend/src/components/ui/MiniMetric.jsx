import React from 'react';
import { Tag } from 'antd';
import DeltaPill from './DeltaPill';

export default function MiniMetric({ label, value, suffix, delta, deltaSuffix, color = 'var(--text-1)', alert = false }) {
  return (
    <div style={{
      minHeight: 72,
      padding: '10px 12px',
      borderRadius: 10,
      background: alert ? 'var(--color-error-light)' : 'var(--bg-muted)',
      border: `1px solid ${alert ? '#FECACA' : 'var(--border-soft)'}`,
    }}>
      <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4, whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: alert ? 'var(--color-error)' : color, lineHeight: 1.15 }}>
          {value}
        </span>
        {suffix ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{suffix}</span> : null}
      </div>
      <div style={{ marginTop: 6 }}>
        {alert ? <Tag color="error" style={{ margin: 0, fontSize: 11 }}>需关注</Tag> : delta !== undefined ? <DeltaPill value={delta} suffix={deltaSuffix} size="sm" /> : null}
      </div>
    </div>
  );
}
