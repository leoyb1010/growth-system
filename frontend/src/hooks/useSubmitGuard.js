import { useState, useCallback, useRef } from 'react';

/**
 * 防重复提交 Hook
 * 在异步提交期间锁定提交按钮，防止重复点击
 *
 * @param {Function} submitFn - 异步提交函数
 * @param {Object} options
 * @param {number} options.cooldown - 提交后冷却时间(ms)，默认0
 * @returns {{ submit: Function, isSubmitting: boolean }}
 *
 * @example
 * const { submit, isSubmitting } = useSubmitGuard(async (values) => {
 *   await api.post('/api/projects', values);
 * });
 *
 * <Button loading={isSubmitting} onClick={() => submit(formValues)}>提交</Button>
 */
function useSubmitGuard(submitFn, { cooldown = 0 } = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cooldownTimer = useRef(null);

  const submit = useCallback(async (...args) => {
    if (isSubmitting) return; // 正在提交，忽略

    setIsSubmitting(true);
    try {
      const result = await submitFn(...args);
      return result;
    } finally {
      if (cooldown > 0) {
        // 冷却期：延迟解锁
        cooldownTimer.current = setTimeout(() => {
          setIsSubmitting(false);
        }, cooldown);
      } else {
        setIsSubmitting(false);
      }
    }
  }, [submitFn, isSubmitting, cooldown]);

  return { submit, isSubmitting };
}

export default useSubmitGuard;
