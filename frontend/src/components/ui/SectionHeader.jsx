import React from 'react';

export default function SectionHeader({ icon, title, subtitle, extra, color = 'var(--text-1)' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color }}>
          {icon}
          <span>{title}</span>
        </div>
        {subtitle ? <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-3)' }}>{subtitle}</div> : null}
      </div>
      {extra ? <div style={{ flexShrink: 0 }}>{extra}</div> : null}
    </div>
  );
}
