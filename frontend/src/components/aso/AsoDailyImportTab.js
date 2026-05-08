import React, { useEffect, useState } from 'react';
import { Button, Card, message, Table, Tag, Space, Modal, Typography } from 'antd';
import { UploadOutlined, DownloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { asoApi } from '../../services/asoService';
import { useAuth } from '../../hooks/useAuth';
import { can } from '../../permissions/ability';

const { Text, Paragraph } = Typography;

function AsoDailyImportTab() {
  const { user } = useAuth();
  const role = user?.role || 'dept_staff';
  const asoRole = user?.aso_role;
  const canWrite = can(role, 'aso.write', null, asoRole);

  const [importResult, setImportResult] = useState(null);
  const [importPreview, setImportPreview] = useState([]);

  if (!canWrite) {
    return <Text type="secondary">当前账号无写入权限，仅管理员和运营可操作导入</Text>;
  }

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await asoApi.importDailyMetrics(fd);
        if (res.code !== 0) { message.error(res.message || '导入失败'); return; }

        const result = res.data || {};
        let preview = [];
        if (result.success > 0) {
          try {
            const previewRes = await asoApi.getDailyMetrics({ source: 'excel_import', pageSize: 50, page: 1 });
            if (previewRes.code === 0) preview = previewRes.data.rows || [];
          } catch {}
        }
        setImportPreview(preview);
        setImportResult(result);
        message.success(`导入完成：成功 ${result.success || 0} 条，跳过 ${result.skip || 0} 条`);
      } catch { message.error('导入失败'); }
    };
    input.click();
  };

  const handleDownloadTemplate = () => {
    const headers = ['日期', '产品', '关键词', '关键词类型', '搜索指数', '流行度', '初始排名', '昨日排名', '今日排名', '最高排名', '昨日量级', '今日量级', '消耗金额', '关键词状态'];
    const example = ['2026-05-08', '网易有道词典', '英文口语', '功能词', '4605', '3', '', '', '5', '3', '0', '60', '0', '权重较弱'];
    const csv = '﻿' + headers.join(',') + '\n' + example.join(',');
    const blob = new Blob([csv], { type: 'text/csv; charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ASO日报导入模板.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Paragraph type="secondary">
          <InfoCircleOutlined style={{ marginRight: 4 }} />
          支持导入标准 ASO 日报模板。系统会自动匹配产品和关键词，不存在时自动创建。同日同产品同关键词重复导入将更新数据并保留快照。
        </Paragraph>
        <Space>
          <Button type="primary" icon={<UploadOutlined />} onClick={handleImport}>上传 Excel 导入</Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>下载标准模板</Button>
        </Space>
      </Card>

      <Card size="small" title="导入模板说明">
        <Paragraph>
          模板包含以下列（必须保留列名）：<br />
          <Text code>日期, 产品, 关键词, 关键词类型, 搜索指数, 流行度, 初始排名, 昨日排名, 今日排名, 最高排名, 昨日量级, 今日量级, 消耗金额, 关键词状态</Text>
        </Paragraph>
        <Paragraph type="secondary">
          产品列填写产品名称（如"网易有道词典"）或产品编码；排名列支持"未覆盖"表示无排名；量级和金额为空时默认为0。
        </Paragraph>
      </Card>

      {importResult && (
        <Modal
          title={`导入复核 · 共 ${importResult.total || 0} 行（成功 ${importResult.success || 0} / 跳过 ${importResult.skip || 0}）`}
          open={!!importResult}
          onCancel={() => setImportResult(null)}
          footer={null}
          width={900}
        >
          {importResult.errors?.length > 0 && (
            <div style={{ marginBottom: 12, color: '#cf1322' }}>
              失败 {importResult.errors.length} 行：
              <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto', background: '#fff2f0', padding: 8, borderRadius: 4, fontSize: 12 }}>
                {importResult.errors.join('\n')}
              </pre>
            </div>
          )}
          {importPreview.length > 0 && (
            <>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>导入后明细预览</div>
              <Table dataSource={importPreview} rowKey="id" size="small" scroll={{ x: 900, y: 400 }} pagination={false}
                columns={[
                  { title: '日期', dataIndex: 'stat_date', width: 100 },
                  { title: '产品', dataIndex: ['product', 'name'], width: 100 },
                  { title: '关键词', dataIndex: ['keyword', 'keyword'], width: 100 },
                  { title: '今日排名', dataIndex: 'current_rank', width: 80 },
                  { title: '量级', dataIndex: 'today_volume', width: 70 },
                  { title: '标签', key: 'tag', width: 70, render: (_, r) => r.is_t3 ? <Tag color="green">T3</Tag> : r.is_t10 ? <Tag color="blue">T10</Tag> : '-' },
                ]}
              />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

export default AsoDailyImportTab;
