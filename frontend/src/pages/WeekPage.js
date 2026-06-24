import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Tag, Progress, Tooltip, Spin, Empty, Input, message, Drawer, Checkbox, Collapse } from 'antd';
import { ClockCircleOutlined, EditOutlined, QuestionCircleOutlined, RobotOutlined, ReloadOutlined } from '@ant-design/icons';
import { api, useAuth } from '../hooks/useAuth';
import moment from 'moment';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import { getStatusStyle, getProgressColor } from '../utils/constants';

const TABLE_LABEL = { projects: '项目', kpis: '指标', performances: '业绩', monthly_tasks: '月度', achievements: '成果' };
const ACTION_CFG = { create: { label: '新增', tag: 'success' }, update: { label: '更新', tag: 'processing' }, delete: { label: '删除', tag: 'error' } };

function WeekPage() {
  const { isDeptManager } = useAuth();
  const [loading, setLoading] = useState(true);
  const [weekSummary, setWeekSummary] = useState(null);
  const [todayChanges, setTodayChanges] = useState([]);
  const [projects, setProjects] = useState([]);
  const [staleProjects, setStaleProjects] = useState([]);
  const [quickEditVisible, setQuickEditVisible] = useState(false);
  const [quickEditItem, setQuickEditItem] = useState(null);
  const [quickProgress, setQuickProgress] = useState('');
  const [quickSyncMonthly, setQuickSyncMonthly] = useState(false);
  const [quickSyncAchievement, setQuickSyncAchievement] = useState(false);

  const getWeekRange = () => {
    const today = moment();
    const monday = today.clone().subtract(today.isoWeekday() - 1, 'days').startOf('day');
    const sunday = monday.clone().add(6, 'days');
    return { start: monday, end: sunday, label: `${monday.format('M/D')} ~ ${sunday.format('M/D')}` };
  };
  const weekRange = getWeekRange();

  const getCurrentQuarter = () => {
    const m = new Date().getMonth();
    return m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4';
  };

  useEffect(() => { fetchAllData(); }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [summaryRes, changesRes, projectsRes, staleRes] = await Promise.all([
        api.get('/dashboard/week-summary'),
        api.get('/dashboard/today-changes'),
        api.get('/projects', { params: { quarter: getCurrentQuarter() } }),
        api.get('/projects/stale', { params: { days: 3 } }),
      ]);
      if (summaryRes.code === 0) setWeekSummary(summaryRes.data);
      if (changesRes.code === 0) setTodayChanges(changesRes.data);
      if (projectsRes.code === 0) setProjects(projectsRes.data);
      if (staleRes.code === 0) setStaleProjects(staleRes.data);
    } catch (err) {
      message.error('加载本周数据失败');
    } finally {
      setLoading(false);
    }
  };

  const openQuickEdit = (item) => {
    setQuickEditItem(item);
    setQuickProgress(item.weekly_progress || '');
    setQuickSyncMonthly(false);
    setQuickSyncAchievement(false);
    setQuickEditVisible(true);
  };

  const handleQuickUpdate = async () => {
    if (!quickEditItem || !quickProgress.trim()) return;
    try {
      await api.put(`/projects/${quickEditItem.id}/quick-update`, {
        weekly_progress: quickProgress,
        sync_to_monthly: quickSyncMonthly,
        sync_to_achievement: quickSyncAchievement,
        updated_at: quickEditItem.updated_at,
      });
      message.success('每日更新成功');
      setQuickEditVisible(false);
      setQuickEditItem(null);
      setQuickProgress('');
      fetchAllData();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || '更新失败');
    }
  };

  // ===== 分桶（MECE：每个项目只进一个最高优先级的桶，杜绝重复）=====
  const staleIds = new Set(staleProjects.map(s => s.id));

  // 计算"需立即处理"的原因标签
  const actionReasons = (p) => {
    const r = [];
    if (p.is_risk || p.status === '风险') r.push({ text: '风险', color: 'error' });
    const d = p.days_until_due;
    if (d !== undefined && d !== null && p.status !== '完成') {
      if (d < 0) r.push({ text: `逾期${Math.abs(d)}天`, color: 'error' });
      else if (d === 0) r.push({ text: '今天到期', color: 'warning' });
      else if (d <= 7) r.push({ text: `剩${d}天`, color: 'warning' });
    }
    if (p.progress_status === 'behind' && p.status !== '完成') r.push({ text: '落后进度', color: 'gold' });
    return r;
  };

  const weekProjects = projects.filter(p => p.type !== '下周重点');
  const nextWeekProjects = projects.filter(p => p.type === '下周重点');

  const needAction = [];
  const notUpdated = [];
  const updatedThisWeek = [];
  const steady = [];
  weekProjects.forEach(p => {
    const reasons = actionReasons(p);
    if (reasons.length) { needAction.push({ ...p, _reasons: reasons }); return; }
    if (staleIds.has(p.id) && p.status !== '完成') { notUpdated.push(p); return; }
    if (p.updated_at && moment(p.updated_at).isSameOrAfter(weekRange.start)) { updatedThisWeek.push(p); return; }
    steady.push(p);
  });
  // 严重度排序
  const sev = (p) => {
    if (p._reasons.some(r => r.text === '风险')) return 0;
    if (p._reasons.some(r => r.text.startsWith('逾期'))) return 1;
    if (p._reasons.some(r => r.text === '今天到期')) return 2;
    if (p._reasons.some(r => r.text.startsWith('剩'))) return 3;
    return 4;
  };
  needAction.sort((a, b) => sev(a) - sev(b));
  // 未更新的也可能不在本季 projects 列表里（stale 接口独立），补齐展示用 stale 自身数据
  const notUpdatedShow = staleProjects
    .filter(s => !needAction.some(p => p.id === s.id))
    .sort((a, b) => (b.days_since_update || 0) - (a.days_since_update || 0));

  const summary = [
    { label: '需立即处理', value: needAction.length, color: needAction.length ? '#DC2626' : '#16A34A', sub: '风险/逾期/临期/落后' },
    { label: '进度未更新', value: notUpdatedShow.length, color: notUpdatedShow.length ? '#F59E0B' : '#16A34A', sub: '超3天未更新' },
    { label: '本周已更新', value: weekSummary?.updated_count ?? updatedThisWeek.length, color: '#3B5AFB', sub: '本周有进展' },
    { label: '下周重点', value: nextWeekProjects.length, color: '#8B5CF6', sub: '已安排' },
  ];

  const renderProjectCard = (item) => {
    const sc = getStatusStyle(item.status);
    return (
      <Card key={item.id} className="surface-card hover-lift" style={{ borderLeft: `3px solid ${sc.border}` }} bodyStyle={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1, #111827)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
          <Tag color={sc.tag} style={{ flexShrink: 0, margin: 0 }}>{item.status}</Tag>
        </div>
        {item._reasons?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {item._reasons.map((r, i) => <Tag key={i} color={r.color} style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>{r.text}</Tag>)}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
          <span>{item.owner_name || '-'}{item.Department?.name ? ` · ${item.Department.name}` : ''}</span>
        </div>
        <Progress percent={item.progress_pct} strokeColor={getProgressColor(item.progress_pct)} trailColor="#F1F5F9" size="small" style={{ marginBottom: 6 }} />
        {item.weekly_progress && (
          <div style={{ fontSize: 12, color: '#6B7280', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 6 }}>{item.weekly_progress}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid #F1F5F9' }}>
          <span className="subtle-text" style={{ fontSize: 11 }}>{item.updated_at ? `更新于 ${moment(item.updated_at).fromNow()}` : '尚未更新'}</span>
          {isDeptManager && <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openQuickEdit(item)}>每日更新</Button>}
        </div>
      </Card>
    );
  };

  const sectionGrid = (list) => (
    <Row gutter={[12, 12]}>{list.map(p => <Col xs={24} sm={12} lg={8} key={p.id}>{renderProjectCard(p)}</Col>)}</Row>
  );

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;

  return (
    <div className="app-page">
      <PageHeader
        title="本周管理"
        subtitle={`${weekRange.label} · 项目推进页数据的自动汇总，无需重复填写`}
        extra={[
          <Button key="ai_closure" icon={<RobotOutlined />} onClick={() => window.__aiAssistant?.openDrawer('risk_closure')}>闭环检查</Button>,
          <Button key="ai_meeting" icon={<RobotOutlined />} onClick={() => window.__aiAssistant?.runAction('prepare_meeting')}>准备周会</Button>,
          <Button key="refresh" icon={<ReloadOutlined />} onClick={fetchAllData}>刷新</Button>,
        ]}
      />

      {/* 摘要：每张卡 = 下方一个分区，口径一一对应 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {summary.map((s, i) => (
          <Col xs={12} sm={6} key={i}>
            <Card className="surface-card hover-lift" bodyStyle={{ padding: 16 }}>
              <div className="metric-label">{s.label}</div>
              <div className="metric-value" style={{ color: s.color }}>{s.value}</div>
              <div className="subtle-text" style={{ fontSize: 11 }}>{s.sub}</div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 1. 需立即处理 */}
      <PanelCard
        title={<span>需立即处理 <span className="subtle-text" style={{ fontSize: 12, marginLeft: 6 }}>{needAction.length}</span></span>}
        subtitle="规则：处于风险状态、已逾期/7天内到期、或完成率落后于时间进度的项目"
        style={{ marginBottom: 20 }}
      >
        {needAction.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本周无需立即处理的项目" /> : sectionGrid(needAction)}
      </PanelCard>

      {/* 2. 进度未更新 */}
      <PanelCard
        title={<span>进度未更新 <span className="subtle-text" style={{ fontSize: 12, marginLeft: 6 }}>{notUpdatedShow.length}</span></span>}
        subtitle="规则：未完成且超过 3 天没有更新进展的项目"
        style={{ marginBottom: 20 }}
      >
        {notUpdatedShow.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="所有项目均近期更新" /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notUpdatedShow.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  <div className="subtle-text" style={{ fontSize: 11 }}>{p.Department?.name || '-'} · {p.owner_name || '-'}</div>
                </div>
                <Tag color="warning" style={{ margin: 0 }}>{p.days_since_update}天未更新</Tag>
                {isDeptManager && <Button type="link" size="small" onClick={() => openQuickEdit(p)}>每日更新</Button>}
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      {/* 3. 本周已更新 */}
      <PanelCard
        title={<span>本周已更新 <span className="subtle-text" style={{ fontSize: 12, marginLeft: 6 }}>{updatedThisWeek.length}</span></span>}
        subtitle={`规则：本周（${weekRange.label}）有进展更新、且不在上面两类中的项目`}
        style={{ marginBottom: 20 }}
      >
        {updatedThisWeek.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="本周暂无新的进展更新" /> : sectionGrid(updatedThisWeek)}
      </PanelCard>

      {/* 4. 下周重点 */}
      <PanelCard
        title={<span>下周重点 <span className="subtle-text" style={{ fontSize: 12, marginLeft: 6 }}>{nextWeekProjects.length}</span></span>}
        subtitle="在项目推进页标记为「下周重点」的工作"
        style={{ marginBottom: 20 }}
      >
        {nextWeekProjects.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无下周重点，请在项目推进页录入" /> : sectionGrid(nextWeekProjects)}
      </PanelCard>

      {/* 次要信息折叠：平稳进行中 + 今日变化 */}
      <Collapse
        ghost
        items={[
          {
            key: 'steady',
            label: <span>其他进行中 <span className="subtle-text" style={{ fontSize: 12, marginLeft: 6 }}>{steady.length}</span></span>,
            children: steady.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无" /> : sectionGrid(steady),
          },
          {
            key: 'changes',
            label: <span><ClockCircleOutlined style={{ marginRight: 6 }} />今日变化 <span className="subtle-text" style={{ fontSize: 12, marginLeft: 6 }}>{todayChanges.length}</span></span>,
            children: todayChanges.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#9CA3AF' }}>今日暂无数据变更</div>
            ) : (
              <div>
                {todayChanges.slice(0, 30).map((c, idx) => {
                  const ac = ACTION_CFG[c.action] || { label: c.action, tag: 'default' };
                  return (
                    <div key={c.id || idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <Tag color={ac.tag} style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{ac.label}</Tag>
                      <span style={{ fontSize: 13, color: '#111827' }}>{TABLE_LABEL[c.table_name] || c.table_name}</span>
                      {c.operator_name && <span className="subtle-text" style={{ fontSize: 11 }}>by {c.operator_name}</span>}
                      <span className="subtle-text" style={{ marginLeft: 'auto', fontSize: 11 }}>{moment(c.created_at).format('HH:mm')}</span>
                    </div>
                  );
                })}
              </div>
            ),
          },
        ]}
      />

      <Drawer
        title={quickEditItem ? `每日更新：${quickEditItem.name}` : '每日更新'}
        open={quickEditVisible}
        onClose={() => { setQuickEditVisible(false); setQuickEditItem(null); setQuickProgress(''); }}
        width={480}
        extra={<Button type="primary" onClick={handleQuickUpdate}>保存</Button>}
      >
        {quickEditItem && (
          <div>
            <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Tag color={getStatusStyle(quickEditItem.status).tag}>{quickEditItem.status}</Tag>
              {quickEditItem.Department?.name && <Tag>{quickEditItem.Department.name}</Tag>}
              <span className="subtle-text">{quickEditItem.owner_name}</span>
            </div>
            <div style={{ marginBottom: 16 }}>
              <Progress percent={quickEditItem.progress_pct} strokeColor={getProgressColor(quickEditItem.progress_pct)} />
            </div>
            <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 13 }}>今日进展</div>
            <Input.TextArea rows={4} value={quickProgress} onChange={(e) => setQuickProgress(e.target.value)} placeholder="输入今日进展（追加模式，不会覆盖已有内容）..." />
            <div style={{ marginTop: 16, background: '#F8FAFC', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Checkbox checked={quickSyncMonthly} onChange={(e) => setQuickSyncMonthly(e.target.checked)} />
                <span style={{ fontSize: 13, color: '#334155' }}>同步进展到本月月度任务</span>
                <Tooltip title="开启后，本次进展将追加到该项目关联的月度任务「实际完成情况」中"><QuestionCircleOutlined style={{ color: '#9CA3AF', cursor: 'help' }} /></Tooltip>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Checkbox checked={quickSyncAchievement} onChange={(e) => setQuickSyncAchievement(e.target.checked)} />
                <span style={{ fontSize: 13, color: '#334155' }}>同步进展到本季季度成果</span>
                <Tooltip title="开启后，本次进展将追加到该项目关联的季度成果「成果描述」中"><QuestionCircleOutlined style={{ color: '#9CA3AF', cursor: 'help' }} /></Tooltip>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default WeekPage;
