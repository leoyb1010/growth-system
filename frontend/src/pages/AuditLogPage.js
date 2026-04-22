import React, { useState, useEffect } from 'react';
import { Table, Card, Tag, Select, Pagination, Space, Typography, Tooltip } from 'antd';
import { useAuth } from '../hooks/useAuth';
import { HistoryOutlined } from '@ant-design/icons';

const { Title } = Typography;

const ACTION_COLORS = {
  create: 'green',
  update: 'blue',
  delete: 'red'
};

const ACTION_LABELS = {
  create: '创建',
  update: '更新',
  delete: '删除'
};

const TABLE_LABELS = {
  kpis: '核心指标',
  projects: '重点工作',
  performances: '业务线业绩',
  monthly_tasks: '月度工作',
  achievements: '季度成果',
  quarter_archives: '季度归档',
  users: '用户管理'
};

function AuditLogPage() {
  const { api } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pageSize: 20 });
  const [filters, setFilters] = useState({ table_name: undefined, action: undefined });

  const fetchLogs = async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (filters.table_name) params.table_name = filters.table_name;
      if (filters.action) params.action = filters.action;

      const res = await api.get('/audit-logs', { params });
      if (res.code === 0) {
        setLogs(res.data.list);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('获取审计日志失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1, 20);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 180,
      render: (v) => new Date(v).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 80,
      render: (v) => <Tag color={ACTION_COLORS[v]}>{ACTION_LABELS[v]}</Tag>
    },
    {
      title: '模块',
      dataIndex: 'table_name',
      width: 120,
      render: (v) => TABLE_LABELS[v] || v
    },
    {
      title: '记录ID',
      dataIndex: 'record_id',
      width: 80
    },
    {
      title: '操作人',
      dataIndex: 'operator_name',
      width: 120
    },
    {
      title: '变更字段',
      dataIndex: 'changed_fields',
      ellipsis: true,
      render: (fields) => {
        if (!fields) return '-';
        const keys = Object.keys(fields);
        if (keys.length === 0) return '-';
        return (
          <Tooltip
            title={
              <div style={{ maxWidth: 400 }}>
                {keys.map(k => (
                  <div key={k} style={{ marginBottom: 4 }}>
                    <strong>{k}</strong>: {JSON.stringify(fields[k].old)} → {JSON.stringify(fields[k].new)}
                  </div>
                ))}
              </div>
            }
          >
            <span>{keys.slice(0, 3).join(', ')}{keys.length > 3 ? ` +${keys.length - 3}` : ''}</span>
          </Tooltip>
        );
      }
    }
  ];

  return (
    <div>
      <Title level={4}><HistoryOutlined /> 审计日志</Title>
      <Card style={{ marginTop: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="选择模块"
            allowClear
            style={{ width: 160 }}
            value={filters.table_name}
            onChange={(v) => setFilters(f => ({ ...f, table_name: v }))}
            options={Object.entries(TABLE_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Select
            placeholder="操作类型"
            allowClear
            style={{ width: 120 }}
            value={filters.action}
            onChange={(v) => setFilters(f => ({ ...f, action: v }))}
            options={[
              { value: 'create', label: '创建' },
              { value: 'update', label: '更新' },
              { value: 'delete', label: '删除' }
            ]}
          />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={logs}
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 'max-content' }}
        />
        <Pagination
          style={{ marginTop: 16, textAlign: 'right' }}
          current={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          showTotal={(t) => `共 ${t} 条`}
          onChange={(page, pageSize) => fetchLogs(page, pageSize)}
        />
      </Card>
    </div>
  );
}

export default AuditLogPage;
