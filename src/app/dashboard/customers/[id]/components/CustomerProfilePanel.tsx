'use client';

import { cn } from '@/lib/utils';
import { Baby, Heart, MapPin, Phone, PlusCircle, TrendingUp } from 'lucide-react';
import type { CustomerDetailRecord } from '../types';

export function CustomerProfilePanel({
  customer,
  userRole,
  onEditCustomer,
  onOpenBooking,
}: {
  customer: CustomerDetailRecord;
  userRole: 'admin' | 'ktv';
  onEditCustomer: () => void;
  onOpenBooking: () => void;
}) {
  return (
        <div className="xl:col-span-1 space-y-8">
          <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="w-32 h-32 bg-rose-50 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl shadow-rose-100 dark:shadow-none border-4 border-white">
                <Heart className="text-primary w-14 h-14" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 mb-2">{customer.name_mother}</h1>
              {userRole === 'admin' && (
                <span className={cn(
                  "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-8",
                  customer.is_fully_paid ? 'bg-blue-50 text-blue-600' :
                  (customer.status === 'active' || customer.status === 'booked' || customer.status === 'in_progress') ? 'bg-emerald-50 text-emerald-600' :
                  customer.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                  customer.status === 'deposit_pending' ? 'bg-amber-50 text-amber-600' :
                  'bg-slate-50 text-slate-500'
                )}>
                  {customer.is_fully_paid ? 'Đã thanh toán thành công' :
                  (customer.status === 'active' || customer.status === 'booked' || customer.status === 'in_progress') ? 'Đang chăm sóc' :
                  customer.status === 'completed' ? 'Đã hoàn tất' :
                  customer.status === 'deposit_pending' ? 'Chờ sinh (Đã cọc)' :
                  'Khách mới (Lead)'}
                </span>
              )}

              <div className="w-full space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Điện thoại</p>
                    <p className="font-bold text-slate-700">{customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Địa chỉ</p>
                    <p className="font-bold text-slate-700 truncate max-w-[150px]" title={customer.address || undefined}>{customer.address}</p>
                    {customer.latitude && customer.longitude && (
                      <p className="text-[9px] font-black text-rose-500 mt-0.5">
                        GPS: {customer.latitude.toFixed(4)}, {customer.longitude.toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                onClick={onEditCustomer}
                className="w-full mt-8 flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black transition-all shadow-lg active:scale-95"
              >
                <PlusCircle className="w-5 h-5" />
                <span>CẬP NHẬT THÔNG TIN</span>
              </button>

              <button
                onClick={onOpenBooking}
                className="w-full mt-4 flex items-center justify-center gap-3 bg-rose-500 hover:bg-rose-600 text-white py-4 rounded-2xl font-black transition-all shadow-lg shadow-rose-200 dark:shadow-none active:scale-95"
              >
                <TrendingUp className="w-5 h-5" />
                <span>ĐẶT LỊCH NGAY</span>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
              <Baby className="text-primary w-6 h-6" />
              Thông tin Bé
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                <span className="text-sm font-bold text-slate-500">Tên của bé</span>
                <span className="font-black text-slate-900">{customer.baby.name}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <span className="text-sm font-bold text-slate-500">Ngày sinh / Dự sinh</span>
                <span className="font-black text-slate-900">{customer.baby.dob}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                <span className="text-sm font-bold text-slate-500">Giới tính</span>
                <span className="font-black text-slate-900">{customer.baby.gender}</span>
              </div>
            </div>
          </div>
        </div>
  );
}
