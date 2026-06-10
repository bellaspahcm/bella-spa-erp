'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, Table, FileJson, ChevronDown, Check, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface PremiumExportButtonProps {
  onExport?: (format: string) => void;
  className?: string;
}

export default function PremiumExportButton({ onExport, className }: PremiumExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const formats = [
    { id: 'excel', label: 'Excel (XLSX)', icon: Table, color: 'text-emerald-500', bg: 'bg-emerald-50' },
    { id: 'pdf', label: 'PDF Report', icon: FileText, color: 'text-rose-500', bg: 'bg-rose-50' },
    { id: 'csv', label: 'CSV Data', icon: FileJson, color: 'text-blue-500', bg: 'bg-blue-50' },
  ];

  const handleExport = (id: string, label: string) => {
    setExportingFormat(id);
    setIsOpen(false);
    
    // Simulate export
    setTimeout(() => {
      if (onExport) onExport(id);
      toast.success(`Đã chuẩn bị file ${label} thành công!`, {
        description: 'Vui lòng kiểm tra thư mục download của bạn.',
        icon: <Check className="w-4 h-4 text-emerald-500" />,
      });
      setExportingFormat(null);
    }, 1500);
  };

  return (
    <div className={`relative w-full min-w-0 sm:w-auto ${className ?? ''}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex w-full min-w-0 items-center justify-center gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-700 shadow-sm transition-all hover:border-rose-200 hover:shadow-md active:scale-95 sm:w-auto"
      >
        <Download className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
        <span className="text-sm font-black tracking-wide sm:tracking-widest">Xuất dữ liệu</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/5 backdrop-blur-[2px]"
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 z-50 mt-3 w-72 max-w-[calc(100vw-2rem)] origin-top-right overflow-hidden rounded-[32px] border border-white/40 bg-white/80 p-3 shadow-2xl shadow-slate-200/50 backdrop-blur-xl"
            >
              <div className="px-4 py-3 mb-2 border-b border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Định dạng file</p>
              </div>
              <div className="space-y-1">
                {formats.map((format) => (
                  <button
                    key={format.id}
                    onClick={() => handleExport(format.id, format.label)}
                    disabled={exportingFormat !== null}
                    className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-all group/item"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${format.bg} rounded-2xl flex items-center justify-center transition-transform group-hover/item:scale-110`}>
                        <format.icon className={`w-6 h-6 ${format.color}`} />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-800">{format.label}</p>
                        <p className="text-[10px] text-slate-400 font-medium italic">Tối ưu cho báo cáo</p>
                      </div>
                    </div>
                    {exportingFormat === format.id ? (
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover/item:text-slate-500 transition-colors" />
                    )}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
