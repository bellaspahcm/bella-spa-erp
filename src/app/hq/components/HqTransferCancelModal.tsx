import { motion } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import type { FormEvent } from 'react';
import type { InventoryTransferOrder } from '@/services/inventory-transfer-actions';

interface HqTransferCancelModalProps {
  transfer: InventoryTransferOrder | null;
  refusingReason: string;
  submitting: boolean;
  onClose: () => void;
  onRefusingReasonChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export function HqTransferCancelModal({
  transfer,
  refusingReason,
  submitting,
  onClose,
  onRefusingReasonChange,
  onSubmit,
}: HqTransferCancelModalProps) {
  if (!transfer) return null;

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
            <span className="text-[9px] bg-rose-500/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-rose-500/20">TỪ CHỐI CẤP VẬT TƯ</span>
            <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[320px]">Đơn {transfer.order_number}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lý do từ chối cung ứng</label>
            <textarea
              rows={4}
              value={refusingReason}
              onChange={(e) => onRefusingReasonChange(e.target.value)}
              className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-xs transition-all resize-none"
              placeholder="Nhập lý do từ chối cấp hàng cho chi nhánh"
              required
            />
            <p className="text-[9px] text-slate-400 font-bold italic mt-1">* Lý do từ chối sẽ hiển thị trực tiếp cho quản trị viên chi nhánh được biết.</p>
          </div>

          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
            >
              Quay lại
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-rose-100 dark:shadow-none"
            >
              {submitting ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : 'Xác nhận từ chối'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
