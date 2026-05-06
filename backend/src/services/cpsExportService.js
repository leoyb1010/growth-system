const xlsx = require('xlsx');
const { CpsChannel, CpsProduct, CpsDailyMetric } = require('../models');
const cpsCalc = require('./cpsCalcService');

async function exportToExcel(query = {}) {
  const where = {};
  if (query.start_date && query.end_date) {
    const { Op } = require('sequelize');
    where.stat_date = { [Op.between]: [query.start_date, query.end_date] };
  }

  const rows = await CpsDailyMetric.findAll({
    where,
    include: [
      { model: CpsChannel, as: 'channel', attributes: ['name', 'code'] },
      { model: CpsProduct, as: 'product', attributes: ['name', 'code'] },
    ],
    order: [['stat_date', 'DESC'], ['channel_id', 'ASC'], ['product_id', 'ASC']],
  });

  const data = rows.map(r => {
    const row = cpsCalc.attachRates(r.toJSON());
    return {
      日期: r.stat_date,
      渠道: r.channel?.name || '-',
      产品: r.product?.name || '-',
      新签数: row.new_sign_count,
      解约数: row.new_terminate_count,
      解约率: row.new_terminate_rate,
      新签退款数: row.new_refund_count,
      新签退款率: row.new_refund_rate,
      续费数: row.renewal_count,
      续费退款数: row.renewal_refund_count,
      续费退款率: row.renewal_refund_rate,
      售后退款数: row.after_sale_refund_count,
      售后退款率: row.after_sale_refund_rate,
      有效签约数: row.effective_count,
      有效收入: Number(row.effective_amount),
      实际订单数: row.actual_count,
      实际订单金额: Number(row.actual_amount),
      客诉数: row.complaint_count,
      数据来源: row.source,
      版本: row.version,
      更新时间: row.updated_at,
    };
  });

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(data);
  xlsx.utils.book_append_sheet(wb, ws, 'CPS数据');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = { exportToExcel };
