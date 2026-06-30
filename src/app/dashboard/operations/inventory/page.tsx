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

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Package,
  AlertTriangle, 
  Activity, 
  BarChart3,
  Calendar,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  ShoppingCart,
  Truck
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

  // ───────────────────────────────────────────────────────────────────────────
  // Fetch inventory
  // ───────────────────────────────────────────────────────────────────────────

  const fetchInventory = async (refresh = false) => {
    if (!tenantId) return;

    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({ tenantId });
      if (statusFilter !== 'all') {
        params.append('stockStatus', statusFilter);
      }

      const response = await fetch(`/api/intelligence/operational/inventory-status?${params}`);
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
  };

  useEffect(() => {
    if (tenantId) {
      fetchInventory();
    }
  }, [tenantId, statusFilter]);

  // ───────────────────────────────────────────────────────────────────────────
  // Handlers
  // ───────────────────────────────────────────────────────────────────────────

  const handleRefresh = () => {
    fetchInventory(true);
  };

  const handleStatusFilterChange = (status: StockStatusFilter) => {
    setStatusFilter(status);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Computed values
  // ───────────────────────────────────────────────────────────────────────────

  const statusCounts = inventory ? {
    out_of_stock: inventory.data.filter(p => p.stockStatus === 'out_of_stock').length,
    low_stock: inventory.data.filter(p => p.stockStatus === 'low_stock').length,
    medium_stock: inventory.data.filter(p => p.stockStatus === 'medium_stock').length,
    high_stock: inventory.data.filter(p => p.stockStatus === 'high_stock').length,
  } : { out_of_stock: 0, low_stock: 0, medium_stock: 0, high_stock: 0 };

  const urgentReorders = inventory?.data.filter(p => p.reorderRecommendation === 'urgent') || [];

  // ───────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ───────────────────────────────────────────────────────────────────────────

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  const formatNumber = (value: number, decimals = 0) => {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const getStockStatusColor = (status: string) => {
    switch (status) {
      case 'out_of_stock': return 'bg-red-100 text-red-800 border-red-200';
      case 'low_stock': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium_stock': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high_stock': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
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

  const getReorderBadgeColor = (recommendation: string) => {
    switch (recommendation) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'recommended': return 'bg-orange-500 text-white';
      case 'suggested': return 'bg-yellow-500 text-slate-900';
      case 'not_needed': return 'bg-slate-200 text-slate-600';
      default: return 'bg-slate-200 text-slate-600';
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
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Quản Lý Kho Hàng</h1>
        <p className="mt-2 text-slate-600">
          Theo dõi tồn kho, cảnh báo hết hàng, và đề xuất nhập hàng
        </p>
      </div>

      {/* Stock Status Overview Cards */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        {/* Out of Stock */}
        <button
          onClick={() => handleStatusFilterChange('out_of_stock')}
          className={`rounded-lg p-6 text-left shadow-sm transition-all hover:shadow-md ${
            statusFilter === 'out_of_stock' 
              ? 'bg-red-500 text-white ring-2 ring-red-600' 
              : 'bg-white text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${statusFilter === 'out_of_stock' ? 'text-white/80' : 'text-slate-600'}`}>
                Hết hàng
              </p>
              <p className="mt-2 text-3xl font-bold">{statusCounts.out_of_stock}</p>
            </div>
            <XCircle className={`h-10 w-10 ${statusFilter === 'out_of_stock' ? 'text-white/50' : 'text-red-500'}`} />
          </div>
        </button>

        {/* Low Stock */}
        <button
          onClick={() => handleStatusFilterChange('low_stock')}
          className={`rounded-lg p-6 text-left shadow-sm transition-all hover:shadow-md ${
            statusFilter === 'low_stock' 
              ? 'bg-orange-500 text-white ring-2 ring-orange-600' 
              : 'bg-white text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${statusFilter === 'low_stock' ? 'text-white/80' : 'text-slate-600'}`}>
                Sắp hết
              </p>
              <p className="mt-2 text-3xl font-bold">{statusCounts.low_stock}</p>
            </div>
            <AlertTriangle className={`h-10 w-10 ${statusFilter === 'low_stock' ? 'text-white/50' : 'text-orange-500'}`} />
          </div>
        </button>

        {/* Medium Stock */}
        <button
          onClick={() => handleStatusFilterChange('medium_stock')}
          className={`rounded-lg p-6 text-left shadow-sm transition-all hover:shadow-md ${
            statusFilter === 'medium_stock' 
              ? 'bg-yellow-500 text-white ring-2 ring-yellow-600' 
              : 'bg-white text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${statusFilter === 'medium_stock' ? 'text-white/80' : 'text-slate-600'}`}>
                Vừa phải
              </p>
              <p className="mt-2 text-3xl font-bold">{statusCounts.medium_stock}</p>
            </div>
            <Activity className={`h-10 w-10 ${statusFilter === 'medium_stock' ? 'text-white/50' : 'text-yellow-500'}`} />
          </div>
        </button>

        {/* High Stock */}
        <button
          onClick={() => handleStatusFilterChange('high_stock')}
          className={`rounded-lg p-6 text-left shadow-sm transition-all hover:shadow-md ${
            statusFilter === 'high_stock' 
              ? 'bg-green-500 text-white ring-2 ring-green-600' 
              : 'bg-white text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${statusFilter === 'high_stock' ? 'text-white/80' : 'text-slate-600'}`}>
                Đầy đủ
              </p>
              <p className="mt-2 text-3xl font-bold">{statusCounts.high_stock}</p>
            </div>
            <CheckCircle className={`h-10 w-10 ${statusFilter === 'high_stock' ? 'text-white/50' : 'text-green-500'}`} />
          </div>
        </button>
      </div>

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        {/* Clear Filter Button */}
        {statusFilter !== 'all' && (
          <button
            onClick={() => handleStatusFilterChange('all')}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100"
          >
            ✕ Xóa bộ lọc
          </button>
        )}

        {/* Refresh Button */}
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="ml-auto rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Cache Status */}
      {inventory?.metadata && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-800">
          <AlertCircle className="h-4 w-4" />
          <span>
            {inventory.metadata.cacheHit ? '✓ Dữ liệu từ cache' : '⚡ Dữ liệu mới'}
            {' • '}
            Thời gian truy vấn: {inventory.metadata.queryTimeMs}ms
          </span>
        </div>
      )}

      {/* Urgent Reorder Alerts */}
      {urgentReorders.length > 0 && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h2 className="text-lg font-bold text-red-900">
              Cảnh báo: {urgentReorders.length} sản phẩm cần nhập hàng khẩn cấp
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {urgentReorders.slice(0, 4).map((product) => (
              <div key={product.productId} className="rounded-lg bg-white p-4 border border-red-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900">{product.productName}</p>
                    <p className="text-sm text-slate-600">{product.category}</p>
                  </div>
                  <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-bold text-white">
                    {product.daysUntilStockout !== null 
                      ? `${product.daysUntilStockout} ngày` 
                      : 'Hết hàng'}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-slate-600">Tồn kho hiện tại:</p>
                    <p className="font-medium text-slate-900">{formatNumber(product.currentStock)}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Điểm nhập hàng:</p>
                    <p className="font-medium text-slate-900">{formatNumber(product.reorderPoint)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory Table */}
      <div className="rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                  Sản phẩm
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  Tồn kho
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  Điểm nhập
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-900">
                  Trạng thái
                </th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                  Hết hàng sau
                </th>
                <th className="px-6 py-4 text-center text-sm font-semibold text-slate-900">
                  Đề xuất
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">
                  Nhà cung cấp
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {inventory?.data.map((product) => (
                <motion.tr
                  key={product.productId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="transition-colors hover:bg-slate-50"
                >
                  {/* Product Name */}
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-slate-900">{product.productName}</div>
                      <div className="text-sm text-slate-600">{product.category}</div>
                      {product.sku && (
                        <div className="text-xs text-slate-500">SKU: {product.sku}</div>
                      )}
                    </div>
                  </td>

                  {/* Current Stock */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Package className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-900">
                        {formatNumber(product.currentStock)}
                      </span>
                      {product.unitOfMeasure && (
                        <span className="text-sm text-slate-500">{product.unitOfMeasure}</span>
                      )}
                    </div>
                  </td>

                  {/* Reorder Point */}
                  <td className="px-6 py-4 text-right">
                    <span className="text-slate-900">{formatNumber(product.reorderPoint)}</span>
                  </td>

                  {/* Stock Status */}
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${getStockStatusColor(product.stockStatus)}`}>
                      {getStockStatusLabel(product.stockStatus)}
                    </span>
                  </td>

                  {/* Days Until Stockout */}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <span className={`font-medium ${
                        product.daysUntilStockout !== null && product.daysUntilStockout < 7 
                          ? 'text-red-600' 
                          : 'text-slate-900'
                      }`}>
                        {product.daysUntilStockout !== null 
                          ? `${product.daysUntilStockout} ngày` 
                          : 'N/A'}
                      </span>
                    </div>
                  </td>

                  {/* Reorder Recommendation */}
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${getReorderBadgeColor(product.reorderRecommendation)}`}>
                      {product.reorderRecommendation === 'urgent' && 'Khẩn cấp'}
                      {product.reorderRecommendation === 'recommended' && 'Nên nhập'}
                      {product.reorderRecommendation === 'suggested' && 'Đề xuất'}
                      {product.reorderRecommendation === 'not_needed' && 'Không cần'}
                    </span>
                  </td>

                  {/* Supplier */}
                  <td className="px-6 py-4">
                    {product.supplierName ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-slate-900">{product.supplierName}</span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          Lead time: {product.supplierLeadTimeDays} ngày
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">Chưa có</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {inventory && inventory.data.length === 0 && (
          <div className="py-12 text-center">
            <Package className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-4 text-slate-600">Không có sản phẩm nào</p>
          </div>
        )}
      </div>
    </div>
  );
}
