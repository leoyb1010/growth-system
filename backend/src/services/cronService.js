const cron = require('node-cron');
const { generateWeeklyReportData } = require('./weeklyReportService');
const { sendWeeklyReportToFeishu } = require('./feishuService');
const { WeeklyReport } = require('../models');
const moment = require('moment');

/**
 * 初始化定时任务
 * 每周五 18:00 自动生成周报草稿
 */
function initCronJobs() {
  // 每周五 18:00 执行
  cron.schedule('0 18 * * 5', async () => {
    console.log('[' + new Date().toISOString() + '] 开始自动生成周报...');
    try {
      const weekStart = moment().subtract(7, 'days').startOf('week').add(1, 'days').toDate();
      const weekEnd = moment().subtract(1, 'days').endOf('week').add(1, 'days').toDate();

      const reportData = await generateWeeklyReportData(weekStart, weekEnd);

      await WeeklyReport.create({
        week_start: reportData.week_start,
        week_end: reportData.week_end,
        content_json: reportData,
        generated_at: new Date()
      });

      // 自动推送到飞书
      const pushResult = await sendWeeklyReportToFeishu(reportData);
      if (pushResult.success) {
        console.log('[' + new Date().toISOString() + '] 飞书推送成功');
      } else {
        console.log('[' + new Date().toISOString() + '] 飞书推送跳过:', pushResult.reason);
      }

      console.log('[' + new Date().toISOString() + '] 周报自动生成成功');
    } catch (err) {
      console.error('[' + new Date().toISOString() + '] 周报自动生成失败:', err);
    }
  }, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });

  console.log('定时任务已启动：每周五 18:00 自动生成周报');
}

module.exports = { initCronJobs };
