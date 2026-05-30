const { Op } = require('sequelize');
const { Project } = require('../models');

function tokens(text) {
  const s = String(text || '').toLowerCase();
  const parts = s
    .replace(/[「」“”，,。:：；;（）()\[\]【】]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const zh = s.match(/[一-龥A-Za-z0-9]{2,}/g) || [];
  return [...new Set([...parts, ...zh])].filter(t => t.length >= 2);
}

function containsAny(haystack, list) {
  const h = String(haystack || '').toLowerCase();
  return list.filter(t => h.includes(t.toLowerCase())).length;
}

function currentQuarter() {
  const m = new Date().getMonth() + 1;
  return m <= 3 ? 'Q1' : m <= 6 ? 'Q2' : m <= 9 ? 'Q3' : 'Q4';
}

function buildProjectWhere(user) {
  const where = {};
  const roleLevel = user.roleLevel;
  if (roleLevel === 0) return where;
  if (user.dept_id) where.dept_id = user.dept_id;
  if (roleLevel === 2) {
    const or = [{ owner_user_id: user.id }, { creator_id: user.id }];
    if (user.name) or.push({ owner_name: user.name });
    where[Op.or] = or;
  }
  return where;
}

function scoreProject(project, hint, fullText, user) {
  const hintTokens = tokens(hint);
  const allTokens = tokens(`${hint} ${fullText}`);
  const fields = [project.name, project.owner_name, project.goal, project.weekly_progress, project.next_week_focus, project.risk_desc, project.next_action].join(' ');
  let score = 0;
  const reasons = [];

  if (hint && project.name && project.name.includes(hint)) { score += 55; reasons.push('项目名包含输入关键词'); }
  if (hint && hint.includes(project.name)) { score += 55; reasons.push('输入包含完整项目名'); }

  const nameHits = containsAny(project.name, hintTokens);
  if (nameHits) { score += Math.min(35, nameHits * 12); reasons.push('项目名关键词匹配'); }

  const fieldHits = containsAny(fields, allTokens);
  if (fieldHits) { score += Math.min(25, fieldHits * 5); reasons.push('项目内容关键词匹配'); }

  if (project.owner_user_id === user.id || project.creator_id === user.id || project.owner_name === user.name) {
    score += 15; reasons.push('当前用户负责/创建');
  }
  if (project.quarter === currentQuarter()) { score += 8; reasons.push('当前季度'); }
  if (project.status !== '完成') { score += 5; reasons.push('未完成项目'); }

  const updatedAt = project.updated_at ? new Date(project.updated_at).getTime() : 0;
  const days = updatedAt ? (Date.now() - updatedAt) / 86400000 : 999;
  if (days <= 7) { score += 5; reasons.push('近期更新'); }

  const confidence = Math.max(0, Math.min(0.99, score / 100));
  return { project, score, confidence, reasons };
}

async function resolveProject({ user, targetHint, rawText }) {
  const projects = await Project.findAll({
    where: buildProjectWhere(user),
    order: [['updated_at', 'DESC']],
    limit: 100,
  });
  const scored = projects
    .map(p => scoreProject(p, targetHint, rawText, user))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const best = scored[0];
  if (!best) {
    return { status: 'no_match', confidence: 0, candidates: [], message: '没有找到你有权限操作的项目' };
  }

  const candidates = scored.map(s => ({
    id: s.project.id,
    name: s.project.name,
    owner_name: s.project.owner_name,
    status: s.project.status,
    progress_pct: s.project.progress_pct,
    confidence: Number(s.confidence.toFixed(2)),
    reasons: s.reasons,
  }));

  if (best.confidence >= 0.85) {
    return { status: 'matched', project: best.project, confidence: best.confidence, candidates };
  }
  if (best.confidence >= 0.6) {
    return { status: 'ambiguous', confidence: best.confidence, candidates, message: '项目匹配不够确定，请选择候选项目' };
  }
  return { status: 'no_match', confidence: best.confidence, candidates, message: '没有把握判断你说的是哪个项目，请补充项目名或负责人' };
}

module.exports = { resolveProject, buildProjectWhere, scoreProject };
