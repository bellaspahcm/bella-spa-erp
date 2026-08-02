'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Search, Loader2, ChevronLeft, Download, Eye,
  BookOpen, Compass, ShieldAlert, Award, FileCode, CheckCircle
} from 'lucide-react';
import { getMyDocuments, WorkforceDocument } from '@/services/workforce-actions';
import { toast } from 'sonner';
import Link from 'next/link';

export default function DocumentsHub() {
  const [documents, setDocuments] = useState<WorkforceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const fetchDocs = useCallback(async () => {
    try {
      const data = await getMyDocuments();
      setDocuments(data);
    } catch (err) {
      console.error('[DocumentsHub] Fetch failed:', err);
      toast.error('Lỗi khi tải kho tài liệu');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const documentTypes = [
    { value: 'all', label: 'Tất cả' },
    { value: 'price_list', label: 'Bảng giá' },
    { value: 'brochure', label: 'Brochure' },
    { value: 'legal_docs', label: 'Pháp lý' },
    { value: 'bank_policy', label: 'Chính sách vay' },
    { value: 'faq', label: 'FAQs' },
    { value: 'training', label: 'Đào tạo' }
  ];

  // Filter docs
  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (doc.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || doc.document_type === selectedType;
    return matchesSearch && matchesType;
  });

  const getFormatSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'price_list': return <BookOpen className="w-5 h-5 text-emerald-500" />;
      case 'legal_docs': return <FileCode className="w-5 h-5 text-rose-500" />;
      case 'bank_policy': return <Compass className="w-5 h-5 text-sky-500" />;
      case 'faq': return <FileText className="w-5 h-5 text-amber-500" />;
      default: return <FileText className="w-5 h-5 text-indigo-500" />;
    }
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/workforce/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Kho Tài Liệu</h2>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 space-y-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm tài liệu, brochure, chính sách..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl py-3 pl-10 pr-4 text-xs outline-none focus:ring-1 focus:ring-primary"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </div>

        {/* Categories Tab Scrollable */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-200">
          {documentTypes.map(t => (
            <button
              key={t.value}
              onClick={() => setSelectedType(t.value)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${selectedType === t.value ? 'bg-primary border-primary text-white shadow-sm' : 'bg-slate-50 dark:bg-slate-850 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-850 hover:border-slate-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* DOCUMENT LIST */}
      <div className="p-5 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Đang tải kho tài liệu...</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-850">
            <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Không tìm thấy tài liệu</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocs.map(doc => (
              <div 
                key={doc.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl flex-shrink-0 mt-0.5">
                    {getTypeIcon(doc.document_type)}
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 leading-snug">{doc.title}</h4>
                    {doc.description && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{doc.description}</p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[9px] font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-700">
                        V{doc.version}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {getFormatSize(doc.file_size_bytes)}
                      </span>
                    </div>
                  </div>
                </div>

                <a 
                  href={doc.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2.5 bg-primary/10 text-primary hover:bg-primary/15 rounded-xl transition-all flex-shrink-0 self-center"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
