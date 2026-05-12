'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  DollarSign, 
  Plus, 
  Minus, 
  Tag, 
  Wallet,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { recordTransaction } from '@/services/finance-actions';
import { toast } from 'sonner';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TransactionModal({ isOpen, onClose, onSuccess }: TransactionModalProps) {
  const [type, setType] = useState<'revenue' | 'expense'>('revenue');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAmount = amount.replace(/\D/g, '');
    if (!cleanAmount || isNaN(Number(cleanAmount))) {
      toast.error('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    setIsSubmitting(true);
    try {
      await recordTransaction({
        amount: Number(cleanAmount),
        type,
        notes: notes || (type === 'revenue' ? 'Thu nhập khác' : 'Chi phí khác')
      });
      toast.success('Ghi nhận giao dịch thành công');
      if (onSuccess) onSuccess();
      onClose();
      // Reset form
      setAmount('');
      setNotes('');
    } catch (error) {
      toast.error('Lỗi khi ghi nhận giao dịch');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className={`p-8 flex items-center justify-between text-white ${type === 'revenue' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest">Ghi nhận thu chi</h2>
                <p className="text-white/80 text-xs font-bold uppercase tracking-wider">Cập nhật dòng tiền hệ thống</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {/* Type Selector */}
            <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => setType('revenue')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black transition-all ${
                  type === 'revenue' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Plus className="w-4 h-4" /> THU VÀO
              </button>
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black transition-all ${
                  type === 'expense' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Minus className="w-4 h-4" /> CHI RA
              </button>
            </div>

            {/* Amount Input */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Số tiền giao dịch</label>
              <div className="relative group">
                <div className={`absolute left-6 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                  type === 'revenue' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                  <Wallet className="w-4 h-4" />
                </div>
                <input
                  autoFocus
                  type="text"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setAmount(val ? Number(val).toLocaleString() : '');
                  }}
                  className="w-full pl-16 pr-8 py-5 bg-slate-50 border-2 border-transparent focus:border-primary/20 focus:bg-white rounded-3xl outline-none transition-all text-2xl font-bold text-slate-900"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-400">VNĐ</span>
              </div>
            </div>

            {/* Notes Input */}
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nội dung / Ghi chú</label>
              <div className="relative">
                <Tag className="absolute left-6 top-5 w-5 h-5 text-slate-400" />
                <textarea
                  rows={3}
                  placeholder="Ví dụ: Thu tiền cọc khách hàng, Chi tiền mua mỹ phẩm..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full pl-16 pr-8 py-4 bg-slate-50 border-2 border-transparent focus:border-primary/20 focus:bg-white rounded-3xl outline-none transition-all font-bold text-slate-700 resize-none"
                />
              </div>
            </div>

            {/* Warning if Large Amount */}
            {amount && Number(amount.replace(/\D/g, '')) > 10000000 && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-xs font-bold">Giao dịch lớn (trên 10M), vui lòng kiểm tra kỹ chứng từ!</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 text-slate-500 font-black uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all"
              >
                Hủy bỏ
              </button>
              <button
                disabled={isSubmitting || !amount}
                type="submit"
                className={`flex-[2] py-4 rounded-2xl font-black text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest ${
                  type === 'revenue' 
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' 
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-100'
                } disabled:opacity-50 disabled:scale-100`}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                Xác nhận ghi nhận
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
