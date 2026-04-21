import React from 'react';
import { Card } from 'antd';

const PanelCard = ({ title, extra, children, bodyStyle, ...rest }) => {
  return (
    <Card
      className="surface-card"
      title={title}
      extra={extra}
      bodyStyle={{
        padding: 20,
        ...bodyStyle,
      }}
      {...rest}
    >
      {children}
    </Card>
  );
};

export default PanelCard;
