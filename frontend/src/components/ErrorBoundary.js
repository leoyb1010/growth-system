import React from 'react';
import { Result, Button } from 'antd';

/**
 * 全局错误边界
 * 捕获子组件树中的 JavaScript 错误，防止整个应用白屏
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] 捕获到未处理错误:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    // 如果提供了 onReset 回调，调用它
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // 自定义降级 UI
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReload);
      }

      return (
        <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center' }}>
          <Result
            status="error"
            title="页面出了点问题"
            subTitle="抱歉，页面遇到了一个错误。你可以尝试恢复或刷新页面。"
            extra={[
              <Button key="recover" type="primary" onClick={this.handleReload}>
                恢复页面
              </Button>,
              <Button key="refresh" onClick={this.handleRefresh}>
                刷新
              </Button>,
            ]}
          >
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto' }}>
                <details style={{ whiteSpace: 'pre-wrap' }}>
                  <summary style={{ cursor: 'pointer', color: '#999' }}>
                    错误详情（仅开发环境可见）
                  </summary>
                  <p style={{ color: '#ff4d4f', fontSize: 12 }}>
                    {this.state.error.toString()}
                  </p>
                  <p style={{ color: '#999', fontSize: 11 }}>
                    {this.state.errorInfo?.componentStack}
                  </p>
                </details>
              </div>
            )}
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
