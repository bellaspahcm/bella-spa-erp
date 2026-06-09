import { motion } from 'framer-motion';
import { RefreshCw, Truck, X } from 'lucide-react';
import type { FormEvent } from 'react';
import type { InventoryTransferOrder, TransferOrderItem } from '@/services/inventory-transfer-actions';

interface HqTransferShipModalProps {
  transfer: InventoryTransferOrder | null;
  shippingCarrier: string;
  trackingNumber: string;
  submitting: boolean;
  onClose: () => void;
  onShippingCarrierChange: (value: string) => void;
  onTrackingNumberChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export function HqTransferShipModal({
  transfer,
  shippingCarrier,
  trackingNumber,
  submitting,
  onClose,
  onShippingCarrierChange,
  onTrackingNumberChange,
  onSubmit,
}: HqTransferShipModalProps) {
  if (!transfer) return null;

  const items = (transfer.items || []) as TransferOrderItem[];

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
            <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">QUY TRÌNH XUẤT KHO CUNG ỨNG</span>
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
          <div className="bg-rose-50/50 border border-rose-100/50 rounded-3xl p-4 space-y-3">
            <h5 className="text-[10px] font-black text-primary uppercase tracking-widest">Danh sách xuất cấp từ kho Tổng bộ:</h5>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center gap-2 bg-white rounded-xl border border-slate-100 px-3 py-2 text-xs">
                  <div>
                    <p className="font-black text-slate-800">{item.name}</p>
                    <p className="font-mono text-[9px] text-slate-400 font-bold uppercase">{item.sku}</p>
                  </div>
                  <span className="font-black text-primary bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">
                    SL: {item.qty} {item.unit || 'cái'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đơn vị vận chuyển</label>
              <input
                type="text"
                value={shippingCarrier}
                onChange={(e) => onShippingCarrierChange(e.target.value)}
                className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-bold text-xs transition-all"
                placeholder="Ví dụ: Giao Hàng Nhanh, Viettel Post..."
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mã vận đơn (Tracking Number)</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => onTrackingNumberChange(e.target.value)}
                className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary font-mono text-xs font-black transition-all"
                placeholder="Nhập mã vận đơn bưu cục"
                required
              />
              <p className="text-[9px] text-slate-400 font-bold italic mt-1">* Khi duyệt giao hàng, hệ thống sẽ tự động trừ số lượng tồn kho tương ứng tại Tổng bộ.</p>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              {submitting ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <>
                  <Truck size={14} />
                  Duyệt & Giao hàng
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
