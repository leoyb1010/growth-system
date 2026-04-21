import React from 'react';
import { Space } from 'antd';

const PageHeader = ({ title, subtitle, extra }) => {
  return (
    <div className="page-header-block">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle ? <div className="page-subtitle">{subtitle}</div> : null}
        </div>
        {extra ? <Space wrap>{extra}</Space> : null}
      </div>
    </div>
  );
};

export default PageHeader;
