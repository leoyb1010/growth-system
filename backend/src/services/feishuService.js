const axios = require('axios');

const FEISHU_WEBHOOK_URL = process.env.FEISHU_WEBHOOK_URL || '';

/**
 * 发送飞书机器人消息卡片
 * @param {object} reportData - 周报数据
 */
async function sendWeeklyReportToFeishu(reportData) {
  if (!FEISHU_WEBHOOK_URL) {
    console.log('[飞书推送] 未配置 FEISHU_WEBHOOK_URL，跳过推送');
    return { success: false, reason: '未配置 Webhook' };
  }

  try {
    const summary = reportData.summary || {};
    const card = {
      msg_type: 'interactive',
      card: {
        config: { wide_screen_mode: true },
        header: {
          title: {
            tag: 'plain_text',
            content: `📊 增长组周报 ${reportData.week_start} ~ ${reportData.week_end}`
          },
          template: 'blue'
        },
        elements: [
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: `**生成时间：** ${reportData.generated_at}\n**本周更新项目：** ${summary.total_updated_projects || 0} 个\n**风险项目：** ${summary.total_risk_projects || 0} 个\n**严重预警：** ${summary.total_severe_warnings || 0} 项\n**即将到期：** ${summary.total_upcoming || 0} 个\n**新增成果：** ${summary.total_new_achievements || 0} 项`
            }
          },
          { tag: 'hr' },
          {
            tag: 'div',
            text: {
              tag: 'lark_md',
              content: '**KPI 完成率摘要：**'
            }
          }
        ]
      }
    };

    // 添加 KPI 摘要
    const kpiItems = (reportData.kpi_summary || []).map(k =>
      `- ${k.dept_name} · ${k.indicator}：${k.actual}${k.unit} / ${k.target}${k.unit}（${k.completion_rate}%）`
    ).join('\n');

    if (kpiItems) {
      card.card.elements.push({
        tag: 'div',
        text: { tag: 'lark_md', content: kpiItems }
      });
    }

    // 风险项目提醒
    const risks = reportData.risk_and_warnings?.risk_projects || [];
    if (risks.length > 0) {
      card.card.elements.push(
        { tag: 'hr' },
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `**⚠️ 风险项目（${risks.length}个）：**`
          }
        }
      );
      risks.slice(0, 5).forEach(r => {
        card.card.elements.push({
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: `- ${r.dept_name} · ${r.name}（${r.owner_name}）- 进度 ${r.progress_pct}%`
          }
        });
      });
    }

    card.card.elements.push(
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [{ tag: 'plain_text', content: '💡 详细内容请登录增长组业务管理系统查看' }]
      }
    );

    const resp = await axios.post(FEISHU_WEBHOOK_URL, card, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    console.log('[飞书推送] 成功:', resp.data);
    return { success: true, data: resp.data };
  } catch (err) {
    console.error('[飞书推送] 失败:', err.message);
    return { success: false, reason: err.message };
  }
}

module.exports = { sendWeeklyReportToFeishu };
