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

import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase-client';
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

  const fetchData = async (refresh = false) => {
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
  };

  useEffect(() => {
    if (tenantId) fetchData();
  }, [tenantId]);

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
          <h1 className="text-3xl font-bold text-gray-900">Phân Tích Rủi Ro Churn</h1>
          <p className="text-gray-600 mt-1">Xác định khách hàng có nguy cơ rời bỏ và hành động giữ chân</p>
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
              <p className="text-sm text-gray-600">Rủi Ro Cao</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{formatNumber(summary.highRisk)}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-600" />
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
              <p className="text-sm text-gray-600">Rủi Ro TB</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{formatNumber(summary.mediumRisk)}</p>
            </div>
            <TrendingDown className="w-10 h-10 text-yellow-600" />
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
              <p className="text-sm text-gray-600">Điểm Churn TB</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{formatNumber(summary.avgChurnScore, 1)}</p>
            </div>
            <TrendingDown className="w-10 h-10 text-purple-600" />
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Phân Bố Rủi Ro Churn</h2>
          <ChurnRiskChart data={churnData?.data || []} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-lg shadow-sm p-6 border border-gray-200"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Xu Hướng Hoạt Động KH</h2>
          <CustomerActivityChart data={churnData?.data || []} />
        </motion.div>
      </div>

      {/* High-Risk Customers Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200"
      >
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Khách Hàng Có Rủi Ro</h2>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">Tất cả</option>
                <option value="High">Rủi ro cao</option>
                <option value="Medium">Rủi ro trung bình</option>
                <option value="Low">Rủi ro thấp</option>
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Khách Hàng</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rủi Ro</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Điểm</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Doanh Thu</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Hành Động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCustomers.slice(0, 20).map((customer) => (
                <tr key={customer.customerId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{customer.customerName}</div>
                      <div className="text-sm text-gray-500">{customer.customerPhone}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRiskColor(customer.churnRiskLevel)}`}>
                      {customer.churnRiskLevel}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(customer.churnRiskScore, 1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(customer.totalRevenue)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {customer.recommendedActions.slice(0, 2).map((action, idx) => (
                        <div key={idx} className="flex items-center gap-1 text-xs text-gray-600">
                          {getActionIcon(action)}
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
