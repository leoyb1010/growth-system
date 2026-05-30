import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Descriptions, Form, Input, message, Modal, Row, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { ApiOutlined, DeleteOutlined, LinkOutlined, ReloadOutlined, RollbackOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';

const { Title, Paragraph, Text } = Typography;

const STATUS_COLORS = {
  received: 'default',
  parsed: 'blue',
  pending_confirm: 'orange',
  executed: 'green',
  ambiguous: 'gold',
  needs_clarification: 'purple',
  rejected: 'red',
  failed: 'red',
  pending: 'orange',
  reverted: 'magenta',
  expired: 'default',
};

function JsonPreview({ value }) {
  if (!value) return '-';
  return <pre style={{ maxWidth: 420, maxHeight: 160, overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(value, null, 2)}</pre>;
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
    { title: '来源', dataIndex: 'provider', width: 100, render: (v, r) => <span>{v}<br /><Text type="secondary">{r.external_username || r.external_user_id}</Text></span> },
    { title: '状态', dataIndex: 'status', width: 120, render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: '意图', dataIndex: 'parsed_intent', width: 150 },
    { title: '原始输入', dataIndex: 'raw_text', ellipsis: true },
    { title: '匹配结果', dataIndex: 'match_result', width: 260, render: v => <JsonPreview value={v} /> },
    { title: '错误', dataIndex: 'error_message', width: 180, ellipsis: true },
  ];

  const draftColumns = [
    { title: '时间', dataIndex: 'created_at', width: 170, render: v => new Date(v).toLocaleString('zh-CN') },
    { title: '状态', dataIndex: 'status', width: 110, render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: '操作', dataIndex: 'operation_type', width: 170 },
    { title: '目标', width: 110, render: (_, r) => r.target_type ? `${r.target_type}#${r.target_id}` : '-' },
    { title: '预览', dataIndex: 'preview_text', ellipsis: true },
    { title: '影响', dataIndex: 'Effects', width: 200, render: effects => (effects || []).map(e => <Tag key={e.id} color={e.reverted_at ? 'magenta' : 'blue'}>{e.table_name}#{e.record_id}{e.reverted_at ? ' 已撤销' : ''}</Tag>) },
    { title: '操作', width: 110, render: (_, r) => <Button size="small" danger icon={<RollbackOutlined />} disabled={r.status !== 'executed'} onClick={() => revertDraft(r.id)}>撤销</Button> },
  ];

  const identityColumns = [
    { title: '绑定时间', dataIndex: 'created_at', width: 170, render: v => new Date(v).toLocaleString('zh-CN') },
    { title: '系统用户', dataIndex: 'User', width: 120, render: u => u?.name || u?.username || '-' },
    { title: 'Provider', dataIndex: 'provider', width: 120 },
    { title: '外部用户', width: 180, render: (_, r) => r.external_username || r.external_user_id },
    { title: '状态', dataIndex: 'status', width: 100, render: v => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
    { title: '最近使用', dataIndex: 'last_used_at', width: 170, render: v => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    { title: '操作', width: 110, render: (_, r) => <Button size="small" danger icon={<DeleteOutlined />} disabled={r.status !== 'active'} onClick={() => disableIdentity(r.id)}>禁用</Button> },
  ];

  return (
    <div>
      <Title level={4}><ApiOutlined /> Agent 输入助手</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="我的 Agent 绑定" extra={<Button icon={<LinkOutlined />} loading={bindLoading} onClick={startBind}>生成绑定码</Button>}>
            <Paragraph>给 HermesAgent / OpenClaw / Telegram Agent 使用。复制绑定码到 skill/CLI 即可完成授权，Agent 只能使用你的系统权限提交业务输入。</Paragraph>
            {bindInfo && (
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="绑定码"><Text copyable strong>{bindInfo.code}</Text></Descriptions.Item>
                <Descriptions.Item label="有效期">{bindInfo.expires_in_minutes} 分钟</Descriptions.Item>
                <Descriptions.Item label="使用方式"><Text copyable>{bindInfo.usage}</Text></Descriptions.Item>
              </Descriptions>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="安全说明">
            <Space direction="vertical">
              <Text>• Agent 不具备改代码、部署、删除主数据、改权限能力。</Text>
              <Text>• 所有自然语言输入都会生成日志和草稿，确认后才写入。</Text>
              <Text>• 写错后可以从这里撤销：项目恢复快照，行动项取消，风险关闭。</Text>
              <Text type="secondary">当前账号：{user?.name || user?.username}</Text>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Select
            allowClear
            placeholder="请求状态"
            style={{ width: 180 }}
            value={filters.status}
            onChange={(v) => setFilters(f => ({ ...f, status: v }))}
            options={Object.keys(STATUS_COLORS).map(v => ({ value: v, label: v }))}
          />
          <Button icon={<ReloadOutlined />} onClick={refreshAll}>刷新</Button>
        </Space>
        <Tabs
          items={[
            { key: 'requests', label: '输入日志', children: <Table rowKey="id" size="small" loading={loading} columns={requestColumns} dataSource={requests} pagination={{ pageSize: 20 }} scroll={{ x: 'max-content' }} /> },
            { key: 'drafts', label: '操作草稿 / 回退', children: <Table rowKey="id" size="small" columns={draftColumns} dataSource={drafts} pagination={{ pageSize: 20 }} scroll={{ x: 'max-content' }} /> },
            { key: 'identities', label: 'Agent 绑定', children: <Table rowKey="id" size="small" columns={identityColumns} dataSource={identities} pagination={{ pageSize: 20 }} scroll={{ x: 'max-content' }} /> },
          ]}
        />
      </Card>
    </div>
  );
}

export default AgentAdminPage;
