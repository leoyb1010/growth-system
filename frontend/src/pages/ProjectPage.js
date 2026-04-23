import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Button, Modal, Form, Input, InputNumber, Select, DatePicker, message, Tag, Progress, Drawer, Descriptions, Badge, Tabs, Tooltip, Checkbox, Dropdown, Grid, Calendar, Popconfirm, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, WarningOutlined, EyeOutlined, UnorderedListOutlined, AppstoreOutlined, FormOutlined, MoreOutlined, ColumnWidthOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { api, useAuth } from '../hooks/useAuth';
import { can } from '../permissions/ability';
import moment from 'moment';
import PageHeader from '../components/ui/PageHeader';
import PanelCard from '../components/ui/PanelCard';
import { STATUS_COLORS, defaultStatusColor, getStatusStyle, getProgressColor } from '../utils/constants';
import DepartmentSelect from '../components/DepartmentSelect';

const { Option } = Select;
const { TextArea } = Input;

const { useBreakpoint } = Grid;

function ProjectPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [detailRecord, setDetailRecord] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [viewMode, setViewMode] = useState('card'); // card | table | kanban
  const [sortMode, setSortMode] = useState('priority'); // priority | time
  const [form] = Form.useForm();
  const { isAdmin, isDeptManager, user } = useAuth();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  // 就地更新状态
  const [editingProgressId, setEditingProgressId] = useState(null);
  const [editingProgressValue, setEditingProgressValue] = useState(0);
  const [quickUpdateVisible, setQuickUpdateVisible] = useState(false);
  const [quickUpdateItem, setQuickUpdateItem] = useState(null);
  const [quickWeeklyProgress, setQuickWeeklyProgress] = useState('');
  // 增强版今日更新
  const [todayUpdateVisible, setTodayUpdateVisible] = useState(false);
  const [todayUpdateItem, setTodayUpdateItem] = useState(null);
  const [todayUpdateForm, setTodayUpdateForm] = useState({ weekly_progress: '', progress_pct: 0, status: '', risk_desc: '' });
  // 更新日历
  const [updateLogs, setUpdateLogs] = useState([]);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [selectedDateLogs, setSelectedDateLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);

  const now = new Date();
  const currentQuarter = now.getMonth() < 3 ? 'Q1' : now.getMonth() < 6 ? 'Q2' : now.getMonth() < 9 ? 'Q3' : 'Q4';
  const [filters, setFilters] = useState({ quarter: currentQuarter });

  const getNextWeekRange = () => {
    const today = moment();
    const dayOfWeek = today.isoWeekday();
    const nextMonday = today.clone().add(8 - dayOfWeek, 'days');
    const nextSunday = nextMonday.clone().add(6, 'days');
    return { start: nextMonday.format('YYYY-MM-DD'), end: nextSunday.format('YYYY-MM-DD') };
  };
  const nextWeek = getNextWeekRange();

  useEffect(() => { fetchData(); }, [filters, sortMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      if (sortMode === 'priority') {
        params.sort = 'priority';
      }
      const res = await api.get('/projects', { params });
      if (res.code === 0) setData(res.data);
    } catch (err) {
      message.error('获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const isNextWeek = values.type === '下周重点';
      const payload = {
        ...values,
        due_date: values.due_date ? values.due_date.format('YYYY-MM-DD') : (isNextWeek ? nextWeek.end : null),
        action_due_date: values.action_due_date ? values.action_due_date.format('YYYY-MM-DD') : null,
        decision_needed: values.decision_needed || false,
        owner_user_id: values.owner_user_id || user?.id,
      };
      if (editingRecord) {
        await api.put(`/projects/${editingRecord.id}`, payload);
        message.success('更新成功');
      } else {
        await api.post('/projects', payload);
        message.success('项目创建成功');
      }
      setModalVisible(false);
      setEditingRecord(null);
      form.resetFields();
      fetchData();
    } catch (err) { message.error(err?.response?.data?.message || err?.message || '操作失败'); }
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({ ...record, due_date: record.due_date ? moment(record.due_date) : null });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/projects/${id}`); message.success('删除成功'); fetchData(); }
    catch (err) { message.error(err?.response?.data?.message || err?.message || '删除失败'); }
  };

  const showDetail = async (record) => {
    setDetailRecord(record);
    setDrawerVisible(true);
    // 拉取更新日志
    try {
      const res = await api.get(`/projects/${record.id}/update-logs`);
      if (res.code === 0) setUpdateLogs(res.data);
    } catch (err) { /* ignore */ }
  };

  // 进度条点击就地更新
  const handleProgressClick = (item) => {
    if (!isDeptManager) return;
    setEditingProgressId(item.id);
    setEditingProgressValue(item.progress_pct);
  };

  const handleProgressSave = async (id) => {
    try {
      await api.put(`/projects/${id}/quick-update`, { progress_pct: editingProgressValue });
      message.success('进度更新成功');
      setEditingProgressId(null);
      fetchData();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || '更新失败');
    }
  };

  // 快速更新本周进展
  const handleQuickUpdate = async () => {
    if (!quickUpdateItem || !quickWeeklyProgress.trim()) return;
    try {
      await api.put(`/projects/${quickUpdateItem.id}/quick-update`, { weekly_progress: quickWeeklyProgress });
      message.success('本周进展更新成功');
      setQuickUpdateVisible(false);
      setQuickUpdateItem(null);
      setQuickWeeklyProgress('');
      fetchData();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || '更新失败');
    }
  };

  // 打开"今日更新"增强面板
  const openTodayUpdate = (item) => {
    setTodayUpdateItem(item);
    setTodayUpdateForm({
      weekly_progress: item.weekly_progress || '',
      progress_pct: item.progress_pct || 0,
      status: item.status || '进行中',
      risk_desc: item.risk_desc || '',
      next_week_focus: item.next_week_focus || '',
      next_action: item.next_action || item.block_reason || '',
    });
    setTodayUpdateVisible(true);
  };

  // 提交"今日更新"
  const handleTodayUpdate = async () => {
    if (!todayUpdateItem) return;
    try {
      await api.put(`/projects/${todayUpdateItem.id}/quick-update`, todayUpdateForm);
      message.success('更新成功');
      setTodayUpdateVisible(false);
      setTodayUpdateItem(null);
      fetchData();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || '更新失败');
    }
  };

  // ===== 看板视图 — 按状态分组 =====
  const renderKanbanView = () => {
    const columns = [
      { key: '未启动', label: '未启动', color: '#9CA3AF', bg: '#F9FAFB' },
      { key: '进行中', label: '进行中', color: '#3B5AFB', bg: '#EFF6FF' },
      { key: '合作中', label: '合作中', color: '#7C3AED', bg: '#F5F3FF' },
      { key: '风险', label: '风险', color: '#DC2626', bg: '#FEF2F2' },
      { key: '完成', label: '完成', color: '#16A34A', bg: '#F0FDF4' },
    ];
    return (
      <Row gutter={[12, 0]} style={{ overflowX: 'auto' }}>
        {columns.map(col => {
          const items = data.filter(p => p.status === col.key);
          return (
            <Col key={col.key} style={{ minWidth: 220, flex: '1 1 0' }}>
              <div style={{ background: col.bg, borderRadius: 10, padding: '12px 10px', minHeight: 300 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: col.color }}>{col.label}</span>
                  </div>
                  <Tag style={{ margin: 0, fontSize: 11 }}>{items.length}</Tag>
                </div>
                {items.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 24, color: '#C0C4CC', fontSize: 12 }}>暂无</div>
                ) : items.map(item => {
                  const sc = getStatusStyle(item.status);
                  return (
                    <Card
                      key={item.id}
                      className="surface-card"
                      style={{ marginBottom: 8, borderLeft: `3px solid ${sc.border}` }}
                      bodyStyle={{ padding: 12 }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span className="subtle-text" style={{ fontSize: 11 }}>👤 {item.owner_name}</span>
                        {item.priority && item.priority !== '中' && <Tag color={item.priority === '高' ? 'red' : 'default'} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>{item.priority}</Tag>}
                      </div>
                      <Progress percent={item.progress_pct} strokeColor={getProgressColor(item.progress_pct)} size="small" style={{ marginBottom: 4 }} />
                      {/* 闭环字段 */}
                      {(item.next_action || item.block_reason) && <div style={{ fontSize: 11, color: '#3B5AFB', marginTop: 4 }}>➡️ {item.next_action || item.block_reason}</div>}
                      {item.decision_needed && <Tag color="orange" style={{ fontSize: 10, margin: 0, marginTop: 4 }}>需决策</Tag>}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
                        <Tooltip title="查看"><EyeOutlined style={{ cursor: 'pointer', color: '#8C8C8C' }} onClick={() => showDetail(item)} /></Tooltip>
                        {isDeptManager && <Tooltip title="更新"><FormOutlined style={{ cursor: 'pointer', color: '#3B5AFB' }} onClick={() => openTodayUpdate(item)} /></Tooltip>}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </Col>
          );
        })}
      </Row>
    );
  };

  // ===== 卡片视图 — 统一展示本周+下周 =====
  const renderCardView = () => (
    <Row gutter={[16, 16]}>
      {data.length === 0 && (
        <Col span={24}>
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
            暂无数据
          </div>
        </Col>
      )}
      {data.map(item => {
        const sc = getStatusStyle(item.status);
        return (
          <Col xs={24} sm={12} lg={8} xl={6} key={item.id}>
            <Card
              className="surface-card hover-lift"
              style={{ borderLeft: `3px solid ${sc.border}`, height: '100%' }}
              bodyStyle={{ padding: 20 }}
              actions={[
                <Tooltip key="view" title="查看"><EyeOutlined onClick={() => showDetail(item)} /></Tooltip>,
                ...(isDeptManager ? [
                  <Tooltip key="today" title="今日更新"><FormOutlined onClick={() => openTodayUpdate(item)} /></Tooltip>,
                  ...(isMobile ? [
                    <Dropdown key="more" menu={{ items: [
                      { key: 'edit', label: '编辑', icon: <EditOutlined />, onClick: () => handleEdit(item) },
                      { key: 'del', label: '删除', icon: <DeleteOutlined style={{ color: '#DC2626' }} />, danger: true, onClick: () => { Modal.confirm({ title: '确认删除', content: `确定删除项目「${item.name}」？`, okType: 'danger', onOk: () => handleDelete(item.id) }); } }
                    ] }}>
                      <MoreOutlined />
                    </Dropdown>
                  ] : [
                    <Tooltip key="edit" title="编辑"><EditOutlined onClick={() => handleEdit(item)} /></Tooltip>,
                    <Popconfirm key="del" title="确定删除该项目？" onConfirm={() => handleDelete(item.id)} okType="danger"><DeleteOutlined style={{ color: '#DC2626', cursor: 'pointer' }} /></Popconfirm>
                  ])
                ] : [])
              ]}
            >
              {/* 项目名 + 类型 + 状态 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{ flex: 1, marginRight: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {item.type === '下周重点' && <Tag color="purple" style={{ fontSize: 11 }}>⚡ 下周</Tag>}
                  <Tag color={sc.tag}>{item.status}</Tag>
                </div>
              </div>

              {/* 负责人 + 截止 — 2个核心信息 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, fontSize: 13 }}>
                <span className="subtle-text">👤 {item.owner_name || '-'}</span>
                {item.due_date && (
                  <span className="subtle-text" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                    截止 {item.due_date}
                    {item.days_until_due !== undefined && (
                      <Tag color={item.days_until_due < 0 ? 'error' : item.days_until_due <= 3 ? 'warning' : 'default'} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0 }}>
                        {item.days_until_due < 0 ? `逾期${Math.abs(item.days_until_due)}天` : item.days_until_due === 0 ? '今天到期' : `剩${item.days_until_due}天`}
                      </Tag>
                    )}
                  </span>
                )}
              </div>

              {/* V4 闭环字段：优先级 + 需决策 */}
              {(item.priority !== '中' || item.decision_needed) && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  {item.priority && item.priority !== '中' && <Tag color={item.priority === '高' ? 'red' : 'default'} style={{ fontSize: 11, lineHeight: '16px', padding: '0 6px', margin: 0 }}>🔥 {item.priority}优先</Tag>}
                  {item.decision_needed && <Tag color="orange" style={{ fontSize: 11, lineHeight: '16px', padding: '0 6px', margin: 0 }}>⚡ 需决策</Tag>}
                </div>
              )}

              {/* 进度条 — 点击可就地编辑 */}
              {editingProgressId === item.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <InputNumber
                      min={0} max={100}
                      value={editingProgressValue}
                      onChange={(v) => setEditingProgressValue(v)}
                      size="small"
                      style={{ width: 70 }}
                      onPressEnter={() => handleProgressSave(item.id)}
                    />
                    <span style={{ fontSize: 12, color: '#6B7280' }}>%</span>
                    <Button type="link" size="small" onClick={() => handleProgressSave(item.id)}>保存</Button>
                    <Button type="link" size="small" onClick={() => setEditingProgressId(null)}>取消</Button>
                  </div>
                ) : (
                  <Tooltip title={isDeptManager ? '点击编辑进度' : ''}>
                    <div onClick={() => handleProgressClick(item)} style={{ cursor: isDeptManager ? 'pointer' : 'default' }}>
                      <Progress
                        percent={item.progress_pct}
                        strokeColor={getProgressColor(item.progress_pct)}
                        trailColor="#F1F5F9"
                        size="small"
                        style={{ marginBottom: 10 }}
                      />
                    </div>
                  </Tooltip>
                )}

              {/* 本周进展摘要 — 点击可快速更新 */}
              {item.weekly_progress && (
                <Tooltip title={isDeptManager ? '点击每日更新' : ''}>
                  <div
                    onClick={() => isDeptManager && openTodayUpdate(item)}
                    style={{ background: '#F5F7FB', padding: '6px 10px', borderRadius: 8, fontSize: 12, color: '#6B7280', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', cursor: isDeptManager ? 'pointer' : 'default' }}
                  >
                    📝 {item.weekly_progress}
                  </div>
                </Tooltip>
              )}
              {!item.weekly_progress && isDeptManager && (
                <Button type="dashed" size="small" block style={{ marginBottom: 8, fontSize: 12 }} onClick={() => openTodayUpdate(item)}>
                  + 补充进展
                </Button>
              )}

              {/* 下周重点工作摘要 */}
              {item.next_week_focus && (
                <div style={{ background: '#F0F4FF', padding: '6px 10px', borderRadius: 8, fontSize: 12, color: '#3B5AFB', marginBottom: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  📋 {item.next_week_focus}
                </div>
              )}

              {/* 目标 — 一行概括 */}
              {item.goal && (
                <div className="subtle-text" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  🎯 {item.goal}
                </div>
              )}

              {/* V4 闭环字段：下一步动作/待解决 */}
              {(item.next_action || item.block_reason) && (
                <div style={{ background: '#EFF6FF', padding: '6px 10px', borderRadius: 8, fontSize: 12, color: '#3B5AFB', marginTop: 8, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  ➡️ {item.next_action || item.block_reason}
                </div>
              )}

              {/* 底部时间标签行 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid #F1F5F9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {item.updated_at && (
                    <span className="subtle-text" style={{ fontSize: 11 }}>
                      🕐 {moment(item.updated_at).fromNow()}
                    </span>
                  )}
                  {/* 长期未更新提醒 — 替代纯"7天内到期"逻辑 */}
                  {item.updated_at && (() => {
                    const daysSince = moment().diff(moment(item.updated_at), 'days');
                    if (daysSince >= 14 && item.status !== '完成') return <Tag color="error" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>🚨 {daysSince}天未更新</Tag>;
                    if (daysSince >= 10 && item.status !== '完成') return <Tag color="orange" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>⚠ {daysSince}天未更新</Tag>;
                    if (daysSince >= 7 && item.status !== '完成') return <Tag color="default" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>💤 {daysSince}天未更新</Tag>;
                    return null;
                  })()}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {item.is_risk && <Tag color="error" style={{ margin: 0, fontSize: 11 }}><WarningOutlined /> 风险</Tag>}
                  {item.is_due_soon && !item.is_risk && <Tag color="warning" style={{ margin: 0, fontSize: 11 }}>⏰ 临期</Tag>}
                </div>
              </div>
            </Card>
          </Col>
        );
      })}
    </Row>
  );

  // ===== 表格视图 =====
  const columns = [
    { title: '部门', dataIndex: ['Department', 'name'], key: 'dept', width: 90 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 110, render: (t) => t === '下周重点' ? <Tag color="purple">⚡ 下周</Tag> : t },
    { title: '项目名称', dataIndex: 'name', key: 'name', width: 180 },
    { title: '负责人', dataIndex: 'owner_name', key: 'owner', width: 80 },
    { title: '进度', dataIndex: 'progress_pct', key: 'progress', width: 140, render: (pct) => <Progress percent={pct} strokeColor={getProgressColor(pct)} size="small" /> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (s) => <Tag color={getStatusStyle(s).tag}>{s}</Tag> },
    { title: '截止', dataIndex: 'due_date', key: 'due', width: 120, render: (due, r) => {
      if (!due) return '-';
      const daysLeft = r.days_until_due;
      const tag = daysLeft !== undefined
        ? <Tag color={daysLeft < 0 ? 'error' : daysLeft <= 3 ? 'warning' : 'default'} style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', marginLeft: 4 }}>
            {daysLeft < 0 ? `逾期${Math.abs(daysLeft)}天` : daysLeft === 0 ? '今天' : `剩${daysLeft}天`}
          </Tag>
        : null;
      return <span>{due}{tag}</span>;
    }},
    {
      title: '操作', key: 'action', width: 180, fixed: 'right',
      render: (_, r) => (
        <span>
          <Button type="link" icon={<EyeOutlined />} onClick={() => showDetail(r)}>详情</Button>
          {isDeptManager && <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>}
          {isDeptManager && <Popconfirm title={`确定删除该项目？`} onConfirm={() => handleDelete(r.id)} okType="danger"><Button type="link" danger icon={<DeleteOutlined />}>删除</Button></Popconfirm>}
        </span>
      )
    }
  ];

  return (
    <div className="app-page">
      <PageHeader
        title="项目推进"
        subtitle="项目数据的唯一维护入口 · 其他页面的项目信息均自动引用此处数据"
        extra={[
          <Select key="q" value={filters.quarter} onChange={(v) => setFilters({ ...filters, quarter: v })} style={{ width: 100 }}>
            <Option value="Q1">Q1</Option><Option value="Q2">Q2</Option><Option value="Q3">Q3</Option><Option value="Q4">Q4</Option>
          </Select>,
          <Select key="sort" value={sortMode} onChange={(v) => setSortMode(v)} style={{ width: 120 }}>
            <Option value="priority">管理优先级</Option>
            <Option value="time">更新时间</Option>
          </Select>,
          <Button
            key="view"
            icon={viewMode === 'card' ? <UnorderedListOutlined /> : viewMode === 'table' ? <ColumnWidthOutlined /> : <AppstoreOutlined />}
            onClick={() => setViewMode(viewMode === 'card' ? 'table' : viewMode === 'table' ? 'kanban' : 'card')}
          >
            {viewMode === 'card' ? '列表' : viewMode === 'table' ? '看板' : '卡片'}
          </Button>,
          isDeptManager && (
            <Button key="add" type="primary" icon={<PlusOutlined />} onClick={() => {
              setEditingRecord(null);
              form.resetFields();
              setModalVisible(true);
            }}>
              新增项目
            </Button>
          ),
        ]}
      />

      {viewMode === 'card' ? renderCardView() : viewMode === 'kanban' ? renderKanbanView() : (
        <PanelCard>
          <div className="ant-table-wrapper">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{columns.map(c => <th key={c.key} style={{ padding: '12px 8px', textAlign: 'left', borderBottom: '1px solid #EEF2F7', fontWeight: 600, fontSize: 13, color: '#334155' }}>{c.title}</th>)}</tr>
              </thead>
              <tbody>
                {data.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #EEF2F7' }}>
                    {columns.map(c => (
                      <td key={c.key} style={{ padding: '10px 8px', fontSize: 13 }}>
                        {c.render ? c.render(item[c.dataIndex], item) : (c.dataIndex instanceof Array ? item[c.dataIndex[0]]?.[c.dataIndex[1]] : item[c.dataIndex])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PanelCard>
      )}

      {/* 详情抽屉 */}
      <Drawer
        title={detailRecord?.name || '项目详情'}
        open={drawerVisible}
        onClose={() => { setDrawerVisible(false); setDetailRecord(null); }}
        width={560}
        extra={isDeptManager && detailRecord ? (
          <Button type="primary" icon={<EditOutlined />} onClick={() => { setDrawerVisible(false); handleEdit(detailRecord); }}>编辑</Button>
        ) : null}
      >
        {detailRecord && (
          <Tabs
            items={[
              {
                key: 'info',
                label: '项目信息',
                children: (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                      <Badge color={getStatusStyle(detailRecord.status).dot} />
                      <Tag color={getStatusStyle(detailRecord.status).tag} style={{ fontSize: 14, padding: '2px 12px' }}>{detailRecord.status}</Tag>
                      <Tag>{detailRecord.Department?.name}</Tag>
                      <span className="subtle-text">{detailRecord.owner_name}</span>
                    </div>
                    <Progress percent={detailRecord.progress_pct} strokeColor={getProgressColor(detailRecord.progress_pct)} style={{ marginBottom: 24 }} />
                    <Descriptions column={2} bordered size="small" labelStyle={{ fontWeight: 600, background: '#F8FAFC', color: '#334155' }}>
                      <Descriptions.Item label="项目类型" span={1}>{detailRecord.type}</Descriptions.Item>
                      <Descriptions.Item label="预计完成" span={1}>
                        {detailRecord.due_date || '-'}
                        {detailRecord.days_until_due !== undefined && (
                          <Tag color={detailRecord.days_until_due < 0 ? 'error' : detailRecord.days_until_due <= 3 ? 'warning' : 'default'} style={{ marginLeft: 8, fontSize: 11 }}>
                            {detailRecord.days_until_due < 0 ? `逾期${Math.abs(detailRecord.days_until_due)}天` : detailRecord.days_until_due === 0 ? '今天到期' : `剩${detailRecord.days_until_due}天`}
                          </Tag>
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label="工作目标" span={2}>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.goal || '-'}</div>
                      </Descriptions.Item>
                      <Descriptions.Item label={detailRecord.type === '下周重点' ? '计划/进展' : '本周进展'} span={2}>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.weekly_progress || '-'}</div>
                      </Descriptions.Item>
                      <Descriptions.Item label="下周重点工作" span={2}>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{detailRecord.next_week_focus || '-'}</div>
                      </Descriptions.Item>
                      <Descriptions.Item label="风险与问题" span={2}>
                        <div style={{ whiteSpace: 'pre-wrap', color: detailRecord.risk_desc ? '#DC2626' : '#9CA3AF' }}>
                          {detailRecord.risk_desc || '无'}
                        </div>
                      </Descriptions.Item>
                      {/* V4 闭环字段 */}
                      <Descriptions.Item label="优先级" span={1}>
                        <Tag color={detailRecord.priority === '高' ? 'red' : detailRecord.priority === '低' ? 'default' : 'blue'}>{detailRecord.priority || '中'}</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="需决策" span={1}>
                        <Tag color={detailRecord.decision_needed ? 'orange' : 'default'}>{detailRecord.decision_needed ? '是' : '否'}</Tag>
                      </Descriptions.Item>
                      {(detailRecord.next_action || detailRecord.block_reason) && (
                        <Descriptions.Item label="下一步/待解决" span={2}>
                          <div style={{ whiteSpace: 'pre-wrap', color: '#3B5AFB' }}>{detailRecord.next_action || detailRecord.block_reason}</div>
                        </Descriptions.Item>
                      )}
                      <Descriptions.Item label="上次更新" span={1}>
                        <span style={{ fontSize: 12, color: '#6B7280' }}>{detailRecord.updated_at ? moment(detailRecord.updated_at).fromNow() : '-'}</span>
                      </Descriptions.Item>
                      <Descriptions.Item label="状态标记" span={1}>
                        <span>
                          {detailRecord.is_risk && <Tag color="error" style={{ marginRight: 4 }}>🔴 风险</Tag>}
                          {detailRecord.is_due_soon && <Tag color="warning" style={{ marginRight: 4 }}>⏰ 临期</Tag>}
                          {detailRecord.severe_warning && <Tag color="error">⚠ 严重预警</Tag>}
                          {!detailRecord.is_risk && !detailRecord.is_due_soon && !detailRecord.severe_warning && <Tag>正常</Tag>}
                        </span>
                      </Descriptions.Item>
                    </Descriptions>
                  </div>
                )
              },
              {
                key: 'calendar',
                label: `更新日历${updateLogs.length > 0 ? ` (${updateLogs.length})` : ''}`,
                children: (
                  <div>
                    <Calendar
                      fullscreen={false}
                      dateCellRender={(date) => {
                        const dateStr = date.format('YYYY-MM-DD');
                        const hasLog = updateLogs.some(l => l.update_date === dateStr);
                        return hasLog ? <Badge dot color="#3B5AFB" style={{ position: 'absolute', top: 4, right: 4 }} /> : null;
                      }}
                      onSelect={(date) => {
                        const dateStr = date.format('YYYY-MM-DD');
                        const logs = updateLogs.filter(l => l.update_date === dateStr);
                        if (logs.length > 0) {
                          setSelectedDate(dateStr);
                          setSelectedDateLogs(logs);
                          setLogModalVisible(true);
                        }
                      }}
                    />
                  </div>
                )
              }
            ]}
          />
        )}
      </Drawer>

      {/* 编辑弹窗 */}
      <Modal
        title={editingRecord ? '编辑项目' : '新增项目'}
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => { setModalVisible(false); setEditingRecord(null); }}
        width={700}
      >
        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dept_id" label="部门" rules={[{ required: true }]} initialValue={1}>
                <DepartmentSelect />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="quarter" label="所属季度" rules={[{ required: true }]} initialValue={currentQuarter}>
                <Select><Option value="Q1">Q1</Option><Option value="Q2">Q2</Option><Option value="Q3">Q3</Option><Option value="Q4">Q4</Option></Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="type" label="项目类型" rules={[{ required: true }]}>
            <Select placeholder="选择类型">
              <Option value="新客拓展">新客拓展</Option>
              <Option value="渠道合作">渠道合作</Option>
              <Option value="产品迭代">产品迭代</Option>
              <Option value="运营优化">运营优化</Option>
              <Option value="下周重点">⚡ 下周重点</Option>
              <Option value="其他">其他</Option>
            </Select>
          </Form.Item>
          <Form.Item name="name" label="项目名称" rules={[{ required: true }]}>
            <Input placeholder="项目/工作名称" />
          </Form.Item>
          <Form.Item name="owner_name" label="负责人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="goal" label="工作目标"><TextArea rows={3} placeholder="预期达成的目标" /></Form.Item>
          <Form.Item name="weekly_progress" label="本周进展">
            <TextArea rows={3} placeholder="本周进展或计划" />
          </Form.Item>
          <Form.Item name="next_week_focus" label="下周重点工作">
            <TextArea rows={3} placeholder="下周计划推进的重点工作" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="progress_pct" label="进度%" initialValue={0}>
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="status" label="状态" initialValue="进行中">
                <Select>
                  <Option value="未启动">未启动</Option>
                  <Option value="进行中">进行中</Option>
                  <Option value="合作中">合作中</Option>
                  <Option value="风险">风险</Option>
                  <Option value="完成">完成</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="due_date" label="预计完成时间">
                  <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="risk_desc" label="风险与问题"><TextArea rows={3} /></Form.Item>

          {/* V4 闭环字段 */}
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="priority" label="优先级" initialValue="中">
                <Select>
                  <Option value="高">🔥 高</Option>
                  <Option value="中">中</Option>
                  <Option value="低">低</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="decision_needed" label="需决策" valuePropName="checked" initialValue={false}>
                <Switch checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="action_due_date" label="动作截止日">
                <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="next_action" label="下一步/待解决"><TextArea rows={2} placeholder="下一步要做什么、有什么阻塞..." /></Form.Item>
        </Form>
      </Modal>

      {/* ===== 今日更新 Drawer（增强版，支持进展+进度+状态+风险） ===== */}
      <Drawer
        title={todayUpdateItem ? `今日更新：${todayUpdateItem.name}` : '今日更新'}
        open={todayUpdateVisible}
        onClose={() => { setTodayUpdateVisible(false); setTodayUpdateItem(null); }}
        width={520}
        extra={<Button type="primary" onClick={handleTodayUpdate}>保存更新</Button>}
      >
        {todayUpdateItem && (
          <div>
            {/* 项目基本信息 */}
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Tag color={getStatusStyle(todayUpdateItem.status).tag}>{todayUpdateItem.status}</Tag>
              <Tag>{todayUpdateItem.Department?.name}</Tag>
              <span className="subtle-text">👤 {todayUpdateItem.owner_name}</span>
              {todayUpdateItem.due_date && (
                <span className="subtle-text" style={{ fontSize: 12 }}>截止 {todayUpdateItem.due_date}</span>
              )}
            </div>

            {/* 进度 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                📊 进度 <span className="subtle-text" style={{ fontWeight: 400, fontSize: 12 }}>当前 {todayUpdateForm.progress_pct}%</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Progress
                  percent={todayUpdateForm.progress_pct}
                  strokeColor={getProgressColor(todayUpdateForm.progress_pct)}
                  style={{ flex: 1 }}
                />
                <InputNumber
                  min={0} max={100}
                  value={todayUpdateForm.progress_pct}
                  onChange={(v) => setTodayUpdateForm({ ...todayUpdateForm, progress_pct: v })}
                  style={{ width: 72 }}
                />
                <span style={{ fontSize: 12, color: '#6B7280' }}>%</span>
              </div>
            </div>

            {/* 状态 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>🏷️ 状态</div>
              <Select
                value={todayUpdateForm.status}
                onChange={(v) => setTodayUpdateForm({ ...todayUpdateForm, status: v })}
                style={{ width: '100%' }}
              >
                <Option value="未启动">未启动</Option>
                <Option value="进行中">🚀 进行中</Option>
                <Option value="合作中">🤝 合作中</Option>
                <Option value="风险">🔴 风险</Option>
                <Option value="完成">✅ 完成</Option>
              </Select>
            </div>

            {/* 本周进展 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>📝 本周进展</div>
              <Input.TextArea
                rows={4}
                value={todayUpdateForm.weekly_progress}
                onChange={(e) => setTodayUpdateForm({ ...todayUpdateForm, weekly_progress: e.target.value })}
                placeholder="描述本周的进展、成果和关键节点..."
              />
            </div>

            {/* 风险与问题 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>⚠️ 风险与问题</div>
              <Input.TextArea
                rows={3}
                value={todayUpdateForm.risk_desc}
                onChange={(e) => setTodayUpdateForm({ ...todayUpdateForm, risk_desc: e.target.value })}
                placeholder="如有风险或阻塞，在此描述..."
              />
            </div>

            {/* 下周重点工作 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>📋 下周重点工作</div>
              <Input.TextArea
                rows={3}
                value={todayUpdateForm.next_week_focus || ''}
                onChange={(e) => setTodayUpdateForm({ ...todayUpdateForm, next_week_focus: e.target.value })}
                placeholder="下周计划推进的重点工作..."
              />
            </div>

            {/* V4 闭环字段 */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>➡️ 下一步/待解决</div>
              <Input.TextArea
                rows={2}
                value={todayUpdateForm.next_action || todayUpdateForm.block_reason || ''}
                onChange={(e) => setTodayUpdateForm({ ...todayUpdateForm, next_action: e.target.value, block_reason: '' })}
                placeholder="下一步要做什么、有什么阻塞..."
              />
            </div>

            {/* 同步选项 */}
            <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Checkbox
                  checked={!!todayUpdateForm.sync_to_monthly}
                  onChange={(e) => setTodayUpdateForm({ ...todayUpdateForm, sync_to_monthly: e.target.checked })}
                />
                <span style={{ fontSize: 13, color: '#334155' }}>同步进展到本月月度任务</span>
                <Tooltip title="开启后，本次进展内容将追加到该项目关联的月度任务「实际完成情况」中">
                  <QuestionCircleOutlined style={{ color: '#9CA3AF', cursor: 'help' }} />
                </Tooltip>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Checkbox
                  checked={!!todayUpdateForm.sync_to_achievement}
                  onChange={(e) => setTodayUpdateForm({ ...todayUpdateForm, sync_to_achievement: e.target.checked })}
                />
                <span style={{ fontSize: 13, color: '#334155' }}>同步进展到本季季度成果</span>
                <Tooltip title="开启后，本次进展内容将追加到该项目关联的季度成果「成果描述」中">
                  <QuestionCircleOutlined style={{ color: '#9CA3AF', cursor: 'help' }} />
                </Tooltip>
              </div>
            </div>

            {/* 工作目标（只读参考） */}
            {todayUpdateItem.goal && (
              <div style={{ background: '#F8FAFC', borderRadius: 8, padding: 12, fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: '#334155' }}>🎯 工作目标：</span>
                <span style={{ color: '#6B7280' }}>{todayUpdateItem.goal}</span>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* 日期更新记录弹卡 */}
      <Modal
        title={`${selectedDate} 更新记录`}
        open={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        footer={null}
        width={480}
      >
        {selectedDateLogs.length === 0 && <div style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>当日无更新记录</div>}
        {selectedDateLogs.map((log, idx) => (
          <div key={log.id} style={{ marginBottom: 16, padding: 16, background: '#F8FAFC', borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: '#334155', marginBottom: 8 }}>
              第 {idx + 1} 条更新 <span className="subtle-text" style={{ fontWeight: 400 }}>{moment(log.created_at).format('HH:mm')}</span>
            </div>
            {log.progress_content && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>📝 进展</div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{log.progress_content}</div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
              {log.status && <Tag color={getStatusStyle(log.status).tag}>{log.status}</Tag>}
              {log.progress_pct !== null && <Tag>进度 {log.progress_pct}%</Tag>}
              {log.risk_desc && <Tag color="error">风险</Tag>}
            </div>
            {log.risk_desc && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#DC2626', whiteSpace: 'pre-wrap' }}>{log.risk_desc}</div>
            )}
            {log.next_action && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#3B5AFB' }}>➡️ 下一步：{log.next_action}</div>
            )}
          </div>
        ))}
      </Modal>
    </div>
  );
}

export default ProjectPage;
