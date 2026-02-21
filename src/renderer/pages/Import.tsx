import { DragEvent, useMemo, useState } from 'react';

type Source = 'alipay' | 'wechat' | 'yunshanfu' | 'bank';

type ImportResult = {
  importId: string | null;
  parsedCount: number;
  inserted: number;
  exactMerged: number;
  fuzzyFlagged: number;
  errors: string[];
  preview: Array<{
    date: string;
    type: string;
    amount: number;
    counterparty?: string;
    description?: string;
    category?: string;
  }>;
};

const SOURCE_LABELS: Record<Source, string> = {
  alipay: '支付宝',
  wechat: '微信',
  yunshanfu: '云闪付',
  bank: '银行账单',
};

function getFileName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const chunks = normalized.split('/');
  return chunks[chunks.length - 1] || filePath;
}

function getFileExt(filePath: string): string {
  const matched = filePath.toLowerCase().match(/\.([a-z0-9]+)$/);
  return matched ? `.${matched[1]}` : '';
}

export default function Import() {
  const [source, setSource] = useState<Source>('alipay');
  const [filePath, setFilePath] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [parseStatus, setParseStatus] = useState('');
  const [message, setMessage] = useState('');
  const [previewResult, setPreviewResult] = useState<ImportResult | null>(null);

  const canImport = useMemo(
    () => Boolean(filePath) && !importing && !previewLoading && (previewResult?.parsedCount || 0) > 0,
    [filePath, importing, previewLoading, previewResult]
  );

  const loadPreview = async (nextPath: string, nextSource: Source) => {
    setPreviewLoading(true);
    setMessage('');
    const ext = getFileExt(nextPath);
    if (ext === '.png') {
      setParseStatus('正在 OCR 识别图片账单，可能需要较长时间...');
    } else if (ext === '.pdf') {
      setParseStatus('正在解析 PDF 账单...');
    } else if (ext === '.html' || ext === '.htm') {
      setParseStatus('正在解析 HTML 账单...');
    } else if (ext === '.xlsx') {
      setParseStatus('正在解析 Excel 账单...');
    } else {
      setParseStatus('正在解析 CSV...');
    }
    try {
      const result = await window.electronAPI.importCSV(nextPath, nextSource, { dryRun: true, previewLimit: 5 });
      setPreviewResult(result);
      if (result.errors.length > 0) {
        setMessage(`解析失败: ${result.errors.join('; ')}`);
      }
    } catch (error) {
      setPreviewResult(null);
      setMessage(`解析失败: ${String(error)}`);
    } finally {
      setPreviewLoading(false);
      setParseStatus('');
    }
  };

  const handleChooseFile = async () => {
    if (importing || previewLoading) return;

    const selectedPath = await window.electronAPI.selectFile([
      { name: '账单文件', extensions: ['csv', 'xlsx', 'pdf', 'html', 'png'] },
      { name: 'CSV Files', extensions: ['csv'] },
      { name: 'Excel Files', extensions: ['xlsx'] },
      { name: 'PDF Files', extensions: ['pdf'] },
      { name: 'HTML Files', extensions: ['html'] },
      { name: 'Image Files', extensions: ['png'] },
    ]);
    if (!selectedPath) return;

    setFilePath(selectedPath);
    setFileName(getFileName(selectedPath));
    await loadPreview(selectedPath, source);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (importing || previewLoading) return;

    const file = event.dataTransfer.files?.[0] as (File & { path?: string }) | undefined;
    if (!file?.path) {
      setMessage('无法获取拖拽文件路径，请使用文件选择按钮');
      return;
    }

    setFilePath(file.path);
    setFileName(getFileName(file.path));
    await loadPreview(file.path, source);
  };

  const handleSourceChange = async (nextSource: Source) => {
    setSource(nextSource);
    if (filePath) {
      await loadPreview(filePath, nextSource);
    }
  };

  const handleImport = async () => {
    if (!canImport) return;

    setImporting(true);
    setMessage('');
    try {
      const result = await window.electronAPI.importCSV(filePath, source);
      setPreviewResult(result);
      if (result.errors.length > 0) {
        setMessage(`导入失败: ${result.errors.join('; ')}`);
      } else {
        setMessage(`导入完成：解析 ${result.parsedCount} 条，新增 ${result.inserted} 条，自动合并 ${result.exactMerged} 条，待确认重复 ${result.fuzzyFlagged} 条`);
      }
    } catch (error) {
      setMessage(`导入失败: ${String(error)}`);
    } finally {
      setImporting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const exportedPath = await window.electronAPI.exportCSV();
      if (exportedPath) setMessage(`CSV 导出成功: ${exportedPath}`);
    } catch (error) {
      setMessage(`CSV 导出失败: ${String(error)}`);
    }
  };

  const handleExportExcel = async () => {
    try {
      const exportedPath = await window.electronAPI.exportExcel();
      if (exportedPath) setMessage(`Excel 导出成功: ${exportedPath}`);
    } catch (error) {
      setMessage(`Excel 导出失败: ${String(error)}`);
    }
  };

  const handleBackup = async () => {
    try {
      const backupPath = await window.electronAPI.backupDatabase();
      if (backupPath) setMessage(`数据库备份成功: ${backupPath}`);
    } catch (error) {
      setMessage(`数据库备份失败: ${String(error)}`);
    }
  };

  return (
    <div className="import">
      <h2>导入账单</h2>

      <div className="import-controls">
        <label>
          数据源：
          <select value={source} onChange={(event) => handleSourceChange(event.target.value as Source)} disabled={importing || previewLoading}>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <button onClick={handleChooseFile} disabled={importing || previewLoading} className="btn-primary">
          选择账单文件
        </button>
      </div>

      <div
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <p>拖拽账单文件到此处</p>
        <p className="dropzone-tip">支持 .csv / .xlsx / .pdf / .html / .png</p>
        <p className="dropzone-tip">当前来源：{SOURCE_LABELS[source]}</p>
      </div>

      {filePath && (
        <div className="import-selected-file">
          <strong>已选文件：</strong>
          <span>{fileName}</span>
        </div>
      )}

      <div className="import-buttons">
        <button onClick={handleImport} disabled={!canImport} className="btn-primary">
          {importing ? '导入中...' : '开始导入'}
        </button>
      </div>

      {previewLoading && <div className="message">{parseStatus || '正在解析账单...'}</div>}

      {previewResult && (
        <div className="preview-card">
          <h3>解析结果</h3>
          <p>总条数：{previewResult.parsedCount}</p>
          {previewResult.preview.length > 0 ? (
            <table className="table preview-table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>类型</th>
                  <th>金额</th>
                  <th>交易对方</th>
                  <th>说明</th>
                </tr>
              </thead>
              <tbody>
                {previewResult.preview.map((item, index) => (
                  <tr key={`${item.date}-${item.amount}-${index}`}>
                    <td>{item.date}</td>
                    <td>{item.type}</td>
                    <td>{item.amount.toFixed(2)}</td>
                    <td>{item.counterparty || '-'}</td>
                    <td>{item.description || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>暂无可预览记录</p>
          )}
        </div>
      )}

      <h2>导出与备份</h2>
      <div className="import-buttons">
        <button onClick={handleExportCSV} className="btn-secondary">
          导出 CSV
        </button>
        <button onClick={handleExportExcel} className="btn-secondary">
          导出 Excel (.xlsx)
        </button>
        <button onClick={handleBackup} className="btn-secondary">
          备份数据库
        </button>
      </div>

      {message && <div className="message">{message}</div>}
    </div>
  );
}
