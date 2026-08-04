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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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

export default function BellaAutoAnalyticsDashboard({ tenantId }: BellaAutoAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadAnalytics();
  }, [tenantId]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Fetch vehicles data
      const { data: vehicles } = await supabase
        .from('auto_vehicles')
        .select('*')
        .eq('tenant_id', tenantId);

      if (!vehicles) {
        setLoading(false);
        return;
      }

      // Calculate status distribution
      const statusCounts = vehicles.reduce((acc, v) => {
        acc[v.status] = (acc[v.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const statusDistribution = [
        { name: 'Showroom', value: statusCounts.showroom || 0, color: '#06b6d4' },
        { name: 'Kho', value: statusCounts.warehouse || 0, color: '#64748b' },
        { name: 'Đã phân bổ', value: statusCounts.allocated || 0, color: '#f59e0b' },
        { name: 'Đang vận chuyển', value: statusCounts.in_transit || 0, color: '#6366f1' },
        { name: 'Đã bàn giao', value: statusCounts.delivered || 0, color: '#10b981' },
      ].filter(item => item.value > 0);

      // Calculate inventory value
      const inventoryValue = {
        total: vehicles.reduce((sum, v) => sum + (v.list_price || 0), 0),
        byStatus: Object.entries(statusCounts).map(([status, count]) => ({
          status,
          value: vehicles
            .filter(v => v.status === status)
            .reduce((sum, v) => sum + (v.list_price || 0), 0),
        })),
      };

      // Generate mock monthly trend (last 6 months)
      const monthlyTrend = generateMonthlyTrend();

      // Generate mock top models
      const topModels = [
        { model: 'VinFast VF 8', sold: 45, revenue: 40500000000 },
        { model: 'VinFast VF 9', sold: 32, revenue: 48000000000 },
        { model: 'VinFast VF 7', sold: 28, revenue: 22400000000 },
        { model: 'VinFast VF 5', sold: 67, revenue: 30150000000 },
        { model: 'VinFast VF 6', sold: 41, revenue: 28700000000 },
      ];

      // Generate mock weekly deliveries (last 8 weeks)
      const weeklyDeliveries = generateWeeklyDeliveries();

      // Generate mock revenue by month (last 6 months)
      const revenueByMonth = generateRevenueByMonth();

      // Calculate average days in stock (mock)
      const averageDaysInStock = 42;

      setAnalytics({
        monthlyTrend,
        statusDistribution,
        topModels,
        inventoryValue,
        averageDaysInStock,
        weeklyDeliveries,
        revenueByMonth,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateMonthlyTrend = () => {
    const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
    return months.map((month, idx) => ({
      month,
      nhap: Math.floor(Math.random() * 30) + 20,
      xuat: Math.floor(Math.random() * 25) + 15,
      ton: Math.floor(Math.random() * 50) + 30 + idx * 5,
    }));
  };

  const generateWeeklyDeliveries = () => {
    return Array.from({ length: 8 }, (_, i) => ({
      week: `Tuần ${i + 1}`,
      deliveries: Math.floor(Math.random() * 15) + 5,
    }));
  };

  const generateRevenueByMonth = () => {
    const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
    return months.map(month => ({
      month,
      revenue: Math.floor(Math.random() * 50000000000) + 100000000000,
    }));
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}B`;
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(0)}M`;
    }
    return value.toLocaleString('vi-VN');
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 dark:text-slate-400">Không thể tải dữ liệu phân tích</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Giá trị tồn kho"
          value={formatCurrency(analytics.inventoryValue.total)}
          suffix="VNĐ"
          icon={<DollarSign className="w-5 h-5" />}
          trend={{ value: 12.5, isPositive: true }}
          color="cyan"
        />
        <MetricCard
          title="Thời gian tồn TB"
          value={analytics.averageDaysInStock.toString()}
          suffix="ngày"
          icon={<Clock className="w-5 h-5" />}
          trend={{ value: 8.2, isPositive: false }}
          color="amber"
        />
        <MetricCard
          title="Xe trong kho"
          value={analytics.statusDistribution.reduce((sum, item) => sum + item.value, 0).toString()}
          suffix="xe"
          icon={<Package className="w-5 h-5" />}
          trend={{ value: 5.8, isPositive: true }}
          color="slate"
        />
        <MetricCard
          title="Bàn giao tuần này"
          value={analytics.weeklyDeliveries[analytics.weeklyDeliveries.length - 1].deliveries.toString()}
          suffix="xe"
          icon={<Activity className="w-5 h-5" />}
          trend={{ value: 15.3, isPositive: true }}
          color="emerald"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Inventory Trend */}
        <ChartCard title="Xu hướng nhập/xuất kho (6 tháng)" icon={<TrendingUp className="w-5 h-5" />}>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analytics.monthlyTrend}>
              <defs>
                <linearGradient id="colorNhap" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorXuat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorTon" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
              <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="nhap" stroke="#06b6d4" fill="url(#colorNhap)" name="Nhập kho" />
              <Area type="monotone" dataKey="xuat" stroke="#10b981" fill="url(#colorXuat)" name="Xuất kho" />
              <Area type="monotone" dataKey="ton" stroke="#f59e0b" fill="url(#colorTon)" name="Tồn kho" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Status Distribution */}
        <ChartCard title="Phân bố trạng thái xe" icon={<Package className="w-5 h-5" />}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analytics.statusDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {analytics.statusDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top Models by Sales */}
        <ChartCard title="Top 5 mẫu xe bán chạy" icon={<TrendingUp className="w-5 h-5" />}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.topModels} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
              <XAxis type="number" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis dataKey="model" type="category" stroke="#64748b" style={{ fontSize: '11px' }} width={100} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'revenue') return [formatCurrency(value) + ' VNĐ', 'Doanh thu'];
                  return [value, 'Số lượng'];
                }}
              />
              <Legend />
              <Bar dataKey="sold" fill="#06b6d4" name="Đã bán" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue Trend */}
        <ChartCard title="Doanh thu theo tháng" icon={<DollarSign className="w-5 h-5" />}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
              <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} tickFormatter={formatCurrency} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                }}
                formatter={(value: number) => [formatCurrency(value) + ' VNĐ', 'Doanh thu']}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Weekly Deliveries */}
        <ChartCard title="Bàn giao xe theo tuần (8 tuần)" icon={<Activity className="w-5 h-5" />}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.weeklyDeliveries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
              <XAxis dataKey="week" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                }}
              />
              <Bar dataKey="deliveries" fill="#6366f1" name="Xe bàn giao" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Inventory Value by Status */}
        <ChartCard title="Giá trị tồn kho theo trạng thái" icon={<DollarSign className="w-5 h-5" />}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analytics.inventoryValue.byStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.3} />
              <XAxis dataKey="status" stroke="#64748b" style={{ fontSize: '12px' }} />
              <YAxis stroke="#64748b" style={{ fontSize: '12px' }} tickFormatter={formatCurrency} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                }}
                formatter={(value: number) => [formatCurrency(value) + ' VNĐ', 'Giá trị']}
              />
              <Bar dataKey="value" fill="#f59e0b" name="Giá trị" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

// Metric Card Component
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
    cyan: 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-100 dark:border-cyan-900/30 text-cyan-600 dark:text-cyan-400',
    amber: 'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-400',
    slate: 'bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800/50 text-slate-600 dark:text-slate-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div className={`p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold opacity-80">{title}</p>
        <div className="opacity-60">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold">{value}</p>
        <span className="text-sm opacity-70">{suffix}</span>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-2">
          {trend.isPositive ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-rose-500" />
          )}
          <span className={`text-xs font-semibold ${trend.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
            {trend.value}%
          </span>
          <span className="text-xs opacity-60">vs tháng trước</span>
        </div>
      )}
    </div>
  );
}

// Chart Card Component
interface ChartCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function ChartCard({ title, icon, children }: ChartCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-cyan-600 dark:text-cyan-400">{icon}</div>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}
