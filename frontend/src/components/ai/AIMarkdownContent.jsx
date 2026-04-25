import React from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * AI 输出 Markdown 渲染组件
 * 统一处理 LLM 返回的 Markdown 内容，替换原有 white-space:pre-wrap 纯文本
 */
const markdownStyles = {
  fontSize: 13,
  lineHeight: 1.7,
  color: '#595959',
  wordBreak: 'break-word',
};

/**
 * 自定义 Markdown 渲染器（覆盖默认标签样式）
 */
const components = {
  // 段落
  p: ({ children }) => (
    <p style={{ margin: '4px 0', lineHeight: 1.7 }}>{children}</p>
  ),
  // 粗体
  strong: ({ children }) => (
    <strong style={{ color: '#262626', fontWeight: 600 }}>{children}</strong>
  ),
  // 列表
  ul: ({ children }) => (
    <ul style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ margin: '4px 0', paddingLeft: 18 }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ margin: '2px 0', lineHeight: 1.6 }}>{children}</li>
  ),
  // 标题（AI 输出中不常用但需兜底）
  h1: ({ children }) => (
    <h1 style={{ fontSize: 16, fontWeight: 700, margin: '8px 0 4px', color: '#262626' }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: 15, fontWeight: 600, margin: '8px 0 4px', color: '#262626' }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 14, fontWeight: 600, margin: '6px 0 4px', color: '#262626' }}>{children}</h3>
  ),
  // 行内代码
  code: ({ inline, children, className }) => {
    if (inline) {
      return (
        <code style={{
          background: '#f5f5f5',
          padding: '1px 4px',
          borderRadius: 3,
          fontSize: 12,
          color: '#d4380d',
        }}>{children}</code>
      );
    }
    // 代码块
    return (
      <pre style={{
        background: '#f5f5f5',
        padding: '8px 10px',
        borderRadius: 6,
        fontSize: 12,
        overflowX: 'auto',
        margin: '6px 0',
      }}>
        <code>{children}</code>
      </pre>
    );
  },
  // 分割线
  hr: () => (
    <hr style={{ border: 'none', borderTop: '1px solid #e8e8e8', margin: '8px 0' }} />
  ),
  // 引用
  blockquote: ({ children }) => (
    <blockquote style={{
      borderLeft: '3px solid #1890ff',
      margin: '6px 0',
      padding: '2px 10px',
      color: '#8c8c8c',
      background: '#f0f5ff',
      borderRadius: '0 4px 4px 0',
    }}>{children}</blockquote>
  ),
};

/**
 * AIMarkdownContent
 * @param {string} content - Markdown 文本
 * @param {object} style - 额外样式覆盖
 * @param {boolean} compact - 紧凑模式（用于聊天气泡）
 */
export default function AIMarkdownContent({ content, style = {}, compact = false }) {
  if (!content) return null;

  // 纯文本检测：如果没有 Markdown 语法标记，直接渲染
  const hasMarkdown = /[*#`>\-\[\]|]{2,}|```|\n{2,}/.test(content);

  if (!hasMarkdown) {
    return (
      <div style={{
        ...markdownStyles,
        whiteSpace: 'pre-wrap',
        ...(compact ? { fontSize: 13, lineHeight: 1.6 } : {}),
        ...style,
      }}>
        {content}
      </div>
    );
  }

  return (
    <div style={{
      ...markdownStyles,
      ...(compact ? { fontSize: 13, lineHeight: 1.6 } : {}),
      ...style,
    }}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  );
}
