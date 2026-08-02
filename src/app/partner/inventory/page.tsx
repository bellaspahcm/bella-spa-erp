'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Building2, Search, Filter, HelpCircle, Loader2, 
  ChevronRight, ArrowLeft, Download, FileText, CheckCircle2
} from 'lucide-react';
import { getPartnerInventory, PartnerInventoryItem } from '@/services/partner-actions';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { toast } from 'sonner';
import Link from 'next/link';

export default function PartnerInventory() {
  const [items, setItems] = useState<PartnerInventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<PartnerInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [blockFilter, setBlockFilter] = useState('all');

  const loadData = useCallback(async () => {
    try {
      const data = await getPartnerInventory();
      setItems(data);
      setFilteredItems(data);
    } catch (err) {
      console.error('[PartnerInventory] Fetch failed:', err);
      toast.error('Lỗi khi tải bảng hàng');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Apply filters
  useEffect(() => {
    let result = items;

    if (search.trim()) {
      result = result.filter(item => 
        item.product_code.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }

    if (blockFilter !== 'all') {
      result = result.filter(item => item.block === blockFilter);
    }

    setFilteredItems(result);
  }, [search, statusFilter, blockFilter, items]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 text-[9px] font-black uppercase tracking-widest rounded-full">Trống</span>;
      case 'booked':
        return <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 text-[9px] font-black uppercase tracking-widest rounded-full">Giữ chỗ</span>;
      case 'deposited':
        return <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-200 text-[9px] font-black uppercase tracking-widest rounded-full">Đặt cọc</span>;
      case 'contracted':
        return <span className="px-2 py-0.5 bg-purple-50 text-purple-600 border border-purple-200 text-[9px] font-black uppercase tracking-widest rounded-full">Đã ký HĐ</span>;
      case 'paid':
        return <span className="px-2 py-0.5 bg-sky-50 text-sky-600 border border-sky-200 text-[9px] font-black uppercase tracking-widest rounded-full">Thanh toán</span>;
      default:
        return <span className="px-2 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 text-[9px] font-black uppercase tracking-widest rounded-full">{status}</span>;
    }
  };

  const getUniqueBlocks = () => {
    const blocks = items.map(item => item.block).filter(Boolean) as string[];
    return ['all', ...Array.from(new Set(blocks))];
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/partner/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Bảng Hàng Căn Hộ</h2>
        </div>
      </div>

      {/* FILTER PANEL */}
      <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm mã căn (ví dụ: A-1205)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-3">
          {/* Status filter */}
          <PremiumSelect
            label="Trạng thái"
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'available', label: 'Trống' },
              { value: 'booked', label: 'Giữ chỗ' },
              { value: 'deposited', label: 'Đặt cọc' },
              { value: 'contracted', label: 'Đã ký HĐ' },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            buttonClassName="!py-2 !px-3 !text-xs"
            dropdownClassName="!text-xs"
          />

          {/* Block filter */}
          <PremiumSelect
            label="Block / Tháp"
            options={getUniqueBlocks().map(b => ({
              value: b,
              label: b === 'all' ? 'Tất cả' : `Block ${b}`
            }))}
            value={blockFilter}
            onChange={setBlockFilter}
            buttonClassName="!py-2 !px-3 !text-xs"
            dropdownClassName="!text-xs"
          />
        </div>
      </div>

      {/* ITEMS LIST */}
      <div className="p-5 space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Đang tải giỏ hàng...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-850">
            <HelpCircle className="w-10 h-10 text-slate-350 mx-auto" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Không tìm thấy căn hộ phù hợp</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map(item => (
              <div 
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col gap-3.5"
              >
                {/* Upper line: Code & status */}
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
                      Mã căn: {item.product_code}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {item.project_name} • Block {item.block || 'N/A'} • Tầng {item.floor || 'N/A'}
                    </p>
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                {/* Pricing & Area detail */}
                <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-100 dark:border-slate-850">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Diện tích</span>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.area} m²</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Giá trần (gồm VAT)</span>
                    <p className="text-xs font-bold text-primary">{formatCurrency(item.unit_price)}</p>
                  </div>
                </div>

                {/* Actions line */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      toast.success(`Đã tải Sales Kit cho căn ${item.product_code}`);
                    }}
                    className="flex-1 py-2 px-3 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Tải Sales Kit
                  </button>
                  
                  {item.status === 'available' ? (
                    <Link
                      href={`/partner/bookings?product_id=${item.id}&product_code=${item.product_code}`}
                      className="flex-1 py-2 px-3 bg-primary text-white text-[10px] font-black uppercase tracking-wider rounded-xl hover:opacity-90 flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Giữ chỗ ngay
                    </Link>
                  ) : (
                    <button 
                      disabled
                      className="flex-1 py-2 px-3 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-wider rounded-xl cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      Đã khóa
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
