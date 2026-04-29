/**
 * useStaggeredEnter - 给列表项分配 stagger 动画延迟
 * 纯 CSS 变量驱动，零运行时开销
 * @param {number} itemIndex - 列表项索引
 * @returns {object} style 对象，包含 --stagger-index CSS 变量
 */
export default function useStaggeredEnter(itemIndex) {
  return {
    style: {
      '--stagger-index': itemIndex,
    },
    className: 'list-item-enter',
  };
}
