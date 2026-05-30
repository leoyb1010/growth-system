import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Empty, message, Modal, Row, Select, Space, Steps, Table, Tabs, Tag, Typography } from 'antd';
import { ApiOutlined, CheckCircleOutlined, DeleteOutlined, LinkOutlined, ReloadOutlined, RollbackOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';

const { Title, Paragraph, Text } = Typography;

const STATUS_META = {
  received: { color: 'default', label: '已接收' },
  parsed: { color: 'blue', label: '已识别' },
  pending_confirm: { color: 'orange', label: '待确认' },
  executed: { color: 'green', label: '已写入' },
  ambiguous: { color: 'gold', label: '需选择项目' },
  needs_clarification: { color: 'purple', label: '需补充信息' },
  rejected: { color: 'red', label: '已拒绝' },
  failed: { color: 'red', label: '失败' },
  pending: { color: 'orange', label: '待确认' },
  reverted: { color: 'magenta', label: '已撤销' },
  expired: { color: 'default', label: '已过期' },
};

const INTENT_LABELS = {
  'project.quick_update': '项目进展',
  'action_item.create': '创建行动项',
  'risk_register.create': '记录风险',
  query: '查询记录',
};

const OPERATION_LABELS = INTENT_LABELS;

function StatusTag({ value }) {
  const meta = STATUS_META[value] || { color: 'default', label: value || '-' };
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function IntentTag({ value }) {
  return value ? <Tag color="blue">{INTENT_LABELS[value] || value}</Tag> : '-';
}

function MatchSummary({ value }) {
  if (!value) return '-';
  if (value.status === 'matched' && value.candidates?.[0]) {
    const c = value.candidates[0];
    return <span>命中「{c.name}」<Text type="secondary">（置信度 {Math.round((c.confidence || 0) * 100)}%）</Text></span>;
  }
  if (value.status === 'ambiguous') {
    return <Space direction="vertical" size={2}>{(value.candidates || []).slice(0, 3).map(c => <Tag key={c.id} color="gold">{c.name} {Math.round((c.confidence || 0) * 100)}%</Tag>)}</Space>;
  }
  if (value.message) return <Text type="secondary">{value.message}</Text>;
  return '-';
}

function PayloadSummary({ value }) {
  if (!value) return '-';
  const items = [];
  if (value.weekly_progress) items.push(['进展', value.weekly_progress]);
  if (value.progress_pct !== undefined) items.push(['进度', `${value.progress_pct}%`]);
  if (value.status) items.push(['状态', value.status]);
  if (value.risk_desc !== undefined) items.push(['风险', value.risk_desc || '暂无']);
  if (value.next_action) items.push(['下一步', value.next_action]);
  if (value.title) items.push(['标题', value.title]);
  if (value.priority) items.push(['优先级', value.priority]);
  if (value.due_date) items.push(['截止', value.due_date]);
  if (!items.length) return '-';
  return <Space direction="vertical" size={2}>{items.map(([k, v]) => <span key={k}><Text type="secondary">{k}：</Text>{String(v)}</span>)}</Space>;
}

function AgentAdminPage() {
  const { api, user } = useAuth();
  const [bindLoading, setBindLoading] = useState(false);
  const [bindInfo, setBindInfo] = useState(null);
  const [requests, setRequests] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [identities, setIdentities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ status: undefined });

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get('/agent/requests', { params: { pageSize: 50, status: filters.status } });
      if (res.code === 0) setRequests(res.data.data || []);
    } catch (err) {
      message.error(err.message || '获取 Agent 请求失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDrafts = async () => {
    try {
      const res = await api.get('/agent/drafts', { params: { pageSize: 50 } });
      if (res.code === 0) setDrafts(res.data.data || []);
    } catch (err) {
      message.error(err.message || '获取 Agent 草稿失败');
    }
  };

  const fetchIdentities = async () => {
    try {
      const res = await api.get('/agent/identities');
      if (res.code === 0) setIdentities(res.data || []);
    } catch (err) {
      message.error(err.message || '获取 Agent 绑定失败');
    }
  };

  const refreshAll = () => {
    fetchRequests();
    fetchDrafts();
    fetchIdentities();
  };

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status]);

  const startBind = async () => {
    setBindLoading(true);
    try {
      const res = await api.post('/agent/bind/start');
      if (res.code === 0) {
        setBindInfo(res.data);
        message.success('绑定码已生成');
      }
    } catch (err) {
      message.error(err.message || '生成绑定码失败');
    } finally {
      setBindLoading(false);
    }
  };

  const disableIdentity = async (id) => {
    Modal.confirm({
      title: '确认禁用这个 Agent 绑定？',
      content: '禁用后，该外部 Agent 用户将无法继续提交业务输入。',
      onOk: async () => {
        await api.post(`/agent/identities/${id}/disable`);
        message.success('已禁用绑定');
        fetchIdentities();
      }
    });
  };

  const revertDraft = async (id) => {
    Modal.confirm({
      title: '确认撤销这次 Agent 输入？',
      content: '项目更新将按执行前快照恢复；行动项会取消；风险会关闭。此操作会写入审计日志。',
      okText: '确认撤销',
      okButtonProps: { danger: true },
      onOk: async () => {
        await api.post(`/agent/drafts/${id}/revert`);
        message.success('已撤销');
        refreshAll();
      }
    });
  };

  const requestColumns = [
    { title: '时间', dataIndex: 'created_at', width: 170, render: v => new Date(v).toLocaleString('zh-CN') },
    { title: '用户', dataIndex: 'User', width: 120, render: u => u?.name || u?.username || '-' },
    { title: '来源', dataIndex: 'provider', width: 120, render: (v, r) => <span>{v}<br /><Text type="secondary">{r.external_username || r.external_user_id}</Text></span> },
    { title: '状态', dataIndex: 'status', width: 120, render: v => <StatusTag value={v} /> },
    { title: '类型', dataIndex: 'parsed_intent', width: 120, render: v => <IntentTag value={v} /> },
    { title: '用户输入', dataIndex: 'raw_text', ellipsis: true },
    { title: '识别内容', dataIndex: 'parsed_payload', width: 260, render: v => <PayloadSummary value={v} /> },
    { title: '项目匹配', dataIndex: 'match_result', width: 260, render: v => <MatchSummary value={v} /> },
    { title: '提示', dataIndex: 'error_message', width: 180, ellipsis: true },
  ];

  const draftColumns = [
    { title: '时间', dataIndex: 'created_at', width: 170, render: v => new Date(v).toLocaleString('zh-CN') },
    { title: '状态', dataIndex: 'status', width: 110, render: v => <StatusTag value={v} /> },
    { title: '操作类型', dataIndex: 'operation_type', width: 130, render: v => OPERATION_LABELS[v] || v },
    { title: '目标', width: 110, render: (_, r) => r.target_type ? `${r.target_type}#${r.target_id}` : '-' },
    { title: '确认预览', dataIndex: 'preview_text', ellipsis: true },
    { title: '写入影响', dataIndex: 'Effects', width: 220, render: effects => (effects || []).length ? (effects || []).map(e => <Tag key={e.id} color={e.reverted_at ? 'magenta' : 'blue'}>{e.table_name}#{e.record_id}{e.reverted_at ? ' 已撤销' : ''}</Tag>) : '-' },
    { title: '操作', width: 110, render: (_, r) => <Button size="small" danger icon={<RollbackOutlined />} disabled={r.status !== 'executed'} onClick={() => revertDraft(r.id)}>撤销</Button> },
  ];

  const identityColumns = [
    { title: '绑定时间', dataIndex: 'created_at', width: 170, render: v => new Date(v).toLocaleString('zh-CN') },
    { title: '系统用户', dataIndex: 'User', width: 120, render: u => u?.name || u?.username || '-' },
    { title: 'Agent 类型', dataIndex: 'provider', width: 120 },
    { title: '外部用户', width: 180, render: (_, r) => r.external_username || r.external_user_id },
    { title: '状态', dataIndex: 'status', width: 100, render: v => <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? '已启用' : '已禁用'}</Tag> },
    { title: '最近使用', dataIndex: 'last_used_at', width: 170, render: v => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '操作', width: 110, render: (_, r) => <Button size="small" danger icon={<DeleteOutlined />} disabled={r.status !== 'active'} onClick={() => disableIdentity(r.id)}>禁用</Button> },
  ];

  const hermesPrompt = `绑定码：${bindInfo?.code || '<先点击生成绑定码>'}\n系统地址：https://leoyuan.top\n账号：${user?.username || user?.name || '我的账号'}\n请调用 POST https://leoyuan.top/api/agent/bind/complete 完成绑定：\n{\n  "code": "${bindInfo?.code || '<绑定码>'}",\n  "provider": "hermesagent",\n  "external_user_id": "${user?.username || 'user'}-hermesagent",\n  "external_username": "${user?.username || user?.name || 'user'}"\n}\n绑定后保存 agent_token。之后我说业务进展时，调用 /api/agent/inbound；如果我在对话里已经确认项目和内容，可以带 execute_confirmed=true 直接写入非敏感新增进展。涉及进度百分比或状态修改时，必须让我二次确认。`;

  const openclawPrompt = hermesPrompt.replaceAll('hermesagent', 'openclaw').replaceAll('-hermesagent', '-openclaw');

  return (
    <div>
      <Title level={4}><ApiOutlined /> Agent 输入助手</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="我的 Agent 绑定" extra={<Button icon={<LinkOutlined />} loading={bindLoading} onClick={startBind}>生成绑定码</Button>}>
            <Paragraph>给 HermesAgent / OpenClaw / Telegram Agent 使用。普通用户只需要复制绑定码或下面的配置 Prompt。Agent 只能使用你的系统权限提交业务输入。</Paragraph>
            {bindInfo && (
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="绑定码"><Text copyable strong>{bindInfo.code}</Text></Descriptions.Item>
                <Descriptions.Item label="有效期">{bindInfo.expires_in_minutes} 分钟</Descriptions.Item>
                <Descriptions.Item label="推荐输入"><Text copyable>{bindInfo.usage}</Text></Descriptions.Item>
                <Descriptions.Item label="高级输入"><Text copyable>{bindInfo.advanced_usage}</Text></Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="第一次如何配置进自己的 Agent">
            <Steps size="small" direction="vertical" current={bindInfo ? 1 : 0} items={[
              { title: '生成绑定码', description: '点击左侧按钮，得到 6 位绑定码。' },
              { title: '复制配置 Prompt', description: '把下面 Hermes 或 OpenClaw 的配置 Prompt 发给你的 Agent。' },
              { title: '开始自然语言输入', description: '例如：更新词库项目，今天新增竞品词整理进展，无风险。' },
            ]} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }} title="一键复制配置 Prompt">
        {!bindInfo && <Alert type="info" showIcon message="请先生成绑定码，再复制下面 Prompt。" style={{ marginBottom: 12 }} />}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card size="small" title="HermesAgent">
              <Paragraph><Text copyable={{ text: hermesPrompt }}>{hermesPrompt}</Text></Paragraph>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card size="small" title="OpenClaw">
              <Paragraph><Text copyable={{ text: openclawPrompt }}>{openclawPrompt}</Text></Paragraph>
            </Card>
          </Col>
        </Row>
      </Card>

      <Card style={{ marginTop: 16 }} title="安全说明">
        <Space direction="vertical">
          <Text>• 默认以“新增进展”为主，不覆盖项目历史内容。</Text>
          <Text>• 涉及进度百分比或状态修改属于敏感操作，需要二次确认。</Text>
          <Text>• Agent 不具备改代码、部署、删除主数据、改权限能力。</Text>
          <Text>• 写错后可以从这里撤销：项目恢复快照，行动项取消，风险关闭。</Text>
          <Text type="secondary">当前账号：{user?.name || user?.username}</Text>
        </Space>
      </Card>

      <Card style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Select
            allowClear
            placeholder="状态筛选"
            style={{ width: 180 }}
            value={filters.status}
            onChange={(v) => setFilters(f => ({ ...f, status: v }))}
            options={Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))}
          />
          <Button icon={<ReloadOutlined />} onClick={refreshAll}>刷新</Button>
        </Space>
        <Tabs
          items={[
            { key: 'requests', label: '输入日志', children: requests.length ? <Table rowKey="id" size="small" loading={loading} columns={requestColumns} dataSource={requests} pagination={{ pageSize: 20 }} scroll={{ x: 'max-content' }} /> : <Empty description="暂无输入日志" /> },
            { key: 'drafts', label: '写入记录 / 回退', children: drafts.length ? <Table rowKey="id" size="small" columns={draftColumns} dataSource={drafts} pagination={{ pageSize: 20 }} scroll={{ x: 'max-content' }} /> : <Empty description="暂无写入记录" /> },
            { key: 'identities', label: 'Agent 绑定', children: identities.length ? <Table rowKey="id" size="small" columns={identityColumns} dataSource={identities} pagination={{ pageSize: 20 }} scroll={{ x: 'max-content' }} /> : <Empty description="暂无绑定" /> },
          ]}
        />
      </Card>
    </div>
  );
}

export default AgentAdminPage;
