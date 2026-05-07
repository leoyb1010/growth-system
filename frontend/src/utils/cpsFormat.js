export function fmtMoney(value, opts = {}) {
  const { shortenWan = false, decimals = 2 } = opts;
  const n = Number(value || 0);
  if (shortenWan && Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return n.toFixed(decimals);
}

export function fmtRate(value, decimals = 2) {
  return `${(Number(value || 0) * 100).toFixed(decimals)}%`;
}

export function fmtCount(value) {
  return Number(value || 0).toLocaleString('zh-CN');
}
