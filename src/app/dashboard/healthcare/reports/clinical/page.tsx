'use client';

import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  CheckCircle2,
  Clock,
  Activity,
  Sparkles,
  Award,
  Stethoscope,
  ChevronRight,
  PieChart,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

export default function ClinicalReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Mock data - Thống kê lâm sàng
  const clinicalStats = {
    totalEncounters: 234,
    completedTreatments: 198,
    successRate: 94.5,
    avgTreatmentTime: 45, // phút
    activePatients: 156,
    newPatients: 42,
  };

  // Mock data - Top procedures
  const topProcedures = [
    { name: 'Tẩy trắng răng Công nghệ Laser Zoom', count: 45, revenue: 67500000, avgDuration: 60, growth: '+18%' },
    { name: 'Nhổ răng khôn Piezotome không đau', count: 38, revenue: 45600000, avgDuration: 30, growth: '+12%' },
    { name: 'Bọc sứ thẩm mỹ Cercon HT Premium', count: 32, revenue: 128000000, avgDuration: 90, growth: '+24%' },
    { name: 'Cấy ghép Implant Nobel Biocare (Thụy Sĩ)', count: 28, revenue: 224000000, avgDuration: 120, growth: '+30%' },
    { name: 'Điều trị tủy Nội nha Vi phẫu', count: 24, revenue: 19200000, avgDuration: 45, growth: '+5%' },
    { name: 'Niềng răng trong suốt Invisalign US', count: 18, revenue: 216000000, avgDuration: 30, growth: '+40%' },
    { name: 'Trám răng sâu Composite thẩm mỹ 3M', count: 67, revenue: 20100000, avgDuration: 20, growth: '+15%' },
  ];

  // Mock data - Case mix by category
  const caseMixData = [
    { category: 'Nha khoa Thẩm mỹ', count: 95, percentage: 40.6, color: 'from-cyan-500 to-teal-500', icon: '✨' },
    { category: 'Nha khoa Phục hồi', count: 76, percentage: 32.5, color: 'from-blue-500 to-indigo-500', icon: '🦷' },
    { category: 'Điều trị Nha chu & Nướu', count: 38, percentage: 16.2, color: 'from-emerald-500 to-teal-600', icon: '🩸' },
    { category: 'Nội nha & Cấp cứu tủy', count: 25, percentage: 10.7, color: 'from-amber-500 to-orange-500', icon: '⚡' },
  ];

  // Mock data - Treatment outcomes
  const treatmentOutcomes = [
    { status: 'Hoàn thành xuất sắc', count: 156, percentage: 78.8, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-800/60' },
    { status: 'Hoàn thành đạt chuẩn', count: 31, percentage: 15.7, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200/60 dark:border-cyan-800/60' },
    { status: 'Theo dõi định kỳ (Tái khám)', count: 8, percentage: 4.0, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-800/60' },
    { status: 'Cần hiệu chỉnh nhẹ', count: 3, percentage: 1.5, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200/60 dark:border-rose-800/60' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Hero Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] relative overflow-hidden">
          {/* Background Decorative Blur Gradients */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br from-teal-500/10 via-cyan-500/10 to-blue-500/0 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/25 shrink-0">
              <BarChart3 className="w-7 h-7" />
            </div>
            <div className="text-left space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Báo cáo & Phân tích Lâm sàng
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Realtime
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Thống kê ca điều trị nha khoa, tỷ lệ thành công lâm sàng & cơ cấu Case Mix phân hệ y tế
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
                  toast.info(`Đã cập nhật báo cáo lâm sàng theo: ${period.label}`);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  selectedPeriod === period.id
                    ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-600/20 scale-105'
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
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_6px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_32px_-4px_rgba(20,184,166,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-teal-500/10 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng lượt khám</span>
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60 flex items-center justify-center shadow-sm">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1 relative z-10 text-left">
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {clinicalStats.totalEncounters} <span className="text-xs font-semibold text-slate-400">lượt</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-extrabold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+12% so với tháng trước</span>
              </div>
            </div>
          </div>

          {/* KPI 2 */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_6px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_32px_-4px_rgba(16,185,129,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ca hoàn thành</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1 relative z-10 text-left">
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {clinicalStats.completedTreatments} <span className="text-xs font-semibold text-slate-400">ca</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                <b className="text-slate-700 dark:text-slate-300 font-extrabold">{clinicalStats.totalEncounters - clinicalStats.completedTreatments} ca</b> đang trong phác đồ điều trị
              </p>
            </div>
          </div>

          {/* KPI 3 */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_6px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_32px_-4px_rgba(6,182,212,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-cyan-500/10 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tỷ lệ thành công</span>
              <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-800/60 flex items-center justify-center shadow-sm">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1 relative z-10 text-left">
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {clinicalStats.successRate}%
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-extrabold">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+2.3% chuẩn y khoa quốc tế</span>
              </div>
            </div>
          </div>

          {/* KPI 4 */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_6px_20px_-2px_rgba(0,0,0,0.04)] hover:shadow-[0_16px_32px_-4px_rgba(245,158,11,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-amber-500/10 to-transparent rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Thời gian TB / Ca</span>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/60 flex items-center justify-center shadow-sm">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1 relative z-10 text-left">
              <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {clinicalStats.avgTreatmentTime} <span className="text-xs font-semibold text-slate-400">phút</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Tối ưu công suất ghế nha & ekip
              </p>
            </div>
          </div>

        </div>

        {/* Service Composition Donut & Pipeline Chart Card */}
        <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] space-y-6 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                <PieChart className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Biểu Đồ Cơ Cấu Dịch Vụ & Doanh Thu (Service Mix Pipeline)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Trực quan hóa tỷ trọng các nhóm thủ thuật nha khoa chính trong tổng 720.4M VNĐ
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800 text-xs font-black">
              6 Nhóm Dịch Vụ Đóng Góp
            </span>
          </div>

          {/* Segmented Pipeline Stream Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-extrabold text-slate-500">
              <span>Phân bổ Pipeline liên tục (% Doanh thu):</span>
              <span className="text-teal-600 dark:text-teal-400 font-black">100% Tổng doanh thu (720.4M VNĐ)</span>
            </div>

            {/* Continuous Multi-Color Pipeline Bar */}
            <div className="w-full h-8 rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 flex items-center gap-1 shadow-inner overflow-hidden">
              <div 
                style={{ width: '31.1%' }} 
                className="h-full rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 flex items-center justify-center text-[10px] font-black text-white shadow-sm hover:opacity-90 transition-all cursor-pointer group relative"
                title="Cấy ghép Implant: 224M VNĐ (31.1%)"
              >
                31.1%
              </div>
              <div 
                style={{ width: '30.0%' }} 
                className="h-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center text-[10px] font-black text-white shadow-sm hover:opacity-90 transition-all cursor-pointer group relative"
                title="Niềng răng Invisalign: 216M VNĐ (30.0%)"
              >
                30.0%
              </div>
              <div 
                style={{ width: '17.8%' }} 
                className="h-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-black text-white shadow-sm hover:opacity-90 transition-all cursor-pointer group relative"
                title="Bọc sứ thẩm mỹ: 128M VNĐ (17.8%)"
              >
                17.8%
              </div>
              <div 
                style={{ width: '9.4%' }} 
                className="h-full rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 flex items-center justify-center text-[10px] font-black text-slate-950 shadow-sm hover:opacity-90 transition-all cursor-pointer group relative"
                title="Tẩy trắng răng: 67.5M VNĐ (9.4%)"
              >
                9.4%
              </div>
              <div 
                style={{ width: '6.3%' }} 
                className="h-full rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 flex items-center justify-center text-[10px] font-black text-white shadow-sm hover:opacity-90 transition-all cursor-pointer group relative"
                title="Nhổ răng khôn: 45.6M VNĐ (6.3%)"
              >
                6.3%
              </div>
              <div 
                style={{ width: '5.4%' }} 
                className="h-full rounded-xl bg-gradient-to-r from-slate-400 to-slate-500 flex items-center justify-center text-[9px] font-black text-white shadow-sm hover:opacity-90 transition-all cursor-pointer group relative"
                title="Khác (Trám răng/Nội nha): 39.3M VNĐ (5.4%)"
              >
                5.4%
              </div>
            </div>
          </div>

          {/* Interactive Composition Legend Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            {[
              { label: 'Cấy ghép Implant', rev: '224.0M', pct: '31.1%', ca: '28 ca', color: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
              { label: 'Niềng Invisalign', rev: '216.0M', pct: '30.0%', ca: '18 ca', color: 'bg-cyan-500', badge: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300' },
              { label: 'Bọc sứ thẩm mỹ', rev: '128.0M', pct: '17.8%', ca: '32 ca', color: 'bg-indigo-500', badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' },
              { label: 'Tẩy trắng Laser', rev: '67.5M', pct: '9.4%', ca: '45 ca', color: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' },
              { label: 'Nhổ răng khôn', rev: '45.6M', pct: '6.3%', ca: '38 ca', color: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' },
              { label: 'Trám răng & Tủy', rev: '39.3M', pct: '5.4%', ca: '91 ca', color: 'bg-slate-400', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
            ].map((item, idx) => (
              <div 
                key={idx}
                className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 hover:border-teal-300 dark:hover:border-teal-700 transition-all space-y-1"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 truncate">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.color} shrink-0`} />
                  <span className="truncate">{item.label}</span>
                </div>
                <div className="flex items-baseline justify-between pt-0.5">
                  <span className="font-black text-xs text-slate-900 dark:text-white">{item.rev}</span>
                  <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${item.badge}`}>
                    {item.pct}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">{item.ca}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top Procedures Section */}
        <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 text-left">
              <span className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500/10 to-cyan-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                <Sparkles className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Top Thủ Thuật Điều Trị Nha Khoa
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Bảng xếp hạng dịch vụ thực hiện nhiều nhất & doanh thu đóng góp
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span>Tổng doanh thu điều trị:</span>
              <span className="px-3 py-1 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-black text-sm">
                720.4M VNĐ
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {topProcedures.map((proc, idx) => {
              const maxCount = Math.max(...topProcedures.map(p => p.count));
              const widthPercent = (proc.count / maxCount) * 100;
              
              // Metallic Rank Colors
              const rankBadge = 
                idx === 0 ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black shadow-md shadow-amber-500/20' :
                idx === 1 ? 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-950 font-black shadow-md shadow-slate-400/20' :
                idx === 2 ? 'bg-gradient-to-r from-amber-700 to-amber-800 text-white font-black shadow-md' :
                'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold';

              return (
                <div 
                  key={idx} 
                  className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 hover:bg-teal-50/40 dark:hover:bg-teal-950/20 border border-slate-100 dark:border-slate-850 hover:border-teal-200 dark:hover:border-teal-800/60 transition-all duration-300 group space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${rankBadge}`}>
                        #{idx + 1}
                      </span>
                      <span className="font-extrabold text-sm text-slate-800 dark:text-slate-200 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                        {proc.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-bold shrink-0">
                      <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs">
                        <strong className="text-slate-900 dark:text-white font-black">{proc.count}</strong> ca
                      </span>
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-black shadow-2xs">
                        {(proc.revenue / 1000000).toFixed(1)}M VNĐ
                      </span>
                      <span className="px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {proc.avgDuration}m
                      </span>
                      <span className="text-[11px] font-black text-cyan-600 dark:text-cyan-400">
                        {proc.growth}
                      </span>
                    </div>
                  </div>

                  {/* Gradient Progress Bar */}
                  <div className="w-full bg-slate-200/70 dark:bg-slate-800/70 rounded-full h-2.5 overflow-hidden p-0.5">
                    <div
                      className="bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 h-full rounded-full transition-all duration-700 shadow-sm"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Case Mix & Outcome Analysis Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Case Mix Breakdown */}
          <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] space-y-6 text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  <PieChart className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                    Phân bố Ca bệnh (Case Mix)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Tỷ trọng chuyên khoa nha khoa</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {caseMixData.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-50/60 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span>{item.category}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-slate-900 dark:text-white">{item.count} ca</span>
                      <span className="font-black text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2 py-0.5 rounded-lg border border-teal-200/50">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`bg-gradient-to-r ${item.color} h-full rounded-full transition-all duration-700`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Treatment Outcome Analysis */}
          <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] space-y-6 text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                    Chỉ số Đánh giá Kết quả Điều trị
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Đánh giá chất lượng phục hồi lâm sàng</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {treatmentOutcomes.map((outcome, idx) => (
                <div key={idx} className={`flex items-center justify-between p-3.5 rounded-2xl border ${outcome.bg} transition-all`}>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className={`w-5 h-5 shrink-0 ${outcome.color}`} />
                    <span className={`font-extrabold text-xs ${outcome.color}`}>{outcome.status}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-900 dark:text-white font-black text-sm">{outcome.count} ca</span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs font-bold min-w-[45px] text-right">
                      {outcome.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Executive Clinical Insight Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 border border-emerald-500/20 dark:border-emerald-800/40 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-black">
                <Sparkles className="w-4 h-4" />
                <span>Đánh giá Chất lượng Y tế Tổng thể:</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                <b className="text-emerald-600 dark:text-emerald-400 font-black">94.5% ca điều trị</b> đạt chuẩn chất lượng cao. Tỷ lệ tái khám điều chỉnh thấp đáng kể (<b className="text-rose-600 dark:text-rose-400 font-black">1.5%</b>), đáp ứng tiêu chí chứng nhận lâm sàng Bella Medical.
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}

