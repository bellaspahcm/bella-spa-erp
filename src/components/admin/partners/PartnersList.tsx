/**
 * Partners List Component
 * 
 * Features:
 * - Server-side data fetching
 * - Search by name, type
 * - Filter by status, sandbox mode
 * - Pagination
 * - Quick actions
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Filter, Download, RefreshCw, Key, Shield, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PartnersTable } from './PartnersTable';
import { toast } from 'sonner';
import type { APIPartner, PartnerType } from '@/types/api-gateway';

interface PartnersListResponse {
  data: APIPartner[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export function PartnersList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // State
  const [partners, setPartners] = useState<APIPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    has_more: false,
  });

  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [typeFilter, setTypeFilter] = useState<PartnerType | 'all'>(
    (searchParams.get('type') as PartnerType) || 'all'
  );
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>(
    (searchParams.get('status') as 'all' | 'active' | 'inactive') || 'all'
  );
  const [sandboxFilter, setSandboxFilter] = useState<'all' | 'sandbox' | 'production'>(
    (searchParams.get('sandbox') as 'all' | 'sandbox' | 'production') || 'all'
  );

  // Fetch partners
  const fetchPartners = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
      });

      if (search) params.set('search', search);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      if (statusFilter !== 'all') params.set('is_active', statusFilter === 'active' ? 'true' : 'false');
      if (sandboxFilter !== 'all') params.set('is_sandbox', sandboxFilter === 'sandbox' ? 'true' : 'false');

      const response = await fetch(`/api/admin/partners?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch partners');
      }

      const data: PartnersListResponse = await response.json();
      setPartners(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching partners:', error);
      toast.error('Không thể tải danh sách API Partners', {
        description: 'Vui lòng kiểm tra kết nối và thử lại',
      });
    } finally {
      setLoading(false);
    }
  };

  // Effects
  useEffect(() => {
    fetchPartners();
  }, [search, typeFilter, statusFilter, sandboxFilter, pagination.offset]);

  // Handlers
  const handleSearch = (value: string) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const handleCreatePartner = () => {
    router.push('/admin/partners/new');
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/admin/partners/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `partners-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Partners list exported to CSV');
    } catch (error) {
      toast.error('Failed to export partners list');
    }
  };

  const handlePageChange = (newOffset: number) => {
    setPagination((prev) => ({ ...prev, offset: newOffset }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards - Bella ERP Style */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border border-rose-200 dark:border-rose-900 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Tổng Partners</p>
              <p className="text-3xl font-bold text-primary dark:text-rose-400 mt-1">{pagination.total}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-primary/10 dark:bg-rose-500/10 flex items-center justify-center">
              <Key className="w-6 h-6 text-primary dark:text-rose-400" />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200 dark:border-green-900 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Đang hoạt động</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                {partners.filter((p) => p.is_active).length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border border-orange-200 dark:border-orange-900 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Sandbox</p>
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                {partners.filter((p) => p.is_sandbox).length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-200 dark:border-blue-900 p-6 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Production</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {partners.filter((p) => !p.is_sandbox).length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar - Bella ERP Style */}
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
          {/* Search */}
          <div className="relative flex-1 w-full lg:max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-600" />
            <Input
              placeholder="Tìm kiếm partner..."
              value={search}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl border-gray-200 dark:border-gray-800 focus:border-primary dark:focus:border-rose-500"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <Select 
              value={typeFilter} 
              onValueChange={(value: string | null) => value && setTypeFilter(value as PartnerType | 'all')}
            >
              <SelectTrigger className="w-full sm:w-[150px] h-11 rounded-xl border-gray-200 dark:border-gray-800">
                <SelectValue placeholder="Loại partner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                <SelectItem value="pos">POS</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="franchise">Franchise</SelectItem>
                <SelectItem value="hr">HR</SelectItem>
                <SelectItem value="analytics">Analytics</SelectItem>
                <SelectItem value="mobile_app">Mobile App</SelectItem>
                <SelectItem value="other">Khác</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={statusFilter} 
              onValueChange={(value: string | null) => value && setStatusFilter(value as 'all' | 'active' | 'inactive')}
            >
              <SelectTrigger className="w-full sm:w-[130px] h-11 rounded-xl border-gray-200 dark:border-gray-800">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="active">Hoạt động</SelectItem>
                <SelectItem value="inactive">Tắt</SelectItem>
              </SelectContent>
            </Select>

            <Select 
              value={sandboxFilter} 
              onValueChange={(value: string | null) => value && setSandboxFilter(value as 'all' | 'sandbox' | 'production')}
            >
              <SelectTrigger className="w-full sm:w-[150px] h-11 rounded-xl border-gray-200 dark:border-gray-800">
                <SelectValue placeholder="Môi trường" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả môi trường</SelectItem>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExport}
              className="flex-1 sm:flex-none h-11 rounded-xl border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchPartners()}
              className="flex-1 sm:flex-none h-11 rounded-xl border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Làm mới
            </Button>

            <Button 
              onClick={handleCreatePartner}
              className="flex-1 sm:flex-none h-11 rounded-xl bg-primary hover:bg-primary/90 dark:bg-rose-600 dark:hover:bg-rose-700 text-white shadow-md hover:shadow-lg transition-all"
            >
              <Plus className="mr-2 h-4 w-4" />
              Tạo Partner
            </Button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 px-1">
        <span>
          Hiển thị <span className="font-semibold text-primary dark:text-rose-400">{partners.length}</span> trong tổng số{' '}
          <span className="font-semibold text-primary dark:text-rose-400">{pagination.total}</span> partners
        </span>
      </div>

      {/* Table */}
      <PartnersTable
        partners={partners}
        loading={loading}
        onRefresh={fetchPartners}
      />

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 shadow-sm">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Trang <span className="font-semibold text-primary dark:text-rose-400">{Math.floor(pagination.offset / pagination.limit) + 1}</span> /{' '}
            <span className="font-semibold">{Math.ceil(pagination.total / pagination.limit)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.offset - pagination.limit)}
              disabled={pagination.offset === 0}
              className="h-10 rounded-xl border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
            >
              Trang trước
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.offset + pagination.limit)}
              disabled={!pagination.has_more}
              className="h-10 rounded-xl border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900 disabled:opacity-50"
            >
              Trang sau
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
