import { useState, useEffect, useCallback } from 'react';
import type { ReceiptWithTransaction, ReceiptQuery, Transaction } from '../shared/types';

interface ReceiptUploadState {
  isUploading: boolean;
  progress: number;
  status: string;
}

interface UploadResult {
  receipt: ReceiptWithTransaction;
  extracted: {
    amount?: number;
    date?: string;
    merchant?: string;
    confidence: number;
    items?: Array<{ name: string; quantity?: number; price?: number }>;
  };
  suggestedTransactions: Transaction[];
}

export function Receipts() {
  const [receipts, setReceipts] = useState<ReceiptWithTransaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [uploadState, setUploadState] = useState<ReceiptUploadState>({
    isUploading: false,
    progress: 0,
    status: '',
  });
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptWithTransaction | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const pageSize = 20;

  const loadReceipts = useCallback(async () => {
    const query: ReceiptQuery = {
      q: searchQuery || undefined,
      page: currentPage,
      pageSize,
    };

    const result = await window.electronAPI.searchReceipts(query);
    setReceipts(result.items);
    setTotalCount(result.total);
  }, [searchQuery, currentPage]);

  useEffect(() => {
    loadReceipts();
  }, [loadReceipts]);

  const handleSelectFile = async () => {
    const filePath = await window.electronAPI.selectReceiptFile();
    if (!filePath) return;

    setUploadState({ isUploading: true, progress: 0, status: 'Starting upload...' });
    setUploadResult(null);

    try {
      const fileName = filePath.split('/').pop() || 'receipt.jpg';
      const result = await window.electronAPI.uploadReceipt(filePath, fileName);
      setUploadResult(result);
      loadReceipts();
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadState(prev => ({ ...prev, status: 'Upload failed', isUploading: false }));
    } finally {
      setUploadState(prev => ({ ...prev, isUploading: false }));
    }
  };

  const handleLinkReceipt = async (receiptId: string, transactionId: string | null) => {
    await window.electronAPI.linkReceipt(receiptId, transactionId);
    loadReceipts();
    if (selectedReceipt?.id === receiptId) {
      setSelectedReceipt(null);
    }
  };

  const handleDeleteReceipt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this receipt?')) return;
    await window.electronAPI.deleteReceipt(id);
    loadReceipts();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const formatAmount = (amount?: number) => {
    if (amount === undefined) return '-';
    return `¥${amount.toFixed(2)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Receipts</h1>
        <button
          onClick={handleSelectFile}
          disabled={uploadState.isUploading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {uploadState.isUploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Receipt
            </>
          )}
        </button>
      </div>

      {/* Upload Progress */}
      {uploadState.isUploading && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">{uploadState.status}</span>
            <span className="text-sm text-blue-700">{Math.round(uploadState.progress * 100)}%</span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadState.progress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload Result - Suggested Matches */}
      {uploadResult && !uploadState.isUploading && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2">Receipt Uploaded Successfully</h3>
          <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
            <div>
              <span className="text-gray-600">Amount:</span>{' '}
              <span className="font-medium">{formatAmount(uploadResult.extracted.amount)}</span>
            </div>
            <div>
              <span className="text-gray-600">Date:</span>{' '}
              <span className="font-medium">{uploadResult.extracted.date || '-'}</span>
            </div>
            <div>
              <span className="text-gray-600">Merchant:</span>{' '}
              <span className="font-medium">{uploadResult.extracted.merchant || '-'}</span>
            </div>
          </div>

          {uploadResult.suggestedTransactions.length > 0 && (
            <div>
              <p className="text-sm text-gray-700 mb-2">Suggested matching transactions:</p>
              <div className="space-y-2">
                {uploadResult.suggestedTransactions.slice(0, 3).map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between bg-white p-3 rounded border border-green-200"
                  >
                    <div className="text-sm">
                      <span className="font-medium">{formatDate(txn.date)}</span>
                      <span className="mx-2">·</span>
                      <span>{txn.counterparty || txn.description}</span>
                      <span className="mx-2">·</span>
                      <span className="font-medium text-red-600">¥{Math.abs(txn.amount).toFixed(2)}</span>
                    </div>
                    <button
                      onClick={() => handleLinkReceipt(uploadResult.receipt.id, txn.id)}
                      className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      Link
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setUploadResult(null)}
            className="mt-3 text-sm text-green-700 hover:text-green-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search receipts by merchant, items, or text..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <svg
          className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Receipts Grid */}
      {receipts.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No receipts yet</h3>
          <p className="text-gray-500">Upload your first receipt to get started</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedReceipt(receipt)}
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-gray-100 flex items-center justify-center">
                  {receipt.thumbnail_path ? (
                    <img
                      src={`file://${receipt.thumbnail_path}`}
                      alt="Receipt"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {receipt.merchant_detected || 'Unknown Merchant'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {receipt.date_detected ? formatDate(receipt.date_detected) : formatDate(receipt.created_at)}
                      </p>
                    </div>
                    <span className="font-semibold text-gray-900">
                      {formatAmount(receipt.amount_detected)}
                    </span>
                  </div>

                  {receipt.transaction && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Linked to transaction
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalCount > pageSize && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage * pageSize >= totalCount}
                  className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Receipt Detail Modal */}
      {selectedReceipt && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedReceipt(null)}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Receipt Details</h2>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Image */}
              <div className="bg-gray-100 rounded-lg overflow-hidden">
                <img
                  src={`file://${selectedReceipt.file_path}`}
                  alt="Receipt"
                  className="w-full h-full object-contain max-h-[60vh]"
                />
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">Extracted Information</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Amount:</span>
                      <span className="font-medium">{formatAmount(selectedReceipt.amount_detected)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium">{selectedReceipt.date_detected || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Merchant:</span>
                      <span className="font-medium">{selectedReceipt.merchant_detected || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">OCR Confidence:</span>
                      <span className="font-medium">
                        {selectedReceipt.ocr_confidence
                          ? `${(selectedReceipt.ocr_confidence * 100).toFixed(0)}%`
                          : '-'}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedReceipt.transaction ? (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Linked Transaction</h3>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{selectedReceipt.transaction.counterparty}</span>
                        <span className="text-red-600 font-semibold">
                          ¥{Math.abs(selectedReceipt.transaction.amount).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{formatDate(selectedReceipt.transaction.date)}</p>
                      <button
                        onClick={() => handleLinkReceipt(selectedReceipt.id, null)}
                        className="mt-2 text-sm text-red-600 hover:text-red-800"
                      >
                        Unlink transaction
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Link to Transaction</h3>
                    <p className="text-sm text-gray-600 mb-2">This receipt is not linked to any transaction.</p>
                  </div>
                )}

                {selectedReceipt.ocr_text && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">OCR Text</h3>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 max-h-40 overflow-auto">
                      <pre className="whitespace-pre-wrap">{selectedReceipt.ocr_text}</pre>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleDeleteReceipt(selectedReceipt.id)}
                  className="w-full py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  Delete Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
