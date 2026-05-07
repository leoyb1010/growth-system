import React from 'react';
import { InputNumber } from 'antd';

export default function MoneyInput(props) {
  return (
    <InputNumber
      {...props}
      min={props.min ?? 0}
      step={props.step ?? 0.01}
      precision={2}
      formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
      parser={(v) => String(v || '').replace(/,/g, '')}
      style={{ width: '100%', ...(props.style || {}) }}
    />
  );
}
