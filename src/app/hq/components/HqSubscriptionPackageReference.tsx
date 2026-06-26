import { Crown, Info } from 'lucide-react';
import { getModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';

interface HqSubscriptionPackageReferenceProps {
  tenantModuleKey?: TenantModuleKey | null;
}

export function HqSubscriptionPackageReference({ tenantModuleKey }: HqSubscriptionPackageReferenceProps = {}) {
  const vocab = getModuleVocabulary(tenantModuleKey);
  
  return (
            <section className="bg-gradient-to-br from-white to-slate-50 dark:from-[#1C1B19] dark:to-[#11100F] border border-slate-100 dark:border-[#3E3A35] rounded-[3rem] p-6 shadow-sm text-left transition-colors duration-300">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-rose-50 dark:bg-[#5D1C34]/40 text-primary dark:text-rose-400 rounded-xl flex items-center justify-center">
                  <Crown size={18} />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-[#EFE9E1] uppercase tracking-widest leading-none">
                    Thông tin Gói dịch vụ & Định mức Hệ thống
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-[#CDBCAB] font-bold mt-0.5 uppercase tracking-wider">
                    Mỗi chi nhánh hoạt động theo giới hạn tài nguyên của gói dịch vụ đã đăng ký.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Free Trial */}
                <div className="bg-white/80 dark:bg-[#1C1B19]/80 backdrop-blur-sm border border-slate-100 dark:border-[#3E3A35] rounded-2xl p-4 space-y-2 shadow-xs transition-colors duration-300">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-slate-100 dark:bg-[#292623] text-slate-500 dark:text-[#CDBCAB] dark:border dark:border-[#3E3A35]">
                      Free Trial
                    </span>
                    <span className="text-[10px] font-black text-slate-400 dark:text-[#CDBCAB]">Dùng thử</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-600 dark:text-[#CDBCAB] flex justify-between">
                      <span>{vocab.worker.singular}:</span> <span className="font-black text-slate-800 dark:text-[#EFE9E1]">Tối đa 1 {vocab.worker.short}</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-[#CDBCAB] flex justify-between">
                      <span>Khách hàng:</span> <span className="font-black text-slate-800 dark:text-[#EFE9E1]">Tối đa 15</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-[#CDBCAB] flex justify-between">
                      <span>Zalo SMS:</span> <span className="font-black text-slate-800 dark:text-[#EFE9E1]">Tối đa 20</span>
                    </p>
                  </div>
                </div>

                {/* Basic */}
                <div className="bg-white/80 dark:bg-[#1C1B19]/80 backdrop-blur-sm border border-slate-100 dark:border-[#3E3A35] rounded-2xl p-4 space-y-2 shadow-xs transition-colors duration-300">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-slate-200 to-slate-300 dark:from-[#292623] dark:to-[#3E3A35] text-slate-800 dark:text-[#EFE9E1] border border-slate-350 dark:border-[#3E3A35]">
                      Silver / Basic
                    </span>
                    <span className="text-[10px] font-black text-slate-500 dark:text-[#CDBCAB]">Cơ bản</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-600 dark:text-[#CDBCAB] flex justify-between">
                      <span>{vocab.worker.singular}:</span> <span className="font-black text-slate-800 dark:text-[#EFE9E1]">Tối đa 3 {vocab.worker.short}</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-[#CDBCAB] flex justify-between">
                      <span>Khách hàng:</span> <span className="font-black text-slate-800 dark:text-[#EFE9E1]">Tối đa 50</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-[#CDBCAB] flex justify-between">
                      <span>Zalo SMS:</span> <span className="font-black text-slate-800 dark:text-[#EFE9E1]">Tối đa 100</span>
                    </p>
                  </div>
                </div>

                {/* Pro */}
                <div className="bg-white/80 dark:bg-[#1C1B19]/80 backdrop-blur-sm border border-slate-100 dark:border-[#3E3A35] rounded-2xl p-4 space-y-2 shadow-xs transition-colors duration-300">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-400 to-yellow-500 dark:from-[#A67D44]/20 dark:to-[#A67D44]/40 text-amber-950 dark:text-[#EFE9E1] border border-amber-300/30 dark:border-[#A67D44]/30">
                      Gold / Pro
                    </span>
                    <span className="text-[10px] font-black text-amber-600 dark:text-amber-400">Chuyên nghiệp</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-600 dark:text-[#CDBCAB] flex justify-between">
                      <span>{vocab.worker.singular}:</span> <span className="font-black text-slate-800 dark:text-[#EFE9E1]">Tối đa 10 {vocab.worker.short}</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-[#CDBCAB] flex justify-between">
                      <span>Khách hàng:</span> <span className="font-black text-slate-800 dark:text-[#EFE9E1]">Tối đa 500</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-[#CDBCAB] flex justify-between">
                      <span>Zalo SMS:</span> <span className="font-black text-slate-800 dark:text-[#EFE9E1]">Tối đa 500</span>
                    </p>
                  </div>
                </div>

                {/* Enterprise */}
                <div className="bg-white/80 dark:bg-[#1C1B19]/80 backdrop-blur-sm border border-slate-100 dark:border-[#3E3A35] rounded-2xl p-4 space-y-2 shadow-xs transition-colors duration-300">
                  <div className="flex justify-between items-center">
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-gradient-to-r from-rose-500 via-purple-600 to-indigo-500 text-white border border-white/20 dark:border-[#5D1C34]/40 animate-pulse">
                      Diamond / Enterprise
                    </span>
                    <span className="text-[10px] font-black text-rose-500 dark:text-rose-400">Nhượng quyền</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-600 dark:text-[#CDBCAB] flex justify-between">
                      <span>{vocab.worker.singular}:</span> <span className="font-black text-rose-600 dark:text-rose-400">Không giới hạn</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-[#CDBCAB] flex justify-between">
                      <span>Khách hàng:</span> <span className="font-black text-rose-600 dark:text-rose-400">Không giới hạn</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600 dark:text-[#CDBCAB] flex justify-between">
                      <span>Zalo SMS:</span> <span className="font-black text-rose-600 dark:text-rose-400">Tối đa 2000</span>
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex items-start gap-2 bg-indigo-50/50 border border-indigo-100/40 rounded-xl p-3 text-[11px] text-slate-500 font-bold">
                <Info size={14} className="text-indigo-500 shrink-0 mt-0.5" />
                <p>
                  <span className="text-slate-700 font-black">Hướng dẫn kiểm tra:</span> Chủ chi nhánh (Branch Admin) có thể kiểm tra định mức tài nguyên đã dùng, số KTV đang hoạt động, và gia hạn nâng cấp các gói dịch vụ này trực tiếp trong phần <span className="text-slate-900 font-black">&quot;Cấu hình hệ thống&quot; → Tab &quot;Gói dịch vụ&quot;</span> của trang quản lý chi nhánh. Tổng bộ HQ có thể theo dõi phân loại gói của từng chi nhánh ngay tại danh sách bên dưới.
                </p>
              </div>
            </section>
  );
}
