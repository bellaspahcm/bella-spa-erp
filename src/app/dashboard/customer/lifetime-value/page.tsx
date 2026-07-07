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
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import type { IntelligenceResponse } from '@/services/intelligence/shared/types';
import type { CustomerLTV, CohortAnalysis } from '@/services/intelligence/customer/queries-simple';
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
      const params = new URLSearchParams({ tenantId, limit: '36' }); // Changed from 50 to 36 (max allowed)
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
      <div className="flex items-center justify-center min-h-screen bg-background/30">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-10 bg-background/30 overflow-auto relative space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-12">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-12 h-12 bg-white/60 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-slate-200/60 text-slate-600 hover:text-primary hover:border-primary/30 active:scale-95 transition-all shadow-sm shrink-0"
            title="Quay lại trang trước"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-[#EFE9E1] tracking-tight uppercase">Giá Trị Vòng Đời Khách Hàng (LTV)</h1>
            <p className="text-xs font-black text-slate-400 dark:text-[#CDBCAB] uppercase tracking-[0.25em] mt-1">Phân tích LTV và dự báo doanh thu tiềm năng</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-2xl font-black transition-all active:scale-95 uppercase tracking-wider disabled:opacity-50 text-xs shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-400/20 via-primary/30 to-blue-400/20" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Tổng KH</p>
              <p className="text-3xl font-black text-slate-900 tracking-tight">{formatNumber(summary.totalCustomers)}</p>
            </div>
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20 text-blue-600">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400/20 via-primary/30 to-emerald-400/20" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">LTV Trung Bình</p>
              <p className="text-3xl font-black text-emerald-600 tracking-tight">{formatCurrency(summary.avgLtv)}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20 text-emerald-600">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-400/20 via-primary/30 to-purple-400/20" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">KH VIP</p>
              <p className="text-3xl font-black text-purple-600 tracking-tight">{formatNumber(summary.vipCustomers)}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20 text-purple-600">
              <Award className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-orange-400/20 via-primary/30 to-orange-400/20" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">LTV Dự Báo</p>
              <p className="text-3xl font-black text-orange-600 tracking-tight">{formatCurrency(summary.avgProjectedLtv)}</p>
            </div>
            <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center border border-orange-500/20 text-orange-600">
              <Target className="w-6 h-6" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LTV by Cohort */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/20 via-pink-300/30 to-primary/20" />
          <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3 uppercase tracking-wider">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 text-primary">
              <TrendingUp className="w-5 h-5" />
            </div>
            LTV Theo Cohort
          </h2>
          <LtvByCohortChart data={cohortData?.data || []} />
        </motion.div>

        {/* LTV Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/20 via-pink-300/30 to-primary/20" />
          <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3 uppercase tracking-wider">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 text-primary">
              <Filter className="w-5 h-5" />
            </div>
            Phân Bố LTV
          </h2>
          <LtvDistributionChart data={ltvData?.data || []} />
        </motion.div>
      </div>

      {/* Cohort Retention Curve */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
      >
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/20 via-pink-300/30 to-primary/20" />
        <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3 uppercase tracking-wider">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 text-primary">
            <Users className="w-5 h-5" />
          </div>
          Đường Cong Retention Theo Cohort
        </h2>
        <RetentionCurveChart data={cohortData?.data || []} />
      </motion.div>

      {/* High-Value Customers Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="glass-pink backdrop-blur-sm bg-white/60 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl transition-all duration-300"
      >
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/20 via-pink-300/30 to-primary/20" />
        <div className="p-8 border-b border-slate-100/60">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Top Khách Hàng Giá Trị Cao</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Khách Hàng</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Hạng</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">LTV Hiện Tại</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">LTV Dự Báo</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Tần Suất Mua</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 bg-white/40">
              {ltvData?.data
                ?.filter(c => c.customerValueTier === 'VIP' || c.customerValueTier === 'Premium')
                .slice(0, 15)
                .map((customer) => (
                  <tr key={customer.customerId} className="hover:bg-white/60 transition-colors duration-200">
                    <td className="px-8 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-bold text-slate-900">{customer.customerName}</div>
                        <div className="text-xs font-medium text-slate-400 mt-0.5">{customer.customerPhone}</div>
                      </div>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1.5 text-xs font-bold rounded-full uppercase tracking-wide ${
                          customer.customerValueTier === 'VIP'
                            ? 'bg-purple-100/60 text-purple-700 border border-purple-200/50'
                            : 'bg-blue-100/60 text-blue-700 border border-blue-200/50'
                        }`}
                      >
                        {customer.customerValueTier}
                      </span>
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                      {formatCurrency(customer.lifetimeRevenue)}
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                      {formatCurrency(customer.projectedAnnualLtv)}
                    </td>
                    <td className="px-8 py-4 whitespace-nowrap text-sm font-bold text-slate-500">
                      {formatNumber(customer.purchaseFrequency, 2)} lần/tháng
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Cache Info Footer */}
      {ltvData?.metadata && (
        <div className="text-center text-xs text-slate-400 font-bold uppercase tracking-wider mt-12 py-4 border-t border-slate-100/20 max-w-xl mx-auto">
          <p>
            Dữ liệu được tạo lúc {new Date(ltvData.metadata.generatedAt).toLocaleTimeString('vi-VN')} 
            {' '}({ltvData.metadata.cacheHit ? 'Từ cache' : 'Truy vấn mới'}) 
            {' '}- Query time: {ltvData.metadata.queryTimeMs}ms
          </p>
        </div>
      )}
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
