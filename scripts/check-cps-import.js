/**
 * CPS 导入数据核验脚本（只读）
 * 验证指尖渠道 2026-05-01 ~ 2026-05-07 导入数据是否落库
 * 用法：cd backend && node ../scripts/check-cps-import.js
 */
const { Op } = require('sequelize');
const { CpsChannel, CpsProduct, CpsDailyMetric } = require('../backend/src/models');

async function main() {
  try {
    // 尝试查找深圳指尖渠道
    const channel = await CpsChannel.findOne({
      where: {
        [Op.or]: [
          { name: { [Op.like]: '%指尖%' } },
          { name: { [Op.like]: '%深圳%' } },
        ],
      },
    });

    if (!channel) {
      console.log('未找到"深圳指尖"渠道，请先创建渠道。');
      console.log('当前所有渠道：');
      const allChannels = await CpsChannel.findAll({ where: { status: 'active' } });
      allChannels.forEach(c => console.log(`  id=${c.id} name=${c.name} code=${c.code}`));
      return;
    }

    console.log(`找到渠道: ${channel.name} (id=${channel.id})`);

    const rows = await CpsDailyMetric.findAll({
      where: {
        channel_id: channel.id,
        stat_date: { [Op.between]: ['2026-05-01', '2026-05-07'] },
      },
      include: [{ model: CpsProduct, as: 'product', attributes: ['name'] }],
      order: [['stat_date', 'ASC'], ['product_id', 'ASC']],
    });

    console.log(`\n2026-05-01 ~ 2026-05-07 指尖渠道数据：共 ${rows.length} 条`);

    if (rows.length === 0) {
      console.log('未找到任何数据。可能原因：');
      console.log('  1. 尚未导入');
      console.log('  2. 导入时 source 字段与查询不匹配');
      console.log('  3. 渠道 ID 不匹配');
      return;
    }

    console.table(rows.map(r => ({
      date: r.stat_date,
      channel: channel.name,
      product: r.product?.name,
      effective_count: r.effective_count,
      effective_amount: Number(r.effective_amount),
      source: r.source,
      uploader: r.uploader_name,
    })));

    // 按日期汇总
    const byDate = {};
    for (const r of rows) {
      if (!byDate[r.stat_date]) byDate[r.stat_date] = { count: 0, amount: 0 };
      byDate[r.stat_date].count += r.effective_count || 0;
      byDate[r.stat_date].amount += Number(r.effective_amount || 0);
    }
    console.log('\n按日期汇总：');
    for (const [date, agg] of Object.entries(byDate).sort()) {
      console.log(`  ${date}: 有效签约 ${agg.count}, 有效收入 ¥${agg.amount.toFixed(2)}`);
    }

    // 按来源统计
    const bySource = {};
    for (const r of rows) {
      const s = r.source || 'unknown';
      bySource[s] = (bySource[s] || 0) + 1;
    }
    console.log('\n按来源统计：');
    for (const [source, count] of Object.entries(bySource)) {
      console.log(`  ${source}: ${count} 条`);
    }
  } catch (err) {
    console.error('核验脚本执行失败:', err.message);
    process.exit(1);
  }
}

main();
