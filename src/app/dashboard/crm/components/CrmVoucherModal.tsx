'use client';

import type { FormEvent } from 'react';
import { parsePercentInput } from '@/lib/utils';
import type { NewVoucherCampaign } from '../types';

interface CrmVoucherModalProps {
  newVoucher: NewVoucherCampaign;
  onChange: (voucher: NewVoucherCampaign) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

export function CrmVoucherModal({ newVoucher, onChange, onClose, onSubmit }: CrmVoucherModalProps) {
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
              placeholder="Ví dụ: WELCOME_BABY_15"
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
              <option value="Bé tròn 1 tuổi">Bé tròn 1 tuổi</option>
              <option value="Mẹ bầu sắp sinh">Mẹ bầu sắp sinh</option>
              <option value="Trẻ sơ sinh">Trẻ sơ sinh</option>
              <option value="Khách hàng cũ kích hoạt lại">Khách hàng cũ kích hoạt lại</option>
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
