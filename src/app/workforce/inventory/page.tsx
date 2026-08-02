'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Building2, LayoutGrid, Search, Loader2, ChevronLeft, 
  Tag, Info, DollarSign, MoveRight
} from 'lucide-react';
import { getRealEstateProjects, RealEstateProjectSummary } from '@/services/workforce-actions';
import { fetchProductsAction } from '@/modules/real_estate/actions/productActions';
import { formatCurrency } from '@bella/shared';
import { toast } from 'sonner';
import Link from 'next/link';

export default function Inventory() {
  const [projects, setProjects] = useState<RealEstateProjectSummary[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBlock, setSelectedBlock] = useState('all');

  // Load projects on mount
  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await getRealEstateProjects();
        setProjects(data);
        if (data.length > 0) {
          setSelectedProjectId(data[0].id);
        }
      } catch (err) {
        console.error('[Inventory] Load projects failed:', err);
        toast.error('Lỗi khi tải danh sách dự án');
      } finally {
        setIsLoadingProjects(false);
      }
    }
    loadProjects();
  }, []);

  // Fetch products when selectedProjectId changes
  const loadProducts = useCallback(async () => {
    if (!selectedProjectId) return;
    setIsLoadingProducts(true);
    try {
      const res = await fetchProductsAction(selectedProjectId);
      if (res.success && res.data) {
        setProducts(Array.isArray(res.data) ? res.data : [res.data]);
      } else {
        toast.error(res.error || 'Lỗi khi tải bảng hàng');
      }
    } catch (err) {
      console.error('[Inventory] Fetch products failed:', err);
      toast.error('Lỗi kết nối khi tải bảng hàng');
    } finally {
      setIsLoadingProducts(false);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Extract unique blocks for filter
  const blocks = ['all', ...Array.from(new Set(products.map(p => p.block).filter(Boolean)))];

  // Filter products by search query and block
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.product_code?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBlock = selectedBlock === 'all' || p.block === selectedBlock;
    return matchesSearch && matchesBlock;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900';
      case 'booked':
        return 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900';
      case 'deposited':
        return 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900';
      case 'contracted':
      case 'paid':
      case 'handed_over':
        return 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900';
      default:
        return 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Còn trống';
      case 'booked': return 'Giữ chỗ';
      case 'deposited': return 'Đặt cọc';
      case 'contracted': return 'Đã ký HĐ';
      case 'paid': return 'Đã thanh toán';
      case 'handed_over': return 'Đã bàn giao';
      default: return 'Khóa';
    }
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/workforce/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Bảng Hàng (Chỉ đọc)</h2>
        </div>
      </div>

      {/* FILTER & SELECTOR SECTION */}
      <div className="p-5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 space-y-4">
        {/* Project Selector */}
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chọn dự án BĐS</label>
          {isLoadingProjects ? (
            <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse"></div>
          ) : (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3.5 text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-bold text-slate-750 dark:text-slate-250"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Search & Block Filter */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 relative">
            <input
              type="text"
              placeholder="Mã căn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl py-3 pl-10 pr-4 text-xs outline-none focus:ring-1 focus:ring-primary"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          </div>
          <div>
            <select
              value={selectedBlock}
              onChange={(e) => setSelectedBlock(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl py-3 px-3 text-xs outline-none focus:ring-1 focus:ring-primary font-bold"
            >
              <option value="all">Tất cả Block</option>
              {blocks.filter(b => b !== 'all').map(b => (
                <option key={b} value={b}>Block {b}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* PRODUCTS GRID */}
      <div className="p-5">
        {isLoadingProducts ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider animate-pulse">Đang tải bảng hàng...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-850">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Không tìm thấy căn hộ phù hợp</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3.5">
            {filteredProducts.map(product => (
              <div 
                key={product.id} 
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-850 dark:text-slate-150">Căn {product.product_code}</span>
                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border ${getStatusColor(product.status)}`}>
                      {getStatusLabel(product.status)}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Block {product.block || '--'} • Tầng {product.floor || '--'}
                  </p>
                </div>

                <div className="border-t border-slate-50 dark:border-slate-800/60 pt-2.5 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-450 font-medium">
                    <span>Diện tích:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{Number(product.area || 0).toFixed(1)} m²</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-450 font-medium">
                    <span>Giá trần:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(product.unit_price || 0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
