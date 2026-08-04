/**
 * Partner Portal - Documents Library Module
 * Thư viện tài liệu bán hàng (Sales Kit)
 */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/services/user-actions';
import { fetchPartnerDocuments, downloadDocument } from '@/services/partner-actions';

type DocumentCategory = 
  | 'brochure'
  | 'price_list'
  | 'legal'
  | 'sales_kit'
  | 'media'
  | 'policy';

interface Document {
  id: string;
  title: string;
  category: DocumentCategory;
  file_type: string;
  file_size: number;
  file_url: string;
  description: string | null;
  uploaded_at: string;
  project_name?: string;
}

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  brochure: '📖 Brochure',
  price_list: '💰 Bảng giá',
  legal: '📜 Pháp lý',
  sales_kit: '🎯 Sales Kit',
  media: '🎬 Media',
  policy: '📋 Chính sách',
};

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  brochure: 'bg-blue-100 text-blue-700',
  price_list: 'bg-green-100 text-green-700',
  legal: 'bg-purple-100 text-purple-700',
  sales_kit: 'bg-orange-100 text-orange-700',
  media: 'bg-pink-100 text-pink-700',
  policy: 'bg-yellow-100 text-yellow-700',
};

export default function PartnerDocumentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await fetchPartnerDocuments();
      setDocuments(data);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const user = await getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      await loadDocuments();
    };
    void loadUser();
  }, [router]);

  const handleDownload = async (doc: Document) => {
    try {
      setDownloading(doc.id);
      await downloadDocument(doc.file_url, doc.title);
    } catch (error) {
      console.error('Failed to download document:', error);
      alert('Tải tài liệu thất bại. Vui lòng thử lại.');
    } finally {
      setDownloading(null);
    }
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.project_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900 mb-3">Thư Viện Tài Liệu</h1>

          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm kiếm tài liệu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex overflow-x-auto px-4 py-2 gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tất cả
          </button>
          {(Object.keys(CATEGORY_LABELS) as DocumentCategory[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
                selectedCategory === cat
                  ? CATEGORY_COLORS[cat]
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Documents List */}
      <div className="p-4 space-y-4">
        {filteredDocuments.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-gray-500">
              {searchQuery
                ? 'Không tìm thấy tài liệu phù hợp'
                : selectedCategory === 'all'
                ? 'Chưa có tài liệu nào'
                : `Chưa có tài liệu ${CATEGORY_LABELS[selectedCategory as DocumentCategory]}`}
            </p>
          </div>
        ) : (
          filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              {/* Document Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{doc.title}</h3>
                  {doc.project_name && (
                    <p className="text-sm text-gray-600">Dự án: {doc.project_name}</p>
                  )}
                </div>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${CATEGORY_COLORS[doc.category]} whitespace-nowrap ml-2`}>
                  {CATEGORY_LABELS[doc.category].replace(/[^\w\s]/gi, '').trim()}
                </span>
              </div>

              {/* Description */}
              {doc.description && (
                <p className="text-sm text-gray-600 mb-3">{doc.description}</p>
              )}

              {/* File Info */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span>
                  {doc.file_type.toUpperCase()} • {formatFileSize(doc.file_size)}
                </span>
                <span>{new Date(doc.uploaded_at).toLocaleDateString('vi-VN')}</span>
              </div>

              {/* Download Button */}
              <button
                onClick={() => void handleDownload(doc)}
                disabled={downloading === doc.id}
                className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {downloading === doc.id ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Đang tải...</span>
                  </>
                ) : (
                  <>
                    <span>⬇️</span>
                    <span>Tải xuống</span>
                  </>
                )}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
