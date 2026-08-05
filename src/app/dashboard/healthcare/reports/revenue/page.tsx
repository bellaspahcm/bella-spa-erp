'use client';

import React, { useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Calendar,
  PieChart,
  Target,
  Sparkles,
  Stethoscope,
  Award,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

export default function RevenueAnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Mock data - Revenue stats
  const revenueStats = {
    totalRevenue: 920500000,
    revenueGrowth: 15.3,
    avgRevenuePerPatient: 5900000,
    avgRevenuePerEncounter: 3932000,
    totalPatients: 156,
    totalEncounters: 234,
  };

  // Mock data - Revenue by service category
  const revenueByCategory = [
    { category: 'Cấy ghép Implant Nobel Biocare', revenue: 224000000, count: 28, percentage: 24.3, color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-500' },
    { category: 'Niềng răng trong suốt Invisalign', revenue: 216000000, count: 18, percentage: 23.5, color: 'from-cyan-500 to-blue-500', bg: 'bg-cyan-500' },
    { category: 'Bọc sứ thẩm mỹ Cercon HT', revenue: 128000000, count: 32, percentage: 13.9, color: 'from-indigo-500 to-purple-500', bg: 'bg-indigo-500' },
    { category: 'Tẩy trắng răng Laser Zoom', revenue: 67500000, count: 45, percentage: 7.3, color: 'from-amber-400 to-amber-500', bg: 'bg-amber-400' },
    { category: 'Nhổ răng khôn Piezotome', revenue: 45600000, count: 38, percentage: 5.0, color: 'from-rose-500 to-pink-500', bg: 'bg-rose-500' },
    { category: 'Trám răng thẩm mỹ 3M', revenue: 20100000, count: 67, percentage: 2.2, color: 'from-sky-500 to-indigo-400', bg: 'bg-sky-500' },
    { category: 'Điều trị tủy Nội nha Vi phẫu', revenue: 19200000, count: 24, percentage: 2.1, color: 'from-violet-500 to-purple-600', bg: 'bg-violet-500' },
    { category: 'Dịch vụ nha khoa khác', revenue: 200100000, count: 82, percentage: 21.7, color: 'from-slate-400 to-slate-500', bg: 'bg-slate-400' },
  ];

  // Mock data - Revenue by doctor
  const revenueByDoctor = [
    { name: 'BS. Lê Minh', title: 'Nha sĩ Trưởng / Chuyên gia Cấy ghép Implant', revenue: 380000000, patients: 68, avgPerPatient: 5588235, growth: 18.2, avatar: '👨‍⚕️' },
    { name: 'BS. Trần Thảo', title: 'Chuyên gia Phục hình Sứ & Chỉnh nha Invisalign', revenue: 340000000, patients: 52, avgPerPatient: 6538461, growth: 22.5, avatar: '👩‍⚕️' },
    { name: 'BS. Nguyễn An', title: 'Bác sĩ Nội nha Vi phẫu & Nha khoa Tổng quát', revenue: 200500000, patients: 36, avgPerPatient: 5569444, growth: 8.3, avatar: '👨‍⚕️' },
  ];

  // Dynamically calculate the last 5 relative months up to current date (e.g. Tháng 4 -> Tháng 8/2026)
  const currentDate = new Date();
  const currentMonthNum = currentDate.getMonth() + 1; // 8 for August

  const getRelativeMonthLabel = (offset: number) => {
    let m = currentMonthNum - offset;
    if (m <= 0) m += 12;
    return `Tháng ${m}`;
  };

  const currentMonthName = getRelativeMonthLabel(0);

  const monthlyTrend = [
    { month: getRelativeMonthLabel(4), revenue: 680000000, target: 750000000 },
    { month: getRelativeMonthLabel(3), revenue: 720000000, target: 750000000 },
    { month: getRelativeMonthLabel(2), revenue: 780000000, target: 750000000 },
    { month: getRelativeMonthLabel(1), revenue: 850000000, target: 800000000 },
    { month: `${currentMonthName} (Hiện tại)`, revenue: 920500000, target: 850000000 },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Hero Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] relative overflow-hidden">
          {/* Background Decorative Blur Gradients */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br from-blue-500/10 via-cyan-500/10 to-teal-500/0 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
              <DollarSign className="w-7 h-7" />
            </div>
            <div className="text-left space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Phân Tích & Báo Cáo Doanh Thu
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Doanh Thu Thực Tế
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Theo dõi cơ cấu doanh thu theo dịch vụ nha khoa, hiệu suất bác sĩ & xu hướng tăng trưởng
              </p>
            </div>
          </div>

          {/* Time Filter Pills */}
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 shrink-0 relative z-10">
            {[
              { id: 'week', label: 'Tuần' },
              { id: 'month', label: 'Tháng' },
              { id: 'quarter', label: 'Quý' },
              { id: 'year', label: 'Năm' },
            ].map((period) => (
              <button
                key={period.id}
                onClick={() => {
                  setSelectedPeriod(period.id);
                  toast.info(`Đã cập nhật phân tích doanh thu theo: ${period.label}`);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  selectedPeriod === period.id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20 scale-105'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/50'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Premium Glass KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* KPI 1 */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_6px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_32px_-4px_rgba(59,130,246,0.15)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng doanh thu</span>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center shadow-sm">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1 relative z-10 text-left">
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {(revenueStats.totalRevenue / 1000000).toFixed(1)}M <span className="text-xs font-semibold text-slate-400">VNĐ</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-extrabold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+{revenueStats.revenueGrowth}% so tháng trước</span>
              </div>
            </div>
          </div>

          {/* KPI 2 */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_6px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_32px_-4px_rgba(6,182,212,0.15)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-cyan-500/10 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">TB / Bệnh nhân</span>
              <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/60 flex items-center justify-center shadow-sm">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1 relative z-10 text-left">
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {(revenueStats.avgRevenuePerPatient / 1000000).toFixed(1)}M <span className="text-xs font-semibold text-slate-400">VNĐ</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                <b className="text-slate-700 dark:text-slate-300 font-extrabold">{revenueStats.totalPatients} bệnh nhân</b> đã phục vụ
              </p>
            </div>
          </div>

          {/* KPI 3 */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_6px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_32px_-4px_rgba(20,184,166,0.15)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-teal-500/10 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">TB / Lượt khám</span>
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60 flex items-center justify-center shadow-sm">
                <Calendar className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1 relative z-10 text-left">
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {(revenueStats.avgRevenuePerEncounter / 1000000).toFixed(1)}M <span className="text-xs font-semibold text-slate-400">VNĐ</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                <b className="text-slate-700 dark:text-slate-300 font-extrabold">{revenueStats.totalEncounters} lượt khám</b> hoàn tất
              </p>
            </div>
          </div>

          {/* KPI 4 */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_6px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_32px_-4px_rgba(16,185,129,0.15)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tăng trưởng</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center shadow-sm">
                <Target className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1 relative z-10 text-left">
              <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight flex items-center gap-1">
                <TrendingUp className="w-6 h-6" />
                +{revenueStats.revenueGrowth}%
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Vượt chỉ tiêu KPI phòng khám
              </p>
            </div>
          </div>

        </div>

        {/* Service Composition Donut & Pipeline Chart Card */}
        <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] space-y-6 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <PieChart className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Biểu Đồ Cơ Cấu Doanh Thu Dịch Vụ (Service Mix Pipeline)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Phân bổ tỷ trọng đóng góp tài chính của từng nhóm thủ thuật nha khoa
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-black">
              Phân bãi 8 nhóm dịch vụ
            </span>
          </div>

          {/* Continuous Multi-Color Pipeline Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-500">
              <span>Phân bổ Pipeline liên tục (% Doanh thu):</span>
              <span className="text-blue-600 dark:text-blue-400 font-black">100% Doanh thu (920.5M VNĐ)</span>
            </div>

            <div className="w-full h-8 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 flex items-center gap-1 shadow-inner overflow-hidden">
              {revenueByCategory.map((item, idx) => (
                <div 
                  key={idx}
                  style={{ width: `${item.percentage}%` }} 
                  className={`h-full rounded-xl bg-gradient-to-r ${item.color} flex items-center justify-center text-[10px] font-black text-white shadow-2xs hover:opacity-90 transition-all cursor-pointer group relative`}
                  title={`${item.category}: ${(item.revenue / 1000000).toFixed(1)}M VNĐ (${item.percentage}%)`}
                >
                  {item.percentage > 4 && `${item.percentage}%`}
                </div>
              ))}
            </div>
          </div>

          {/* Composition Legend Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-2">
            {revenueByCategory.map((item, idx) => (
              <div 
                key={idx}
                className="p-2.5 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 hover:border-blue-300 dark:hover:border-blue-700 transition-all space-y-1"
              >
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                  <span className={`w-2 h-2 rounded-full ${item.bg} shrink-0`} />
                  <span className="truncate">{item.category}</span>
                </div>
                <div className="flex items-baseline justify-between pt-0.5">
                  <span className="font-black text-xs text-slate-900 dark:text-white">{(item.revenue / 1000000).toFixed(1)}M</span>
                  <span className="text-[9px] font-black text-blue-600 dark:text-blue-400">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by Service Category Section */}
        <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] space-y-6 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Bảng Xếp Hạng Doanh Thu Theo Loại Dịch Vụ
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Doanh thu chi tiết, số lượng ca và tỷ trọng % theo từng thủ thuật
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {revenueByCategory.map((item, idx) => {
              const maxRevenue = Math.max(...revenueByCategory.map(c => c.revenue));
              const widthPercent = (item.revenue / maxRevenue) * 100;
              
              // Metallic Rank Colors
              const rankBadge = 
                idx === 0 ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-500/20' :
                idx === 1 ? 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-950 font-black shadow-md shadow-slate-400/20' :
                idx === 2 ? 'bg-gradient-to-r from-amber-700 to-amber-800 text-white font-black shadow-md' :
                'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold';

              return (
                <div 
                  key={idx}
                  className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 border border-slate-100 dark:border-slate-850 hover:border-blue-200 dark:hover:border-blue-800/60 transition-all duration-300 group space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${rankBadge}`}>
                        #{idx + 1}
                      </span>
                      <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {item.category}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-bold shrink-0">
                      <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs">
                        <strong className="text-slate-900 dark:text-white font-black">{item.count}</strong> ca
                      </span>
                      <span className="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 font-black text-sm shadow-2xs">
                        {(item.revenue / 1000000).toFixed(1)}M VNĐ
                      </span>
                      <span className="px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 min-w-[55px] text-center font-black">
                        {item.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Gradient Progress Bar */}
                  <div className="w-full bg-slate-200/70 dark:bg-slate-800/70 rounded-full h-2.5 overflow-hidden p-0.5">
                    <div
                      className={`bg-gradient-to-r ${item.color} h-full rounded-full transition-all duration-700 shadow-sm`}
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revenue by Doctor Section */}
        <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] space-y-6 text-left">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                <Stethoscope className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Hiệu Suất & Doanh Thu Theo Bác Sĩ
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Xếp hạng năng suất khám điều trị của đội ngũ y bác sĩ</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {revenueByDoctor.map((doctor, idx) => (
              <div key={idx} className="p-6 rounded-[24px] bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-850 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg transition-all duration-300 space-y-4 relative overflow-hidden group">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-2xl shadow-sm">
                      {doctor.avatar}
                    </span>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {doctor.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 line-clamp-1">{doctor.title}</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Doanh thu đạt được:</span>
                  <div className="text-right">
                    <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                      {(doctor.revenue / 1000000).toFixed(1)}M VNĐ
                    </span>
                    <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-black justify-end">
                      <TrendingUp className="w-3 h-3" />
                      +{doctor.growth}%
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Bệnh nhân</span>
                    <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{doctor.patients} BN</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/60">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">TB / Bệnh nhân</span>
                    <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                      {(doctor.avgPerPatient / 1000000).toFixed(1)}M
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Trend Section - Vertical Column & Line Combo Chart */}
        <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] space-y-6 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <TrendingUp className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Biểu Đồ Cột & Đường Xu Hướng Doanh Thu (5 Tháng Gần Nhất)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  So sánh Doanh thu thực tế (Cột Gradient) với Mục tiêu KPI (Đường Line nét đứt)
                </p>
              </div>
            </div>

            {/* Chart Legend Tags */}
            <div className="flex items-center gap-3 text-xs font-bold shrink-0">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                <span className="w-3 h-3 rounded-md bg-gradient-to-t from-blue-600 to-cyan-400" />
                <span>Doanh thu Thực tế</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                <span className="w-3.5 h-1 rounded-full bg-emerald-500" />
                <span>Đường KPI Mục tiêu</span>
              </div>
            </div>
          </div>

          {/* Interactive Combo Chart Canvas Container */}
          <div className="p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-100 dark:border-slate-850 space-y-3">
            
            <div className="flex items-stretch gap-4">
              {/* Dedicated Y-Axis Labels Column (Left Margin) */}
              <div className="w-16 shrink-0 flex flex-col justify-between text-[10px] font-extrabold text-slate-400 dark:text-slate-500 text-right py-1 select-none">
                <span>1.0B VNĐ</span>
                <span>750M VNĐ</span>
                <span>500M VNĐ</span>
                <span>250M VNĐ</span>
                <span>0 VNĐ</span>
              </div>

              {/* Main Chart Area */}
              <div className="flex-1 relative h-64 pt-6 pb-2">
                
                {/* Horizontal Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  <div className="border-b border-dashed border-slate-200 dark:border-slate-800/80 w-full" />
                  <div className="border-b border-dashed border-slate-200 dark:border-slate-800/80 w-full" />
                  <div className="border-b border-dashed border-slate-200 dark:border-slate-800/80 w-full" />
                  <div className="border-b border-dashed border-slate-200 dark:border-slate-800/80 w-full" />
                  <div className="border-b border-slate-200 dark:border-slate-800 w-full" />
                </div>

                {/* SVG Trend Line Overlay with Explicit viewBox */}
                <svg 
                  viewBox="0 0 500 200" 
                  preserveAspectRatio="none" 
                  className="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-visible"
                >
                  <defs>
                    <linearGradient id="kpiGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="50%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>

                  {/* Connected KPI Target Dashed Line (Sleek Thin) */}
                  <path
                    d="M 50 50 L 150 50 L 250 50 L 350 40 L 450 30"
                    fill="none"
                    stroke="url(#kpiGlow)"
                    strokeWidth="1.8"
                    strokeDasharray="5,3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-[0_2px_6px_rgba(16,185,129,0.4)]"
                  />

                  {/* Actual Revenue Spline Line (Sleek Thin) */}
                  <path
                    d="M 50 64 L 150 56 L 250 44 L 350 30 L 450 16"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    className="opacity-80"
                  />

                  {/* KPI Target Glowing Dots */}
                  <circle cx="50" cy="50" r="3.5" className="fill-emerald-500 stroke-white stroke-[1.5]" />
                  <circle cx="150" cy="50" r="3.5" className="fill-emerald-500 stroke-white stroke-[1.5]" />
                  <circle cx="250" cy="50" r="3.5" className="fill-emerald-500 stroke-white stroke-[1.5]" />
                  <circle cx="350" cy="40" r="3.5" className="fill-cyan-500 stroke-white stroke-[1.5]" />
                  <circle cx="450" cy="30" r="4.5" className="fill-blue-500 stroke-white stroke-2 animate-pulse" />
                </svg>

                {/* 5 Grouped Columns (Sleek Slim Bar Columns) */}
                <div className="grid grid-cols-5 h-full items-end gap-3 sm:gap-6 px-4 relative z-10">
                  {monthlyTrend.map((month, idx) => {
                    const maxVal = 1000000000; // 1B VNĐ
                    const heightPercent = (month.revenue / maxVal) * 100;
                    const isPeak = idx === monthlyTrend.length - 1;

                    return (
                      <div key={idx} className="flex flex-col items-center gap-1.5 group cursor-pointer h-full justify-end max-w-[32px] mx-auto w-full">
                        {/* Top Revenue Badge */}
                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black transition-all group-hover:scale-110 shadow-2xs ${
                          isPeak 
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/30' 
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                        }`}>
                          {(month.revenue / 1000000).toFixed(0)}M
                        </span>

                        {/* Sleek 3D Slim Bar Column */}
                        <div className="w-full bg-slate-200/50 dark:bg-slate-800/50 rounded-xl h-full flex items-end p-0.5">
                          <div
                            className={`w-full rounded-lg transition-all duration-700 group-hover:brightness-110 shadow-sm ${
                              isPeak
                                ? 'bg-gradient-to-t from-blue-600 via-cyan-500 to-teal-400 shadow-blue-500/25'
                                : 'bg-gradient-to-t from-slate-400 via-teal-500 to-emerald-400'
                            }`}
                            style={{ height: `${heightPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

              </div>
            </div>

            {/* X-Axis Month Labels & KPI Badges Footer */}
            <div className="flex items-center gap-4 border-t border-slate-200/80 dark:border-slate-800 pt-3">
              <div className="w-16 shrink-0" />
              <div className="flex-1 grid grid-cols-5 gap-3 sm:gap-6 px-4 text-center">
                {monthlyTrend.map((month, idx) => {
                  const achievementRate = (month.revenue / month.target) * 100;
                  const isAboveTarget = month.revenue >= month.target;

                  return (
                    <div key={idx} className="space-y-1">
                      <p className="text-xs font-extrabold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {month.month}
                      </p>
                      <span className={`inline-block px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                        isAboveTarget 
                          ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200/50' 
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200/50'
                      }`}>
                        {achievementRate.toFixed(1)}% KPI
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Executive Summary Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-teal-500/10 border border-blue-500/20 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-black">
              <Sparkles className="w-4 h-4" />
              <span>Đánh giá Tăng trưởng Tài chính:</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              Doanh thu tăng trưởng liên tục trên biểu đồ dọc. <b className="text-blue-600 dark:text-blue-400 font-black">{currentMonthName}</b> ghi nhận đỉnh doanh thu <b className="text-blue-600 dark:text-blue-400 font-black">920.5M VNĐ</b> (+15.3% so với tháng trước), hoàn thành xuất sắc <b className="text-emerald-600 dark:text-emerald-400 font-black">108.3% chỉ tiêu KPI</b> đề ra.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}

