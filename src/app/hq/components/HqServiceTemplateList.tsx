import { Plus, RefreshCw, Sparkles } from 'lucide-react';
import { formatCurrency } from '@bella/shared';;
import type { HqPackageTemplate } from '@/types/domain';

interface HqServiceTemplateListProps {
  templates: HqPackageTemplate[];
  loading: boolean;
  onOpenTemplate: (template: HqPackageTemplate | null) => void;
  onOpenDistribution: (template: HqPackageTemplate) => void;
  onDeleteTemplate: (templateId: string, templateName: string) => void;
}

export function HqServiceTemplateList({
  templates,
  loading,
  onOpenTemplate,
  onOpenDistribution,
  onDeleteTemplate,
}: HqServiceTemplateListProps) {
  return (
    <div className="lg:col-span-5 bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-6 space-y-6">
      <div className="flex justify-between items-center border-b border-slate-50 pb-4">
        <div>
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Liệu trình thương hiệu</h4>
          <p className="text-[9px] text-slate-400 font-bold mt-0.5">Danh mục mẫu chuẩn Bella HQ</p>
        </div>
        <button
          onClick={() => onOpenTemplate(null)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-sm"
        >
          <Plus size={12} />
          Thêm mới
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center">
          <RefreshCw size={20} className="animate-spin text-primary mx-auto" />
        </div>
      ) : templates.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-8">Chưa có liệu trình chuẩn nào.</p>
      ) : (
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
          {templates.map(t => (
            <div key={t.id} className="bg-slate-50/50 border border-slate-100 rounded-3xl p-4 space-y-3 hover:bg-slate-50 transition-colors text-left">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <h5 className="font-black text-slate-900 text-xs truncate" title={t.name}>{t.name}</h5>
                  <p className="text-[10px] text-slate-400 font-bold block mt-0.5">{t.duration} &bull; {t.total_sessions} buổi</p>
                </div>
                <span className="text-[11px] font-black text-primary shrink-0">{formatCurrency(t.price)}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-white rounded-2xl border border-slate-100/50 p-2.5 text-[9px] font-bold text-slate-500">
                <div>
                  <p className="text-slate-400">Giá sàn / trần</p>
                  <p className="font-black text-slate-800">{formatCurrency(t.price_floor ?? t.price)} - {formatCurrency(t.price_cap ?? t.price)}</p>
                </div>
                <div>
                  <p className="text-slate-400">KTV hoa hồng</p>
                  <p className="font-black text-slate-800">{formatCurrency(t.ktv_commission ?? 0)} / buổi</p>
                </div>
              </div>

              <div className="flex justify-between items-center text-[9px] font-bold bg-white rounded-xl border border-slate-100/50 px-2.5 py-1">
                <span className="text-slate-400">Cho phép tự sửa giá</span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                  t.allowed_franchise_override
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-rose-50 text-rose-600'
                }`}>
                  {t.allowed_franchise_override ? 'BẬT (BIÊN ĐỘ)' : 'KHÓA CỐ ĐỊNH'}
                </span>
              </div>

              {t.offer && (
                <div className="bg-rose-50/40 border border-rose-100/30 rounded-xl px-2.5 py-1.5 text-[9px] font-bold text-primary flex items-start gap-1">
                  <Sparkles size={10} className="shrink-0 mt-0.5 text-primary" />
                  <span>Ưu đãi: {t.offer}</span>
                </div>
              )}

              <div className="flex gap-2 justify-end pt-2 border-t border-slate-100/50">
                <button
                  onClick={() => onOpenDistribution(t)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase tracking-wider transition-all"
                >
                  Phân phối
                </button>
                <button
                  onClick={() => onOpenTemplate(t)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9px] font-black uppercase tracking-wider transition-all"
                >
                  Sửa
                </button>
                <button
                  onClick={() => onDeleteTemplate(t.id, t.name)}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-[9px] font-black uppercase tracking-wider transition-all"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
