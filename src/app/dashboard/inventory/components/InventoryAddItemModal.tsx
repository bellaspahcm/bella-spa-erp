import type { Dispatch, SetStateAction } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import { PlusCircle, RefreshCw, X } from 'lucide-react';

import type { NewInventoryItem } from '../types';

type InventoryAddItemModalProps = {
  show: boolean;
  newItem: NewInventoryItem;
  submitting: boolean;
  setNewItem: Dispatch<SetStateAction<NewInventoryItem>>;
  onClose: () => void;
  onSubmit: () => void;
};

const ITEM_FIELDS: Array<{
  label: string;
  key: keyof NewInventoryItem;
  type: 'text' | 'number';
  placeholder: string;
}> = [
  { label: 'Tên vật tư *', key: 'name', type: 'text', placeholder: 'VD: Tinh dầu massage...' },
  { label: 'Mã SKU', key: 'sku', type: 'text', placeholder: 'VD: OIL-LAV-001' },
  { label: 'Đơn vị *', key: 'unit', type: 'text', placeholder: 'ml, g, cái, chai...' },
  { label: 'Tồn kho ban đầu', key: 'stock_level', type: 'number', placeholder: '0' },
  { label: 'Ngưỡng sắp hết', key: 'min_stock_level', type: 'number', placeholder: '10' },
  { label: 'Đơn giá (VND)', key: 'price_per_unit', type: 'number', placeholder: '0' },
];

export function InventoryAddItemModal({
  show,
  newItem,
  submitting,
  setNewItem,
  onClose,
  onSubmit,
}: InventoryAddItemModalProps) {
  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white w-full max-w-md rounded-[3rem] p-10 relative z-10 shadow-2xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900">Thêm Vật Tư Mới</h3>
              <button onClick={onClose} className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4 mb-8">
              {ITEM_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block ml-1">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    min={f.type === 'number' ? 0 : undefined}
                    value={f.type === 'number'
                      ? (newItem[f.key] === 0 ? '' : String(newItem[f.key] ?? ''))
                      : String(newItem[f.key] ?? '')
                    }
                    onFocus={f.type === 'number' ? e => e.target.select() : undefined}
                    onChange={e => setNewItem(prev => ({
                      ...prev,
                      [f.key]: f.type === 'number' ? (e.target.value === '' ? 0 : Number(e.target.value)) : e.target.value,
                    }))}
                    className="w-full bg-slate-50 rounded-2xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-600">Hủy</button>
              <button onClick={onSubmit} disabled={submitting} className="flex-[2] bg-primary text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                Lưu Vật Tư
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
