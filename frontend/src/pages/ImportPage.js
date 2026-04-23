import React, { useState } from 'react';
import { Upload, Button, message, Card, Table, Alert } from 'antd';
import { UploadOutlined, ImportOutlined } from '@ant-design/icons';
import { api } from '../hooks/useAuth';

function ImportPage() {
  const [fileList, setFileList] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const props = {
    onRemove: () => {
      setFileList([]);
      setResult(null);
    },
    beforeUpload: (file) => {
      const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                      file.type === 'application/vnd.ms-excel';
      if (!isExcel) {
        message.error('请上传 Excel 文件 (.xlsx 或 .xls)');
        return Upload.LIST_IGNORE;
      }
      setFileList([file]);
      return false; // 阻止自动上传
    },
    fileList,
  };

  const handleImport = async () => {
    if (fileList.length === 0) {
      message.error('请先选择文件');
      return;
    }

    setImporting(true);
    const formData = new FormData();
    formData.append('file', fileList[0]);

    try {
      const res = await api.post('/import/excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.code === 0) {
        setResult(res.data);
        const totalImported = (res.data.sheets || []).reduce((sum, s) => sum + s.imported, 0);
        const totalSkipped = (res.data.skipped || []).length;
        const totalErrors = (res.data.errors || []).length;
        if (totalImported === 0 && totalSkipped > 0) {
          message.warning(`未识别到有效数据，${totalSkipped} 个 Sheet 被跳过，请检查 Sheet 名称`);
        } else if (totalImported === 0) {
          message.warning('未导入任何数据，请检查文件格式');
        } else {
          message.success(`导入完成：${totalImported} 条数据，${totalSkipped} 个 Sheet 跳过，${totalErrors} 个错误`);
        }
      } else {
        message.error(res.message || '导入失败');
      }
    } catch (err) {
      message.error('导入失败: ' + (err.message || '未知错误'));
    } finally {
      setImporting(false);
    }
  };

  const resultColumns = [
    { title: 'Sheet 名称', dataIndex: 'name', key: 'name' },
    { title: '导入记录数', dataIndex: 'imported', key: 'imported' }
  ];

  return (
    <div>
      <h2>数据导入</h2>
      <p style={{ color: '#8c8c8c' }}>上传现有的"部门追踪总表.xlsx"，系统将自动识别并导入 5 个模块的数据。</p>

      <Alert
        message="导入说明"
        description={
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>支持 .xlsx 和 .xls 格式</li>
            <li>Sheet 名称需包含对应模块关键词（如"核心指标"、"重点工作"等）</li>
            <li>第一行为表头，第二行起为数据</li>
            <li>部门列请使用系统中已有的部门名称</li>
            <li>导入前建议先备份现有数据</li>
          </ul>
        }
        type="info"
        style={{ marginBottom: 24 }}
      />

      <Card style={{ marginBottom: 24 }}>
        <Upload {...props}>
          <Button icon={<UploadOutlined />}>选择 Excel 文件</Button>
        </Upload>
        <Button
          type="primary"
          icon={<ImportOutlined />}
          onClick={handleImport}
          loading={importing}
          disabled={fileList.length === 0}
          style={{ marginTop: 16 }}
        >
          开始导入
        </Button>
      </Card>

      {result && (
        <Card title="导入结果">
          {result.sheets?.length > 0 ? (
            <Table dataSource={result.sheets} columns={resultColumns} rowKey="name" pagination={false} scroll={{ x: 'max-content' }} />
          ) : (
            <Alert message="未导入任何数据" description="系统未识别到可导入的 Sheet，请检查文件中的 Sheet 名称是否包含对应关键词（如“核心指标”、“重点工作”等）" type="warning" showIcon />
          )}
          {result.skipped?.length > 0 && (
            <Alert
              message="未识别的 Sheet"
              description={
                <ul>
                  {result.skipped.map((s, i) => (
                    <li key={i}>{s.sheet}（{s.reason}）</li>
                  ))}
                </ul>
              }
              type="info"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
          {result.errors?.length > 0 && (
            <Alert
              message="导入异常"
              description={
                <ul>
                  {result.errors.map((e, i) => (
                    <li key={i}>{e.sheet}: {e.error}</li>
                  ))}
                </ul>
              }
              type="error"
              showIcon
              style={{ marginTop: 16 }}
            />
          )}
        </Card>
      )}
    </div>
  );
}

export default ImportPage;
