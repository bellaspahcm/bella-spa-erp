'use client';

import { Crown, Info, Send, Users, UserCheck, MessageSquare, ArrowRight, Settings, ChevronRight } from 'lucide-react';

interface HqSubscriptionPackageReferenceProps {
  onSelectTierFilter?: (tier: string) => void;
}

export function HqSubscriptionPackageReference({ onSelectTierFilter }: HqSubscriptionPackageReferenceProps) {
  return (
    <section className="bg-white rounded-[2.5rem] border border-slate-200/80 p-6 md:p-8 shadow-xs text-left space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center shrink-0">
            <Crown size={20} />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tight">
              THÔNG TIN GÓI DỊCH VỤ & ĐỊNH MỨC HỆ THỐNG
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">
              Mỗi chi nhánh hoạt động theo giới hạn tài nguyên của gói dịch vụ đã đăng ký.
            </p>
          </div>
        </div>

        <button className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-2xl text-xs font-black text-slate-700 flex items-center gap-1.5 transition-all shadow-2xs shrink-0 cursor-pointer">
          <Settings size={14} className="text-slate-500" />
          <span>Quản lý gói dịch vụ</span>
          <ChevronRight size={14} className="text-slate-400" />
        </button>
      </div>

      {/* 4 Tier Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* FREE TRIAL */}
        <div className="bg-slate-50/60 border border-slate-200/70 rounded-3xl p-5 flex flex-col justify-between hover:shadow-md transition-all group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200/80 inline-flex items-center gap-1.5">
                <Send size={11} className="text-slate-500" />
                FREE TRIAL
              </span>
            </div>

            <div className="my-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-slate-900 font-mono">84</span>
              <span className="text-xs font-bold text-slate-500">chi nhánh</span>
            </div>

            <div className="space-y-2 border-t border-slate-200/60 pt-3 text-xs font-bold text-slate-600">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <UserCheck size={13} className="text-slate-400" /> Nhân viên
                </span>
                <span className="font-black text-slate-900">Tối đa 1</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Users size={13} className="text-slate-400" /> Khách hàng
                </span>
                <span className="font-black text-slate-900">Tối đa 15</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <MessageSquare size={13} className="text-slate-400" /> Zalo SMS
                </span>
                <span className="font-black text-slate-900">Tối đa 20</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSelectTierFilter && onSelectTierFilter('free_trial')}
            className="mt-5 w-full py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200/80 font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs group-hover:border-slate-300 cursor-pointer"
          >
            <span>Xem chi nhánh</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* SILVER / BASIC */}
        <div className="bg-blue-50/30 border border-blue-100 rounded-3xl p-5 flex flex-col justify-between hover:shadow-md transition-all group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200/80 inline-flex items-center gap-1.5">
                <Crown size={11} className="text-blue-600" />
                SILVER / BASIC
              </span>
            </div>

            <div className="my-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-slate-900 font-mono">312</span>
              <span className="text-xs font-bold text-slate-500">chi nhánh</span>
            </div>

            <div className="space-y-2 border-t border-blue-100 pt-3 text-xs font-bold text-slate-600">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <UserCheck size={13} className="text-blue-500" /> Nhân viên
                </span>
                <span className="font-black text-slate-900">Tối đa 3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Users size={13} className="text-blue-500" /> Khách hàng
                </span>
                <span className="font-black text-slate-900">Tối đa 50</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <MessageSquare size={13} className="text-blue-500" /> Zalo SMS
                </span>
                <span className="font-black text-slate-900">Tối đa 100</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSelectTierFilter && onSelectTierFilter('basic')}
            className="mt-5 w-full py-2.5 rounded-2xl bg-blue-50/80 hover:bg-blue-100 text-blue-700 border border-blue-200/80 font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs group-hover:border-blue-300 cursor-pointer"
          >
            <span>Xem chi nhánh</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* GOLD / PRO */}
        <div className="bg-amber-50/40 border border-amber-100 rounded-3xl p-5 flex flex-col justify-between hover:shadow-md transition-all group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200/80 inline-flex items-center gap-1.5">
                <Crown size={11} className="text-amber-700" />
                GOLD / PRO
              </span>
            </div>

            <div className="my-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-slate-900 font-mono">428</span>
              <span className="text-xs font-bold text-slate-500">chi nhánh</span>
            </div>

            <div className="space-y-2 border-t border-amber-100 pt-3 text-xs font-bold text-slate-600">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <UserCheck size={13} className="text-amber-600" /> Nhân viên
                </span>
                <span className="font-black text-slate-900">Tối đa 10</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Users size={13} className="text-amber-600" /> Khách hàng
                </span>
                <span className="font-black text-slate-900">Tối đa 500</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <MessageSquare size={13} className="text-amber-600" /> Zalo SMS
                </span>
                <span className="font-black text-slate-900">Tối đa 500</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSelectTierFilter && onSelectTierFilter('pro')}
            className="mt-5 w-full py-2.5 rounded-2xl bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80 font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs group-hover:border-amber-300 cursor-pointer"
          >
            <span>Xem chi nhánh</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {/* DIAMOND / ENTERPRISE */}
        <div className="bg-purple-50/40 border border-purple-100 rounded-3xl p-5 flex flex-col justify-between hover:shadow-md transition-all group">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-700 border border-purple-200/80 inline-flex items-center gap-1.5">
                <Crown size={11} className="text-purple-600" />
                DIAMOND / ENTERPRISE
              </span>
            </div>

            <div className="my-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-slate-900 font-mono">176</span>
              <span className="text-xs font-bold text-slate-500">chi nhánh</span>
            </div>

            <div className="space-y-2 border-t border-purple-100 pt-3 text-xs font-bold text-slate-600">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <UserCheck size={13} className="text-purple-600" /> Nhân viên
                </span>
                <span className="font-black text-rose-600">Không giới hạn</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Users size={13} className="text-purple-600" /> Khách hàng
                </span>
                <span className="font-black text-rose-600">Không giới hạn</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <MessageSquare size={13} className="text-purple-600" /> Zalo SMS
                </span>
                <span className="font-black text-rose-600">Tối đa 2000</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onSelectTierFilter && onSelectTierFilter('enterprise')}
            className="mt-5 w-full py-2.5 rounded-2xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/80 font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs group-hover:border-purple-300 cursor-pointer"
          >
            <span>Xem chi nhánh</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="bg-blue-50/70 border border-blue-100/90 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-900">
        <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="font-black text-blue-950">Hướng dẫn kiểm tra:</strong> Chủ chi nhánh (Branch Admin) có thể kiểm tra định mức tài nguyên đã dùng, số KTV đang hoạt động, và gia hạn nâng cấp các gói dịch vụ này trực tiếp trong phần <strong className="text-blue-950">&quot;Cấu hình hệ thống&quot; → Tab &quot;Gói dịch vụ&quot;</strong> của trang quản lý chi nhánh. Tổng bộ HQ có thể theo dõi phân loại gói của từng chi nhánh ngay tại danh sách bên dưới.
        </p>
      </div>
    </section>
  );
}
