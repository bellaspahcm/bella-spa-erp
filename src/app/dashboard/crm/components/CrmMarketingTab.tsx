'use client';

import { Gift, Percent, Plus, Tag } from 'lucide-react';
import type { BirthdayCustomer, VoucherCampaign } from '../types';

interface CrmMarketingTabProps {
  birthdayCustomers: BirthdayCustomer[];
  vouchers: VoucherCampaign[];
  loadError: string | null;
  actionLoading: string | null;
  onSendBirthday: (customerId: string, babyName: string) => void;
  onOpenVoucherModal: () => void;
}

export function CrmMarketingTab({
  birthdayCustomers,
  vouchers,
  loadError,
  actionLoading,
  onSendBirthday,
  onOpenVoucherModal,
}: CrmMarketingTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Ká»· niá»‡m Sinh nháº­t cá»§a BÃ© trong thÃ¡ng</h3>
          <p className="text-xs text-slate-400 font-medium">Chiáº¿n dá»‹ch gá»­i tin nháº¯n chÃºc má»«ng & Voucher tá»± Ä‘á»™ng</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="py-4 px-6">TÃªn máº¹ & BÃ©</th>
                <th className="py-4 px-6">NgÃ y sinh cá»§a BÃ©</th>
                <th className="py-4 px-6">Tuá»•i cá»§a bÃ©</th>
                <th className="py-4 px-6">Khoáº£ng cÃ¡ch</th>
                <th className="py-4 px-6 text-center">Gá»­i chÃºc má»«ng</th>
              </tr>
            </thead>
            <tbody>
              {birthdayCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 font-medium italic">
                    {loadError ? 'KhÃ´ng thá»ƒ táº£i danh sÃ¡ch sinh nháº­t trong thÃ¡ng.' : 'KhÃ´ng tÃ¬m tháº¥y bÃ© nÃ o cÃ³ sinh nháº­t trong thÃ¡ng nÃ y.'}
                  </td>
                </tr>
              ) : (
                birthdayCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-slate-100/70 hover:bg-slate-50/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-slate-800">{customer.name_baby || 'BÃ© cÆ°ng'}</span>
                        <span className="text-[11px] text-slate-400 font-bold">Máº¹: {customer.name_mother} â€¢ SÄT: {customer.phone}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-bold text-slate-600">{customer.dobFormatted}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-black text-primary uppercase tracking-wide">
                        TrÃ²n {customer.ageYears} Tuá»•i
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {customer.isToday ? (
                        <span className="inline-block px-2.5 py-1 bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse">
                          HÃ”M NAY ðŸŽ‚
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">CÃ²n {customer.daysUntil} ngÃ y</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => onSendBirthday(customer.id, customer.name_baby || 'bÃ©')}
                        disabled={actionLoading === customer.id}
                        className="px-4 py-2 bg-gradient-to-r from-primary to-rose-500 hover:from-primary/95 hover:to-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-rose-100 dark:shadow-none hover:shadow-lg transition-all flex items-center gap-1.5 mx-auto"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        {actionLoading === customer.id ? 'ÄANG Gá»¬I...' : 'Táº¶NG VOUCHER'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                Danh sÃ¡ch Voucher
              </h3>
              <p className="text-xs text-slate-400 font-medium">CÃ¡c mÃ£ giáº£m giÃ¡ Ã¡p dá»¥ng trong chiáº¿n dá»‹ch</p>
            </div>
            <button
              onClick={onOpenVoucherModal}
              className="p-2 bg-rose-50 hover:bg-primary hover:text-white rounded-xl text-primary transition-all active:scale-95 shadow-sm"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {vouchers.map((voucher) => (
              <div key={voucher.code} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-rose-100 hover:bg-rose-50/10 transition-all">
                <div className="space-y-1">
                  <span className="text-xs font-black text-primary bg-rose-50 px-2 py-0.5 rounded border border-rose-100/50">
                    {voucher.code}
                  </span>
                  <p className="text-[11px] font-bold text-slate-600 mt-1">{voucher.target}</p>
                  <p className="text-[9px] text-slate-400 font-medium">ÄÃ£ dÃ¹ng: {voucher.usage} láº§n</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-slate-800">-{voucher.discount}%</span>
                  <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">Äang cháº¡y</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[2.5rem] shadow-xl text-white space-y-6 relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mb-16 -mr-16" />
          <div>
            <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              Chiáº¿n dá»‹ch Tiáº¿p thá»‹ Targeted
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">Tiáº¿p cáº­n cÃ¡c nhÃ³m khÃ¡ch hÃ ng má»¥c tiÃªu Ä‘á»ƒ tá»‘i Æ°u chuyá»ƒn Ä‘á»•i</p>
          </div>
          <div className="space-y-4 text-xs font-medium text-slate-300">
            <p>ERP tá»± Ä‘á»™ng phÃ¢n nhÃ³m tá»‡p khÃ¡ch hÃ ng dá»±a trÃªn dá»¯ liá»‡u sáº£n phá»¥ khoa vÃ  tuá»•i cá»§a bÃ©:</p>
            <div className="space-y-2.5">
              <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                <span>Máº¹ báº§u sáº¯p sinh (dob_expected &lt; 30 ngÃ y)</span>
                <span className="text-[10px] font-black text-primary uppercase">12 khÃ¡ch hÃ ng</span>
              </div>
              <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                <span>BÃ© sÆ¡ sinh (dob_baby &lt; 3 thÃ¡ng)</span>
                <span className="text-[10px] font-black text-primary uppercase">18 khÃ¡ch hÃ ng</span>
              </div>
              <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
                <span>BÃ© thÃ´i nÃ´i (dob_baby tá»« 11 - 12 thÃ¡ng)</span>
                <span className="text-[10px] font-black text-primary uppercase">9 khÃ¡ch hÃ ng</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
