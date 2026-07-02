'use client';

/**
 * Customer Lifetime Value (LTV) Dashboard
 * 
 * Comprehensive LTV analysis showing:
 * 1. LTV by Cohort (Line chart showing LTV trends by signup month)
 * 2. LTV Distribution (Histogram of customer value ranges)
 * 3. High-Value Customers (Table with VIP and High Value tiers)
 * 4. Cohort Retention Curve (Retention rate by cohort over time)
 * 
 * Data flows through Customer Intelligence Layer with automatic caching.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  DollarSign,
  TrendingUp,
  Users,
  Target,
  RefreshCw,
  Filter,
  Award,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import type { IntelligenceResponse } from '@/services/intelligence/shared/types';
import type { CustomerLTV, CohortAnalysis } from '@/services/intelligence/customer/queries';
import {
  LtvByCohortChart,
  LtvDistributionChart,
  RetentionCurveChart,
} from '@/components/intelligence/customer';

function CustomerLTVDashboard() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ltvData, setLtvData] = useState<IntelligenceResponse<CustomerLTV[]> | null>(null);
  const [cohortData, setCohortData] = useState<IntelligenceResponse<CohortAnalysis[]> | null>(null);

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
      if (!profile || !profile.tenant_id || profile.role !== 'admin') {
        toast.error('Không có quyền truy cập');
        router.push('/dashboard');
        return;
      }
      setTenantId(profile.tenant_id);
    }
    initTenant();
  }, [router]);

  const fetchData = async (refresh = false) => {
    if (!tenantId) return;
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({ tenantId, limit: '50' });
      const [ltvRes, cohortRes] = await Promise.all([
        fetch(`/api/intelligence/customer/ltv?${params}`),
        fetch(`/api/intelligence/customer/cohort-analysis?${params}`),
      ]);
      const [ltvJson, cohortJson] = await Promise.all([ltvRes.json(), cohortRes.json()]);
      if (ltvJson.error || cohortJson.error) {
        throw new Error(ltvJson.error || cohortJson.error);
      }
      setLtvData(ltvJson);
      setCohortData(cohortJson);
      if (refresh) toast.success('Dữ liệu đã được cập nhật');
    } catch (error) {
      console.error('Failed to fetch LTV data:', error);
      toast.error('Không thể tải dữ liệu LTV');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId]);

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

  const getSummaryMetrics = () => {
    if (!ltvData || !ltvData.data || ltvData.data.length === 0) {
      return {
        totalCustomers: 0,
        avgLtv: 0,
        vipCustomers: 0,
        avgProjectedLtv: 0,
      };
    }
    return {
      totalCustomers: ltvData.data.length,
      avgLtv: ltvData.data.reduce((sum, c) => sum + c.lifetimeRevenue, 0) / ltvData.data.length,
      vipCustomers: ltvData.data.filter(c => c.customerValueTier === 'VIP').length,
      avgProjectedLtv: ltvData.data.reduce((sum, c) => sum + c.projectedAnnualLtv, 0) / ltvData.data.length,
    };
  };

  const summary = getSummaryMetrics();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Giá Trị Vòng Đời Khách Hàng (LTV)</h1>
          <p className="text-gray-600 mt-1">Phân tích LTV và dự báo doanh thu tiềm năng</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tổng KH</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(summary.totalCustomers)}</p>
            </div>
            <Users className="w-10 h-10 text-blue-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">LTV Trung Bình</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(summary.avgLtv)}</p>
            </div>
            <DollarSign className="w-10 h-10 text-green-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">KH VIP</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{formatNumber(summary.vipCustomers)}</p>
            </div>
            <Award className="w-10 h-10 text-purple-600" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">LTV Dự Báo</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{formatCurrency(summary.avgProjectedLtv)}</p>
            </div>
            <Target className="w-10 h-10 text-orange-600" />
          </div>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-pink-600" />
            LTV Theo Cohort
          </h2>
          <LtvByCohortChart data={cohortData?.data || []} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Filter className="w-5 h-5 text-pink-600" />
            Phân Bố LTV
          </h2>
          <LtvDistributionChart data={ltvData?.data || []} />
        </motion.div>
      </div>

      {/* Retention Curve */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Đường Cong Retention Theo Cohort</h2>
        <RetentionCurveChart data={cohortData?.data || []} />
      </motion.div>

      {/* High-Value Customers Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200"
      >
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Top Khách Hàng Giá Trị Cao</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Khách Hàng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hạng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">LTV Hiện Tại</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">LTV Dự Báo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tần Suất Mua</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ltvData?.data
                ?.filter(c => c.customerValueTier === 'VIP' || c.customerValueTier === 'High Value')
                .slice(0, 15)
                .map((customer) => (
                  <tr key={customer.customerId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{customer.customerName}</div>
                        <div className="text-sm text-gray-500">{customer.customerPhone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          customer.customerValueTier === 'VIP'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {customer.customerValueTier}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(customer.lifetimeRevenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(customer.projectedAnnualLtv)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatNumber(customer.purchaseFrequency, 2)} lần/tháng
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}

// Wrap with ErrorBoundary to prevent full page crashes
export default function CustomerLTVDashboardWrapper() {
  return (
    <ErrorBoundary>
      <CustomerLTVDashboard />
    </ErrorBoundary>
  );
}
