function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function money(v) {
  return Number(toNumber(v).toFixed(2));
}

function calcRankDelta(yesterdayRank, currentRank) {
  if (yesterdayRank === null || yesterdayRank === undefined) return null;
  if (currentRank === null || currentRank === undefined) return null;
  const y = Number(yesterdayRank);
  const c = Number(currentRank);
  if (!Number.isFinite(y) || !Number.isFinite(c)) return null;
  return y - c;
}

function attachRankFlags(currentRank) {
  const rank = Number(currentRank);
  if (!Number.isFinite(rank) || rank <= 0) {
    return { is_t1: false, is_t3: false, is_t10: false, is_covered: false };
  }
  return {
    is_t1: rank === 1,
    is_t3: rank >= 1 && rank <= 3,
    is_t10: rank >= 1 && rank <= 10,
    is_covered: true,
  };
}

function sanitizeDailyMetricInput(payload = {}) {
  return {
    keyword_status: payload.keyword_status || null,
    search_index: payload.search_index !== undefined && payload.search_index !== null && payload.search_index !== '' ? toInt(payload.search_index) : null,
    popularity: payload.popularity !== undefined && payload.popularity !== null && payload.popularity !== '' ? toInt(payload.popularity) : null,
    initial_rank: payload.initial_rank !== undefined && payload.initial_rank !== null && payload.initial_rank !== '' ? toInt(payload.initial_rank) : null,
    yesterday_rank: payload.yesterday_rank !== undefined && payload.yesterday_rank !== null && payload.yesterday_rank !== '' ? toInt(payload.yesterday_rank) : null,
    current_rank: payload.current_rank !== undefined && payload.current_rank !== null && payload.current_rank !== '' ? toInt(payload.current_rank) : null,
    best_rank: payload.best_rank !== undefined && payload.best_rank !== null && payload.best_rank !== '' ? toInt(payload.best_rank) : null,
    yesterday_volume: toInt(payload.yesterday_volume),
    today_volume: toInt(payload.today_volume),
    cost_amount: money(payload.cost_amount),
  };
}

function buildDerivedDailyFields(sanitized) {
  const rankDelta = calcRankDelta(sanitized.yesterday_rank, sanitized.current_rank);
  const flags = attachRankFlags(sanitized.current_rank);
  return { rank_delta: rankDelta, ...flags };
}

function attachDerivedFields(row = {}) {
  const rankDelta = calcRankDelta(row.yesterday_rank, row.current_rank);
  const flags = attachRankFlags(row.current_rank);
  return { ...row, rank_delta: rankDelta, ...flags };
}

module.exports = { toNumber, toInt, money, calcRankDelta, attachRankFlags, sanitizeDailyMetricInput, buildDerivedDailyFields, attachDerivedFields };
