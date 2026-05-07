import React from 'react';
import { InputNumber } from 'antd';

export default function PercentInput({ value, onChange, ...rest }) {
  return (
    <InputNumber
      {...rest}
      value={value === undefined || value === null || value === '' ? undefined : Number(value) * 100}
      onChange={(v) => {
        if (v === undefined || v === null || v === '') return onChange?.(undefined);
        onChange?.(Number(v) / 100);
      }}
      formatter={(v) => (v === undefined || v === null || v === '' ? '' : `${v}%`)}
      parser={(v) => String(v || '').replace('%', '').trim()}
      min={0}
      max={100}
      step={0.1}
      precision={2}
      style={{ width: '100%', ...(rest.style || {}) }}
    />
  );
}
