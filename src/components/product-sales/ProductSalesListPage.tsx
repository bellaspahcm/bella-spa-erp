'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Plus, Download, Filter, X } from 'lucide-react';
import { ProductSaleRow } from './ProductSaleRow';
import { ProductSaleModal } from './ProductSaleModal';
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { useKTVList } from '@/hooks/useKTVList';
import { useCustomers } from '@/hooks/useCustomers';
import { queryTenantCommissionConfig } from '@/lib/supabase-commission-queries';
import { createClient } from '@/lib/supabase-client';
import type { CommissionConfig } from '@/types/commission-types';
import {
  getProductSales,
  deleteProductSale,
} from '@/modules/product-sales/actions/product-sales-actions';

interface ProductSale {
  id: string;
  ktv_id: string;
  customer_id: string | null;
  product_name: string;
  product_category: string | null;
  product_sku: string | null;
  quantity: number;
  unit_price: number;
  total_amount: number;
  commission_amount: number;
  override_commission_enabled: boolean;
  override_commission_type: 'fixed' | 'percentage' | null;
  override_commission_value: number | null;
  payment_method: 'cash' | 'bank_transfer' | 'zalo_pay' | 'momo' | 'card';
  sale_date: string;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  notes: string | null;
  created_at: string;
  updated_at: string;
  ktv_name?: string;
  customer_name?: string;
}

interface ProductSalesFilters {
  startDate?: string;
  endDate?: string;
  ktvId?: string;
  status?: string;
  search?: string;
}

export function ProductSalesListPage() {
  const tenantContext = useTenantContext();
  
  // Fetch KTV list and customers for modal
  const { ktvList, isLoading: isLoadingKTV } = useKTVList(tenantContext?.tenantId);
  const { customers, isLoading: isLoadingCustomers } = useCustomers(tenantContext?.tenantId);
  
  const [sales, setSales] = useState<ProductSale[]>([]);
  const [filteredSales, setFilteredSales] = useState<ProductSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<ProductSale | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [commissionDefaults, setCommissionDefaults] = useState<CommissionConfig | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Filter state
  const [filters, setFilters] = useState<ProductSalesFilters>({
    startDate: '',
    endDate: '',
    ktvId: '',
    status: '',
    search: '',
  });

  // Stats
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalCommission: 0,
    completedCount: 0,
  });

  // Fetch product sales
  const fetchSales = useCallback(async () => {
    if (!tenantContext?.tenantId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getProductSales({
        tenantId: tenantContext.tenantId,
        ktvId: filters.ktvId || undefined,
        status: filters.status || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        limit: 500, // Fetch more for client-side filtering
        offset: 0,
      });

      if (result.success && result.data) {
        const salesData = result.data.sales as ProductSale[];
        setSales(salesData);
        
        // Calculate stats
        const completed = salesData.filter(s => s.status === 'completed');
        setStats({
          totalSales: salesData.length,
          totalRevenue: completed.reduce((sum, s) => sum + s.total_amount, 0),
          totalCommission: completed.reduce((sum, s) => sum + s.commission_amount, 0),
          completedCount: completed.length,
        });
      } else {
        setError(result.error || 'Không thể tải danh sách bán hàng');
      }
    } catch (err) {
      console.error('Error fetching product sales:', err);
      setError('Lỗi hệ thống khi tải dữ liệu');
    } finally {
      setIsLoading(false);
    }
  }, [tenantContext?.tenantId, filters.ktvId, filters.status, filters.startDate, filters.endDate]);

  // Initial fetch
  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Fetch commission config
  useEffect(() => {
    async function fetchCommissionConfig() {
      if (!tenantContext?.tenantId) return;

      try {
        const supabase = createClient();
        const { data, error: configError } = await queryTenantCommissionConfig(
          supabase,
          tenantContext.tenantId
        );

        if (configError) {
          console.error('[ProductSalesListPage] Error fetching commission config:', configError);
          // Use fallback defaults
          setCommissionDefaults({
            service_commission_default: {
              type: 'fixed' as const,
              value: 150000,
            },
            product_sales_commission_default: {
              type: 'percentage' as const,
              value: 10,
            },
          });
        } else {
          setCommissionDefaults(data);
        }
      } catch (err) {
        console.error('[ProductSalesListPage] Unexpected error fetching config:', err);
        // Use fallback defaults
        setCommissionDefaults({
          service_commission_default: {
            type: 'fixed' as const,
            value: 150000,
          },
          product_sales_commission_default: {
            type: 'percentage' as const,
            value: 10,
          },
        });
      }
    }

    fetchCommissionConfig();
  }, [tenantContext?.tenantId]);

  // Client-side filtering for search
  useEffect(() => {
    let filtered = [...sales];

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (sale) =>
          sale.product_name.toLowerCase().includes(searchLower) ||
          sale.product_category?.toLowerCase().includes(searchLower) ||
          sale.product_sku?.toLowerCase().includes(searchLower) ||
          sale.ktv_name?.toLowerCase().includes(searchLower) ||
          sale.customer_name?.toLowerCase().includes(searchLower)
      );
    }

    setFilteredSales(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  }, [sales, filters.search]);

  // Pagination
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentSales = filteredSales.slice(startIndex, endIndex);

  // Handlers
  const handleEdit = (sale: ProductSale) => {
    setSelectedSale(sale);
    setIsModalOpen(true);
  };

  const handleDelete = async (saleId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa bản ghi bán hàng này?')) {
      return;
    }

    const result = await deleteProductSale(saleId);

    if (result.success) {
      // Remove from list
      setSales((prev) => prev.filter((s) => s.id !== saleId));
      alert('Đã xóa bản ghi bán hàng');
    } else {
      alert(result.error || 'Không thể xóa bản ghi');
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedSale(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    fetchSales(); // Refresh list
  };

  const handleFilterChange = (key: keyof ProductSalesFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      ktvId: '',
      status: '',
      search: '',
    });
  };

  const handleExportCSV = () => {
    // Simple CSV export
    const headers = [
      'Ngày bán',
      'Sản phẩm',
      'Số lượng',
      'Đơn giá',
      'Tổng tiền',
      'Hoa hồng',
      'KTV',
      'Khách hàng',
      'Trạng thái',
      'Phương thức TT',
    ];
    
    const rows = filteredSales.map((sale) => [
      sale.sale_date,
      sale.product_name,
      sale.quantity,
      sale.unit_price,
      sale.total_amount,
      sale.commission_amount,
      sale.ktv_name || '',
      sale.customer_name || '',
      sale.status,
      sale.payment_method,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `product_sales_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Module check - Allow both 'spa' and 'beauty_spa' modules
  if (tenantContext?.enabledModules && 
      !tenantContext.enabledModules.includes('spa') &&
      !tenantContext.enabledModules.includes('beauty_spa')) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-500">Tính năng này chỉ khả dụng cho Spa và Beauty Spa module</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-emerald-100 flex items-center justify-center">
            <ShoppingCart className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bán hàng sản phẩm</h1>
            <p className="text-sm text-gray-500">Quản lý bán hàng và hoa hồng</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4" />
            <span>Lọc</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredSales.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm bán hàng</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Tổng bán hàng</p>
          <p className="text-2xl font-bold text-gray-900">{stats.totalSales}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Hoàn thành</p>
          <p className="text-2xl font-bold text-emerald-600">{stats.completedCount}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Tổng doanh thu</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats.totalRevenue.toLocaleString('vi-VN')} đ
          </p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Tổng hoa hồng</p>
          <p className="text-2xl font-bold text-emerald-600">
            {stats.totalCommission.toLocaleString('vi-VN')} đ
          </p>
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Bộ lọc</h3>
                <button
                  onClick={handleClearFilters}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  Xóa bộ lọc
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tìm kiếm
                  </label>
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Tên sản phẩm, SKU, KTV..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trạng thái
                  </label>
                  <select
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Tất cả</option>
                    <option value="completed">Hoàn thành</option>
                    <option value="pending">Chờ xử lý</option>
                    <option value="cancelled">Đã hủy</option>
                    <option value="refunded">Đã hoàn tiền</option>
                  </select>
                </div>

                {/* Date Range */}
                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Từ ngày
                  </label>
                  <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Đến ngày
                  </label>
                  <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sales List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-gray-500">Đang tải...</div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      ) : currentSales.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">
            {filters.search || filters.status || filters.startDate
              ? 'Không tìm thấy bản ghi nào phù hợp'
              : 'Chưa có bán hàng nào'}
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm bán hàng đầu tiên</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {currentSales.map((sale) => (
            <ProductSaleRow
              key={sale.id}
              sale={sale}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-4">
              <p className="text-sm text-gray-600">
                Hiển thị {startIndex + 1}-{Math.min(endIndex, filteredSales.length)} trong tổng số{' '}
                {filteredSales.length} bản ghi
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Trước
                </button>

                <span className="text-sm text-gray-600">
                  Trang {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Sale Modal */}
      {isModalOpen && tenantContext?.tenantId && (
        <ProductSaleModal
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          tenantId={tenantContext.tenantId}
          ktvList={ktvList}
          customers={customers}
          commissionDefaults={commissionDefaults || undefined}
          initialData={selectedSale || undefined}
        />
      )}
    </div>
  );
}
