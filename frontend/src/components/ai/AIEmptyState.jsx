import React from 'react';
import { Empty, Spin, Button, Alert } from 'antd';
import { RobotOutlined } from '@ant-design/icons';

/**
 * AI 空状态 / Loading / Error
 */
export default function AIEmptyState({ type = 'empty', onRetry }) {
  if (type === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin size="large" />
        <div style={{ marginTop: 12, color: '#8c8c8c', fontSize: 13 }}>AI 正在分析数据...</div>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <Alert
          type="error"
          message="分析失败"
          description="AI 分析过程中出现错误，请稍后重试"
          showIcon
          style={{ marginBottom: 12 }}
        />
        <Button size="small" onClick={onRetry}>重试</Button>
      </div>
    );
  }

  return (
    <div style={{ padding: '30px 0', textAlign: 'center' }}>
      <RobotOutlined style={{ fontSize: 40, color: '#bfbfbf' }} />
      <div style={{ marginTop: 12, color: '#8c8c8c', fontSize: 13 }}>
        选择一个模式开始分析
      </div>
    </div>
  );
}
