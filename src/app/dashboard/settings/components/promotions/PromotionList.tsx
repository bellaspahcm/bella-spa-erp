'use client';

import { Calendar, Sparkles, Tag, Trash2 } from 'lucide-react';
import type { Promotion } from './types';

interface PromotionListProps {
  promotions: Promotion[];
  actionId: string | null;
  onToggleActive: (promotion: Promotion) => void;
  onDelete: (promotion: Promotion) => void;
}

export function PromotionList({
  promotions,
  actionId,
  onToggleActive,
  onDelete,
}: PromotionListProps) {
  return (
    <div className="w-full space-y-6">
      <h3 className="text-lg font-black text-slate-800">
        Danh sách chương trình ({promotions.length})
      </h3>

      {promotions.length === 0 ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-[2rem] p-12 text-center">
          <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 font-bold text-sm">Chưa cấu hình chương trình khuyến mãi nào.</p>
          <p className="text-xs text-slate-400 mt-1">
            Sử dụng biểu mẫu bên trái để thêm chương trình mới hiển thị cho khách hàng.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {promotions.map((promotion) => (
            <PromotionCard
              key={promotion.id}
              promotion={promotion}
              isBusy={actionId === promotion.id}
              onToggleActive={onToggleActive}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PromotionCard({
  promotion,
  isBusy,
  onToggleActive,
  onDelete,
}: {
  promotion: Promotion;
  isBusy: boolean;
  onToggleActive: (promotion: Promotion) => void;
  onDelete: (promotion: Promotion) => void;
}) {
  return (
    <div
      className={`bg-white border p-6 rounded-[2rem] flex flex-col justify-between shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md ${
        promotion.is_active ? 'border-pink-100' : 'border-slate-100 opacity-75'
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h4 className="font-serif font-black text-slate-800 text-base leading-snug">
            {promotion.title}
          </h4>
          {promotion.discount_percent && (
            <span className="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0">
              -{promotion.discount_percent}%
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 font-bold leading-relaxed">
          {promotion.description}
        </p>

        <div className="space-y-1.5 pt-2">
          {promotion.discount_code && (
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mã:</span>
              <span className="text-xs font-black text-rose-500 font-mono tracking-wider bg-rose-50 px-1.5 py-0.5 rounded">
                {promotion.discount_code}
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>Thời gian:</span>
            <span className="text-slate-600 font-black">{formatPromotionDateRange(promotion)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-between gap-4">
        <button
          onClick={() => onToggleActive(promotion)}
          disabled={isBusy}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 ${
            promotion.is_active
              ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          {promotion.is_active ? 'Đang chạy' : 'Tạm ngưng'}
        </button>

        <button
          onClick={() => onDelete(promotion)}
          disabled={isBusy}
          className="p-2 bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all active:scale-95 disabled:opacity-50"
          title="Xóa khuyến mãi"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function formatPromotionDateRange(promotion: Promotion) {
  if (!promotion.start_date && !promotion.end_date) {
    return 'Vô thời hạn';
  }

  const startDate = promotion.start_date
    ? new Date(promotion.start_date).toLocaleDateString('vi-VN')
    : '...';
  const endDate = promotion.end_date
    ? new Date(promotion.end_date).toLocaleDateString('vi-VN')
    : 'Vô thời hạn';

  return `${startDate} - ${endDate}`;
}
