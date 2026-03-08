import { useEffect, useState } from 'react';
import { SourceId, SOURCES, getSourceName } from '../../shared/sources';

interface CoverageData {
  source: string;
  month: string;
  count: number;
}

interface LastImportData {
  source: string;
  lastDate: string | null;
}

// Source-specific import hints
const SOURCE_IMPORT_HINTS: Record<SourceId, string> = {
  alipay: '访问支付宝网页版 → 交易记录 → 下载账单',
  wechat: '打开微信 → 我 → 服务 → 钱包 → 账单 → 下载',
  yunshanfu: '打开云闪付APP → 我的 → 账单 → 导出',
  bank: '登录网银 → 账户管理 → 交易明细 → 导出',
  manual: '在"快速记账"页面手动添加现金交易',
};

// Source-specific icons (emoji mapping)
const SOURCE_ICONS: Record<SourceId, string> = {
  alipay: '🔵',
  wechat: '🟢',
  yunshanfu: '🔴',
  bank: '🏦',
  manual: '✏️',
};

export default function SourceCoverage() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [coverage, setCoverage] = useState<CoverageData[]>([]);
  const [lastImports, setLastImports] = useState<LastImportData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ source: SourceId; month: string } | null>(null);
  const [showConfirmZero, setShowConfirmZero] = useState(false);

  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [coverageData, lastImportData] = await Promise.all([
        window.electronAPI.getSourceCoverage(year),
        window.electronAPI.getLastImportBySource(),
      ]);
      setCoverage(coverageData);
      setLastImports(lastImportData);
    } catch (error) {
      console.error('Failed to load source coverage:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate months for the selected year
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    return `${year}-${month.toString().padStart(2, '0')}`;
  }).reverse(); // Most recent first

  // Get count for a specific source and month
  const getCount = (sourceId: string, month: string): number | null => {
    const item = coverage.find(c => c.source === sourceId && c.month === month);
    return item ? item.count : null;
  };

  // Check if a month is the current month
  const isCurrentMonth = (month: string): boolean => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    return month === currentMonth;
  };

  // Check if a month is in the future
  const isFutureMonth = (month: string): boolean => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    return month > currentMonth;
  };

  // Get freshness indicator
  const getFreshness = (sourceId: string): { days: number; status: 'fresh' | 'stale' | 'missing' } => {
    const lastImport = lastImports.find(li => li.source === sourceId);
    if (!lastImport?.lastDate) {
      return { days: Infinity, status: 'missing' };
    }

    const lastDate = new Date(lastImport.lastDate);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff <= 7) return { days: daysDiff, status: 'fresh' };
    if (daysDiff <= 30) return { days: daysDiff, status: 'stale' };
    return { days: daysDiff, status: 'missing' };
  };

  const handleCellClick = (sourceId: SourceId, month: string) => {
    if (isFutureMonth(month)) return;

    const count = getCount(sourceId, month);
    if (count === null) {
      // Show options for NA cells
      setSelectedCell({ source: sourceId, month });
    } else {
      // Navigate to transactions with source and month filter
      window.location.hash = `#transactions?source=${sourceId}&from=${month}-01&to=${month}-31`;
    }
  };

  const handleImportClick = () => {
    if (selectedCell) {
      window.location.hash = `#import?source=${selectedCell.source}&month=${selectedCell.month}`;
      setSelectedCell(null);
    }
  };

  const handleMarkZeroClick = async () => {
    if (selectedCell) {
      // In a real implementation, this would call an IPC method to mark as zero
      // For now, we just show a confirmation
      setShowConfirmZero(true);
    }
  };

  const confirmMarkZero = () => {
    // TODO: Implement actual mark as zero functionality
    // This would require a new database table to track explicit "no data" months
    alert(`已将 ${selectedCell?.month} 的 ${getSourceName(selectedCell?.source as SourceId)} 标记为无数据`);
    setShowConfirmZero(false);
    setSelectedCell(null);
  };

  if (loading) {
    return (
      <div className="source-coverage">
        <div className="loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className="source-coverage">
      <div className="coverage-header">
        <h2>📅 数据收集状态</h2>
        <div className="year-selector">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 5 }, (_, i) => {
              const y = new Date().getFullYear() - i;
              return (
                <option key={y} value={y}>
                  {y}年
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div className="coverage-summary">
        {SOURCES.map((source) => {
          const freshness = getFreshness(source.id);
          return (
            <div key={source.id} className={`source-status ${freshness.status}`}>
              <span className="source-name">{source.name}</span>
              {freshness.status === 'missing' ? (
                <span className="status-badge missing">未导入</span>
              ) : (
                <span className={`status-badge ${freshness.status}`}>
                  {freshness.days === 0 ? '今天' : `${freshness.days}天前`}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="coverage-grid-container">
        <table className="coverage-grid">
          <thead>
            <tr>
              <th className="source-col">来源</th>
              {months.map((month) => (
                <th key={month} className={isCurrentMonth(month) ? 'current-month' : ''}>
                  {month.slice(5)}月
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SOURCES.map((source) => (
              <tr key={source.id}>
                <td className="source-name-cell">
                  <div className="source-info">
                    <span className="source-icon">{SOURCE_ICONS[source.id]}</span>
                    <span className="source-label">{source.name}</span>
                  </div>
                </td>
                {months.map((month) => {
                  const count = getCount(source.id, month);
                  const isCurrent = isCurrentMonth(month);
                  const isFuture = isFutureMonth(month);
                  const cellClass = [
                    'coverage-cell',
                    count === null ? 'na' : 'has-data',
                    isCurrent ? 'current' : '',
                    count === 0 ? 'zero' : '',
                    isFuture ? 'future' : '',
                  ].join(' ');

                  return (
                    <td
                      key={month}
                      className={cellClass}
                      onClick={() => !isFuture && handleCellClick(source.id, month)}
                      title={isFuture ? '未来月份' : count === null ? '点击导入或标记' : `${count} 条交易，点击查看详情`}
                    >
                      {isFuture ? (
                        <span className="future-marker">-</span>
                      ) : count === null ? (
                        <span className="na-marker">NA</span>
                      ) : (
                        <span className="count">
                          {count}
                          {isCurrent && <span className="current-marker">~</span>}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="coverage-legend">
        <div className="legend-item">
          <span className="legend-cell has-data">123</span>
          <span>已导入（数字为交易数）</span>
        </div>
        <div className="legend-item">
          <span className="legend-cell na">NA</span>
          <span>未导入（点击选择）</span>
        </div>
        <div className="legend-item">
          <span className="legend-cell current">45~</span>
          <span>当前月份（进行中）</span>
        </div>
        <div className="legend-item">
          <span className="legend-cell future">-</span>
          <span>未来月份</span>
        </div>
      </div>

      {/* Action Modal for NA cells */}
      {selectedCell && !showConfirmZero && (
        <div className="modal-overlay" onClick={() => setSelectedCell(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>
              {SOURCE_ICONS[selectedCell.source]} {getSourceName(selectedCell.source)} - {selectedCell.month}
            </h3>
            <p className="import-hint">💡 {SOURCE_IMPORT_HINTS[selectedCell.source]}</p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleImportClick}>
                📥 去导入
              </button>
              <button className="btn btn-secondary" onClick={handleMarkZeroClick}>
                ✓ 标记为无数据
              </button>
              <button className="btn btn-text" onClick={() => setSelectedCell(null)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Zero Modal */}
      {showConfirmZero && selectedCell && (
        <div className="modal-overlay" onClick={() => setShowConfirmZero(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>确认标记为无数据</h3>
            <p>
              确定 {selectedCell.month} 月份<br />
              <strong>{getSourceName(selectedCell.source)}</strong> 没有交易记录吗？
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={confirmMarkZero}>
                确认标记
              </button>
              <button className="btn btn-text" onClick={() => setShowConfirmZero(false)}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="coverage-tips">
        <h4>💡 提示</h4>
        <ul>
          <li>点击 <strong>NA</strong> 单元格可选择导入或标记为无数据</li>
          <li>点击数字单元格可查看该月份的交易明细</li>
          <li>建议每月定期导入各平台账单，保持数据完整</li>
        </ul>
      </div>
    </div>
  );
}
