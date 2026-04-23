import React, { useState } from 'react';
import { Input, Button, Space, Tag } from 'antd';
import { SendOutlined } from '@ant-design/icons';

/**
 * AI 聊天输入框
 */
export default function AIChatInput({ onSend, suggestedFollowUps = [], loading = false }) {
  const [input, setInput] = useState('');

  const handleSend = () => {
    const query = input.trim();
    if (!query) return;
    onSend(query);
    setInput('');
  };

  return (
    <div style={{ borderTop: '1px solid #f0f0f0', padding: '10px 12px', background: '#fafafa' }}>
      {/* 推荐追问 */}
      {suggestedFollowUps.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {suggestedFollowUps.map((q, i) => (
            <Tag
              key={i}
              style={{ cursor: 'pointer', fontSize: 12, marginBottom: 4 }}
              color="blue"
              onClick={() => onSend(q)}
            >
              {q}
            </Tag>
          ))}
        </div>
      )}
      {/* 输入框 */}
      <Input.Search
        value={input}
        onChange={e => setInput(e.target.value)}
        onSearch={handleSend}
        placeholder="问我任何关于业务数据的问题..."
        enterButton={<SendOutlined />}
        loading={loading}
        size="small"
        style={{ borderRadius: 6 }}
      />
    </div>
  );
}
