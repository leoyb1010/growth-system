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
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReload);
      }

      const errMsg = this.state.error?.message || String(this.state.error);
      return (
        <div style={{ padding: '48px 24px', display: 'flex', justifyContent: 'center' }}>
          <Result
            status="error"
            title="页面出了点问题"
            subTitle="抱歉，页面遇到了一个错误。你可以尝试恢复或刷新页面。"
            extra={[
              <Button key="recover" type="primary" onClick={this.handleReload}>恢复页面</Button>,
              <Button key="refresh" onClick={this.handleRefresh}>刷新</Button>,
            ]}
          >
            <div style={{ textAlign: 'left', maxWidth: 600, margin: '0 auto', background: '#fef2f2', padding: 12, borderRadius: 8 }}>
              <div style={{ color: '#dc2626', fontSize: 13, fontWeight: 500 }}>{errMsg}</div>
              {this.state.errorInfo?.componentStack && (
                <pre style={{ color: '#666', fontSize: 11, whiteSpace: 'pre-wrap', marginTop: 4 }}>
                  {this.state.errorInfo.componentStack.slice(0, 500)}
                </pre>
              )}
            </div>
          </Result>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
