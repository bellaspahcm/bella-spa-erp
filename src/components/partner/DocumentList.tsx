'use client';

import { useState, useEffect } from 'react';
import { type DocumentCategory } from '@/lib/storage/partner-documents';

interface DocumentMetadata {
  filePath: string;
  fileUrl: string;
  category: DocumentCategory;
  metadata: {
    originalName: string;
    fileSize: number;
    mimeType: string;
    uploadedAt: string;
    description?: string;
  };
  signedUrl?: string;
}

interface DocumentListProps {
  applicationId: string;
  onDelete?: (filePath: string) => void;
  refreshTrigger?: number;
}

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  business_license: 'Giấy phép kinh doanh',
  tax_certificate: 'Giấy chứng nhận thuế',
  id_card: 'CMND/CCCD',
  bank_document: 'Tài liệu ngân hàng',
  other: 'Khác',
};

const FILE_ICONS: Record<string, string> = {
  'application/pdf': '📄',
  'image/jpeg': '🖼️',
  'image/jpg': '🖼️',
  'image/png': '🖼️',
  'image/webp': '🖼️',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DocumentList({
  applicationId,
  onDelete,
  refreshTrigger,
}: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  
  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/partner/documents/${applicationId}`);
      const data = await response.json();
      
      if (data.success) {
        setDocuments(data.documents);
      } else {
        setError(data.error || 'Lỗi tải documents');
      }
    } catch (err) {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchDocuments();
  }, [applicationId, refreshTrigger]);
  
  const handleDelete = async (filePath: string) => {
    if (!confirm('Bạn có chắc muốn xóa tài liệu này?')) return;
    
    setDeletingPath(filePath);
    
    try {
      const response = await fetch(
        `/api/partner/documents/${applicationId}?filePath=${encodeURIComponent(filePath)}`,
        { method: 'DELETE' }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setDocuments(docs => docs.filter(d => d.filePath !== filePath));
        onDelete?.(filePath);
      } else {
        alert(data.error || 'Lỗi xóa document');
      }
    } catch (err) {
      alert('Lỗi kết nối');
    } finally {
      setDeletingPath(null);
    }
  };
  
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-rose-600 border-t-transparent"></div>
        <p className="mt-2 text-sm text-gray-600">Đang tải documents...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }
  
  if (documents.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-md border-2 border-dashed border-gray-300">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-600">Chưa có tài liệu nào</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {documents.map((doc) => {
        const icon = FILE_ICONS[doc.metadata.mimeType] || '📎';
        const isDeleting = deletingPath === doc.filePath;
        
        return (
          <div
            key={doc.filePath}
            className="flex items-start gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow"
          >
            <div className="text-3xl">{icon}</div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {doc.metadata.originalName}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {CATEGORY_LABELS[doc.category]} • {formatFileSize(doc.metadata.fileSize)}
                  </p>
                  {doc.metadata.description && (
                    <p className="text-xs text-gray-600 mt-1">{doc.metadata.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Uploaded: {formatDate(doc.metadata.uploadedAt)}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {doc.signedUrl && (
                    <a
                      href={doc.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors font-medium"
                    >
                      Xem
                    </a>
                  )}
                  
                  <button
                    onClick={() => handleDelete(doc.filePath)}
                    disabled={isDeleting}
                    className="text-xs px-3 py-1.5 bg-red-50 text-red-700 rounded hover:bg-red-100 transition-colors font-medium disabled:opacity-50"
                  >
                    {isDeleting ? 'Đang xóa...' : 'Xóa'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
