const cron = require('node-cron');
const cpsAlertService = require('./cpsAlertService');

function initCpsCron() {
  // 每天 09:00 执行 CPS 预警检测
  cron.schedule('0 9 * * *', async () => {
    console.log('[CPS Cron] 开始执行预警检测...');
    try {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const date = yesterday.toISOString().slice(0, 10);
      const events = await cpsAlertService.checkAlertsForDate(date);
      console.log(`[CPS Cron] 检测完成，产生 ${events.length} 条预警`);
    } catch (err) {
      console.error('[CPS Cron] 执行失败:', err.message);
    }
  }, { timezone: 'Asia/Shanghai' });

  console.log('[CPS Cron] 定时任务已注册 (每日 09:00)');
}

module.exports = { initCpsCron };
