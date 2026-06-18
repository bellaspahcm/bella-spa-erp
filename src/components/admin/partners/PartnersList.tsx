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
import { Plus, Search, Filter, Download, RefreshCw } from 'lucide-react';
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
      toast.error('Failed to load partners. Please try again.');
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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search partners..."
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Select 
            value={typeFilter} 
            onValueChange={(value: string | null) => value && setTypeFilter(value as PartnerType | 'all')}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Partner Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="pos">POS</SelectItem>
              <SelectItem value="payment">Payment</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
              <SelectItem value="franchise">Franchise</SelectItem>
              <SelectItem value="hr">HR</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
              <SelectItem value="mobile_app">Mobile App</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={statusFilter} 
            onValueChange={(value: string | null) => value && setStatusFilter(value as 'all' | 'active' | 'inactive')}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={sandboxFilter} 
            onValueChange={(value: string | null) => value && setSandboxFilter(value as 'all' | 'sandbox' | 'production')}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Environment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Environments</SelectItem>
              <SelectItem value="sandbox">Sandbox</SelectItem>
              <SelectItem value="production">Production</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>

          <Button variant="outline" size="sm" onClick={() => fetchPartners()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button onClick={handleCreatePartner}>
            <Plus className="mr-2 h-4 w-4" />
            New Partner
          </Button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {partners.length} of {pagination.total} partners
      </div>

      {/* Table */}
      <PartnersTable
        partners={partners}
        loading={loading}
        onRefresh={fetchPartners}
      />

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {Math.floor(pagination.offset / pagination.limit) + 1} of{' '}
            {Math.ceil(pagination.total / pagination.limit)}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.offset - pagination.limit)}
              disabled={pagination.offset === 0}
            >
              Previous
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.offset + pagination.limit)}
              disabled={!pagination.has_more}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
