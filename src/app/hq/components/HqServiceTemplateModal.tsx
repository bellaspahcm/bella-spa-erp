import { motion } from 'framer-motion';
import { Check, Lock, RefreshCw, X } from 'lucide-react';
import type { FormEvent, KeyboardEvent } from 'react';
import type { HqPackageTemplate } from '@/types/domain';

interface HqServiceTemplateModalProps {
  open: boolean;
  editingTemplate: HqPackageTemplate | null;
  templateName: string;
  templatePrice: string;
  templateDuration: string;
  templateTotalSessions: string;
  templateKtvCommission: string;
  templatePriceFloor: string;
  templatePriceCap: string;
  templateAllowedOverride: boolean;
  templateDetails: string[];
  newDetailText: string;
  templateOffer: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onTemplateNameChange: (value: string) => void;
  onTemplatePriceChange: (value: string) => void;
  onTemplateDurationChange: (value: string) => void;
  onTemplateTotalSessionsChange: (value: string) => void;
  onTemplateKtvCommissionChange: (value: string) => void;
  onTemplatePriceFloorChange: (value: string) => void;
  onTemplatePriceCapChange: (value: string) => void;
  onTemplateAllowedOverrideChange: (value: boolean) => void;
  onTemplateOfferChange: (value: string) => void;
  onNewDetailTextChange: (value: string) => void;
  onAddDetailStep: () => void;
  onRemoveDetailStep: (index: number) => void;
}

export function HqServiceTemplateModal({
  open,
  editingTemplate,
  templateName,
  templatePrice,
  templateDuration,
  templateTotalSessions,
  templateKtvCommission,
  templatePriceFloor,
  templatePriceCap,
  templateAllowedOverride,
  templateDetails,
  newDetailText,
  templateOffer,
  submitting,
  onClose,
  onSubmit,
  onTemplateNameChange,
  onTemplatePriceChange,
  onTemplateDurationChange,
  onTemplateTotalSessionsChange,
  onTemplateKtvCommissionChange,
  onTemplatePriceFloorChange,
  onTemplatePriceCapChange,
  onTemplateAllowedOverrideChange,
  onTemplateOfferChange,
  onNewDetailTextChange,
  onAddDetailStep,
  onRemoveDetailStep,
}: HqServiceTemplateModalProps) {
  if (!open) return null;

  const handleDetailKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onAddDetailStep();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center shrink-0">
          <div>
            <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">QUẢN TRỊ DANH MỤC</span>
            <h3 className="text-lg font-black uppercase tracking-tight mt-1">{editingTemplate ? 'Cập nhật Liệu trình Chuẩn' : 'Thêm mới Liệu trình Chuẩn'}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="p-8 overflow-y-auto">
            <div className="space-y-6 text-left">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Tên liệu trình *</label>
                <input
                  type="text"
                  required
                  value={templateName}
                  onChange={e => onTemplateNameChange(e.target.value)}
                  placeholder="VD: Chăm sóc da chuyên sâu VIP"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Giá chuẩn HQ (VNĐ) *</label>
                  <input
                    type="text"
                    required
                    value={templatePrice}
                    onChange={e => onTemplatePriceChange(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">KTV Hoa hồng/buổi (VNĐ)</label>
                  <input
                    type="text"
                    value={templateKtvCommission}
                    onChange={e => onTemplateKtvCommissionChange(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Thời lượng (VD: 90 phút)</label>
                  <input
                    type="text"
                    value={templateDuration}
                    onChange={e => onTemplateDurationChange(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Số buổi liệu trình</label>
                  <input
                    type="number"
                    value={templateTotalSessions}
                    onChange={e => onTemplateTotalSessionsChange(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                    <Lock size={12} className="text-slate-400" />
                    Quản trị giá bán & Phân phối
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Cho phép Đại lý tự đổi giá</span>
                    <input
                      type="checkbox"
                      checked={templateAllowedOverride}
                      onChange={e => onTemplateAllowedOverrideChange(e.target.checked)}
                      className="w-4 h-4 rounded text-primary focus:ring-primary/20"
                    />
                  </label>
                </div>

                <div className={`grid grid-cols-2 gap-4 transition-all ${!templateAllowedOverride ? 'opacity-40 pointer-events-none' : ''}`}>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Giá sàn (Tối thiểu)</label>
                    <input
                      type="text"
                      value={templatePriceFloor}
                      onChange={e => onTemplatePriceFloorChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Giá trần (Tối đa)</label>
                    <input
                      type="text"
                      value={templatePriceCap}
                      onChange={e => onTemplatePriceCapChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                    />
                  </div>
                </div>
                {!templateAllowedOverride && (
                  <p className="text-[10px] text-slate-500 font-bold italic">
                    Khi tắt tùy chọn này, các chi nhánh nhượng quyền sẽ bị khóa giá bán lẻ chính xác theo Giá chuẩn HQ.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Ưu đãi / Ghi chú</label>
                <input
                  type="text"
                  value={templateOffer}
                  onChange={e => onTemplateOfferChange(e.target.value)}
                  placeholder="VD: Tặng kèm voucher 200k"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Các bước quy trình (Chuẩn hóa)</label>
                <div className="space-y-2 mb-3">
                  {templateDetails.map((detail, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
                      <span className="w-5 h-5 bg-white rounded-full flex items-center justify-center text-[9px] font-black text-slate-400 shrink-0 shadow-sm">{idx + 1}</span>
                      <span className="text-xs font-bold text-slate-700 flex-1">{detail}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveDetailStep(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDetailText}
                    onChange={e => onNewDetailTextChange(e.target.value)}
                    onKeyDown={handleDetailKeyDown}
                    placeholder="Thêm bước thực hiện..."
                    className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:border-primary transition-all"
                  />
                  <button
                    type="button"
                    onClick={onAddDetailStep}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                  >
                    Thêm
                  </button>
                </div>
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
              disabled={submitting}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-md disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
              Lưu Gói Mẫu
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
