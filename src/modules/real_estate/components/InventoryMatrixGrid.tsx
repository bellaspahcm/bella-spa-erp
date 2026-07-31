'use client';

import React, { useState } from 'react';
import { Database } from '@/types/database.types';
import { UnitDetailModal } from './UnitDetailModal';
import { Building2, Layers, Maximize2, User, HelpCircle } from 'lucide-react';

type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

interface InventoryMatrixGridProps {
  products: ProductRow[];
  onUpdateStatus: (
    productId: string,
    targetStatus: ProductRow['status'],
    ownerName?: string | null
  ) => Promise<void>;
}

interface StatusConfigItem {
  label: string;
  border: string;
  bg: string;
  text: string;
  dot: string;
  glow: string;
}

const STATUS_CONFIG: Record<string, StatusConfigItem> = {
  available: {
    label: 'Tự Do',
    border: 'border-emerald-200/50 dark:border-emerald-800/40',
    bg: 'bg-emerald-50/40 dark:bg-emerald-950/10 hover:bg-emerald-100/50 hover:border-emerald-400/60 dark:hover:bg-emerald-950/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
    glow: 'group-hover:shadow-[0_0_15px_rgba(16,185,129,0.15)]',
  },
  booked: {
    label: 'Giữ Chỗ',
    border: 'border-amber-200/50 dark:border-amber-800/40',
    bg: 'bg-amber-50/40 dark:bg-amber-950/10 hover:bg-amber-100/50 hover:border-amber-400/60 dark:hover:bg-amber-950/20',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    glow: 'group-hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]',
  },
  deposited: {
    label: 'Đã Cọc',
    border: 'border-rose-200/50 dark:border-rose-800/40',
    bg: 'bg-rose-50/40 dark:bg-rose-950/10 hover:bg-rose-100/50 hover:border-rose-400/60 dark:hover:bg-rose-950/20',
    text: 'text-rose-700 dark:text-rose-400',
    dot: 'bg-rose-500',
    glow: 'group-hover:shadow-[0_0_15px_rgba(244,63,94,0.15)]',
  },
  contracted: {
    label: 'Ký HĐMB',
    border: 'border-purple-200/50 dark:border-purple-800/40',
    bg: 'bg-purple-50/40 dark:bg-purple-950/10 hover:bg-purple-100/50 hover:border-purple-400/60 dark:hover:bg-purple-950/20',
    text: 'text-purple-700 dark:text-purple-400',
    dot: 'bg-purple-500',
    glow: 'group-hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]',
  },
  paid: {
    label: 'Thanh Toán',
    border: 'border-blue-200/50 dark:border-blue-800/40',
    bg: 'bg-blue-50/40 dark:bg-blue-950/10 hover:bg-blue-100/50 hover:border-blue-400/60 dark:hover:bg-blue-950/20',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
    glow: 'group-hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]',
  },
  handed_over: {
    label: 'Bàn Giao',
    border: 'border-yellow-200/60 dark:border-yellow-800/40',
    bg: 'bg-yellow-50/40 dark:bg-yellow-950/10 hover:bg-yellow-100/50 hover:border-yellow-400/60 dark:hover:bg-yellow-950/20',
    text: 'text-yellow-750 dark:text-yellow-400',
    dot: 'bg-yellow-500',
    glow: 'group-hover:shadow-[0_0_15px_rgba(234,179,8,0.15)]',
  },
  cancelled: {
    label: 'Đã Hủy',
    border: 'border-slate-200/60 dark:border-slate-800/40',
    bg: 'bg-slate-50/50 dark:bg-slate-900/10 hover:bg-slate-100/50 hover:border-slate-400/60 dark:hover:bg-slate-900/20',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
    glow: 'group-hover:shadow-[0_0_15px_rgba(100,116,139,0.15)]',
  },
};

export const InventoryMatrixGrid: React.FC<InventoryMatrixGridProps> = ({
  products,
  onUpdateStatus,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<ProductRow | null>(null);

  // Group products by Floor (Tầng)
  const groupedByFloor = products.reduce((acc, p) => {
    const floorKey = p.floor || '1';
    if (!acc[floorKey]) acc[floorKey] = [];
    acc[floorKey].push(p);
    return acc;
  }, {} as Record<string, ProductRow[]>);

  // Sort floors numerically ascending
  const sortedFloors = Object.keys(groupedByFloor).sort((a, b) => {
    const numA = parseInt(a, 10) || 0;
    const numB = parseInt(b, 10) || 0;
    return numA - numB;
  });

  const formatPriceMillions = (unitPrice: number, area: number) => {
    const total = (unitPrice * area) / 1_000_000_000;
    return `${total.toFixed(2)} tỷ`;
  };

  return (
    <div className="space-y-6">
      {/* Grid Header & Status Legend */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200/40 dark:border-slate-800/50">
        <div>
          <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            Sơ Đồ Ma Trận Căn Hộ Theo Tầng
          </h2>
          <p className="text-xs font-semibold text-slate-450 dark:text-slate-400 mt-1">
            Chọn căn hộ để cập nhật trạng thái giao dịch hoặc xem hồ sơ chi tiết.
          </p>
        </div>

        {/* Dynamic Status Legend */}
        <div className="flex flex-wrap gap-2.5">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div
              key={key}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 shadow-sm text-xs"
            >
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className="font-bold text-slate-650 dark:text-slate-350">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid Container */}
      <div className="space-y-6">
        {sortedFloors.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 text-slate-400 font-semibold flex flex-col items-center justify-center gap-2">
            <HelpCircle className="w-8 h-8 text-slate-300" />
            Chưa có sản phẩm căn hộ nào trong danh mục.
          </div>
        ) : (
          sortedFloors.map((floor) => {
            const floorProducts = groupedByFloor[floor];
            return (
              <div
                key={floor}
                className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/40 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-850 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-500/10">
                    <Layers className="w-3.5 h-3.5" />
                    TẦNG {floor}
                  </div>
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500">
                    ({floorProducts.length} sản phẩm)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {floorProducts.map((p) => {
                    const st = p.status || 'available';
                    const cfg = STATUS_CONFIG[st] || STATUS_CONFIG['available'];

                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProduct(p)}
                        className={`group p-4 rounded-xl border ${cfg.border} ${cfg.bg} ${cfg.glow} text-left transition-all duration-300 hover:scale-[1.03] hover:shadow-lg cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[110px]`}
                      >
                        {/* Upper row: Product code & mini badge */}
                        <div className="flex items-center justify-between w-full">
                          <span className="font-extrabold text-slate-800 dark:text-white text-base tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {p.product_code}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border border-current/25 ${cfg.text}`}>
                            {cfg.label}
                          </span>
                        </div>

                        {/* Lower section: details */}
                        <div className="mt-3.5 space-y-1">
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            <Maximize2 className="w-3 h-3 text-slate-400" />
                            {p.area} m²
                          </div>
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-350">
                            {formatPriceMillions(p.unit_price, p.area)}
                          </div>
                          {p.owner_name && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate mt-1 bg-slate-100/50 dark:bg-slate-800/40 px-1.5 py-0.5 rounded">
                              <User className="w-2.5 h-2.5 shrink-0 text-slate-400" />
                              <span className="truncate">{p.owner_name}</span>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Unit Detail Modal */}
      <UnitDetailModal
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onUpdateStatus={onUpdateStatus}
      />
    </div>
  );
};

