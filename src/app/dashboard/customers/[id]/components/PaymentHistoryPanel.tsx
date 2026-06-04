'use client';

import { cn, formatNumberWithSeparator } from '@/lib/utils';
import { CreditCard as CreditCardIcon, DollarSign as DollarIcon } from 'lucide-react';
import type { CustomerDetailBooking } from '../types';

export function PaymentHistoryPanel({
  activeBooking,
  userRole,
}: {
  activeBooking: CustomerDetailBooking | null;
  userRole: 'admin' | 'ktv';
}) {
  if (userRole !== 'admin' || !activeBooking) return null;

  return (
            <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 mt-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 flex-wrap">
                  <CreditCardIcon className="text-primary w-6 h-6 flex-shrink-0" />
                  <span>Lịch sử Thanh toán & Đối soát</span>
                </h3>
                <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-primary">
                  Tổng thu: {formatNumberWithSeparator(activeBooking.deposit_amount || 0)}đ
                </span>
              </div>

              <div className="space-y-4">
                {activeBooking.revenue && activeBooking.revenue.length > 0 ? (
                  activeBooking.revenue.map((rev) => (
                    <div key={rev.id} className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-slate-50 rounded-[2rem] hover:bg-slate-100 transition-all gap-4">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm">
                          <DollarIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-slate-800">
                              {rev.revenue_type === 'deposit' ? 'Đặt cọc gói' :
                               rev.revenue_type === 'remaining_payment' ? 'Thanh toán nốt' :
                               rev.revenue_type === 'package_payment' ? 'Thanh toán trọn gói' :
                               rev.revenue_type === 'session_completed' ? 'Thanh toán theo buổi' :
                               'Thu bổ sung'}
                            </p>
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                              rev.payment_method === 'bank_transfer' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                            )}>
                              {rev.payment_method === 'bank_transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                            </span>
                            <span className={cn(
                              "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                              rev.status === 'confirmed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-500'
                            )}>
                              {rev.status === 'confirmed' ? 'Đã đối soát' : 'Chờ xác nhận'}
                            </span>
                          </div>
                          <p className="text-xs font-bold text-slate-400 mt-1">
                            Ngày thu: <strong className="text-slate-600">{rev.received_date}</strong>
                            {rev.recorded_by?.full_name && (
                              <> • Người ghi nhận: <strong className="text-slate-600">{rev.recorded_by.full_name}</strong></>
                            )}
                          </p>
                          {rev.notes && (
                            <p className="text-[11px] font-medium text-slate-500 mt-2 pl-3 border-l-2 border-slate-200 italic">
                              &quot;{rev.notes}&quot;
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end justify-center">
                        <span className="text-lg font-black text-emerald-600">
                          +{formatNumberWithSeparator(rev.amount)}đ
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                    <DollarIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-400 font-bold italic">Chưa có giao dịch thanh toán nào được ghi nhận</p>
                  </div>
                )}
              </div>
            </div>
  );
}
