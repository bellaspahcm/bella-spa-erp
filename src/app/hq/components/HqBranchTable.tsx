'use client';

import type { ReactNode } from 'react';
import { Lock, MapPin, Phone, Plus, RefreshCw, Unlock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { HqTenantRecord } from '@/types/domain';

interface HqBranchTableProps {
  tenants: HqTenantRecord[];
  updatingId: string | null;
  onToggleStatus: (tenantId: string, currentStatus: 'active' | 'suspended') => void;
  onOpenBranchRegistration: () => void;
  getTierBadge: (tier?: string | null) => ReactNode;
  getExpirationInfo: (expiryStr?: string | null, tier?: string | null) => ReactNode;
}

export function HqBranchTable({
  tenants,
  updatingId,
  onToggleStatus,
  onOpenBranchRegistration,
  getTierBadge,
  getExpirationInfo,
}: HqBranchTableProps) {
  return (
            <section className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden text-left">
              <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Danh sách chi nhánh Spa Hệ thống ({tenants.length})
                </h4>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase hidden sm:inline-block">
                    Hệ thống Multi-Tenant
                  </span>
                  <button
                    type="button"
                    onClick={onOpenBranchRegistration}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-pink-650 hover:from-rose-600 hover:to-pink-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-md hover:shadow-rose-100 dark:hover:shadow-none transition-all active:scale-95 cursor-pointer"
                  >
                    <Plus size={12} />
                    Đăng ký Chi Nhánh mới
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                {tenants.length === 0 ? (
                  <div className="p-12 text-center">
                    <span className="text-3xl mb-3 block">🏢</span>
                    <p className="text-slate-400 font-bold text-sm italic">Không tìm thấy chi nhánh nào phù hợp</p>
                  </div>
                ) : (
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100">
                      <tr>
                        <th scope="col" className="px-8 py-5">Tên chi nhánh Spa</th>
                        <th scope="col" className="px-6 py-5">Phân loại & Gói</th>
                        <th scope="col" className="px-6 py-5">Liên hệ & Địa chỉ</th>
                        <th scope="col" className="px-6 py-5 text-center">Nhân sự</th>
                        <th scope="col" className="px-6 py-5 text-center">Khách hàng</th>
                        <th scope="col" className="px-6 py-5 text-right">Doanh thu chi nhánh</th>
                        <th scope="col" className="px-6 py-5 text-center">Trạng thái</th>
                        <th scope="col" className="px-8 py-5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                      {tenants.map((t) => {
                        const isHeadquarter = t.name === 'Bella Spa Headquarter';
                        const isFranchise = t.franchise_agreement_date !== null || t.royalty_type !== null;
                        return (
                          <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                            {/* Spa Name & Logo Initial */}
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs uppercase shrink-0 ${
                                  isHeadquarter 
                                    ? 'bg-indigo-950 text-white' 
                                    : 'bg-rose-50 text-primary border border-rose-100'
                                }`}>
                                  {t.name.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                  <h5 className="font-black text-slate-900 truncate max-w-[200px] flex items-center gap-1.5">
                                    {t.name}
                                    {isHeadquarter && (
                                      <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">HQ</span>
                                    )}
                                  </h5>
                                  <span className="text-[9px] text-slate-400 font-bold block mt-0.5">
                                    Ngày tham gia: {t.created_at ? new Date(t.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Classification & Subscription package */}
                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-1 items-start text-xs">
                                {isHeadquarter ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-900 text-white border border-slate-700 select-none">
                                    Trụ sở chính
                                  </span>
                                ) : isFranchise ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100 select-none">
                                    Nhượng quyền
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100 select-none">
                                    Trực thuộc
                                  </span>
                                )}
                                <div className="mt-1 flex flex-col items-start gap-0.5">
                                  {getTierBadge(t.subscription_tier)}
                                  {getExpirationInfo(t.subscription_expires_at, t.subscription_tier)}
                                </div>
                              </div>
                            </td>

                            {/* Contact & Address */}
                            <td className="px-6 py-5">
                              <div className="space-y-1 text-xs">
                                <p className="flex items-center gap-1.5 text-slate-600 truncate max-w-[220px]">
                                  <MapPin size={12} className="text-slate-400 shrink-0" />
                                  <span>{t.address || 'Chưa cập nhật'}</span>
                                </p>
                                <p className="flex items-center gap-1.5 text-slate-500 font-bold">
                                  <Phone size={12} className="text-slate-400 shrink-0" />
                                  <span>{t.contact_phone || 'Chưa cập nhật'}</span>
                                </p>
                              </div>
                            </td>

                            {/* Staff count */}
                            <td className="px-6 py-5 text-center font-black text-slate-800">
                              {t.staffCount}
                            </td>

                            {/* Customer count */}
                            <td className="px-6 py-5 text-center font-black text-slate-800">
                              {t.customerCount}
                            </td>

                            {/* Branch Revenue */}
                            <td className="px-6 py-5 text-right font-black text-emerald-600 text-sm">
                              {formatCurrency(t.revenueSum)}
                            </td>

                            {/* Status Badge */}
                            <td className="px-6 py-5 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                t.status === 'active' 
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                                  : 'bg-rose-50 text-rose-600 border border-rose-100'
                              }`}>
                                {t.status === 'active' ? 'Hoạt động' : 'Tạm khóa'}
                              </span>
                            </td>

                            {/* Toggle Suspend Action */}
                            <td className="px-8 py-5 text-right">
                              {isHeadquarter ? (
                                <span className="text-[10px] text-slate-400 font-bold italic">Không thể khóa</span>
                              ) : (
                                <button
                                  onClick={() => onToggleStatus(t.id, t.status === 'suspended' ? 'suspended' : 'active')}
                                  disabled={updatingId === t.id}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${
                                    t.status === 'active'
                                      ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-100/50'
                                      : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-100/50'
                                  }`}
                                >
                                  {updatingId === t.id ? (
                                    <RefreshCw size={12} className="animate-spin" />
                                  ) : t.status === 'active' ? (
                                    <>
                                      <Lock size={12} />
                                      Khóa
                                    </>
                                  ) : (
                                    <>
                                      <Unlock size={12} />
                                      Mở khóa
                                    </>
                                  )}
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
  );
}
