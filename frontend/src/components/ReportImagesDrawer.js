import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Drawer, Select, Upload, Button, Image, Input, Switch, Popconfirm, Empty, Spin, message, Space, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, PictureOutlined } from '@ant-design/icons';
import { reportAssetApi, fileToUploadPayload } from '../services/reportAssetService';

/**
 * 周报配图抽屉
 * - 选择周报内的某个项目（或「整报封面」），上传/管理插图。
 * - 图注可编辑、可设是否进导出、可删除。
 * - 完全自包含，不侵入 WeeklyReportPage 的主渲染逻辑。
 */
export default function ReportImagesDrawer({ open, onClose, reportId, projects = [], onChanged }) {
  const [loading, setLoading] = useState(false);
  const [assets, setAssets] = useState([]);
  const [scope, setScope] = useState('cover'); // 'cover' 或 项目 id 字符串
  const [uploading, setUploading] = useState(false);

  const projectOptions = useMemo(() => {
    const opts = [{ label: '整报封面 / 通用图', value: 'cover' }];
    (projects || []).forEach((p) => {
      if (p && p.id != null) {
        opts.push({ label: `${p.dept_name ? p.dept_name + ' · ' : ''}${p.name || '未命名项目'}`, value: String(p.id) });
      }
    });
    return opts;
  }, [projects]);

  const load = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    try {
      const res = await reportAssetApi.list(reportId);
      setAssets(res.data?.data || []);
    } catch (e) {
      message.error('加载配图失败：' + (e?.response?.data?.message || e.message));
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const currentAssets = useMemo(() => {
    if (scope === 'cover') return assets.filter((a) => a.section === 'cover' || a.project_id == null);
    return assets.filter((a) => String(a.project_id) === String(scope));
  }, [assets, scope]);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const payload = await fileToUploadPayload(file);
      const body = {
        ...payload,
        section: scope === 'cover' ? 'cover' : 'project',
        project_id: scope === 'cover' ? null : Number(scope),
      };
      await reportAssetApi.upload(reportId, body);
      message.success('上传成功');
      await load();
      onChanged && onChanged();
    } catch (e) {
      message.error('上传失败：' + (e?.response?.data?.message || e.message));
    } finally {
      setUploading(false);
    }
    return false; // 阻止 antd 默认上传
  };

  const handleCaption = async (asset, caption) => {
    try {
      await reportAssetApi.update(reportId, asset.id, { caption });
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, caption } : a)));
    } catch (e) {
      message.error('保存图注失败');
    }
  };

  const handleToggleExport = async (asset, checked) => {
    try {
      await reportAssetApi.update(reportId, asset.id, { include_in_export: checked });
      setAssets((prev) => prev.map((a) => (a.id === asset.id ? { ...a, include_in_export: checked } : a)));
      onChanged && onChanged();
    } catch (e) {
      message.error('更新失败');
    }
  };

  const handleDelete = async (asset) => {
    try {
      await reportAssetApi.remove(reportId, asset.id);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      onChanged && onChanged();
      message.success('已删除');
    } catch (e) {
      message.error('删除失败');
    }
  };

  const apiBase = import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_API_URL || '';

  return (
    <Drawer
      title={<><PictureOutlined /> 周报配图</>}
      width={Math.min(720, typeof window !== 'undefined' ? window.innerWidth : 720)}
      open={open}
      onClose={onClose}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <div style={{ marginBottom: 6, color: '#6B7280', fontSize: 13 }}>选择要配图的位置</div>
          <Select
            style={{ width: '100%' }}
            value={scope}
            options={projectOptions}
            onChange={setScope}
            showSearch
            optionFilterProp="label"
          />
        </div>

        <Upload.Dragger
          accept="image/png,image/jpeg,image/webp,image/gif"
          showUploadList={false}
          beforeUpload={handleUpload}
          disabled={uploading || !reportId}
          multiple
        >
          <p style={{ margin: 0 }}>
            <PlusOutlined /> 点击或拖拽图片到此处上传
          </p>
          <p style={{ color: '#9CA3AF', fontSize: 12, margin: '6px 0 0' }}>
            支持 PNG/JPEG/WebP/GIF，自动压缩到合适尺寸，单图 ≤ 5MB
          </p>
        </Upload.Dragger>

        {uploading && <Spin tip="上传中…" />}

        <Spin spinning={loading}>
          {currentAssets.length === 0 ? (
            <Empty description="该位置暂无配图" />
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {currentAssets.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: 10,
                    border: '1px solid #EEF0F4',
                    borderRadius: 10,
                    background: a.include_in_export ? '#fff' : '#FAFAFA',
                  }}
                >
                  <Image
                    src={`${apiBase}/api${a.url.replace(/^\/api/, '')}`}
                    width={120}
                    height={90}
                    style={{ objectFit: 'cover', borderRadius: 6 }}
                    fallback="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iOTAiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNmMGYwZjAiLz48L3N2Zz4="
                  />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Input
                      size="small"
                      placeholder="图注（可选，导出时显示在图下方）"
                      defaultValue={a.caption || ''}
                      maxLength={200}
                      onBlur={(e) => handleCaption(a, e.target.value)}
                    />
                    <Space size="small" wrap>
                      <span style={{ fontSize: 12, color: '#9CA3AF' }}>
                        {a.width}×{a.height} · {Math.round((a.byte_size || 0) / 1024)}KB
                      </span>
                      <Tag color={a.include_in_export ? 'green' : 'default'} style={{ marginInlineEnd: 0 }}>
                        {a.include_in_export ? '进导出' : '不导出'}
                      </Tag>
                    </Space>
                    <Space>
                      <Switch
                        size="small"
                        checked={a.include_in_export}
                        onChange={(c) => handleToggleExport(a, c)}
                        checkedChildren="导出"
                        unCheckedChildren="隐藏"
                      />
                      <Popconfirm title="删除这张配图？" onConfirm={() => handleDelete(a)} okText="删除" cancelText="取消">
                        <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                      </Popconfirm>
                    </Space>
                  </div>
                </div>
              ))}
            </Space>
          )}
        </Spin>
      </Space>
    </Drawer>
  );
}
