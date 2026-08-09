'use client';

/**
 * Churn Risk Analysis Dashboard
 * 
 * Comprehensive churn risk analysis showing:
 * 1. Churn Risk Distribution (Bar chart: High/Medium/Low)
 * 2. High-Risk Customers List (Table with retention actions)
 * 3. Customer Activity Trends (Line chart showing activity decline)
 * 4. Retention Action Plan (Recommendations by risk level)
 * 
 * Data flows through Customer Intelligence Layer with automatic caching.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  AlertTriangle,
  TrendingDown,
  Users,
  Phone,
  Mail,
  MessageSquare,
  RefreshCw,
  Filter,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import type { IntelligenceResponse } from '@/services/intelligence/shared/types';
import type { ChurnRiskAnalysis } from '@/services/intelligence/customer/queries-simple';
import {
  ChurnRiskChart,
  CustomerActivityChart,
} from '@/components/intelligence/customer';

type RiskFilter = 'all' | 'High' | 'Medium' | 'Low';

function ChurnRiskDashboard() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [churnData, setChurnData] = useState<IntelligenceResponse<ChurnRiskAnalysis[]> | null>(null);

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

  const fetchData = useCallback(async (refresh = false) => {
    if (!tenantId) return;
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const params = new URLSearchParams({ tenantId });
      const response = await fetch(`/api/intelligence/customer/churn-risk?${params}`);
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setChurnData(data);
      if (refresh) toast.success('Dữ liệu đã được cập nhật');
    } catch (error) {
      console.error('Failed to fetch churn risk data:', error);
      toast.error('Không thể tải dữ liệu rủi ro churn');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId, fetchData]);

  const formatNumber = (value: number, decimals = 0) => {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  const getSummaryMetrics = () => {
    if (!churnData || !churnData.data || churnData.data.length === 0) {
      return {
        totalCustomers: 0,
        highRisk: 0,
        mediumRisk: 0,
        avgChurnScore: 0,
      };
    }
    return {
      totalCustomers: churnData.data.length,
      highRisk: churnData.data.filter(c => c.churnRiskLevel === 'High').length,
      mediumRisk: churnData.data.filter(c => c.churnRiskLevel === 'Medium').length,
      avgChurnScore: churnData.data.reduce((sum, c) => sum + c.churnRiskScore, 0) / churnData.data.length,
    };
  };

  const getFilteredCustomers = () => {
    if (!churnData || !churnData.data) return [];
    if (riskFilter === 'all') return churnData.data;
    return churnData.data.filter(c => c.churnRiskLevel === riskFilter);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('call')) return <Phone className="w-4 h-4" />;
    if (action.includes('email')) return <Mail className="w-4 h-4" />;
    if (action.includes('Survey')) return <MessageSquare className="w-4 h-4" />;
    return <ChevronRight className="w-4 h-4" />;
  };

  const summary = getSummaryMetrics();
  const filteredCustomers = getFilteredCustomers();

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
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-[#EFE9E1] tracking-tight uppercase">Phân Tích Rủi Ro Churn</h1>
            <p className="text-xs font-black text-slate-400 dark:text-[#CDBCAB] uppercase tracking-[0.25em] mt-1">Xác định khách hàng có nguy cơ rời bỏ và hành động giữ chân</p>
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
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-400/20 via-primary/30 to-red-400/20" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Rủi Ro Cao</p>
              <p className="text-3xl font-black text-red-600 tracking-tight">{formatNumber(summary.highRisk)}</p>
            </div>
            <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-yellow-400/20 via-primary/30 to-yellow-400/20" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Rủi Ro Trung Bình</p>
              <p className="text-3xl font-black text-yellow-600 tracking-tight">{formatNumber(summary.mediumRisk)}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-500/10 rounded-2xl flex items-center justify-center border border-yellow-500/20 text-yellow-600">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-6 rounded-3xl border border-white/50 shadow-sm relative overflow-hidden hover:shadow-md hover:translate-y-[-1px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-400/20 via-primary/30 to-purple-400/20" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Điểm Churn Trung Bình</p>
              <p className="text-3xl font-black text-purple-600 tracking-tight">{formatNumber(summary.avgChurnScore, 1)}</p>
            </div>
            <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20 text-purple-600">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Churn Risk Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/20 via-pink-300/30 to-primary/20" />
          <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3 uppercase tracking-wider">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 text-primary">
              <AlertTriangle className="w-5 h-5" />
            </div>
            Phân Bố Rủi Ro Churn
          </h2>
          <ChurnRiskChart data={churnData?.data || []} />
        </motion.div>

        {/* Customer Activity Trends */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-pink backdrop-blur-sm bg-white/60 p-8 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/20 via-pink-300/30 to-primary/20" />
          <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3 uppercase tracking-wider">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 text-primary">
              <TrendingDown className="w-5 h-5" />
            </div>
            Xu Hướng Hoạt Động KH
          </h2>
          <CustomerActivityChart data={churnData?.data || []} />
        </motion.div>
      </div>

      {/* High-Risk Customers Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-pink backdrop-blur-sm bg-white/60 rounded-[2rem] border border-white/50 shadow-sm relative overflow-hidden hover:shadow-xl transition-all duration-300"
      >
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/20 via-pink-300/30 to-primary/20" />
        <div className="p-8 border-b border-slate-100/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Khách Hàng Có Rủi Ro</h2>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <div className="w-48">
              <PremiumSelect
                value={riskFilter}
                onChange={(value) => setRiskFilter(value as RiskFilter)}
                options={[
                  { value: 'all', label: 'Tất cả', icon: <Filter className="w-4 h-4" /> },
                  { value: 'High', label: 'Rủi ro cao', icon: <AlertTriangle className="w-4 h-4" /> },
                  { value: 'Medium', label: 'Rủi ro trung bình', icon: <TrendingDown className="w-4 h-4" /> },
                  { value: 'Low', label: 'Rủi ro thấp', icon: <Users className="w-4 h-4" /> },
                ]}
                placeholder="Chọn mức rủi ro"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Khách Hàng</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Rủi Ro</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Điểm Churn</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Doanh Thu</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-wider">Hành Động Khuyến Nghị</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/50 bg-white/40">
              {filteredCustomers.slice(0, 20).map((customer) => (
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
                        customer.churnRiskLevel === 'High'
                          ? 'bg-red-100/60 text-red-700 border border-red-200/50'
                          : customer.churnRiskLevel === 'Medium'
                          ? 'bg-amber-100/60 text-amber-700 border border-amber-200/50'
                          : 'bg-emerald-100/60 text-emerald-700 border border-emerald-200/50'
                      }`}
                    >
                      {customer.churnRiskLevel === 'High' ? 'Cao' : customer.churnRiskLevel === 'Medium' ? 'Trung bình' : 'Thấp'}
                    </span>
                  </td>
                  <td className="px-8 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                    {formatNumber(customer.churnRiskScore, 1)}
                  </td>
                  <td className="px-8 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                    {formatCurrency(customer.totalRevenue)}
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex flex-col gap-1.5">
                      {customer.recommendedActions.slice(0, 2).map((action, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                          <div className="w-5 h-5 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200/30 text-slate-500">
                            {getActionIcon(action)}
                          </div>
                          <span>{action}</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Cache Info Footer */}
      {churnData?.metadata && (
        <div className="text-center text-xs text-slate-400 font-bold uppercase tracking-wider mt-12 py-4 border-t border-slate-100/20 max-w-xl mx-auto">
          <p>
            Dữ liệu được tạo lúc {new Date(churnData.metadata.generatedAt).toLocaleTimeString('vi-VN')} 
            {' '}({churnData.metadata.cacheHit ? 'Từ cache' : 'Truy vấn mới'}) 
            {' '}- Query time: {churnData.metadata.queryTimeMs}ms
          </p>
        </div>
      )}
    </div>
  );
}

// Wrap with ErrorBoundary to prevent full page crashes
export default function ChurnRiskDashboardWrapper() {
  return (
    <ErrorBoundary>
      <ChurnRiskDashboard />
    </ErrorBoundary>
  );
}
