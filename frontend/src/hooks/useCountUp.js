/**
 * useCountUp - 数字滚动动画 hook
 * 纯 requestAnimationFrame，零依赖
 * @param {number} end - 目标数值
 * @param {number} duration - 动画时长(ms)，默认 800
 * @param {boolean} enabled - 是否启用，默认 true
 * @returns {number} 当前显示数值
 */
import { useState, useEffect, useRef } from 'react';

export default function useCountUp(end, duration = 800, enabled = true) {
  const [value, setValue] = useState(enabled ? 0 : end);
  const rafRef = useRef(null);
  const startTimeRef = useRef(null);
  const startValueRef = useRef(0);

  useEffect(() => {
    if (!enabled || end === 0) {
      setValue(end);
      return;
    }

    startValueRef.current = value;
    startTimeRef.current = null;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // easeOutExpo 缓动
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = startValueRef.current + (end - startValueRef.current) * eased;

      setValue(Math.round(current));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [end, duration, enabled]);

  return value;
}
