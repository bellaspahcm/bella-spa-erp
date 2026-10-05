'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Building2,
  Wallet,
  TrendingUp,
  Percent,
  Calendar,
  Search,
  Download,
  ChevronRight,
  AlertTriangle,
  ArrowRight,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
} from 'lucide-react';
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { SafeResponsiveContainer as ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { formatCurrency } from '@bella/shared';
import type { HqDashboardStats, HqTenantRecord } from '@/types/domain';

interface Props {
  stats?: HqDashboardStats;
  tenants?: HqTenantRecord[];
  onSelectBranch?: (branchId: string) => void;
}

// Sample fallback dataset matching reference design numbers
const defaultBranchesData = [
  { rank: 1, name: 'Nguyễn Huệ', region: 'TP. HCM', revenue: 1.85, profit: 0.42, margin: 22.8, growth: 14.2, bookings: 1820, status: 'active', avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80' },
  { rank: 2, name: 'Thảo Điền', region: 'TP. HCM', revenue: 1.42, profit: 0.332, margin: 23.4, growth: 12.8, bookings: 1450, status: 'active', avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&q=80' },
  { rank: 3, name: 'Quận 7', region: 'TP. HCM', revenue: 1.18, profit: 0.258, margin: 21.9, growth: 9.6, bookings: 1230, status: 'active', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80' },
  { rank: 4, name: 'Cầu Giấy', region: 'Hà Nội', revenue: 0.98, profit: 0.21, margin: 21.3, growth: -3.2, bookings: 980, status: 'slow', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80' },
  { rank: 5, name: 'Đà Nẵng', region: 'Đà Nẵng', revenue: 0.82, profit: 0.18, margin: 22.0, growth: 5.8, bookings: 880, status: 'active', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80' },
  { rank: 6, name: 'Hải Phòng', region: 'Miền Bắc', revenue: 0.76, profit: 0.247, margin: 32.5, growth: 18.4, bookings: 740, status: 'active', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80' },
  { rank: 7, name: 'Nha Trang', region: 'Miền Trung', revenue: 0.68, profit: 0.191, margin: 28.1, growth: 11.1, bookings: 690, status: 'active', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=100&q=80' },
  { rank: 8, name: 'Bình Dương', region: 'Miền Nam', revenue: 0.62, profit: 0.165, margin: 26.7, growth: -6.1, bookings: 620, status: 'slow', avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=100&q=80' },
  { rank: 9, name: 'Cần Thơ', region: 'Miền Nam', revenue: 0.58, profit: 0.142, margin: 24.5, growth: -12.5, bookings: 590, status: 'warning', avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=100&q=80' },
  { rank: 10, name: 'Biên Hòa', region: 'Miền Nam', revenue: 0.51, profit: 0.12, margin: 23.4, growth: -18.7, bookings: 510, status: 'warning', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=100&q=80' },
];

const revenueStructureData = [
  { name: 'Dịch vụ', value: 8.12, percent: 64.6, color: '#2563eb' },
  { name: 'Sản phẩm', value: 3.21, percent: 25.5, color: '#e11d48' },
  { name: 'Thẻ liệu trình', value: 0.95, percent: 7.6, color: '#9333ea' },
  { name: 'Khác', value: 0.30, percent: 2.3, color: '#94a3b8' },
];

const monthlyTrendData = [
  { month: 'T1', revenue: 8.5, profit: 1.8, margin: 21.1 },
  { month: 'T2', revenue: 9.1, profit: 2.0, margin: 22.0 },
  { month: 'T3', revenue: 9.8, profit: 2.1, margin: 21.4 },
  { month: 'T4', revenue: 10.4, profit: 2.2, margin: 21.1 },
  { month: 'T5', revenue: 11.2, profit: 2.3, margin: 20.5 },
  { month: 'T6', revenue: 11.8, profit: 2.4, margin: 20.3 },
  { month: 'T7', revenue: 12.0, profit: 2.45, margin: 20.4 },
  { month: 'T8', revenue: 12.2, profit: 2.46, margin: 20.1 },
  { month: 'T9', revenue: 12.58, profit: 2.48, margin: 19.7 },
];

export function HqExecutiveOverview({
  stats,
  tenants = [],
  onSelectBranch,
}: Props) {
  const [fromDate, setFromDate] = useState('2026-09-01');
  const [toDate, setToDate] = useState('2026-09-30');
  const [subTab, setSubTab] = useState<'overview' | 'finance' | 'ops' | 'customers' | 'hr' | 'products' | 'custom'>('overview');
  const [trendTimeframe, setTrendTimeframe] = useState<'month' | 'week' | 'day'>('month');
  const [tableSortTab, setTableSortTab] = useState<'revenue' | 'profit' | 'margin' | 'growth' | 'bookings'>('revenue');
  const [tableSearch, setTableSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Parse branches for table
  const branchesList = useMemo(() => {
    if (tenants.length > 0) {
      return tenants.map((t, idx) => {
        const revTỷ = ((t.revenueSum || 0) / 1_000_000_000) || defaultBranchesData[idx % defaultBranchesData.length].revenue;
        return {
          id: t.id,
          rank: idx + 1,
          name: t.name.replace(/^Bella\s+Spa\s+/i, ''),
          region: t.address?.includes('Hà Nội') ? 'Hà Nội' : t.address?.includes('Đà Nẵng') ? 'Đà Nẵng' : 'TP. HCM',
          revenue: Number(revTỷ.toFixed(2)),
          profit: Number((revTỷ * 0.2).toFixed(2)),
          margin: 21.5,
          growth: 8.5,
          bookings: t.customerCount || 1000,
          status: t.status === 'suspended' ? 'warning' : 'active',
          avatar: defaultBranchesData[idx % defaultBranchesData.length].avatar,
        };
      });
    }
    return defaultBranchesData;
  }, [tenants]);

  // Filtered branches list for table
  const filteredBranches = useMemo(() => {
    return branchesList
      .filter((b) => {
        const matchSearch = b.name.toLowerCase().includes(tableSearch.toLowerCase()) || b.region.toLowerCase().includes(tableSearch.toLowerCase());
        const matchRegion = selectedRegion === 'all' || b.region === selectedRegion;
        const matchStatus = selectedStatus === 'all' || b.status === selectedStatus;
        return matchSearch && matchRegion && matchStatus;
      })
      .sort((a, b) => {
        if (tableSortTab === 'revenue') return b.revenue - a.revenue;
        if (tableSortTab === 'profit') return b.profit - a.profit;
        if (tableSortTab === 'margin') return b.margin - a.margin;
        if (tableSortTab === 'growth') return b.growth - a.growth;
        return b.bookings - a.bookings;
      });
  }, [branchesList, tableSearch, selectedRegion, selectedStatus, tableSortTab]);

  return (
    <div className="space-y-8 font-sans antialiased text-slate-900 pb-16">
      
      {/* ── TOP HEADER BAR & SUB-NAV ── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center font-black text-sm shrink-0">
              HT
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                TỔNG QUAN TOÀN HỆ THỐNG
              </h1>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                Giám sát hiệu suất kinh doanh, tài chính và vận hành của toàn bộ chi nhánh
              </p>
            </div>
          </div>

          {/* Date Picker & Apply */}
          <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-2 text-xs font-bold text-slate-700">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent outline-none cursor-pointer"
              />
              <span className="text-slate-400">→</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent outline-none cursor-pointer"
              />
            </div>
            <button className="px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm">
              Áp dụng
            </button>
          </div>
        </div>

        {/* Sub-navigation Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-t border-slate-100 pt-4">
          {[
            { id: 'overview', label: 'Tổng quan' },
            { id: 'finance', label: 'Tài chính' },
            { id: 'ops', label: 'Vận hành' },
            { id: 'customers', label: 'Khách hàng' },
            { id: 'hr', label: 'Nhân sự' },
            { id: 'products', label: 'Sản phẩm' },
            { id: 'custom', label: 'Báo cáo tùy chỉnh' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id as typeof subTab)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 border ${
                subTab === tab.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TOP 4 METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Chi nhánh */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-start justify-between relative overflow-hidden">
          <div className="space-y-3 z-10">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Tổng số chi nhánh</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 leading-none">236</span>
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">↑ 8%</span>
            </div>
            <div className="space-y-1 text-xs font-bold">
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>210 Hoạt động</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>18 Ít hoạt động</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>8 Cảnh báo</span>
              </div>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Doanh thu thuần */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-start justify-between relative overflow-hidden">
          <div className="space-y-3 z-10">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Doanh thu thuần toàn hệ thống</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 leading-none">12,58 tỷ</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">↑ 12,4%</span>
              <p className="text-[10px] font-bold text-slate-400 mt-1">So với kỳ trước: 11,18 tỷ</p>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 border border-pink-100 flex items-center justify-center shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Lợi nhuận sau thuế */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-start justify-between relative overflow-hidden">
          <div className="space-y-3 z-10">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Lợi nhuận sau thuế</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 leading-none">2,48 tỷ</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block">↑ 8,1%</span>
              <p className="text-[10px] font-bold text-slate-400 mt-1">So với kỳ trước: 2,30 tỷ</p>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Tỷ suất lợi nhuận */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-start justify-between relative overflow-hidden">
          <div className="space-y-3 z-10">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Tỷ suất lợi nhuận</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 leading-none">19,7%</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full inline-block">↓ 2.3 điểm %</span>
              <p className="text-[10px] font-bold text-slate-400 mt-1">So với kỳ trước: 22,0%</p>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
            <Percent className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── ROW 2: CHARTS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue Structure Donut */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Cấu trúc doanh thu <span className="text-slate-400 text-xs font-normal">(sau loại trừ nội bộ)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 py-2">
            <div className="h-52 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={revenueStructureData}
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {revenueStructureData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} tỷ`} />
                </RePieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-lg font-black text-slate-900">12,58 tỷ</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Doanh thu thuần</span>
              </div>
            </div>

            <div className="space-y-3 text-xs font-bold">
              {revenueStructureData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between border-b border-slate-50 pb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-700">{item.name}</span>
                  </div>
                  <span className="text-slate-900 font-black">{item.value.toFixed(2).replace('.', ',')} tỷ ({item.percent}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue & Profit Trend Chart */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Xu hướng doanh thu & lợi nhuận
            </h3>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setTrendTimeframe('month')}
                className={`px-3 py-1 rounded-lg transition-all ${trendTimeframe === 'month' ? 'bg-slate-900 text-white font-black' : 'text-slate-600'}`}
              >
                Theo tháng
              </button>
              <button
                onClick={() => setTrendTimeframe('week')}
                className={`px-3 py-1 rounded-lg transition-all ${trendTimeframe === 'week' ? 'bg-slate-900 text-white font-black' : 'text-slate-600'}`}
              >
                Theo tuần
              </button>
              <button
                onClick={() => setTrendTimeframe('day')}
                className={`px-3 py-1 rounded-lg transition-all ${trendTimeframe === 'day' ? 'bg-slate-900 text-white font-black' : 'text-slate-600'}`}
              >
                Theo ngày
              </button>
            </div>
          </div>

          <div className="h-60 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={monthlyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#94a3b8" domain={[0, 40]} tickFormatter={(v) => `${v}%`} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="revenue" name="Doanh thu thuần" fill="#e11d48" radius={[4, 4, 0, 0]} barSize={14} />
                <Bar yAxisId="left" dataKey="profit" name="Lợi nhuận sau thuế" fill="#10b981" radius={[4, 4, 0, 0]} barSize={14} />
                <Line yAxisId="right" type="monotone" dataKey="margin" name="Tỷ suất lợi nhuận (%)" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-center gap-6 text-xs font-bold text-slate-600 pt-2 border-t border-slate-50">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-rose-600 rounded-xs" /> Doanh thu thuần</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-500 rounded-xs" /> Lợi nhuận sau thuế</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-blue-600 rounded-full" /> Tỷ suất lợi nhuận</span>
          </div>
        </div>
      </div>

      {/* ── ROW 3: TOP 5 RANKINGS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Revenue */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Top 5 chi nhánh theo doanh thu
            </h3>
            <button className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
              Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {[
              { rank: 1, name: 'Nguyễn Huệ', val: '1,85 tỷ', percent: 100, avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80' },
              { rank: 2, name: 'Thảo Điền', val: '1,42 tỷ', percent: 77, avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&q=80' },
              { rank: 3, name: 'Quận 7', val: '1,18 tỷ', percent: 64, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80' },
              { rank: 4, name: 'Cầu Giấy', val: '0,98 tỷ', percent: 53, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=100&q=80' },
              { rank: 5, name: 'Đà Nẵng', val: '0,82 tỷ', percent: 44, avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=100&q=80' },
            ].map((item) => (
              <div key={item.rank} className="flex items-center gap-3 text-xs font-bold">
                <span className="w-5 text-slate-400 font-black text-center">{item.rank}</span>
                <Image src={item.avatar} alt={item.name} width={32} height={32} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                <span className="w-28 text-slate-900 font-black truncate">{item.name}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${item.percent}%` }} />
                </div>
                <span className="w-16 text-right font-black text-slate-900">{item.val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 Margin */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Top 5 chi nhánh theo tỷ suất lợi nhuận
            </h3>
            <button className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
              Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {[
              { rank: 1, name: 'Hải Phòng', val: '32,5%', percent: 100, avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80' },
              { rank: 2, name: 'Nha Trang', val: '28,1%', percent: 86, avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=100&q=80' },
              { rank: 3, name: 'Bình Dương', val: '26,7%', percent: 82, avatar: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=100&q=80' },
              { rank: 4, name: 'Cần Thơ', val: '24,5%', percent: 75, avatar: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=100&q=80' },
              { rank: 5, name: 'Thảo Điền', val: '23,4%', percent: 72, avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=100&q=80' },
            ].map((item) => (
              <div key={item.rank} className="flex items-center gap-3 text-xs font-bold">
                <span className="w-5 text-slate-400 font-black text-center">{item.rank}</span>
                <Image src={item.avatar} alt={item.name} width={32} height={32} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                <span className="w-28 text-slate-900 font-black truncate">{item.name}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${item.percent}%` }} />
                </div>
                <span className="w-16 text-right font-black text-slate-900">{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ROW 4: MAP & OPERATIONS WARNING ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Regional Map */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            Bản đồ hoạt động chi nhánh
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            {/* Vietnam Map Graphic Placeholder */}
            <div className="md:col-span-2 h-64 bg-sky-50/60 rounded-2xl border border-sky-100 relative p-4 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:12px_12px] opacity-30" />
              <div className="relative text-center space-y-2 z-10">
                <MapPin className="w-8 h-8 text-sky-600 mx-auto animate-bounce" />
                <p className="text-xs font-black text-sky-900">BẢN ĐỒ VIỆT NAM (236 CHI NHÁNH)</p>
                <p className="text-[10px] font-bold text-sky-700">Hà Nội • TP.HCM • Đà Nẵng • Cần Thơ</p>
              </div>
            </div>

            {/* Region Counts */}
            <div className="space-y-2.5 text-xs font-bold">
              {[
                { name: 'Hà Nội', count: 42 },
                { name: 'TP. Hồ Chí Minh', count: 78, highlight: true },
                { name: 'Đà Nẵng', count: 15 },
                { name: 'Miền Bắc', count: 38 },
                { name: 'Miền Trung', count: 22 },
                { name: 'Miền Nam', count: 41 },
              ].map((r, idx) => (
                <div key={idx} className={`flex justify-between items-center px-3 py-1.5 rounded-xl border ${r.highlight ? 'bg-blue-50 border-blue-200 text-blue-900 font-black' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                  <span>{r.name}</span>
                  <span className="font-black text-slate-900">{r.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-start gap-4 text-xs font-bold text-slate-600 pt-2 border-t border-slate-50">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Hoạt động (210)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Ít hoạt động (18)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Cảnh báo (8)</span>
          </div>
        </div>

        {/* Operations Health & Warnings */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Tình trạng vận hành toàn hệ thống
            </h3>
            <button className="text-xs font-bold text-blue-600 hover:underline">
              Xem chi tiết -&gt;
            </button>
          </div>

          {/* Operational Donut Status */}
          <div className="flex items-center gap-4 py-2">
            <div className="w-24 h-24 rounded-full border-8 border-emerald-500 border-t-amber-500 border-r-rose-500 flex items-center justify-center shrink-0">
              <div className="text-center">
                <span className="text-base font-black text-slate-900 block leading-tight">89%</span>
                <span className="text-[8px] font-bold text-slate-400 block leading-tight">Hiệu suất vận hành</span>
              </div>
            </div>

            <div className="space-y-2 text-xs font-bold">
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Hoạt động bình thường (210)</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Ít hoạt động (18)</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Cần chú ý (8)</div>
            </div>
          </div>

          {/* Warnings List Box */}
          <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-rose-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" /> Chi nhánh cần chú ý (8)
              </span>
              <button className="text-[10px] font-black text-rose-600 hover:underline">Xem tất cả</button>
            </div>

            <div className="space-y-2 text-xs font-bold">
              <div className="flex items-start gap-2 bg-white/80 rounded-xl p-2 border border-rose-100/50">
                <span className="text-amber-500 font-black">🟠</span>
                <div>
                  <p className="text-slate-900 font-black">Cần Thơ</p>
                  <p className="text-[10px] text-slate-500 font-medium">Doanh thu giảm 32% so với kỳ trước (3 ngày)</p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-white/80 rounded-xl p-2 border border-rose-100/50">
                <span className="text-rose-500 font-black">🔴</span>
                <div>
                  <p className="text-slate-900 font-black">Biên Hòa</p>
                  <p className="text-[10px] text-slate-500 font-medium">Chưa cập nhật doanh thu 2 ngày</p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-white/80 rounded-xl p-2 border border-rose-100/50">
                <span className="text-rose-500 font-black">🔴</span>
                <div>
                  <p className="text-slate-900 font-black">Vũng Tàu</p>
                  <p className="text-[10px] text-slate-500 font-medium">Tỷ lệ hủy lịch cao 28%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 5: FINANCIAL CONSOLIDATION FLOW ── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
          Báo cáo tài chính hợp nhất
          <span className="text-slate-400 text-xs font-normal">(sau khi loại trừ giao dịch nội bộ)</span>
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-7 gap-2 items-center text-center">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
            <span className="text-lg font-black text-slate-900 block">15,20 tỷ</span>
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Doanh thu gộp</span>
          </div>

          <div className="text-slate-400 font-bold text-xs flex flex-col items-center justify-center">
            <span className="text-rose-500 font-black">- 2,62 tỷ</span>
            <span className="text-[9px] text-slate-400">Loại trừ nội bộ</span>
            <ArrowRight className="w-4 h-4 text-slate-300 mt-1 hidden md:block" />
          </div>

          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 space-y-1">
            <span className="text-lg font-black text-emerald-700 block">12,58 tỷ</span>
            <span className="text-[10px] font-bold text-emerald-600 block uppercase">Doanh thu thuần</span>
          </div>

          <div className="text-slate-400 font-bold text-xs flex flex-col items-center justify-center">
            <span className="text-rose-500 font-black">- 6,80 tỷ</span>
            <span className="text-[9px] text-slate-400">Giá vốn</span>
            <ArrowRight className="w-4 h-4 text-slate-300 mt-1 hidden md:block" />
          </div>

          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-1">
            <span className="text-lg font-black text-blue-700 block">5,78 tỷ</span>
            <span className="text-[10px] font-bold text-blue-600 block uppercase">Lợi nhuận gộp</span>
          </div>

          <div className="text-slate-400 font-bold text-xs flex flex-col items-center justify-center">
            <span className="text-rose-500 font-black">- 2,11 tỷ</span>
            <span className="text-[9px] text-slate-400">Chi phí QLKD</span>
            <ArrowRight className="w-4 h-4 text-slate-300 mt-1 hidden md:block" />
          </div>

          <div className="bg-emerald-500 text-white p-4 rounded-2xl shadow-lg shadow-emerald-500/20 space-y-1 col-span-2 md:col-span-1">
            <span className="text-lg font-black block">2,48 tỷ</span>
            <span className="text-[10px] font-black uppercase block opacity-90">Lợi nhuận sau thuế</span>
          </div>
        </div>
      </div>

      {/* ── ROW 6: FULL PERFORMANCE TABLE ── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
            Bảng xếp hạng chi nhánh theo hiệu suất
          </h3>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full lg:w-auto">
            {[
              { id: 'revenue', label: 'Theo doanh thu' },
              { id: 'profit', label: 'Theo lợi nhuận' },
              { id: 'margin', label: 'Theo tỷ suất lợi nhuận' },
              { id: 'growth', label: 'Theo tăng trưởng' },
              { id: 'bookings', label: 'Theo số booking' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTableSortTab(tab.id as typeof tableSortTab)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 border ${
                  tableSortTab === tab.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm kiếm chi nhánh..."
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
              />
            </div>

            {/* Region Dropdown */}
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">Khu vực (Tất cả)</option>
              <option value="TP. HCM">TP. HCM</option>
              <option value="Hà Nội">Hà Nội</option>
              <option value="Đà Nẵng">Đà Nẵng</option>
              <option value="Miền Bắc">Miền Bắc</option>
              <option value="Miền Trung">Miền Trung</option>
              <option value="Miền Nam">Miền Nam</option>
            </select>

            {/* Status Dropdown */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">Trạng thái (Tất cả)</option>
              <option value="active">Hoạt động</option>
              <option value="slow">Ít hoạt động</option>
              <option value="warning">Cảnh báo</option>
            </select>
          </div>

          <button className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm shrink-0">
            <Download className="w-3.5 h-3.5" /> Xuất Excel
          </button>
        </div>

        {/* Performance Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider bg-slate-50/50">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-3">Chi nhánh</th>
                <th className="py-3 px-3">Khu vực</th>
                <th className="py-3 px-3 text-right">Doanh thu thuần</th>
                <th className="py-3 px-3 text-right">Lợi nhuận</th>
                <th className="py-3 px-3 text-right">Tỷ suất LN</th>
                <th className="py-3 px-3 text-right">So với kỳ trước</th>
                <th className="py-3 px-3 text-right">Bookings</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold">
              {filteredBranches.map((item, idx) => (
                <tr
                  key={idx}
                  onClick={() => onSelectBranch && 'id' in item && typeof item.id === 'string' && onSelectBranch(item.id)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-3 text-slate-400 font-black">{item.rank}</td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <Image src={item.avatar} alt={item.name} width={28} height={28} className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                      <span className="font-black text-slate-900">{item.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-slate-500 font-medium">{item.region}</td>
                  <td className="py-3.5 px-3 text-right font-black text-slate-900">{item.revenue.toFixed(2).replace('.', ',')} tỷ</td>
                  <td className="py-3.5 px-3 text-right font-black text-slate-800">{(item.profit * 1000).toFixed(0)} triệu</td>
                  <td className="py-3.5 px-3 text-right font-black text-emerald-600">{item.margin}%</td>
                  <td className="py-3.5 px-3 text-right whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${item.growth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                      {item.growth >= 0 ? `↑ ${item.growth}%` : `↓ ${Math.abs(item.growth)}%`}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right text-slate-800 font-black">{item.bookings.toLocaleString('vi-VN')}</td>
                  <td className="py-3.5 px-3 text-center">
                    {item.status === 'active' ? (
                      <span className="px-2.5 py-1 rounded-full text-[9.5px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ● Hoạt động
                      </span>
                    ) : item.status === 'slow' ? (
                      <span className="px-2.5 py-1 rounded-full text-[9.5px] font-black bg-amber-50 text-amber-700 border border-amber-200">
                        ● Ít hoạt động
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[9.5px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                        ● Cảnh báo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Table Pagination */}
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 pt-3 border-t border-slate-100">
          <span>Hiển thị 1 - {filteredBranches.length} / {branchesList.length} chi nhánh</span>
          <div className="flex items-center gap-1.5">
            <button className="w-7 h-7 rounded-lg bg-blue-600 text-white font-black flex items-center justify-center">1</button>
            <button className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center">2</button>
            <button className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center">3</button>
            <span>...</span>
            <button className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center">24</button>
          </div>
        </div>
      </div>
    </div>
  );
}
