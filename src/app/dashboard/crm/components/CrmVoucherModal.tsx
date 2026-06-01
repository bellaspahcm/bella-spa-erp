'use client';

import type { FormEvent } from 'react';
import type { NewVoucherCampaign } from '../types';

interface CrmVoucherModalProps {
  newVoucher: NewVoucherCampaign;
  onChange: (voucher: NewVoucherCampaign) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
}

export function CrmVoucherModal({
  newVoucher,
  onChange,
  onClose,
  onSubmit,
}: CrmVoucherModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-300">
      <div className="bg-white p-8 rounded-[2.5rem] w-full max-w-md shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">Táº¡o chiáº¿n dá»‹ch Voucher má»›i</h3>
        <p className="text-xs text-slate-400 font-medium mb-6">Táº¡o mÃ£ quÃ  táº·ng kÃ­ch thÃ­ch mua hÃ ng cho khÃ¡ch hÃ ng thÃ¢n thiáº¿t</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">MÃ£ Code Voucher</label>
            <input
              type="text"
              placeholder="VÃ­ dá»¥: WELCOME_BABY_15"
              required
              value={newVoucher.code}
              onChange={(e) => onChange({ ...newVoucher, code: e.target.value.toUpperCase() })}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:border-rose-100 text-sm font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Pháº§n trÄƒm giáº£m giÃ¡ (%)</label>
            <input
              type="number"
              min={1}
              max={100}
              required
              value={newVoucher.discount}
              onChange={(e) => onChange({ ...newVoucher, discount: parseInt(e.target.value) || 10 })}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:border-rose-100 text-sm font-semibold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tá»‡p khÃ¡ch hÃ ng má»¥c tiÃªu</label>
            <select
              value={newVoucher.target}
              onChange={(e) => onChange({ ...newVoucher, target: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 focus:outline-none focus:border-rose-100 text-sm font-semibold"
            >
              <option value="BÃ© trÃ²n 1 tuá»•i">BÃ© trÃ²n 1 tuá»•i (Sinh nháº­t)</option>
              <option value="Máº¹ báº§u sáº¯p sinh">Máº¹ báº§u sáº¯p sinh (Thai sáº£n)</option>
              <option value="Tráº» sÆ¡ sinh">Tráº» sÆ¡ sinh (Newborn)</option>
              <option value="KhÃ¡ch hÃ ng cÅ© kÃ­ch hoáº¡t láº¡i">KhÃ¡ch hÃ ng cÅ© kÃ­ch hoáº¡t láº¡i</option>
            </select>
          </div>

          <div className="pt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-xl transition-all"
            >
              Há»¦Y Bá»Ž
            </button>
            <button
              type="submit"
              className="flex-1 py-3 bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all"
            >
              Táº O CHIáº¾N Dá»ŠCH
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
