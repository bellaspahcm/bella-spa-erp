import { motion } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import type { FormEvent } from 'react';
import type { HqTenantRecord } from '@/types/domain';

interface HqClearingRateModalProps {
  tenant: HqTenantRecord | null;
  rate: string;
  submitting: boolean;
  onClose: () => void;
  onRateChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export function HqClearingRateModal({
  tenant,
  rate,
  submitting,
  onClose,
  onRateChange,
  onSubmit,
}: HqClearingRateModalProps) {
  if (!tenant) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden text-left"
      >
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center">
          <div>
            <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">CẤU HÌNH ĐỐI SOÁT LIỆU TRÌNH</span>
            <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[320px]">{tenant.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đơn giá bù trừ nội bộ (VND / ca điều trị)</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                value={rate}
                onChange={(e) => onRateChange(e.target.value)}
                className="block w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-black text-lg transition-all"
                placeholder="Ví dụ: 150000"
                required
              />
              <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none font-black text-slate-400">đ</div>
            </div>
            <p className="text-[10px] text-slate-400 font-bold italic mt-1">* Đây là số tiền chi nhánh bán gói (debtor) phải bù đắp cho chi nhánh này (creditor) trên mỗi ca phục vụ khách liên chi nhánh hoàn thành.</p>
          </div>

          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : 'Lưu cấu hình'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
