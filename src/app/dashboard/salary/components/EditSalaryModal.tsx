'use client';

import { motion } from 'framer-motion';
import { KtvSalaryRecord } from '@/types/domain';

interface EditSalaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSalary: KtvSalaryRecord | null;
  setEditingSalary: (s: KtvSalaryRecord) => void;
  handleSaveConfig: () => Promise<void>;
  isSaving: boolean;
}

export default function EditSalaryModal({
  isOpen,
  onClose,
  editingSalary,
  setEditingSalary,
  handleSaveConfig,
  isSaving,
}: EditSalaryModalProps) {
  if (!isOpen || !editingSalary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-8">
          <h3 className="text-2xl font-black text-slate-900 mb-6">Chỉnh sửa Lương</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Lương cứng (đ)</label>
              <input 
                type="number" 
                value={editingSalary.baseSalary} 
                onChange={e => setEditingSalary({...editingSalary, baseSalary: Number(e.target.value)})}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Thưởng KPI (đ)</label>
              <input 
                type="number" 
                value={editingSalary.kpiBonus} 
                onChange={e => setEditingSalary({...editingSalary, kpiBonus: Number(e.target.value)})}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Phạt (đ)</label>
              <input 
                type="number" 
                value={editingSalary.deductions} 
                onChange={e => setEditingSalary({...editingSalary, deductions: Number(e.target.value)})}
                className="w-full bg-rose-50 border-none rounded-xl px-4 py-3 font-bold text-rose-600 focus:ring-2 focus:ring-rose-500/20 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">Tạm ứng (đ)</label>
              <input 
                type="number" 
                value={editingSalary.advances} 
                onChange={e => setEditingSalary({...editingSalary, advances: Number(e.target.value)})}
                className="w-full bg-rose-50 border-none rounded-xl px-4 py-3 font-bold text-rose-600 focus:ring-2 focus:ring-rose-500/20 outline-none"
              />
            </div>
          </div>
        </div>
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all"
          >
            Hủy bỏ
          </button>
          <button 
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="flex-1 py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover shadow-lg shadow-pink-100 transition-all disabled:opacity-50"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
