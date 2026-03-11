import { useState } from 'react';

export default function Export() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');

  const handleExportCSV = async () => {
    setExporting(true);
    setMessage('');
    try {
      const filePath = await window.electronAPI.exportCSV(undefined, startDate || undefined, endDate || undefined);
      if (filePath) {
        setMessage(`✅ 导出成功: ${filePath}`);
      }
    } catch (error) {
      setMessage('❌ 导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    setMessage('');
    try {
      const filePath = await window.electronAPI.exportExcel(startDate || undefined, endDate || undefined);
      if (filePath) {
        setMessage(`✅ 导出成功: ${filePath}`);
      }
    } catch (error) {
      setMessage('❌ 导出失败');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    setMessage('');
    try {
      const filePath = await window.electronAPI.exportPDF(startDate || undefined, endDate || undefined);
      if (filePath) {
        setMessage(`✅ PDF导出成功: ${filePath}`);
      }
    } catch (error) {
      setMessage('❌ PDF导出失败');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-page">
      <div className="page-header">
        <h2>📤 数据导出</h2>
        <p className="page-subtitle">将您的财务数据导出为各种格式</p>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <div className="card-header">
          <h3 className="card-title">导出选项</h3>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Date Range */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label>开始日期</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>结束日期</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Export Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              className="btn-primary"
              onClick={handleExportCSV}
              disabled={exporting}
              style={{ justifyContent: 'center', padding: '12px' }}
            >
              📄 导出为 CSV (Excel可打开)
            </button>

            <button
              className="btn-secondary"
              onClick={handleExportExcel}
              disabled={exporting}
              style={{ justifyContent: 'center', padding: '12px' }}
            >
              📊 导出为 Excel
            </button>

            <button
              className="btn-secondary"
              onClick={handleExportPDF}
              disabled={exporting}
              style={{ justifyContent: 'center', padding: '12px' }}
            >
              📑 PDF报表
            </button>

            <button
              className="btn-secondary"
              disabled={true}
              style={{ justifyContent: 'center', padding: '12px', opacity: 0.5 }}
            >
              🖼️ 导出图表图片 (即将推出)
            </button>
          </div>

          {/* Message */}
          {message && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: message.includes('✅') ? '#D1FAE5' : '#FEE2E2',
              color: message.includes('✅') ? '#059669' : '#DC2626',
              borderRadius: '6px',
              fontSize: '14px'
            }}>
              {message}
            </div>
          )}

          {/* Info */}
          <div style={{
            marginTop: '24px',
            padding: '16px',
            background: '#F3F4F6',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#6B7280'
          }}>
            <h4 style={{ margin: '0 0 8px 0' }}>💡 导出说明</h4>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>CSV格式：通用格式，可用Excel、Numbers等打开</li>
              <li>Excel格式：保留样式和格式的原生Excel文件</li>
              <li>PDF报表：包含统计图表和交易明细的完整财务报告</li>
              <li>不选择日期范围将导出所有数据</li>
              <li>导出的文件保存路径可自定义选择</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Quick Export History - placeholder */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h3 className="card-title">最近导出</h3>
        </div>
        <div style={{ padding: '20px', textAlign: 'center', color: '#9CA3AF' }}>
          导出历史功能即将推出...
        </div>
      </div>
    </div>
  );
}
