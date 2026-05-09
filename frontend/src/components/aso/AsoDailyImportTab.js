import React, { useEffect, useState } from 'react';
import { Button, Card, message, Table, Tag, Space, Modal, Typography, Select } from 'antd';
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
  const [products, setProducts] = useState([]);
  const [selProductId, setSelProductId] = useState(null);
  const [delayedResult, setDelayedResult] = useState(null);

  useEffect(() => {
    asoApi.getProducts().then(res => { if (res.code === 0) setProducts(res.data || []); }).catch(() => {});
  }, []);

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
      if (selProductId) fd.append('default_product_id', selProductId);
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

        if ((result.success || 0) === 0) {
          setDelayedResult(result);
          return;
        }
        message.success(`导入完成：成功 ${result.success || 0} 条，跳过 ${result.skip || 0} 条`);
      } catch { message.error('导入失败'); }
    };
    input.click();
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await asoApi.downloadDailyTemplate();
      const url = window.URL.createObjectURL(new Blob([res]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ASO日报导入模板.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch { message.error('模板下载失败'); }
  };

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Paragraph type="secondary">
          <InfoCircleOutlined style={{ marginRight: 4 }} />
          支持导入标准 ASO 日报模板。系统会自动匹配产品和关键词，不存在时自动创建。同日同产品同关键词重复导入将更新数据并保留快照。
        </Paragraph>
        <Space wrap>
          <div>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>默认产品（Excel无产品列时使用）</div>
            <Select placeholder="无产品列时用此产品兜底" allowClear value={selProductId} onChange={setSelProductId} style={{ width: 220 }}>
              {products.map(p => <Select.Option key={p.id} value={p.id}>{p.name}</Select.Option>)}
            </Select>
          </div>
          <Button type="primary" icon={<UploadOutlined />} onClick={handleImport}>上传 Excel 导入</Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>下载标准模板</Button>
        </Space>
      </Card>

      {/* 导入失败提示 */}
      <Modal
        title="导入未写入任何数据"
        open={!!delayedResult}
        onCancel={() => setDelayedResult(null)}
        footer={<Button onClick={() => setDelayedResult(null)}>知道了</Button>}
      >
        <Paragraph>
          本次导入<strong>成功 0 条</strong>，跳过 {delayedResult?.skip || 0} 条。可能原因：
        </Paragraph>
        <ul style={{ paddingLeft: 20 }}>
          <li>Excel 中缺少产品列 — 请在上方选择"默认产品"后重新导入</li>
          <li>缺少关键词列 — 模板需包含"关键词"列</li>
          <li>缺少日期列 — 模板需包含"日期"列</li>
          <li>缺少排名列 — 模板需包含"今日排名"或"当前排名"列</li>
        </ul>
        {delayedResult?.errors?.length > 0 && (
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 150, overflow: 'auto', background: '#fff2f0', padding: 8, borderRadius: 4, fontSize: 12 }}>
            {delayedResult.errors.slice(0, 15).join('\n')}
          </pre>
        )}
      </Modal>

      <Card size="small" title="导入模板说明">
        <Paragraph>
          模板包含以下列（第一行为表头，系统自动扫描匹配）：<br />
          <Text code>日期, 分类, 关键词, 关键词状态, 搜索指数, 流行度, 初始排名, 昨日量级, 今日计划量级, 实际完成量级, 昨日排名, 今日排名, 波动情况, 消耗金额, 分类榜排名</Text>
        </Paragraph>
        <Paragraph type="secondary">
          <strong>必须先在上方选择产品</strong>。量级和金额为空时默认为0。排名支持"未覆盖"。系统根据提供的标准模版自动匹配相关信息。
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
