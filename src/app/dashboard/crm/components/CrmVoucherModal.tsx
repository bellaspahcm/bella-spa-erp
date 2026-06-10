'use client';

import type { FormEvent } from 'react';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { parsePercentInput } from '@/lib/utils';
import type { NewVoucherCampaign } from '../types';

interface CrmVoucherModalProps {
  newVoucher: NewVoucherCampaign;
  onChange: (voucher: NewVoucherCampaign) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  tenantModuleKey?: TenantModuleKey | null;
}

const BABYCARE_TARGET_OPTIONS = [
  'Bé tròn 1 tuổi',
  'Mẹ bầu sắp sinh',
  'Trẻ sơ sinh',
  'Khách hàng cũ kích hoạt lại',
];

const BEAUTY_TARGET_OPTIONS = [
  'Khách chăm sóc da định kỳ',
  'Khách liệu trình body',
  'Khách công nghệ cao',
  'Khách hàng cũ kích hoạt lại',
];

const NEUTRAL_TARGET_OPTIONS = [
  'Khách cần chăm sóc lại',
  'Khách hàng thân thiết',
  'Khách quan tâm dịch vụ mới',
  'Khách hàng cũ kích hoạt lại',
];

export function CrmVoucherModal({ newVoucher, onChange, onClose, onSubmit, tenantModuleKey }: CrmVoucherModalProps) {
  const voucherTargetOptions = tenantModuleKey === 'babycare'
    ? BABYCARE_TARGET_OPTIONS
    : tenantModuleKey === 'beauty_spa'
      ? BEAUTY_TARGET_OPTIONS
      : NEUTRAL_TARGET_OPTIONS;
  const codePlaceholder = tenantModuleKey === 'babycare' ? 'Ví dụ: WELCOME_BABY_15' : 'Ví dụ: SKINCARE_15';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
      <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Tạo chiến dịch voucher mới</h3>
        <p className="text-xs text-slate-400 font-medium mb-6">Tạo mã quà tặng kích thích mua hàng cho khách hàng thân thiết</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Mã voucher</label>
            <input
              type="text"
              placeholder={codePlaceholder}
              required
              value={newVoucher.code}
              onChange={(event) => onChange({ ...newVoucher, code: event.target.value.toUpperCase() })}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:border-rose-100 text-sm font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Phần trăm giảm giá</label>
            <input
              type="number"
              min={1}
              max={100}
              required
              value={newVoucher.discount}
              onChange={(event) => onChange({ ...newVoucher, discount: parsePercentInput(event.target.value, { min: 1, max: 100, fallback: 10 }) })}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:border-rose-100 text-sm font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tệp khách hàng mục tiêu</label>
            <select
              value={newVoucher.target}
              onChange={(event) => onChange({ ...newVoucher, target: event.target.value })}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:border-rose-100 text-sm font-semibold"
            >
              {voucherTargetOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="pt-4 flex items-center gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-xl transition-all">
              Hủy bỏ
            </button>
            <button type="submit" className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all">
              Tạo chiến dịch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
