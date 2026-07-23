'use client';

/**
 * Inventory Intelligence Dashboard - Operations Manager Intelligence
 * 
 * Inventory management metrics:
 * 1. Stock Status Overview Cards (Out/Low/Medium/High stock)
 * 2. Inventory Table (Product list with stock levels, reorder points)
 * 3. Low Stock Alerts Panel
 * 4. Stock Status Filter
 * 
 * Data flows through Operational Intelligence Layer with automatic caching.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Package,
  AlertTriangle, 
  Activity, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Truck,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface InventoryStatus {
  productId: string;
  tenantId: string;
  productName: string;
  category: string;
  sku: string | null;
  unitOfMeasure: string | null;
  currentStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  maxStockLevel: number;
  stockStatus: 'out_of_stock' | 'low_stock' | 'medium_stock' | 'high_stock';
  stockValue: number;
  usageLast30Days: number;
  avgDailyUsage: number;
  daysUntilStockout: number | null;
  supplierId: string | null;
  supplierName: string | null;
  supplierContact: string | null;
  supplierPhone: string | null;
  supplierEmail: string | null;
  supplierLeadTimeDays: number;
  reorderRecommendation: 'urgent' | 'recommended' | 'suggested' | 'not_needed';
  suggestedReorderDate: string | null;
  lastRestockDate: string | null;
  lastRestockQuantity: number | null;
  lastUsageDate: string | null;
  inventoryUpdatedAt: string;
  computedAt: string;
}

interface IntelligenceResponse<T> {
  data: T;
  metadata: {
    generatedAt: string;
    cacheHit: boolean;
    queryTimeMs: number;
    dataSourcesUsed: string[];
  };
}

type StockStatusFilter = 'all' | 'out_of_stock' | 'low_stock' | 'medium_stock' | 'high_stock';

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function InventoryDashboardPage() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StockStatusFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Inventory data
  const [inventory, setInventory] = useState<IntelligenceResponse<InventoryStatus[]> | null>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // Initialize tenant
  // ───────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function initTenant() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

      if (!profile || !profile.tenant_id) {
        toast.error('Không tìm thấy tenant');
        return;
      }

      // Check if user has operations manager or admin role
      if (!['admin', 'manager'].includes(profile.role)) {
        toast.error('Bạn không có quyền truy cập trang này');
        router.push('/dashboard');
        return;
      }

      setTenantId(profile.tenant_id);
    }

    initTenant();
  }, [router]);

  const fetchInventory = useCallback(async (refresh = false) => {
    if (!tenantId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({ tenantId });
      if (statusFilter !== 'all') {
        params.append('stockStatus', statusFilter);
      }
      params.append('t', Date.now().toString()); // Cache buster

      const response = await fetch(`/api/intelligence/operational/inventory-status?${params}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setInventory(data);
      
      if (refresh) {
        toast.success('Đã làm mới dữ liệu');
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      toast.error('Không thể tải dữ liệu kho hàng');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantId, statusFilter]);

  useEffect(() => {
    if (tenantId) {
      fetchInventory();
    }
  }, [tenantId, fetchInventory]);

  const handleRefresh = () => {
    fetchInventory(true);
  };

  const handleStatusFilterChange = (status: StockStatusFilter) => {
    setStatusFilter(status);
  };

  const statusCounts = inventory ? {
    out_of_stock: inventory.data.filter(p => p.stockStatus === 'out_of_stock').length,
    low_stock: inventory.data.filter(p => p.stockStatus === 'low_stock').length,
    medium_stock: inventory.data.filter(p => p.stockStatus === 'medium_stock').length,
    high_stock: inventory.data.filter(p => p.stockStatus === 'high_stock').length,
  } : { out_of_stock: 0, low_stock: 0, medium_stock: 0, high_stock: 0 };

  const urgentReorders = inventory?.data.filter(p => p.reorderRecommendation === 'urgent') || [];

  const formatNumber = (value: number | null | undefined, decimals = 0) => {
    if (value === null || value === undefined || isNaN(Number(value))) return '0';
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(Number(value));
  };

  const getStockStatusLabel = (status: string) => {
    switch (status) {
      case 'out_of_stock': return 'Hết hàng';
      case 'low_stock': return 'Sắp hết';
      case 'medium_stock': return 'Vừa phải';
      case 'high_stock': return 'Đầy đủ';
      default: return status;
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Render Loading State
  // ───────────────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-12 w-12 animate-spin text-primary" />
          <p className="mt-4 text-slate-600">Đang tải dữ liệu kho hàng...</p>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Main Render
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 pb-16 md:pb-24 space-y-8">
      {/* Breadcrumbs & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-950/5 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase">
          <Link href="/dashboard" className="hover:text-emerald-800 transition-colors">
            Tổng quan
          </Link>
          <ChevronRight size={12} className="opacity-40" />
          <Link href="/dashboard/operations" className="hover:text-emerald-800 transition-colors">
            Phân tích vận hành
          </Link>
          <ChevronRight size={12} className="opacity-40" />
          <span className="text-emerald-800 font-bold">Quản Lý Kho Hàng</span>
        </div>
        
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition-all duration-200 hover:bg-slate-50 hover:text-emerald-800 hover:border-emerald-800/30 group"
        >
          <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-1" />
          <span>Trở về trang gần nhất</span>
        </button>
      </div>

      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest block">
            Báo cáo vận hành
          </span>
          <h1 className="font-heading text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Quản Lý Kho Hàng
          </h1>
          <p className="text-sm text-slate-600 font-medium max-w-xl">
            Theo dõi lượng hàng tồn kho thực tế, cảnh báo mức tối thiểu và đề xuất nhà cung cấp
          </p>
        </div>

        <div className="flex items-center gap-3">
          {statusFilter !== 'all' && (
            <button
              onClick={() => handleStatusFilterChange('all')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition-all active:scale-95"
            >
              <span>✕ Xóa bộ lọc</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-600 border border-slate-200 shadow-sm hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Cache Status */}
      {inventory?.metadata && (
        <div className="flex items-center justify-between rounded-2xl bg-emerald-50/50 border border-emerald-100/50 px-5 py-3 text-xs font-medium text-emerald-800 backdrop-blur-sm shadow-sm shadow-emerald-50/10">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {inventory.metadata.cacheHit ? '✓ Dữ liệu được tải từ bộ nhớ đệm (Cache Hit)' : '⚡ Dữ liệu mới được tổng hợp thời gian thực'}
            </span>
          </div>
          <div className="opacity-80">
            Thời gian phản hồi: <span className="font-bold">{inventory.metadata.queryTimeMs}ms</span>
          </div>
        </div>
      )}

      {/* Stock Status Overview Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Out of Stock */}
        <button
          onClick={() => handleStatusFilterChange('out_of_stock')}
          className={`group relative overflow-hidden rounded-[2rem] p-6 text-left shadow-sm shadow-slate-100/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
            statusFilter === 'out_of_stock' 
              ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-500/20 ring-1 ring-red-400/20' 
              : 'bg-white border border-slate-200/50 text-slate-900 hover:border-red-500/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'out_of_stock' ? 'text-white/80' : 'text-slate-500'}`}>
                Hết hàng
              </p>
              <p className="mt-2 text-3xl font-extrabold font-heading">{statusCounts.out_of_stock}</p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${
              statusFilter === 'out_of_stock' ? 'bg-white/15 text-white' : 'bg-red-50 text-red-500'
            }`}>
              <XCircle className="h-6 w-6" />
            </div>
          </div>
        </button>

        {/* Low Stock */}
        <button
          onClick={() => handleStatusFilterChange('low_stock')}
          className={`group relative overflow-hidden rounded-[2rem] p-6 text-left shadow-sm shadow-slate-100/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
            statusFilter === 'low_stock' 
              ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-orange-500/20 ring-1 ring-orange-400/20' 
              : 'bg-white border border-slate-200/50 text-slate-900 hover:border-orange-500/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'low_stock' ? 'text-white/80' : 'text-slate-500'}`}>
                Sắp hết
              </p>
              <p className="mt-2 text-3xl font-extrabold font-heading">{statusCounts.low_stock}</p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${
              statusFilter === 'low_stock' ? 'bg-white/15 text-white' : 'bg-orange-50 text-orange-500'
            }`}>
              <AlertTriangle className="h-6 w-6" />
            </div>
          </div>
        </button>

        {/* Medium Stock */}
        <button
          onClick={() => handleStatusFilterChange('medium_stock')}
          className={`group relative overflow-hidden rounded-[2rem] p-6 text-left shadow-sm shadow-slate-100/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
            statusFilter === 'medium_stock' 
              ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/20 ring-1 ring-amber-400/20' 
              : 'bg-white border border-slate-200/50 text-slate-900 hover:border-amber-500/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'medium_stock' ? 'text-white/80' : 'text-slate-500'}`}>
                Vừa phải
              </p>
              <p className="mt-2 text-3xl font-extrabold font-heading">{statusCounts.medium_stock}</p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${
              statusFilter === 'medium_stock' ? 'bg-white/15 text-white' : 'bg-amber-50 text-amber-600'
            }`}>
              <Activity className="h-6 w-6" />
            </div>
          </div>
        </button>

        {/* High Stock */}
        <button
          onClick={() => handleStatusFilterChange('high_stock')}
          className={`group relative overflow-hidden rounded-[2rem] p-6 text-left shadow-sm shadow-slate-100/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${
            statusFilter === 'high_stock' 
              ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/20 ring-1 ring-emerald-400/20' 
              : 'bg-white border border-slate-200/50 text-slate-900 hover:border-emerald-500/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-xs font-bold uppercase tracking-wider ${statusFilter === 'high_stock' ? 'text-white/80' : 'text-slate-500'}`}>
                Đầy đủ
              </p>
              <p className="mt-2 text-3xl font-extrabold font-heading">{statusCounts.high_stock}</p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-transform group-hover:scale-110 ${
              statusFilter === 'high_stock' ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-600'
            }`}>
              <CheckCircle className="h-6 w-6" />
            </div>
          </div>
        </button>
      </div>

      {/* Urgent Reorder Alerts */}
      {urgentReorders.length > 0 && (
        <div className="rounded-[2rem] border border-red-200/50 bg-red-50/40 p-6 md:p-8 backdrop-blur-sm shadow-sm shadow-red-50/10 space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-950 font-heading">Cảnh báo nhập hàng khẩn cấp</h2>
              <p className="text-xs text-red-700 font-medium">Hiện có {urgentReorders.length} sản phẩm sắp chạm đáy tồn kho</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {urgentReorders.slice(0, 4).map((product) => (
              <div key={product.productId} className="rounded-2xl border border-red-100 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-850 truncate">{product.productName}</p>
                    <p className="text-xs font-semibold text-slate-400 mt-0.5">{product.category}</p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-red-50 border border-red-100 px-2.5 py-1 text-xs font-bold text-red-600">
                    {product.daysUntilStockout !== null 
                      ? `${product.daysUntilStockout} ngày` 
                      : 'Hết hàng'}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-xs border-t border-slate-50 pt-3">
                  <div>
                    <p className="text-slate-500 font-medium">Tồn hiện tại:</p>
                    <p className="font-bold text-slate-850 text-sm mt-0.5">{formatNumber(product.currentStock)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 font-medium">Điểm reorder:</p>
                    <p className="font-bold text-slate-850 text-sm mt-0.5">{formatNumber(product.reorderPoint)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="rounded-[2rem] border border-slate-200/50 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Sản phẩm
                </th>
                <th className="px-6 py-4.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  Tồn kho
                </th>
                <th className="px-6 py-4.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  Điểm nhập
                </th>
                <th className="px-6 py-4.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                  Trạng thái
                </th>
                <th className="px-6 py-4.5 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                  Hết hàng sau
                </th>
                <th className="px-6 py-4.5 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                  Đề xuất
                </th>
                <th className="px-6 py-4.5 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                  Nhà cung cấp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventory?.data.map((product) => (
                <motion.tr
                  key={product.productId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="transition-colors hover:bg-slate-50/40"
                >
                  {/* Product Name */}
                  <td className="px-6 py-4">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-slate-850">{product.productName}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium">{product.category}</span>
                        {product.sku && (
                          <>
                            <span className="h-1 w-1 rounded-full bg-slate-200" />
                            <span className="text-xs text-slate-400 font-mono">SKU: {product.sku}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Current Stock */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="font-semibold text-slate-850">
                        {formatNumber(product.currentStock)}
                      </span>
                      {product.unitOfMeasure && (
                        <span className="text-xs text-slate-400 font-medium">{product.unitOfMeasure}</span>
                      )}
                    </div>
                  </td>

                  {/* Reorder Point */}
                  <td className="px-6 py-4 text-right">
                    <span className="font-medium text-slate-700">{formatNumber(product.reorderPoint)}</span>
                  </td>

                  {/* Stock Status */}
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
                      product.stockStatus === 'out_of_stock' ? 'bg-red-50 text-red-700 border-red-100' :
                      product.stockStatus === 'low_stock' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                      product.stockStatus === 'medium_stock' ? 'bg-amber-50/60 text-amber-800 border-amber-100' :
                      'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {getStockStatusLabel(product.stockStatus)}
                    </span>
                  </td>

                  {/* Days Until Stockout */}
                  <td className="px-6 py-4 text-right">
                    <span className={`font-semibold ${
                      product.daysUntilStockout !== null && product.daysUntilStockout < 7 
                        ? 'text-red-600 font-bold' 
                        : 'text-slate-700'
                    }`}>
                      {product.daysUntilStockout !== null 
                        ? `${product.daysUntilStockout} ngày` 
                        : 'N/A'}
                    </span>
                  </td>

                  {/* Reorder Recommendation */}
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${
                      product.reorderRecommendation === 'urgent' ? 'bg-red-600 text-white' :
                      product.reorderRecommendation === 'recommended' ? 'bg-orange-500 text-white' :
                      product.reorderRecommendation === 'suggested' ? 'bg-amber-50 text-amber-800 border border-amber-200/50' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {product.reorderRecommendation === 'urgent' && 'Khẩn cấp'}
                      {product.reorderRecommendation === 'recommended' && 'Nên nhập'}
                      {product.reorderRecommendation === 'suggested' && 'Đề xuất'}
                      {product.reorderRecommendation === 'not_needed' && 'Không cần'}
                    </span>
                  </td>

                  {/* Supplier */}
                  <td className="px-6 py-4">
                    {product.supplierName ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-slate-400" />
                          <span className="font-semibold text-slate-800 text-sm">{product.supplierName}</span>
                        </div>
                        <div className="text-xs text-slate-450 font-medium pl-5">
                          Lead time: {product.supplierLeadTimeDays} ngày
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Chưa có</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {inventory && inventory.data.length === 0 && (
          <div className="py-16 text-center">
            <Package className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-slate-500 font-medium">Không có sản phẩm nào</p>
          </div>
        )}
      </div>
      
      {/* Spacer to prevent scroll clipping next to browser viewport / taskbar */}
      <div className="h-16 md:h-24" />
    </div>
  );
}
