import React from 'react';
import { Spin, Empty, Button, Result } from 'antd';

/**
 * 统一异步状态组件
 * 处理 loading / error / empty / data 四种状态
 *
 * @param {Object} props
 * @param {boolean} props.loading - 是否加载中
 * @param {string|Error|null} props.error - 错误信息
 * @param {boolean} props.empty - 数据是否为空
 * @param {ReactNode} props.children - 正常内容
 * @param {string} props.emptyText - 空状态文案
 * @param {Function} props.onRetry - 重试回调
 * @param {ReactNode} props.emptyExtra - 空状态额外操作
 */
function AsyncState({
  loading = false,
  error = null,
  empty = false,
  children,
  emptyText = '暂无数据',
  onRetry,
  emptyExtra,
}) {
  // 1. 加载状态
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200, padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  // 2. 错误状态
  if (error) {
    const errMsg = typeof error === 'string' ? error : error?.message || '加载失败';
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={errMsg}
        extra={onRetry ? [
          <Button key="retry" type="primary" onClick={onRetry}>重试</Button>,
        ] : undefined}
        style={{ padding: '48px 24px' }}
      />
    );
  }

  // 3. 空状态
  if (empty) {
    return (
      <Empty
        description={emptyText}
        style={{ padding: '48px 0' }}
      >
        {emptyExtra}
      </Empty>
    );
  }

  // 4. 正常内容
  return children;
}

export default AsyncState;
