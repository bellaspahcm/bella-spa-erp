'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase-client';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Clock, Package, Activity } from 'lucide-react';

interface AnalyticsData {
  monthlyTrend: Array<{ month: string; nhap: number; xuat: number; ton: number }>;
  statusDistribution: Array<{ name: string; value: number; color: string }>;
  topModels: Array<{ model: string; sold: number; revenue: number }>;
  inventoryValue: {
    total: number;
    byStatus: Array<{ status: string; value: number }>;
  };
  averageDaysInStock: number;
  weeklyDeliveries: Array<{ week: string; deliveries: number }>;
  revenueByMonth: Array<{ month: string; revenue: number }>;
}

interface BellaAutoAnalyticsDashboardProps {
  tenantId: string;
}

// Interactive Header Actions for Premium look
const CardHeaderActions = () => {
  return (
    <div className="flex items-center gap-1.5 animate-fade-in">
      <select className="text-[11px] font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-lg px-2.5 py-1 text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 shadow-sm">
        <option>6 tháng qua</option>
        <option>30 ngày qua</option>
        <option>Năm nay</option>
      </select>
      <button 
        title="Tải báo cáo"
        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
    </div>
  );
};

// Custom Glassmorphic Tooltip
interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color?: string;
    fill?: string;
  }>;
  label?: string;
  valueFormatter?: (value: number) => string;
}

const CustomTooltip = ({ active, payload, label, valueFormatter }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 rounded-xl shadow-lg dark:shadow-2xl transition-all duration-200">
        <p className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-2">{label}</p>
        <div className="space-y-1.5">
          {payload.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <span 
                className="w-2 h-2 rounded-full ring-2 ring-white dark:ring-slate-950 shadow-sm" 
                style={{ backgroundColor: item.color || item.fill }} 
              />
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                {item.name}:
              </span>
              <span className="text-xs font-bold text-slate-900 dark:text-white ml-auto">
                {valueFormatter ? valueFormatter(item.value) : item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function BellaAutoAnalyticsDashboard({ tenantId }: BellaAutoAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const supabase = createClient();

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // ✅ Call real RPCs instead of mock data
      const [trendResult, topModelsResult, revenueResult, deliveriesResult] = await Promise.all([
        supabase.rpc('get_auto_inventory_trend', { p_tenant_id: tenantId }),
        supabase.rpc('get_auto_top_models', { p_tenant_id: tenantId, p_limit: 5 }),
        supabase.rpc('get_auto_revenue_by_month', { p_tenant_id: tenantId }),
        supabase.rpc('get_auto_weekly_deliveries', { p_tenant_id: tenantId }),
      ]);

      // Check for errors with detailed logging
      if (trendResult.error) {
        console.error('[BellaAuto] Trend RPC error:', trendResult.error);
        // Don't throw - just use empty data
      }
      if (topModelsResult.error) {
        console.error('[BellaAuto] Top models RPC error:', topModelsResult.error);
        // Don't throw - just use empty data
      }
      if (revenueResult.error) {
        console.error('[BellaAuto] Revenue RPC error:', revenueResult.error);
        // Don't throw - just use empty data
      }
      if (deliveriesResult.error) {
        console.error('[BellaAuto] Deliveries RPC error:', deliveriesResult.error);
        // Don't throw - just use empty data
      }

      // Fetch vehicles for status distribution & inventory value
      const { data: vehicles, error: vehiclesError } = await supabase
        .from('auto_vehicles')
        .select('status, list_price')
        .eq('tenant_id', tenantId);

      if (vehiclesError) throw vehiclesError;

      if (vehiclesError) throw vehiclesError;
      const vehicleList = vehicles || [];

      // Calculate status distribution (use copy to avoid mutation)
      const statusCounts: Record<string, number> = {};
      vehicleList.forEach(v => {
        statusCounts[v.status] = (statusCounts[v.status] || 0) + 1;
      });

      const statusDistribution = [
        { name: 'Showroom', value: statusCounts.showroom || 0, color: '#06b6d4' },
        { name: 'Kho', value: statusCounts.warehouse || 0, color: '#64748b' },
        { name: 'Đã phân bổ', value: statusCounts.allocated || 0, color: '#f59e0b' },
        { name: 'Đang vận chuyển', value: statusCounts.in_transit || 0, color: '#6366f1' },
        { name: 'Đã bàn giao', value: statusCounts.delivered || 0, color: '#10b981' },
      ].filter(item => item.value > 0);

      // Calculate inventory value
      const inventoryValue = {
        total: vehicleList.reduce((sum, v) => sum + (v.list_price || 0), 0),
        byStatus: Object.entries(statusCounts).map(([status]) => ({
          status: status === 'showroom' ? 'Showroom' :
                  status === 'warehouse' ? 'Kho' :
                  status === 'allocated' ? 'Đã phân bổ' :
                  status === 'in_transit' ? 'Đang vận chuyển' : 'Đã bàn giao',
          value: vehicleList
            .filter(v => v.status === status)
            .reduce((sum, v) => sum + (v.list_price || 0), 0),
        })),
      };

      // Calculate average days in stock (simplified - mock for now)
      const averageDaysInStock = 42; // TODO: Calculate from actual data

      // ✅ Use RPC data instead of mock
      setAnalytics({
        monthlyTrend: trendResult.data || [],
        statusDistribution,
        topModels: topModelsResult.data || [],
        inventoryValue,
        averageDaysInStock,
        weeklyDeliveries: deliveriesResult.data || [],
        revenueByMonth: revenueResult.data || [],
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
      // Set empty data on error to prevent crash
      setAnalytics({
        monthlyTrend: [],
        statusDistribution: [],
        topModels: [],
        inventoryValue: { total: 0, byStatus: [] },
        averageDaysInStock: 0,
        weeklyDeliveries: [],
        revenueByMonth: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)} Tỷ`;
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(0)} Tr`;
    }
    return value.toLocaleString('vi-VN');
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-96 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50" />
          <div className="h-96 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200/50 dark:border-slate-800/50" />
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12 bg-white dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl shadow-sm">
        <p className="text-slate-500 dark:text-slate-400 font-medium">Không thể tải dữ liệu phân tích</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Giá trị tồn kho"
          value={formatCurrency(analytics.inventoryValue.total)}
          suffix="VNĐ"
          icon={<DollarSign className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />}
          trend={{ value: 12.5, isPositive: true }}
          color="cyan"
        />
        <MetricCard
          title="Thời gian tồn TB"
          value={analytics.averageDaysInStock.toString()}
          suffix="ngày"
          icon={<Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          trend={{ value: 8.2, isPositive: false }}
          color="amber"
        />
        <MetricCard
          title="Xe trong kho"
          value={analytics.statusDistribution.reduce((sum, item) => sum + item.value, 0).toString()}
          suffix="xe"
          icon={<Package className="w-4 h-4 text-slate-600 dark:text-slate-400" />}
          trend={{ value: 5.8, isPositive: true }}
          color="slate"
        />
        <MetricCard
          title="Bàn giao tuần này"
          value={(analytics.weeklyDeliveries.length > 0 
            ? analytics.weeklyDeliveries[analytics.weeklyDeliveries.length - 1].deliveries 
            : 0
          ).toString()}
          suffix="xe"
          icon={<Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          trend={{ value: 15.3, isPositive: true }}
          color="emerald"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Monthly Inventory Trend */}
        <ChartCard 
          title="Xu hướng nhập/xuất kho" 
          subtitle="Biểu đồ phân tích lượng xe luân chuyển trong 6 tháng qua"
          icon={<TrendingUp className="w-4 h-4" />}
          extra={<CardHeaderActions />}
        >
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.monthlyTrend} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNhap" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="colorXuat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="colorTon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  dy={8}
                />
                <YAxis 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  dx={-4}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="nhap" stroke="#06b6d4" strokeWidth={2.5} fill="url(#colorNhap)" name="Nhập kho" />
                <Area type="monotone" dataKey="xuat" stroke="#10b981" strokeWidth={2.5} fill="url(#colorXuat)" name="Xuất kho" />
                <Area type="monotone" dataKey="ton" stroke="#f59e0b" strokeWidth={3} fill="url(#colorTon)" name="Tồn kho" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Custom Horizontal Legend for Clean Look */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100/50 dark:border-slate-800/40">
            {[
              { label: 'Nhập kho', color: '#06b6d4' },
              { label: 'Xuất kho', color: '#10b981' },
              { label: 'Tồn kho', color: '#f59e0b' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{item.label}</span>
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Status Distribution (Doughnut Chart with Center Label) */}
        <ChartCard 
          title="Phân bố trạng thái xe" 
          subtitle="Tỷ lệ cơ cấu trạng thái của xe trong hệ thống"
          icon={<Package className="w-4 h-4" />}
          extra={<CardHeaderActions />}
        >
          <div className="flex flex-col justify-between min-h-[300px]">
            <div className="h-[210px] mt-4 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={92}
                    paddingAngle={4}
                    cornerRadius={5}
                    dataKey="value"
                  >
                    {analytics.statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  {/* Center Text inside PieChart */}
                  <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 dark:fill-slate-500 font-bold text-[10px] tracking-widest uppercase">
                    Tổng xe
                  </text>
                  <text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-800 dark:fill-slate-100 font-extrabold text-2xl tracking-tight">
                    {analytics.statusDistribution.reduce((sum, item) => sum + item.value, 0)}
                  </text>
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Custom Grid Legend with values & percentages */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-4 border-t border-slate-100/50 dark:border-slate-800/40">
              {analytics.statusDistribution.map((item, index) => {
                const total = analytics.statusDistribution.reduce((sum, i) => sum + i.value, 0);
                const percentage = ((item.value / total) * 100).toFixed(0);
                return (
                  <div key={index} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100/50 dark:border-slate-800/30">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate leading-none mb-0.5 uppercase tracking-wider">{item.name}</p>
                      <p className="text-xs font-extrabold text-slate-700 dark:text-slate-300 leading-none">
                        {item.value} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">({percentage}%)</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartCard>

        {/* Top Models by Sales */}
        <ChartCard 
          title="Top 5 mẫu xe bán chạy" 
          subtitle="Các dòng xe đạt doanh số xuất kho cao nhất"
          icon={<TrendingUp className="w-4 h-4" />}
          extra={<CardHeaderActions />}
        >
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.topModels} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="barModelGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.08)" horizontal={false} />
                <XAxis 
                  type="number" 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                />
                <YAxis 
                  dataKey="model" 
                  type="category" 
                  stroke="#cbd5e1"
                  tick={{ fill: '#475569', fontSize: 11, fontWeight: 700 }}
                  axisLine={false} 
                  tickLine={false} 
                  dx={-4}
                  width={110} 
                />
                <Tooltip 
                  content={<CustomTooltip />}
                  formatter={(value: number, name: string) => {
                    if (name === 'revenue') return [formatCurrency(value) + ' VNĐ', 'Doanh thu'];
                    return [value, 'Số lượng'];
                  }}
                />
                <Bar dataKey="sold" fill="url(#barModelGradient)" name="Đã bán" radius={[0, 6, 6, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Revenue Trend (LineChart styled as Area) */}
        <ChartCard 
          title="Doanh thu theo tháng" 
          subtitle="Diễn biến tổng doanh thu bán xe theo từng tháng"
          icon={<DollarSign className="w-4 h-4" />}
          extra={<CardHeaderActions />}
        >
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.revenueByMonth} margin={{ top: 10, right: 10, left: 58, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis 
                  dataKey="month" 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  dy={8}
                />
                <YAxis 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={formatCurrency}
                  width={55}
                  dx={-4}
                />
                <Tooltip content={<CustomTooltip valueFormatter={formatCurrency} />} />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#10b981" 
                  strokeWidth={3.5}
                  fill="url(#revenueGradient)"
                  name="Doanh thu"
                  dot={{ fill: '#10b981', r: 4, strokeWidth: 1.5, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Weekly Deliveries */}
        <ChartCard 
          title="Bàn giao xe theo tuần" 
          subtitle="Số lượng bàn giao hoàn tất cho khách hàng"
          icon={<Activity className="w-4 h-4" />}
          extra={<CardHeaderActions />}
        >
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.weeklyDeliveries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="deliveryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#4f46e5" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis 
                  dataKey="week" 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  dy={8}
                />
                <YAxis 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  allowDecimals={false}
                  dx={-4}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="deliveries" fill="url(#deliveryGradient)" name="Xe bàn giao" radius={[5, 5, 0, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Inventory Value by Status */}
        <ChartCard 
          title="Giá trị tồn kho theo trạng thái" 
          subtitle="Phân bổ tổng giá trị xe (VNĐ) theo từng hiện trạng"
          icon={<DollarSign className="w-4 h-4" />}
          extra={<CardHeaderActions />}
        >
          <div className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.inventoryValue.byStatus} margin={{ top: 10, right: 10, left: 58, bottom: 0 }}>
                <defs>
                  <linearGradient id="valueStatusGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                <XAxis 
                  dataKey="status" 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  dy={8}
                />
                <YAxis 
                  stroke="#cbd5e1"
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={formatCurrency}
                  width={55}
                  dx={-4}
                />
                <Tooltip content={<CustomTooltip valueFormatter={formatCurrency} />} />
                <Bar dataKey="value" fill="url(#valueStatusGradient)" name="Giá trị" radius={[5, 5, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

// Premium Metric Card Component
interface MetricCardProps {
  title: string;
  value: string;
  suffix: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color: 'cyan' | 'amber' | 'slate' | 'emerald';
}

function MetricCard({ title, value, suffix, icon, trend, color }: MetricCardProps) {
  const colorClasses = {
    cyan: 'bg-gradient-to-br from-cyan-50/40 to-cyan-100/10 dark:from-cyan-950/20 dark:to-cyan-900/10 border-cyan-100/80 dark:border-cyan-900/30 text-cyan-600 dark:text-cyan-400 hover:shadow-cyan-100/20 dark:hover:shadow-none',
    amber: 'bg-gradient-to-br from-amber-50/40 to-amber-100/10 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-100/80 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 hover:shadow-amber-100/20 dark:hover:shadow-none',
    slate: 'bg-gradient-to-br from-slate-50/40 to-slate-100/10 dark:from-slate-900/30 dark:to-slate-850/15 border-slate-100/80 dark:border-slate-800/50 text-slate-600 dark:text-slate-300 hover:shadow-slate-100/20 dark:hover:shadow-none',
    emerald: 'bg-gradient-to-br from-emerald-50/40 to-emerald-100/10 dark:from-emerald-950/20 dark:to-emerald-900/10 border-emerald-100/80 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:shadow-emerald-100/20 dark:hover:shadow-none',
  };

  return (
    <div className={`p-6 rounded-2xl border shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">{title}</p>
        <div className="p-2 rounded-xl bg-white/80 dark:bg-slate-950/60 shadow-sm border border-slate-100/30 dark:border-slate-800/20">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <p className="text-3xl font-extrabold tracking-tight">{value}</p>
        <span className="text-xs font-semibold opacity-60">{suffix}</span>
      </div>
      {trend && (
        <div className="flex items-center gap-1.5 mt-3.5 pt-3 border-t border-slate-100/40 dark:border-slate-850/40">
          <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-lg text-[10px] font-extrabold ${
            trend.isPositive 
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400' 
              : 'bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400'
          }`}>
            {trend.isPositive ? (
              <TrendingUp className="w-3 h-3 shrink-0" />
            ) : (
              <TrendingDown className="w-3 h-3 shrink-0" />
            )}
            {trend.value}%
          </div>
          <span className="text-[10px] opacity-50 font-medium">so với tháng trước</span>
        </div>
      )}
    </div>
  );
}

// Premium Chart Card Component
interface ChartCardProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  extra?: React.ReactNode;
}

function ChartCard({ title, subtitle, icon, children, extra }: ChartCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.15)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.035)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.25)] transition-all duration-300">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 text-cyan-600 dark:text-cyan-400 shadow-sm shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-wide">{title}</h3>
            {subtitle && (
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {extra && <div className="shrink-0">{extra}</div>}
      </div>
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}
