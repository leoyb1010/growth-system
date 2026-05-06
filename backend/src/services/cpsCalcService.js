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

function rate(numerator, denominator) {
  const a = toNumber(numerator);
  const b = toNumber(denominator);
  if (b <= 0) return 0;
  return Number((a / b).toFixed(6));
}

function sanitizeInput(payload = {}) {
  return {
    new_sign_count: toInt(payload.new_sign_count),
    new_terminate_count: toInt(payload.new_terminate_count),
    new_refund_count: toInt(payload.new_refund_count),
    renewal_count: toInt(payload.renewal_count),
    renewal_refund_count: toInt(payload.renewal_refund_count),
    after_sale_refund_count: toInt(payload.after_sale_refund_count),
    complaint_count: toInt(payload.complaint_count),
  };
}

function buildDerivedFields(payload = {}) {
  const unitPrice = toNumber(payload.unit_price);
  const newSign = toInt(payload.new_sign_count);
  const newRefund = toInt(payload.new_refund_count);
  const renewal = toInt(payload.renewal_count);
  const renewalRefund = toInt(payload.renewal_refund_count);
  const afterSaleRefund = toInt(payload.after_sale_refund_count);

  const effectiveCount = newSign + renewal - newRefund - renewalRefund;
  const actualCount = newSign + renewal - afterSaleRefund;

  return {
    new_sign_amount: money(newSign * unitPrice),
    new_refund_amount: money(newRefund * unitPrice),
    renewal_amount: money(renewal * unitPrice),
    renewal_refund_amount: money(renewalRefund * unitPrice),
    effective_count: effectiveCount,
    effective_amount: money(effectiveCount * unitPrice),
    actual_count: actualCount,
    actual_amount: money(actualCount * unitPrice),
  };
}

function attachRates(row = {}) {
  const newSign = toNumber(row.new_sign_count);
  const renewal = toNumber(row.renewal_count);
  const totalPaid = newSign + renewal;

  return {
    ...row,
    new_terminate_rate: rate(row.new_terminate_count, newSign),
    new_refund_rate: rate(row.new_refund_count, newSign),
    renewal_refund_rate: rate(row.renewal_refund_count, renewal),
    after_sale_refund_rate: rate(row.after_sale_refund_count, totalPaid),
  };
}

function sumMetrics(rows = []) {
  const base = {
    new_sign_count: 0, new_terminate_count: 0, new_refund_count: 0,
    renewal_count: 0, renewal_refund_count: 0, after_sale_refund_count: 0,
    complaint_count: 0,
    new_sign_amount: 0, new_refund_amount: 0, renewal_amount: 0,
    renewal_refund_amount: 0, effective_count: 0, effective_amount: 0,
    actual_count: 0, actual_amount: 0,
  };

  for (const row of rows) {
    for (const key of Object.keys(base)) {
      base[key] += toNumber(row[key]);
    }
  }

  for (const key of Object.keys(base)) {
    if (key.endsWith('_amount')) base[key] = money(base[key]);
  }

  return attachRates(base);
}

module.exports = { toNumber, toInt, money, rate, sanitizeInput, buildDerivedFields, attachRates, sumMetrics };
