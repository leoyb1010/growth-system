import React, { useEffect, useState, useCallback } from 'react';
import { Drawer, Typography, Divider, Tag, Button, Space, message } from 'antd';
import { CloseOutlined, ReloadOutlined, CopyOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import AITabHeader from './AITabHeader';
import AIInsightCard from './AIInsightCard';
import AIActionList from './AIActionList';
import AIChatInput from './AIChatInput';
import AIEmptyState from './AIEmptyState';
import useAIContext from '../../hooks/useAIContext';

const { Text, Paragraph } = Typography;

/**
 * AI 助手侧边栏
 */
export default function AIAssistantDrawer({
  open,
  onClose,
  activeMode,
  loading,
  data,
  chatHistory,
  onModeChange,
  onAction,
  onChat,
  onLoadPanel,
}) {
  const { currentPage, currentObject } = useAIContext();
  const [chatInput, setChatInput] = useState('');
  const [rawExpanded, setRawExpanded] = useState(false);

  // 打开时自动加载（仅非 free_ask 模式）
  useEffect(() => {
    if (open && !data && activeMode !== 'free_ask') {
      onLoadPanel?.(activeMode, currentPage, currentObject);
    }
  }, [open]);

  // 模式切换时加载
  const handleModeChange = useCallback((mode) => {
    onModeChange?.(mode);
    if (mode !== 'free_ask') {
      onLoadPanel?.(mode, currentPage, currentObject);
    }
  }, [currentPage, currentObject, onLoadPanel, onModeChange]);

  // 快捷动作
  const handleAction = useCallback((action) => {
    if (action.mode && action.mode !== activeMode) {
      onModeChange?.(action.mode);
    }
    onAction?.(action.key, currentPage, currentObject);
  }, [activeMode, currentPage, currentObject, onAction, onModeChange]);

  // 自由问答
  const handleChat = useCallback((query) => {
    onChat?.(query, currentPage, currentObject);
  }, [currentPage, currentObject, onChat]);

  // 复制内容
  const handleCopy = useCallback((text) => {
    navigator.clipboard?.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    }).catch(() => {
      message.error('复制失败');
    });
  }, []);

  // 刷新
  const handleRefresh = useCallback(() => {
    if (activeMode === 'free_ask') return;
    onLoadPanel?.(activeMode, currentPage, currentObject);
  }, [activeMode, currentPage, currentObject, onLoadPanel]);

  return (
    <Drawer
      title={null}
      placement="right"
      onClose={onClose}
      open={open}
      width={420}
      closable={false}
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
        header: { display: 'none' }
      }}
    >
      {/* 自定义 Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0',
        background: 'linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>🤖</span>
            <Text strong style={{ fontSize: 16 }}>AI 业务副驾驶</Text>
          </div>
          <Space size={4}>
            <Button type="text" size="small" icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading} />
            <Button type="text" size="small" icon={<CloseOutlined />} onClick={onClose} />
          </Space>
        </div>

        {/* headline */}
        {data?.headline && (
          <div style={{
            background: '#fff',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 13,
            color: '#262626',
            border: '1px solid #e6f7ff',
          }}>
            {data.headline}
            {data.isMock && <Tag color="default" style={{ marginLeft: 8, fontSize: 10 }}>规则分析</Tag>}
          </div>
        )}
      </div>

      {/* Tab 切换 */}
      <div style={{ borderBottom: '1px solid #f0f0f0' }}>
        <AITabHeader activeMode={activeMode} onModeChange={handleModeChange} />
      </div>

      {/* 内容区 */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
        {loading && !data && <AIEmptyState type="loading" />}

        {activeMode !== 'free_ask' && data && (
          <>
            {/* 结构化卡片模式 */}
            {data.cards?.length > 0 && data.cards.map((card, i) => (
              <AIInsightCard key={card.id || i} card={card} onAction={handleAction} />
            ))}

            {/* 简报/议程模式 */}
            {(data.sections?.length > 0 || data.content) && !data.cards?.length && (
              <div>
                {data.title && (
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, color: '#262626' }}>
                    {data.title}
                  </div>
                )}
                {data.sections?.map((section, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1890ff', marginBottom: 4 }}>
                      {section.title}
                    </div>
                    <div style={{
                      background: '#fafafa',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 13,
                      lineHeight: 1.7,
                      color: '#595959',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {section.content}
                    </div>
                  </div>
                ))}
                {data.content && !data.sections?.length && (
                  <div style={{
                    background: '#fafafa',
                    borderRadius: 6,
                    padding: '10px 12px',
                    fontSize: 13,
                    lineHeight: 1.7,
                    color: '#595959',
                    whiteSpace: 'pre-wrap',
                    position: 'relative',
                  }}>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => handleCopy(data.content)}
                      style={{ position: 'absolute', top: 4, right: 4, fontSize: 12 }}
                    />
                    {data.content}
                  </div>
                )}
              </div>
            )}

            {/* 快捷动作 */}
            {data.actions?.length > 0 && (
              <>
                <Divider style={{ margin: '8px 0', fontSize: 12, color: '#8c8c8c' }}>快捷动作</Divider>
                <AIActionList actions={data.actions} onAction={handleAction} />
              </>
            )}

            {/* 原始分析（折叠展示） */}
            {data.rawAnalysis && (
              <>
                <Divider style={{ margin: '8px 0', fontSize: 12, color: '#8c8c8c' }}>
                  <span
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setRawExpanded(!rawExpanded)}
                  >
                    {rawExpanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
                    {' '}AI 深度分析
                  </span>
                </Divider>
                {rawExpanded && (
                  <div style={{
                    background: '#fafafa',
                    borderRadius: 6,
                    padding: '10px 12px',
                    fontSize: 12,
                    lineHeight: 1.7,
                    color: '#8c8c8c',
                    whiteSpace: 'pre-wrap',
                    position: 'relative',
                  }}>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => handleCopy(data.rawAnalysis)}
                      style={{ position: 'absolute', top: 4, right: 4, fontSize: 11 }}
                    />
                    {data.rawAnalysis}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* 自由问答模式 */}
        {activeMode === 'free_ask' && (
          <div>
            {chatHistory.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#8c8c8c' }}>
                <span style={{ fontSize: 32 }}>💬</span>
                <div style={{ marginTop: 8, fontSize: 13 }}>输入问题，AI 会基于当前页面数据回答</div>
              </div>
            )}
            {chatHistory.map((msg, i) => (
              <div key={i} style={{
                marginBottom: 10,
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  background: msg.role === 'user' ? '#1890ff' : msg.isError ? '#fff1f0' : '#f0f5ff',
                  color: msg.role === 'user' ? '#fff' : '#262626',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}>
                  {msg.content}
                  {msg.isMock && <Tag color="default" style={{ marginLeft: 4, fontSize: 10 }}>规则</Tag>}
                  {msg.suggestedFollowUps && (
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {msg.suggestedFollowUps.map((q, j) => (
                        <Tag key={j} color="blue" style={{ cursor: 'pointer', fontSize: 11 }} onClick={() => handleChat(q)}>
                          {q}
                        </Tag>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && chatHistory.length > 0 && (
              <div style={{ textAlign: 'center', padding: 8, color: '#8c8c8c', fontSize: 12 }}>
                AI 正在思考...
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部输入框（自由问答模式） */}
      {activeMode === 'free_ask' && (
        <AIChatInput
          onSend={handleChat}
          loading={loading}
          suggestedFollowUps={
            chatHistory.length === 0
              ? (data?.actions?.map(a => a.label) || ['当前有哪些风险项目？', '本周指标达成情况如何？', '下周应该优先做什么？'])
              : (chatHistory[chatHistory.length - 1]?.suggestedFollowUps || [])
          }
        />
      )}
    </Drawer>
  );
}
