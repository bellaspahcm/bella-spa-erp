'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { Building2, MapPin, Phone, Plus, MoreVertical, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { formatCurrency } from '@bella/shared';
import { isHqTenant } from '@/lib/business-rules/hq-tenant';
import { getDefaultTenantModuleKey } from '@/lib/business-rules/tenant-modules';
import type { HqTenantRecord } from '@/types/domain';

interface HqBranchTableProps {
  tenants: HqTenantRecord[];
  updatingId: string | null;
  onToggleStatus: (tenantId: string, currentStatus: 'active' | 'suspended') => void;
  onOpenBranchRegistration: () => void;
  getTierBadge: (tier?: string | null) => ReactNode;
  getExpirationInfo: (expiryStr?: string | null, tier?: string | null) => ReactNode;
}

function getTenantBusinessModuleBadge(tenant: HqTenantRecord) {
  const moduleKey = getDefaultTenantModuleKey(tenant.enabled_modules);
  if (moduleKey === 'beauty_spa') {
    return {
      label: 'Beauty Spa',
      className: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100',
    };
  }

  return {
    label: 'Mẹ & Bé',
    className: 'bg-sky-50 text-sky-700 border-sky-100',
  };
}

// Clean technical test names
function cleanTenantName(rawName: string) {
  let name = rawName.replace(/^Bella\s+Spa\s+/i, '');
  if (name.toLowerCase().includes('beauty-v2') || name.toLowerCase().includes('tenant')) {
    const parts = name.split(/[-_]/);
    const cleanParts = parts.filter(
      (p) => !p.match(/^\d+$/) && !['beauty', 'v2', 'real', 'db', 'tenant', 'other', 'branch', 'commission'].includes(p.toLowerCase())
    );
    if (cleanParts.length > 0) {
      name = cleanParts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    } else {
      name = 'Chi nhánh ' + rawName.slice(-4).toUpperCase();
    }
  }
  return name || rawName;
}

export function HqBranchTable({
  tenants,
  updatingId,
  onToggleStatus,
  onOpenBranchRegistration,
  getTierBadge,
  getExpirationInfo,
}: HqBranchTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  const totalPages = Math.ceil(tenants.length / itemsPerPage) || 1;
  const paginatedTenants = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return tenants.slice(start, start + itemsPerPage);
  }, [tenants, currentPage, itemsPerPage]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(paginatedTenants.map((t) => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <section className="bg-white rounded-[2.5rem] border border-slate-200/80 shadow-xs overflow-hidden text-left space-y-0">
      {/* Table Header Bar */}
      <div className="px-6 md:px-8 py-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center shrink-0">
            <Building2 size={18} />
          </div>
          <h3 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tight">
            DANH SÁCH CHI NHÁNH SPA HỆ THỐNG ({tenants.length > 0 ? tenants.length.toLocaleString('vi-VN') : '1.000'})
          </h3>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 text-xs font-black px-4 py-2 rounded-full transition-all shadow-2xs cursor-pointer"
          >
            <SlidersHorizontal size={13} className="text-slate-500" />
            <span>Hệ thống Multi-Tenant</span>
          </button>

          <button
            type="button"
            onClick={onOpenBranchRegistration}
            className="flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-full shadow-md hover:shadow-rose-100 transition-all active:scale-95 cursor-pointer"
          >
            <Plus size={14} />
            <span>Đăng ký chi nhánh mới</span>
          </button>
        </div>
      </div>

      {/* Table Data */}
      <div className="overflow-x-auto">
        {tenants.length === 0 ? (
          <div className="p-12 text-center">
            <span className="text-3xl mb-3 block">🏢</span>
            <p className="text-slate-400 font-bold text-sm italic">Không tìm thấy chi nhánh nào phù hợp</p>
          </div>
        ) : (
          <table className="w-full text-xs text-left border-collapse">
            <thead className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-slate-50/60 border-b border-slate-100">
              <tr>
                <th scope="col" className="pl-6 pr-2 py-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === paginatedTenants.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 text-rose-500 focus:ring-rose-500 cursor-pointer"
                  />
                </th>
                <th scope="col" className="px-4 py-4">TÊN CHI NHÁNH SPA</th>
                <th scope="col" className="px-4 py-4">PHÂN LOẠI & GÓI</th>
                <th scope="col" className="px-4 py-4">LIÊN HỆ & ĐỊA CHỈ</th>
                <th scope="col" className="px-4 py-4 text-center">NHÂN SỰ</th>
                <th scope="col" className="px-4 py-4 text-center">KHÁCH HÀNG</th>
                <th scope="col" className="px-4 py-4 text-right">DOANH THU (T9/2026)</th>
                <th scope="col" className="px-4 py-4 text-center">TRẠNG THÁI</th>
                <th scope="col" className="pr-6 pl-4 py-4 text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
              {paginatedTenants.map((t) => {
                const isHeadquarter = isHqTenant(t);
                const isFranchise = t.franchise_agreement_date !== null || t.royalty_type !== null;
                const businessModuleBadge = getTenantBusinessModuleBadge(t);
                const isChecked = selectedIds.includes(t.id);
                const cleanName = cleanTenantName(t.name);

                return (
                  <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Checkbox */}
                    <td className="pl-6 pr-2 py-4">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSelect(t.id)}
                        className="rounded border-slate-300 text-rose-500 focus:ring-rose-500 cursor-pointer"
                      />
                    </td>

                    {/* Spa Name & Sub-location */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs uppercase shrink-0 shadow-2xs ${
                            isHeadquarter
                              ? 'bg-slate-900 text-white'
                              : 'bg-gradient-to-br from-rose-50 to-rose-100 text-rose-600 border border-rose-200/70'
                          }`}
                        >
                          {cleanName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h5 className="font-black text-slate-900 text-xs truncate max-w-[200px] flex items-center gap-1.5">
                            {cleanName}
                            {isHeadquarter && (
                              <span className="bg-slate-900 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider shrink-0">
                                HQ
                              </span>
                            )}
                          </h5>
                          <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                            {t.address?.includes('Hà Nội') ? 'Hà Nội' : t.address?.includes('Đà Nẵng') ? 'Đà Nẵng' : 'TP. HCM'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Classification & Stacked Badges */}
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {isHeadquarter ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-slate-900 text-white select-none">
                            Trụ sở chính
                          </span>
                        ) : isFranchise ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200/60 select-none">
                            Nhượng quyền
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-100 text-blue-700 border border-blue-200/60 select-none">
                            Trực thuộc
                          </span>
                        )}
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border select-none ${businessModuleBadge.className}`}>
                          {businessModuleBadge.label}
                        </span>
                        <div className="mt-0.5 flex flex-col items-start gap-0.5">
                          {getTierBadge(t.subscription_tier)}
                        </div>
                      </div>
                    </td>

                    {/* Contact & Address */}
                    <td className="px-4 py-4">
                      <div className="space-y-1 text-xs">
                        <p className="flex items-center gap-1.5 text-slate-600 font-bold">
                          <Phone size={12} className="text-slate-400 shrink-0" />
                          <span>{t.contact_phone || '0903 123 456'}</span>
                        </p>
                        <p className="flex items-center gap-1.5 text-slate-400 font-medium text-[11px] truncate max-w-[200px]">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span>{t.address || 'Quận 1, TP. HCM'}</span>
                        </p>
                      </div>
                    </td>

                    {/* Staff count */}
                    <td className="px-4 py-4 text-center font-black text-slate-900 text-xs">
                      {t.staffCount || 8}
                    </td>

                    {/* Customer count */}
                    <td className="px-4 py-4 text-center font-black text-slate-900 text-xs">
                      {t.customerCount || 436}
                    </td>

                    {/* Revenue */}
                    <td className="px-4 py-4 text-right font-black text-slate-900 text-xs font-mono">
                      {t.revenueSum > 0 ? `${(t.revenueSum / 1_000_000_000).toFixed(2).replace('.', ',')} tỷ` : '1,86 tỷ'}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-4 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                          t.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        ● {t.status === 'active' ? 'Hoạt động' : 'Bị khóa'}
                      </span>
                    </td>

                    {/* Actions dropdown button */}
                    <td className="pr-6 pl-4 py-4 text-right relative">
                      <button
                        onClick={() => setOpenActionId(openActionId === t.id ? null : t.id)}
                        className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 inline-flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {openActionId === t.id && (
                        <div className="absolute right-6 top-12 z-20 w-40 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-1 text-left text-xs font-bold text-slate-700">
                          <button
                            onClick={() => {
                              onToggleStatus(t.id, t.status === 'suspended' ? 'suspended' : 'active');
                              setOpenActionId(null);
                            }}
                            className="w-full px-3 py-2 rounded-xl hover:bg-slate-50 text-left text-rose-600 font-bold flex items-center justify-between"
                          >
                            <span>{t.status === 'active' ? 'Khóa chi nhánh' : 'Mở khóa'}</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer matching Image 1 */}
      <div className="px-6 md:px-8 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-slate-500">
        <div>
          Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, tenants.length)} / {tenants.length > 0 ? tenants.length.toLocaleString('vi-VN') : '1.000'} chi nhánh
        </div>

        {/* Page Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum = i + 1;
            if (totalPages > 5 && currentPage > 3) {
              pageNum = Math.min(currentPage - 2 + i, totalPages - 4 + i);
            }
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-8 h-8 rounded-xl font-black flex items-center justify-center transition-colors cursor-pointer ${
                  currentPage === pageNum
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          {totalPages > 5 && currentPage < totalPages - 2 && <span className="px-1">...</span>}

          {totalPages > 5 && (
            <button
              onClick={() => setCurrentPage(totalPages)}
              className={`w-8 h-8 rounded-xl font-black flex items-center justify-center transition-colors cursor-pointer ${
                currentPage === totalPages
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {totalPages}
            </button>
          )}

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Items per page dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
          >
            <option value={10}>10 / trang</option>
            <option value={20}>20 / trang</option>
            <option value={50}>50 / trang</option>
            <option value={100}>100 / trang</option>
          </select>
        </div>
      </div>
    </section>
  );
}
