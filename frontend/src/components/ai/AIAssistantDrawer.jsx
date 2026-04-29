import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Drawer, Typography, Divider, Tag, Button, Space, message, Modal, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import { CloseOutlined, ReloadOutlined, CopyOutlined, DownOutlined, RightOutlined, ThunderboltOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ArrowRightOutlined, RobotOutlined } from '@ant-design/icons';
import AITabHeader from './AITabHeader';
import AIInsightCard from './AIInsightCard';
import AIActionList from './AIActionList';
import AIChatInput from './AIChatInput';
import AIEmptyState from './AIEmptyState';
import AIMarkdownContent from './AIMarkdownContent';
import useAIContext from '../../hooks/useAIContext';
import useAIStream from '../../hooks/useAIStream';
import { api } from '../../hooks/useAuth';

const { Text, Paragraph } = Typography;

/**
 * AI 可操作 Action 卡片
 * 每个可执行操作都有确认按钮 + 二次确认 Modal
 */
function AIActionCard({ action, onExecute }) {
  const [confirming, setConfirming] = useState(false);
  const [executing, setExecuting] = useState(false);

  const iconMap = {
    view_project: <ArrowRightOutlined />,
    navigate_to: <ArrowRightOutlined />,
    flag_risk: <ExclamationCircleOutlined style={{ color: '#DC2626' }} />,
    create_note: <ThunderboltOutlined />,
    set_reminder: <CheckCircleOutlined />,
    export_summary: <CopyOutlined />,
  };

  const handleExecute = () => {
    if (action.confirmRequired) {
      setConfirming(true);
    } else {
      doExecute();
    }
  };

  const doExecute = async () => {
    setConfirming(false);
    setExecuting(true);
    try {
      await onExecute(action);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        marginBottom: 6,
        background: '#F0F4FF',
        borderRadius: 8,
        border: '1px solid rgba(59, 90, 251, 0.1)',
      }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{iconMap[action.key] || '⚡'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{action.label}</div>
          {action.desc && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{action.desc}</div>}
        </div>
        <Button
          size="small"
          type="primary"
          ghost
          loading={executing}
          onClick={handleExecute}
          style={{ flexShrink: 0 }}
        >
          执行
        </Button>
      </div>
      <Modal
        title="确认操作"
        open={confirming}
        onOk={doExecute}
        onCancel={() => setConfirming(false)}
        okText="确认执行"
        cancelText="取消"
        okButtonProps={{ danger: action.key === 'flag_risk' }}
        width={400}
      >
        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
          {action.confirmMessage || `确认执行「${action.label}」？`}
        </div>
      </Modal>
    </>
  );
}

/**
 * AI 助手侧边栏
 * V7: 增强存在感 + 可操作输出 + 上下文感知
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
  const navigate = useNavigate();
  const [chatInput, setChatInput] = useState('');
  const [rawExpanded, setRawExpanded] = useState(false);
  const [actionResults, setActionResults] = useState([]);
  const { streamChat, content: streamContent, isStreaming, error: streamError } = useAIStream();
  const chatEndRef = useRef(null);

  // 流式完成后，把 SSE 内容推入 chatHistory
  useEffect(() => {
    if (!isStreaming && streamContent) {
      onChat?.(null, currentPage, currentObject, false, streamContent);
    }
  }, [isStreaming, streamContent]);

  // 自动滚动到底部
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, streamContent, isStreaming]);

  // 打开时自动加载
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

  // 可操作 Action 执行
  const handleActionExecute = useCallback(async (action) => {
    try {
      const res = await api.post('/ai/action', {
        actionKey: action.key,
        params: action.params || {},
      });
      if (res.code === 0) {
        const result = res.data;
        setActionResults(prev => [...prev, { action, result, time: new Date() }]);
        if (result.type === 'navigate') {
          message.success(`正在跳转: ${result.path}`);
          // 延迟跳转让用户看到反馈
          setTimeout(() => {
            window.location.hash = result.path;
          }, 500);
        } else {
          message.success(`操作「${action.label}」已执行`);
        }
      } else {
        message.error(res.message || '操作执行失败');
      }
    } catch (err) {
      message.error('操作执行失败，请稍后重试');
    }
  }, []);

  // 自由问答 — SSE 流式
  const handleChat = useCallback(async (query) => {
    if (isStreaming) return;
    onChat?.(query, currentPage, currentObject, true);
    await streamChat(query, currentPage);
  }, [currentPage, currentObject, isStreaming, streamChat, onChat]);

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

  // 页面名称映射
  const pageNameMap = {
    dashboard: '驾驶舱', week: '本周管理', kpis: '核心指标',
    projects: '项目推进', weekly_reports: '周报复盘',
    monthly_tasks: '月度任务', achievements: '季度成果',
  };

  return (
    <Drawer
      title={null}
      placement="right"
      onClose={onClose}
      open={open}
      width={440}
      closable={false}
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%' },
        header: { display: 'none' },
        wrapper: {},
      }}
    >
      {/* 自定义 Header — 品牌感更强 */}
      <div style={{
        padding: '16px 18px 12px',
        background: 'linear-gradient(135deg, #3B5AFB 0%, #2B4AE0 100%)',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <RobotOutlined style={{ fontSize: 18, color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>AI 业务副驾驶</div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>当前页面: {pageNameMap[currentPage] || '总览'}</div>
            </div>
          </div>
          <Space size={4}>
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined style={{ color: '#fff' }} />}
              onClick={handleRefresh}
              loading={loading}
              style={{ color: '#fff' }}
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined style={{ color: '#fff' }} />}
              onClick={onClose}
              style={{ color: '#fff' }}
            />
          </Space>
        </div>

        {/* headline — 白色卡片 */}
        {data?.headline && (
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 13,
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            lineHeight: 1.6,
          }}>
            {data.headline}
            {data.isMock && <Tag color="orange" style={{ marginLeft: 8, fontSize: 10, fontWeight: 600 }}>规则分析（非AI）</Tag>}
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
            {data.cards?.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 8 }}>洞察</div>
                {data.cards.map((card, i) => (
                  <AIInsightCard key={card.id || i} card={card} onAction={handleAction} />
                ))}
              </>
            )}

            {/* 简报/议程模式 */}
            {(data.sections?.length > 0 || data.content) && !data.cards?.length && (
              <div>
                <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 8 }}>分析</div>
                {data.title && (
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 10, color: '#262626' }}>
                    {data.title}
                  </div>
                )}
                {data.sections?.map((section, i) => (
                  <div key={i} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#3B5AFB', marginBottom: 4 }}>
                      {section.title}
                    </div>
                    <div style={{
                      background: '#F9FAFB',
                      borderRadius: 8,
                      padding: '8px 12px',
                    }}>
                      <AIMarkdownContent content={section.content} />
                    </div>
                  </div>
                ))}
                {data.content && !data.sections?.length && (
                  <div style={{
                    background: '#F9FAFB',
                    borderRadius: 8,
                    padding: '10px 12px',
                    position: 'relative',
                  }}>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => handleCopy(data.content)}
                      style={{ position: 'absolute', top: 4, right: 4, fontSize: 12 }}
                    />
                    <AIMarkdownContent content={data.content} />
                  </div>
                )}
              </div>
            )}

            {/* 置信度 */}
            {typeof data.confidence === 'number' && (
              <div style={{ marginTop: 8, fontSize: 11, color: data.confidence >= 0.7 ? '#16A34A' : data.confidence >= 0.4 ? '#F59E0B' : '#DC2626' }}>
                置信度 {Math.round(data.confidence * 100)}%
              </div>
            )}

            {/* 引用来源 */}
            {data.sources?.length > 0 && (
              <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <span style={{ fontSize: 12, color: '#6B7280', marginRight: 4 }}>引用：</span>
                {data.sources.map((s, i) => (
                  <Tag key={i} color="blue" style={{ cursor: s.id ? 'pointer' : 'default', fontSize: 11 }}
                    onClick={() => s.id && s.type === 'project' && navigate(`/projects?projectId=${s.id}`)}>
                    {s.title}
                  </Tag>
                ))}
              </div>
            )}

            {/* 建议操作按钮 */}
            {data.suggestedActions?.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>建议操作</span>
                {data.suggestedActions.map((action, i) => (
                  <Button key={i} size="small" type={action.confirmRequired ? 'default' : 'primary'}
                    onClick={() => handleActionExecute(action)}
                    danger={action.key === 'flag_risk'}>
                    {action.label}
                  </Button>
                ))}
              </div>
            )}

            {/* V7: 可操作 Action 卡片 */}
            {data.actions?.length > 0 && (
              <>
                <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, marginBottom: 4, marginTop: 4 }}>建议</div>
                {data.actions
                  .filter(a => a.type === 'action')
                  .map((action, i) => (
                    <AIActionCard key={i} action={action} onExecute={handleActionExecute} />
                  ))}
                {/* 传统快捷动作（type !== 'action'） */}
                {data.actions.filter(a => a.type !== 'action').length > 0 && (
                  <AIActionList actions={data.actions.filter(a => a.type !== 'action')} onAction={handleAction} />
                )}
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
                    background: '#F9FAFB',
                    borderRadius: 8,
                    padding: '10px 12px',
                    position: 'relative',
                  }}>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => handleCopy(data.rawAnalysis)}
                      style={{ position: 'absolute', top: 4, right: 4, fontSize: 11 }}
                    />
                    <AIMarkdownContent content={data.rawAnalysis} style={{ fontSize: 12, color: '#8c8c8c' }} />
                  </div>
                )}
              </>
            )}

            {/* 操作结果反馈 */}
            {actionResults.length > 0 && (
              <>
                <Divider style={{ margin: '8px 0', fontSize: 12, color: '#16A34A' }}>
                  <CheckCircleOutlined style={{ marginRight: 4 }} />已执行操作
                </Divider>
                {actionResults.slice(-3).map((ar, i) => (
                  <div key={i} style={{
                    padding: '6px 10px',
                    marginBottom: 4,
                    background: '#F0FDF4',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#16A34A',
                    border: '1px solid #BBF7D0',
                  }}>
                    ✓ {ar.action.label} — {ar.result.type === 'navigate' ? '已跳转' : '已执行'}
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* 自由问答模式 */}
        {activeMode === 'free_ask' && (
          <div>
            {chatHistory.length === 0 && !isStreaming && (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF' }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: '#F0F4FF', margin: '0 auto 12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <RobotOutlined style={{ fontSize: 22, color: '#3B5AFB' }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', marginBottom: 4 }}>
                  基于当前页面数据回答
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  问我关于项目、指标、风险等任何问题
                </div>
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
                  background: msg.role === 'user' ? '#3B5AFB' : msg.isError ? '#FEF2F2' : '#F0F4FF',
                  color: msg.role === 'user' ? '#fff' : '#262626',
                  padding: '8px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                }}>
                  {msg.role === 'user' ? (
                    <span style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                  ) : (
                    <AIMarkdownContent content={msg.content} compact />
                  )}
                  {msg.isMock && <Tag color="orange" style={{ marginLeft: 4, fontSize: 10, fontWeight: 600 }}>规则分析（非AI）</Tag>}
                  {msg.suggestedFollowUps && !isStreaming && (
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
            {/* SSE 流式输出中的 assistant 消息 */}
            {isStreaming && (
              <div style={{
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  background: '#F0F4FF',
                  color: '#262626',
                  padding: '8px 12px',
                  borderRadius: '12px 12px 12px 2px',
                }}>
                  {streamContent ? (
                    <AIMarkdownContent content={streamContent} compact />
                  ) : (
                    <span style={{ fontSize: 13, color: '#8c8c8c' }}>AI 正在思考<span className="streaming-cursor">▍</span></span>
                  )}
                </div>
              </div>
            )}
            {streamError && (
              <div style={{
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  background: '#FEF2F2',
                  color: '#a8071a',
                  padding: '8px 12px',
                  borderRadius: '12px 12px 12px 2px',
                  fontSize: 13,
                }}>
                  {streamError}
                </div>
              </div>
            )}
            {loading && chatHistory.length > 0 && !isStreaming && (
              <div style={{ textAlign: 'center', padding: 8, color: '#8c8c8c', fontSize: 12 }}>
                AI 正在思考...
              </div>
            )}
            <div ref={chatEndRef} />
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
              ? (data?.actions?.filter(a => a.type === 'action').map(a => a.label) || ['当前有哪些风险项目？', '本周指标达成情况如何？', '下周应该优先做什么？'])
              : (chatHistory[chatHistory.length - 1]?.suggestedFollowUps || [])
          }
        />
      )}
    </Drawer>
  );
}
