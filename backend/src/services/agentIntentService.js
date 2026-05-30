const PROJECT_STATUSES = ['未启动', '进行中', '合作中', '阻塞中', '风险', '完成'];
const PRIORITY_MAP = [
  { words: ['紧急', '马上', '立刻', 'urgent'], value: 'urgent' },
  { words: ['高优先级', '重要', 'high'], value: 'high' },
  { words: ['低优先级', '不急', 'low'], value: 'low' },
];

function compact(str) {
  return String(str || '').replace(/\s+/g, ' ').trim();
}

function extractProgress(text) {
  const m = text.match(/(?:进度|完成度|推进到|到|达到)?\s*(\d{1,3})\s*%?/);
  if (!m) return undefined;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value < 0 || value > 100) return undefined;
  if (!text.includes('%') && !/(进度|完成度|推进到|达到)/.test(text)) return undefined;
  return value;
}

function extractStatus(text) {
  for (const s of PROJECT_STATUSES) {
    if (text.includes(s)) return s;
  }
  if (/延期|风险|卡住|阻塞|问题/.test(text)) return text.includes('阻塞') || text.includes('卡住') ? '阻塞中' : '风险';
  if (/完成|搞定|结束/.test(text)) return '完成';
  if (/开始|启动/.test(text)) return '进行中';
  return undefined;
}

function extractDueDate(text) {
  const today = new Date();
  if (/今天/.test(text)) return today.toISOString().slice(0, 10);
  if (/明天/.test(text)) {
    const d = new Date(today); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10);
  }
  const m = text.match(/(\d{1,2})[月/-](\d{1,2})[日号]?/);
  if (m) {
    const y = today.getFullYear();
    const mm = String(m[1]).padStart(2, '0');
    const dd = String(m[2]).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

function extractProjectHint(text) {
  const patterns = [
    /(?:更新|记录|同步|推进|补充)(?:一下)?(.+?)(?:项目|进展|今天|昨日|昨天|进度|风险|，|,|。|$)/,
    /(.+?)(?:项目|那个|这块|这条).*(?:进度|更新|推进|完成|风险)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m && compact(m[1]).length >= 2) return compact(m[1]).replace(/[「」“”]/g, '');
  }
  const quoted = text.match(/[「“](.+?)[」”]/);
  if (quoted) return compact(quoted[1]);
  return compact(text).slice(0, 80);
}

function parseAction(text) {
  const title = compact(text.replace(/^(帮我|请|创建|新增|加一个|记录一个)?(行动项|待办|todo|任务)[:：]?/i, ''));
  let priority = 'medium';
  for (const item of PRIORITY_MAP) {
    if (item.words.some(w => text.includes(w))) priority = item.value;
  }
  return {
    intent: 'action_item.create',
    payload: {
      title: title.slice(0, 200),
      description: title.slice(0, 1000),
      priority,
      due_date: extractDueDate(text),
    }
  };
}

function parseRisk(text) {
  const title = compact(text.replace(/^(帮我|请|记录|新增|加一个)?(风险|风险项)[:：]?/i, ''));
  const riskLevel = /严重|重大|critical/.test(text) ? 'critical' : /高风险|high/.test(text) ? 'high' : 'medium';
  return {
    intent: 'risk_register.create',
    payload: {
      title: title.slice(0, 200) || 'Agent 记录的风险',
      description: title.slice(0, 2000),
      risk_level: riskLevel,
      probability: /可能|大概率|容易/.test(text) ? 'high' : 'medium',
    },
    targetHint: extractProjectHint(text)
  };
}

function parseProjectUpdate(text) {
  const progress = extractProgress(text);
  const status = extractStatus(text);
  const noRisk = /无风险|没有风险|暂无风险|风险暂时没有/.test(text);
  const riskMatch = text.match(/(?:风险|问题|卡点|阻塞)[:：是为]?(.+?)(?:。|，|,|$)/);
  const nextMatch = text.match(/(?:下步|下一步|下周|明天|后续|接下来)[:：]?(.+?)(?:。|$)/);
  const cleaned = compact(text)
    .replace(/进度\s*(到|达到)?\s*\d{1,3}\s*%?/g, '')
    .replace(/无风险|没有风险|暂无风险|风险暂时没有/g, '');

  return {
    intent: 'project.quick_update',
    targetHint: extractProjectHint(text),
    payload: {
      weekly_progress: cleaned.slice(0, 1000),
      progress_pct: progress,
      status,
      risk_desc: noRisk ? '' : (riskMatch ? compact(riskMatch[1]).slice(0, 1000) : undefined),
      next_action: nextMatch ? compact(nextMatch[1]).slice(0, 1000) : undefined,
    }
  };
}

function parseIntent(rawText) {
  const text = compact(rawText);
  if (!text) return { intent: 'unknown', payload: {} };
  if (/^(查|查询|看看|列出|有哪些|什么)/.test(text)) {
    return { intent: 'query', payload: { query: text } };
  }
  if (/(行动项|待办|todo|任务)/i.test(text) && /(创建|新增|加|记录|帮我)/.test(text)) {
    return parseAction(text);
  }
  if (/(风险|延期|阻塞|卡住|问题)/.test(text) && /(记录|新增|加|风险台账|可能|存在)/.test(text)) {
    return parseRisk(text);
  }
  return parseProjectUpdate(text);
}

module.exports = { parseIntent, extractProgress, extractStatus, extractProjectHint };
