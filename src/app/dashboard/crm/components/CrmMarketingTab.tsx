'use client';

import { Gift, Percent, Plus, Tag } from 'lucide-react';
import type { BirthdayCustomer, VoucherCampaign } from '../types';

interface CrmMarketingTabProps {
  birthdayCustomers: BirthdayCustomer[];
  vouchers: VoucherCampaign[];
  loadError: string | null;
  voucherError: string | null;
  isLoadingVouchers: boolean;
  actionLoading: string | null;
  onSendBirthday: (customerId: string, babyName: string) => void;
  onOpenVoucherModal: () => void;
}

export function CrmMarketingTab({
  birthdayCustomers,
  vouchers,
  loadError,
  voucherError,
  isLoadingVouchers,
  actionLoading,
  onSendBirthday,
  onOpenVoucherModal,
}: CrmMarketingTabProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 bg-white rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden">
        <div className="p-6 border-b border-slate-50">
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Kỷ niệm sinh nhật của bé trong tháng</h3>
          <p className="text-xs text-slate-400 font-medium">Chiến dịch gửi tin nhắn chúc mừng & voucher tự động</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="py-4 px-6">Tên mẹ & bé</th>
                <th className="py-4 px-6">Ngày sinh của bé</th>
                <th className="py-4 px-6">Tuổi của bé</th>
                <th className="py-4 px-6">Khoảng cách</th>
                <th className="py-4 px-6 text-center">Gửi chúc mừng</th>
              </tr>
            </thead>
            <tbody>
              {birthdayCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400 font-medium italic">
                    {loadError ? 'Không thể tải danh sách sinh nhật trong tháng.' : 'Không tìm thấy bé nào có sinh nhật trong tháng này.'}
                  </td>
                </tr>
              ) : (
                birthdayCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-slate-100/70 hover:bg-slate-50/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-slate-800">{customer.name_baby || 'Bé cưng'}</span>
                        <span className="text-[11px] text-slate-400 font-bold">Mẹ: {customer.name_mother} • SĐT: {customer.phone}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-bold text-slate-600">{customer.dobFormatted}</span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-black text-primary uppercase tracking-wide">Tròn {customer.ageYears} tuổi</span>
                    </td>
                    <td className="py-4 px-6">
                      {customer.isToday ? (
                        <span className="inline-block px-2.5 py-1 bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse">
                          Hôm nay
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">Còn {customer.daysUntil} ngày</span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => onSendBirthday(customer.id, customer.name_baby || 'bé')}
                        disabled={actionLoading === customer.id}
                        className="px-4 py-2 bg-gradient-to-r from-primary to-rose-500 hover:from-primary/95 hover:to-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-rose-100 dark:shadow-none hover:shadow-lg transition-all flex items-center gap-1.5 mx-auto disabled:opacity-50"
                      >
                        <Gift className="w-3.5 h-3.5" />
                        {actionLoading === customer.id ? 'Đang gửi...' : 'Tặng voucher'}
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
                Danh sách voucher
              </h3>
              <p className="text-xs text-slate-400 font-medium">Các mã giảm giá áp dụng trong chiến dịch</p>
            </div>
            <button
              onClick={onOpenVoucherModal}
              className="p-2 bg-rose-50 hover:bg-primary hover:text-white rounded-xl text-primary transition-all active:scale-95 shadow-sm"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            {isLoadingVouchers ? (
              <p className="py-8 text-center text-xs font-bold text-slate-400">Đang tải danh sách voucher...</p>
            ) : voucherError ? (
              <p className="py-8 text-center text-xs font-bold text-rose-500">{voucherError}</p>
            ) : vouchers.length === 0 ? (
              <p className="py-8 text-center text-xs font-bold text-slate-400">Chưa có voucher khuyến mãi nào.</p>
            ) : (
              vouchers.map((voucher) => (
              <div key={voucher.id} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-rose-100 hover:bg-rose-50/10 transition-all">
                <div className="space-y-1">
                  <span className="text-xs font-black text-primary bg-rose-50 px-2 py-0.5 rounded border border-rose-100/50">{voucher.code}</span>
                  <p className="text-[11px] font-bold text-slate-600 mt-1">{voucher.target}</p>
                  <p className="text-[9px] text-slate-400 font-medium">Đã dùng: {voucher.usage} lần</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-slate-800">-{voucher.discount}%</span>
                  <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${voucher.status === 'active' ? 'text-emerald-500' : 'text-slate-400'}`}>
                    {voucher.status === 'active' ? 'Đang chạy' : 'Tạm ngưng'}
                  </p>
                </div>
              </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[2.5rem] shadow-xl text-white space-y-6 relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl -mb-16 -mr-16" />
          <div>
            <h3 className="text-base font-black uppercase tracking-wider flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              Chiến dịch tiếp thị targeted
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">Tiếp cận nhóm khách hàng mục tiêu để tối ưu chuyển đổi</p>
          </div>
          <div className="space-y-4 text-xs font-medium text-slate-300">
            <p>ERP phân nhóm khách hàng dựa trên dữ liệu sản phụ khoa và tuổi của bé.</p>
            <div className="space-y-2.5">
              <Segment label="Mẹ bầu sắp sinh" count="12 khách hàng" />
              <Segment label="Bé sơ sinh" count="18 khách hàng" />
              <Segment label="Bé thôi nôi" count="9 khách hàng" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Segment({ label, count }: { label: string; count: string }) {
  return (
    <div className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between">
      <span>{label}</span>
      <span className="text-[10px] font-black text-primary uppercase">{count}</span>
    </div>
  );
}
