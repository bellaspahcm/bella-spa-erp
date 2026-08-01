'use client';

import { Calendar, Percent, Plus, RefreshCw, Tag } from 'lucide-react';
import type { FormEvent } from 'react';
import { normalizePromotionDiscountPercent } from '@/lib/business-rules/promotion';
import type { PromotionFormState } from './types';
import { useTenantModuleKey } from '@/hooks/useTenantModuleKey';

interface PromotionFormProps {
  form: PromotionFormState;
  isSubmitting: boolean;
  onChange: (patch: Partial<PromotionFormState>) => void;
  onSubmit: (event: FormEvent) => void;
}

export function PromotionForm({
  form,
  isSubmitting,
  onChange,
  onSubmit,
}: PromotionFormProps) {
  const { tenantModuleKey: moduleKey } = useTenantModuleKey();
  
  const titlePlaceholder = moduleKey === 'real_estate' 
    ? 'VD: Mở bán đợt 1 căn hộ VIP'
    : moduleKey === 'industrial_cleaning'
    ? 'VD: Ưu đãi bảo trì công trình'
    : 'VD: Chương trình tri ân đặc biệt';

  return (
    <div className="xl:col-span-1 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-6 rounded-[2rem] space-y-6 self-start shadow-sm">
      <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
        <Plus className="w-5 h-5 text-primary" />
        Thêm ưu đãi mới
      </h3>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
            Tiêu đề chương trình
          </label>
          <input
            type="text"
            required
            value={form.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder={titlePlaceholder}
            className="w-full px-5 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
            Mô tả chi tiết
          </label>
          <textarea
            required
            value={form.description}
            onChange={(event) => onChange({ description: event.target.value })}
            placeholder="Mô tả quyền lợi và điều kiện áp dụng..."
            rows={3}
            className="w-full px-5 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-sm resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Tag className="w-3 h-3 text-slate-400" />
              Mã ưu đãi
            </label>
            <input
              type="text"
              value={form.discountCode}
              onChange={(event) =>
                onChange({ discountCode: event.target.value.toUpperCase().replace(/\s+/g, '') })
              }
              placeholder="PROMO50"
              className="w-full px-5 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-black text-sm font-mono text-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Percent className="w-3 h-3 text-slate-400" />
              % giảm giá
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.discountPercent}
              onChange={(event) => onChange({
                discountPercent: event.target.value === ''
                  ? ''
                  : String(normalizePromotionDiscountPercent(event.target.value) ?? 0),
              })}
              placeholder="10"
              className="w-full px-5 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <DateField
            label="Ngày bắt đầu"
            value={form.startDate}
            onChange={(value) => onChange({ startDate: value })}
          />
          <DateField
            label="Ngày kết thúc"
            value={form.endDate}
            onChange={(value) => onChange({ endDate: value })}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-primary hover:bg-primary-hover text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-md disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 mt-4"
        >
          {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span>{isSubmitting ? 'Đang thêm...' : 'Tạo khuyến mãi'}</span>
        </button>
      </form>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
        <Calendar className="w-3 h-3 text-slate-400" />
        {label}
      </label>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-4 py-3 bg-white/50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 rounded-xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-sm"
      />
    </div>
  );
}
