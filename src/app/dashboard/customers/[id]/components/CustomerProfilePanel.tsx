'use client';

import { cn } from '@/lib/utils';
import { Baby, Heart, MapPin, Phone, PlusCircle, Sparkles, TrendingUp } from 'lucide-react';
import { getTenantModulePresentationOrNeutral } from '@/lib/business-rules/tenant-module-presentation';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import type { CustomerDetailRecord } from '../types';

export function CustomerProfilePanel({
  customer,
  tenantModuleKey,
  userRole,
  onEditCustomer,
  onOpenBooking,
}: {
  customer: CustomerDetailRecord;
  tenantModuleKey: TenantModuleKey | null;
  userRole: 'admin' | 'ktv';
  onEditCustomer: () => void;
  onOpenBooking: () => void;
}) {
  const customerLabels = getTenantModulePresentationOrNeutral(tenantModuleKey);
  const SecondaryIcon = tenantModuleKey === 'babycare' ? Baby : Sparkles;

  return (
        <div className="space-y-6 xl:col-span-1 xl:space-y-8">
          <div className="relative overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-8 xl:rounded-[3rem]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="flex flex-col items-center text-center relative z-10">
              <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-[2rem] border-4 border-white bg-rose-50 shadow-2xl shadow-rose-100 dark:shadow-none sm:mb-6 sm:h-32 sm:w-32 sm:rounded-[2.5rem]">
                <Heart className="h-11 w-11 text-primary sm:h-14 sm:w-14" />
              </div>
              <h1 className="mb-2 max-w-full break-words text-xl font-black text-slate-900 sm:text-2xl">{customer.name_mother}</h1>
              {userRole === 'admin' && (
                <span className={cn(
                  "mb-6 max-w-full break-words rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] sm:mb-8 sm:tracking-[0.2em]",
                  customer.is_fully_paid ? 'bg-blue-50 text-blue-600' :
                  (customer.status === 'active' || customer.status === 'booked' || customer.status === 'in_progress') ? 'bg-emerald-50 text-emerald-600' :
                  customer.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                  customer.status === 'deposit_pending' ? 'bg-amber-50 text-amber-600' :
                  'bg-slate-50 text-slate-500'
                )}>
                  {customer.is_fully_paid ? 'Đã thanh toán thành công' :
                  (customer.status === 'active' || customer.status === 'booked' || customer.status === 'in_progress') ? customerLabels.activeStatusLabel :
                  customer.status === 'completed' ? 'Đã hoàn tất' :
                  customer.status === 'deposit_pending' ? customerLabels.depositStatusLabel :
                  customerLabels.leadStatusLabel}
                </span>
              )}

              <div className="w-full space-y-3 sm:space-y-4">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 shrink-0 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Điện thoại</p>
                    <p className="break-all font-bold text-slate-700">{customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 shrink-0 bg-white rounded-xl flex items-center justify-center text-primary shadow-sm">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Địa chỉ</p>
                    <p className="break-words font-bold text-slate-700" title={customer.address || undefined}>{customer.address}</p>
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
                className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-4 font-black text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95 sm:mt-8"
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

          <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-xl shadow-slate-200/50 sm:p-8 xl:rounded-[3rem]">
            <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3">
              <SecondaryIcon className="text-primary w-6 h-6" />
              {customerLabels.secondaryInfoTitle}
            </h3>
            <div className="space-y-4">
              <div className="flex flex-col gap-1 rounded-2xl border border-rose-100/50 bg-rose-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-bold text-slate-500">{customerLabels.secondaryInfoNameLabel}</span>
                <span className="break-words font-black text-slate-900">{customer.baby.name}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-bold text-slate-500">{customerLabels.secondaryInfoDateLabel}</span>
                <span className="break-words font-black text-slate-900">{customer.baby.dob}</span>
              </div>
              {/* Chỉ hiển thị Giới tính cho babycare và beauty_spa, không hiển thị cho industrial_cleaning */}
              {tenantModuleKey !== 'industrial_cleaning' && (
                <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-bold text-slate-500">{customerLabels.secondaryGenderLabel}</span>
                  <span className="break-words font-black text-slate-900">{customer.baby.gender}</span>
                </div>
              )}
            </div>
          </div>
        </div>
  );
}
