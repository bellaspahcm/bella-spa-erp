'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Minus, ExternalLink, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import Link from 'next/link';

interface Adjustment {
  id: string;
  adjustment_type: 'bonus' | 'deduction';
  amount: number;
  category: string;
  reason: string;
  status: 'draft' | 'approved' | 'rejected' | 'cancelled';
  created_by_name?: string;
  created_at: string;
}

interface AdjustmentsBreakdownProps {
  ktvId: string;
  month: string; // YYYY-MM format
  tenantId: string;
  className?: string;
}

export function AdjustmentsBreakdown({
  ktvId,
  month,
  tenantId,
  className = '',
}: AdjustmentsBreakdownProps) {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAdjustments() {
      setIsLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const monthYear = `${month}-01`; // Convert YYYY-MM to YYYY-MM-01

        const { data, error: fetchError } = await (supabase as any)
          .from('salary_adjustments')
          .select(`
            id,
            adjustment_type,
            amount,
            category,
            reason,
            status,
            created_at,
            created_by:users!created_by_id(full_name)
          `)
          .eq('ktv_id', ktvId)
          .eq('tenant_id', tenantId)
          .eq('month_year', monthYear)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('[AdjustmentsBreakdown] Fetch error:', fetchError);
          setError('Không thể tải điều chỉnh lương');
          return;
        }

        const adjustmentsData: Adjustment[] = (data || []).map((adj: any) => ({
          id: adj.id,
          adjustment_type: adj.adjustment_type,
          amount: Number(adj.amount),
          category: adj.category,
          reason: adj.reason,
          status: adj.status,
          created_by_name: adj.created_by?.full_name || 'N/A',
          created_at: adj.created_at,
        }));

        setAdjustments(adjustmentsData);
      } catch (err) {
        console.error('[AdjustmentsBreakdown] Unexpected error:', err);
        setError('Lỗi hệ thống');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAdjustments();
  }, [ktvId, month, tenantId]);

  // Calculate totals (only approved)
  const approvedAdjustments = adjustments.filter((a) => a.status === 'approved');
  const totalBonuses = approvedAdjustments
    .filter((a) => a.adjustment_type === 'bonus')
    .reduce((sum, a) => sum + a.amount, 0);
  const totalDeductions = approvedAdjustments
    .filter((a) => a.adjustment_type === 'deduction')
    .reduce((sum, a) => sum + a.amount, 0);
  const netAdjustment = totalBonuses - totalDeductions;

  const statusConfig = {
    draft: {
      label: 'Chờ duyệt',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    },
    approved: {
      label: 'Đã duyệt',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
    rejected: {
      label: 'Từ chối',
      className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    },
    cancelled: {
      label: 'Đã hủy',
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    },
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Điều chỉnh thủ công
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-pulse text-sm text-gray-500 dark:text-gray-400">
            Đang tải...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Điều chỉnh thủ công
          </h3>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  if (adjustments.length === 0) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
            Điều chỉnh thủ công
          </h3>
          <Link
            href="/dashboard/salary/adjustments"
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          >
            Quản lý
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Không có điều chỉnh lương cho tháng này
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
          Điều chỉnh thủ công
        </h3>
        <Link
          href="/dashboard/salary/adjustments"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
        >
          Quản lý
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Adjustments List */}
      <div className="space-y-2">
        {adjustments.map((adj) => {
          const status = statusConfig[adj.status];
          return (
            <div
              key={adj.id}
              className="flex items-start gap-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
            >
              {/* Type Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {adj.adjustment_type === 'bonus' ? (
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Minus className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                      {adj.category}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-bold flex-shrink-0 ${
                      adj.adjustment_type === 'bonus'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-red-700 dark:text-red-300'
                    }`}
                  >
                    {adj.adjustment_type === 'bonus' ? '+' : '-'}
                    {adj.amount.toLocaleString('vi-VN')} đ
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                  {adj.reason}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Bởi {adj.created_by_name} •{' '}
                  {new Date(adj.created_at).toLocaleDateString('vi-VN')}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Net Adjustment Summary */}
      {approvedAdjustments.length > 0 && (
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Tổng thưởng:</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
              +{totalBonuses.toLocaleString('vi-VN')} đ
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Tổng phạt:</span>
            <span className="font-semibold text-red-700 dark:text-red-300">
              -{totalDeductions.toLocaleString('vi-VN')} đ
            </span>
          </div>
          <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
            <span className="font-bold text-gray-900 dark:text-gray-100">Điều chỉnh ròng:</span>
            <span
              className={`font-bold ${
                netAdjustment >= 0
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-red-700 dark:text-red-300'
              }`}
            >
              {netAdjustment >= 0 ? '+' : ''}
              {netAdjustment.toLocaleString('vi-VN')} đ
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
