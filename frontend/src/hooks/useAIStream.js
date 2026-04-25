import { useState, useCallback, useRef } from 'react';

/**
 * AI 流式输出 Hook
 * 使用 SSE (Server-Sent Events) 接收流式 AI 响应
 *
 * @returns {{ streamChat: Function, content: string, isStreaming: boolean, error: string|null, abort: Function }}
 */
function useAIStream() {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const streamChat = useCallback(async (query, currentPage = 'dashboard') => {
    // 重置状态
    setContent('');
    setError(null);
    setIsStreaming(true);

    const token = localStorage.getItem('token');
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/ai/chat-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ query, currentPage }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 解析 SSE 事件
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case 'content':
                setContent(prev => prev + event.text);
                break;
              case 'warning':
                console.warn('[AI Stream Warning]', event.message);
                break;
              case 'done':
                setIsStreaming(false);
                break;
              case 'error':
                setError(event.message || 'AI 流式输出出错');
                setIsStreaming(false);
                break;
              default:
                break;
            }
          } catch (e) {
            // 忽略 JSON 解析错误
          }
        }
      }

      // 流式正常结束
      setIsStreaming(false);
    } catch (err) {
      if (err.name === 'AbortError') {
        // 用户主动取消
        setIsStreaming(false);
        return;
      }
      setError(err.message || '流式请求失败');
      setIsStreaming(false);
    }
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  return { streamChat, content, isStreaming, error, abort };
}

export default useAIStream;
