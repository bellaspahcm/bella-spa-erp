import { motion } from 'framer-motion';
import { Info, RefreshCw, Send, X } from 'lucide-react';
import type { FormEvent } from 'react';
import type { HqPackageTemplate } from '@/types/domain';

interface TenantOption {
  id: string;
  name: string;
}

interface HqServiceDistributionModalProps {
  open: boolean;
  template: HqPackageTemplate | null;
  tenants: TenantOption[];
  selectedTenantIds: string[];
  submitting: boolean;
  onClose: () => void;
  onSelectedTenantIdsChange: (value: string[]) => void;
  onSubmit: (event: FormEvent) => void;
}

export function HqServiceDistributionModal({
  open,
  template,
  tenants,
  selectedTenantIds,
  submitting,
  onClose,
  onSelectedTenantIdsChange,
  onSubmit,
}: HqServiceDistributionModalProps) {
  if (!open || !template) return null;

  const allTenantsSelected = selectedTenantIds.length === tenants.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] text-left"
      >
        <div className="bg-gradient-to-r from-indigo-900 to-slate-900 px-8 py-6 text-white flex justify-between items-center shrink-0">
          <div>
            <span className="text-[9px] bg-white/20 text-indigo-200 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10">TRIỂN KHAI MẪU</span>
            <h3 className="text-lg font-black uppercase tracking-tight mt-1 truncate max-w-[300px]">{template.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="p-8 overflow-y-auto space-y-6">
            <div className="bg-indigo-50/50 border border-indigo-100/50 p-4 rounded-2xl flex items-start gap-3 text-indigo-700">
              <Info size={20} className="shrink-0 mt-0.5" />
              <p className="text-xs font-bold leading-relaxed">
                Chọn các chi nhánh để đẩy cấu hình liệu trình chuẩn này xuống. Nếu chi nhánh đã có gói này, hệ thống sẽ <strong>ghi đè & cập nhật</strong> lại quy trình/thời lượng chuẩn.
              </p>
            </div>

            <div>
              <div className="flex justify-between items-end mb-3">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Danh sách chi nhánh</label>
                <button
                  type="button"
                  onClick={() => onSelectedTenantIdsChange(allTenantsSelected ? [] : tenants.map(t => t.id))}
                  className="text-[10px] font-black text-primary uppercase tracking-wider hover:underline"
                >
                  {allTenantsSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                {tenants.map(tenant => {
                  const isChecked = selectedTenantIds.includes(tenant.id);
                  return (
                    <label
                      key={tenant.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isChecked ? 'bg-rose-50/50 border-primary shadow-sm' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onSelectedTenantIdsChange([...selectedTenantIds, tenant.id]);
                          } else {
                            onSelectedTenantIdsChange(selectedTenantIds.filter(id => id !== tenant.id));
                          }
                        }}
                        className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                      />
                      <span className={`text-sm font-bold ${isChecked ? 'text-slate-900' : 'text-slate-600'}`}>
                        {tenant.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting || selectedTenantIds.length === 0}
              className="px-6 py-3 bg-primary hover:bg-rose-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              Tiến hành phân phối
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
