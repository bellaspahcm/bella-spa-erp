'use client';

import React, { useState } from 'react';
import { 
  Activity, 
  TrendingUp, 
  Clock,
  Users,
  Star,
  ThumbsUp,
  AlertTriangle,
  CheckCircle2,
  Smile,
  Sparkles,
  ShieldCheck,
  Zap,
  Calendar,
  HeartPulse
} from 'lucide-react';
import { toast } from 'sonner';

export default function TreatmentStatisticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Mock data - Treatment stats
  const treatmentStats = {
    totalProcedures: 312,
    avgDuration: 45, // minutes
    patientSatisfaction: 4.7, // out of 5
    successRate: 94.5,
    complicationRate: 2.3,
    followUpRate: 87.5,
  };

  // Mock data - Patient satisfaction breakdown
  const satisfactionBreakdown = [
    { rating: 5, count: 142, percentage: 68.3, label: 'Xuất sắc', color: 'from-emerald-500 to-teal-400' },
    { rating: 4, count: 48, percentage: 23.1, label: 'Tốt', color: 'from-blue-500 to-cyan-400' },
    { rating: 3, count: 14, percentage: 6.7, label: 'Khá', color: 'from-amber-400 to-yellow-500' },
    { rating: 2, count: 3, percentage: 1.4, label: 'Cần cải thiện', color: 'from-orange-500 to-amber-500' },
    { rating: 1, count: 1, percentage: 0.5, label: 'Không hài lòng', color: 'from-rose-500 to-red-500' },
  ];

  // Mock data - Treatment complexity
  const treatmentComplexity = [
    { level: 'Đơn giản', count: 156, avgDuration: 25, successRate: 98.1, color: 'from-emerald-500 to-teal-400', badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200' },
    { level: 'Trung bình', count: 98, avgDuration: 45, successRate: 95.9, color: 'from-blue-500 to-cyan-400', badgeBg: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200' },
    { level: 'Phức tạp', count: 42, avgDuration: 75, successRate: 90.5, color: 'from-amber-500 to-orange-400', badgeBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200' },
    { level: 'Rất phức tạp', count: 16, avgDuration: 120, successRate: 87.5, color: 'from-rose-500 to-red-500', badgeBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200' },
  ];

  // Mock data - Patient age distribution
  const ageDistribution = [
    { range: '0 - 17 tuổi', count: 24, percentage: 15.4, color: 'from-teal-400 to-emerald-500' },
    { range: '18 - 30 tuổi', count: 45, percentage: 28.8, color: 'from-cyan-500 to-blue-500' },
    { range: '31 - 45 tuổi', count: 52, percentage: 33.3, color: 'from-blue-600 to-indigo-500' },
    { range: '46 - 60 tuổi', count: 28, percentage: 17.9, color: 'from-indigo-500 to-purple-500' },
    { range: 'Trên 60 tuổi', count: 7, percentage: 4.5, color: 'from-purple-500 to-pink-500' },
  ];

  // Mock data - Patient gender distribution
  const genderDistribution = [
    { gender: 'Nữ giới', count: 91, percentage: 58.3, color: 'from-pink-500 to-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/80 text-rose-600 dark:text-rose-400', icon: '👩' },
    { gender: 'Nam giới', count: 65, percentage: 41.7, color: 'from-blue-600 to-cyan-500', bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200/80 text-blue-600 dark:text-blue-400', icon: '👨' },
  ];

  // Mock data - Common complications
  const complications = [
    { type: 'Nhiễm trùng nhẹ', count: 4, severity: 'low', treatment: 'Kháng sinh theo phác đồ', badge: 'Mức độ Thấp' },
    { type: 'Đau kéo dài', count: 3, severity: 'low', treatment: 'Giảm đau & Theo dõi', badge: 'Mức độ Thấp' },
    { type: 'Chảy máu sau phẫu thuật', count: 2, severity: 'medium', treatment: 'Cầm máu tại chỗ', badge: 'Trung bình' },
    { type: 'Phản ứng vật liệu', count: 1, severity: 'medium', treatment: 'Thay thế vật liệu sinh học', badge: 'Trung bình' },
  ];

  // Mock data - Follow-up status
  const followUpStatus = [
    { status: 'Đúng hẹn tái khám', count: 112, percentage: 71.8, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200' },
    { status: 'Trễ hẹn tái khám', count: 25, percentage: 16.0, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200' },
    { status: 'Chưa tới lịch tái khám', count: 19, percentage: 12.2, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200' },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Hero Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.06)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] relative overflow-hidden">
          {/* Background Decorative Blur Gradients */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br from-teal-500/10 via-cyan-500/10 to-emerald-500/0 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/25 shrink-0">
              <Activity className="w-7 h-7" />
            </div>
            <div className="text-left space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Thống Kê Điều Trị & Kết Quả Lâm Sàng
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                  Báo Cáo Thực Tế
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Theo dõi hiệu quả thủ thuật, mức độ hài lòng bệnh nhân và chỉ số an toàn y tế
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
                  toast.success(`Đã chuyển sang báo cáo ${period.label.toLowerCase()}`);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-300 ${
                  selectedPeriod === period.id
                    ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md shadow-teal-500/20'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Ultra-Modern Glassmorphic KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          
          {/* Card 1: Tổng thủ thuật */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:border-teal-500/40 transition-all duration-300 group text-left relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tổng thủ thuật
              </span>
              <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900/40 group-hover:scale-110 transition-transform">
                <Activity className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {treatmentStats.totalProcedures} <span className="text-sm font-bold text-slate-500">ca</span>
              </p>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>+8% so tháng trước</span>
              </div>
            </div>
          </div>

          {/* Card 2: Thời gian TB */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:border-amber-500/40 transition-all duration-300 group text-left relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Thời gian TB
              </span>
              <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 group-hover:scale-110 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                {treatmentStats.avgDuration} <span className="text-sm font-bold text-slate-500">phút</span>
              </p>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Mỗi thủ thuật lâm sàng
              </p>
            </div>
          </div>

          {/* Card 3: Hài lòng TB */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:border-yellow-500/40 transition-all duration-300 group text-left relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Hài lòng TB
              </span>
              <div className="p-3 rounded-2xl bg-yellow-50 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 border border-yellow-100 dark:border-yellow-900/40 group-hover:scale-110 transition-transform">
                <Smile className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                {treatmentStats.patientSatisfaction}
                <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
              </p>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Từ 208 đánh giá thực tế
              </p>
            </div>
          </div>

          {/* Card 4: Tỷ lệ thành công */}
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:border-emerald-500/40 transition-all duration-300 group text-left relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Tỷ lệ thành công
              </span>
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {treatmentStats.successRate}%
              </p>
              <p className="text-xs font-bold text-rose-500 dark:text-rose-400">
                Biến chứng nhẹ: {treatmentStats.complicationRate}%
              </p>
            </div>
          </div>

        </div>

        {/* Section Row 1: Satisfaction & Complexity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Patient Satisfaction Breakdown */}
          <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] space-y-6 text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-yellow-500/10 text-amber-500 border border-amber-500/20">
                  <Star className="w-5 h-5 fill-amber-400" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Mức Độ Hài Lòng Bệnh Nhân
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Phân bố sao đánh giá chất lượng dịch vụ & trải nghiệm khám
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {satisfactionBreakdown.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {Array.from({ length: item.rating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                        ))}
                        {Array.from({ length: 5 - item.rating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-slate-300 dark:text-slate-700" />
                        ))}
                      </div>
                      <span className="text-slate-800 dark:text-slate-200 font-extrabold">{item.label}</span>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-900 dark:text-white font-black">{item.count} đánh giá</span>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black min-w-[50px] text-center">
                        {item.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-200/70 dark:bg-slate-800/70 rounded-full h-2.5 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all duration-700 shadow-sm`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Satisfaction Summary Callout */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 border border-emerald-500/20 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-black">
                <ThumbsUp className="w-4 h-4" />
                <span>Tổng kết Trải nghiệm Bệnh nhân:</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                <b className="text-emerald-600 dark:text-emerald-400 font-black">91.4%</b> bệnh nhân đánh giá 4 - 5 sao (Tốt & Xuất sắc). Điểm trung bình hài lòng duy trì ở mức cao <b className="text-amber-500 font-black">4.7 / 5.0</b>.
              </p>
            </div>
          </div>

          {/* Treatment Complexity Breakdown */}
          <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] space-y-6 text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-gradient-to-br from-teal-500/10 to-emerald-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                  <HeartPulse className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Độ Phức Tạp Điều Trị
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Phân loại theo mức độ kỹ thuật, thời gian và tỷ lệ thành công
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {treatmentComplexity.map((item, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 hover:border-teal-200 dark:hover:border-teal-800/60 transition-all duration-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${item.color}`} />
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">{item.level}</span>
                    </div>
                    <span className={`px-3 py-1 rounded-xl text-xs font-black border ${item.badgeBg}`}>
                      {item.count} ca
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Thời gian TB</span>
                      <p className="text-sm font-black text-slate-900 dark:text-white mt-0.5">{item.avgDuration} phút</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Tỷ lệ thành công</span>
                      <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{item.successRate}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Section Row 2: Age Distribution & Follow-up Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Patient Demographics: Age & Gender Distribution */}
          <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] space-y-6 text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Phân Bố Nhân Khẩu Học Bệnh Nhân
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Tỷ lệ tiếp cận dịch vụ nha khoa theo Giới tính & Nhóm tuổi
                  </p>
                </div>
              </div>
            </div>

            {/* Gender Distribution Sub-Section - Enterprise Corporate Design */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                <span>Cơ cấu Giới tính Bệnh nhân</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">156 bệnh nhân</span>
              </div>

              {/* Enterprise Gender Cards Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between hover:border-pink-500/40 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20 flex items-center justify-center font-extrabold text-xs">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-slate-900 dark:text-white">Nữ giới</p>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">91 bệnh nhân</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-pink-600 dark:text-pink-400">58.3%</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between hover:border-blue-500/40 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center font-extrabold text-xs">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-extrabold text-xs text-slate-900 dark:text-white">Nam giới</p>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">65 bệnh nhân</p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-blue-600 dark:text-blue-400">41.7%</span>
                </div>
              </div>

              {/* Combined Enterprise Gender Progress Stream Bar */}
              <div className="w-full bg-slate-200/60 dark:bg-slate-800/60 rounded-full h-2.5 overflow-hidden p-0.5 flex">
                <div 
                  className="bg-gradient-to-r from-pink-500 to-rose-500 h-full rounded-l-full transition-all duration-700 shadow-2xs" 
                  style={{ width: `58.3%` }}
                />
                <div 
                  className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full rounded-r-full transition-all duration-700 shadow-2xs" 
                  style={{ width: `41.7%` }}
                />
              </div>
            </div>

            {/* Age Distribution Sub-Section */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider block">
                Phân bố theo Nhóm độ tuổi
              </span>

              <div className="space-y-3">
                {ageDistribution.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800 dark:text-slate-200 font-extrabold">{item.range}</span>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-slate-900 dark:text-white font-black">{item.count} BN</span>
                        <span className="px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black min-w-[45px] text-center">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-200/70 dark:bg-slate-800/70 rounded-full h-2 overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all duration-700 shadow-sm`}
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Follow-up Status */}
          <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] space-y-6 text-left">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Calendar className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Tình Trạng Tái Khám
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Tỷ lệ tuân thủ lịch hẹn tái khám của bệnh nhân
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {followUpStatus.map((item, idx) => (
                <div key={idx} className={`p-4 rounded-2xl border ${item.bg} flex items-center justify-between transition-all duration-300`}>
                  <span className={`font-extrabold text-sm ${item.color}`}>{item.status}</span>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span className="px-3 py-1 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-black shadow-2xs">
                      {item.count} bệnh nhân
                    </span>
                    <span className="px-2.5 py-1 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-black">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-cyan-500/5 to-indigo-500/10 border border-blue-500/20 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-black">
                <ShieldCheck className="w-4 h-4" />
                <span>Chỉ số Tuân thủ Điều trị:</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                Tỷ lệ tuân thủ tái khám đạt <b className="text-blue-600 dark:text-blue-400 font-black">{treatmentStats.followUpRate}%</b> ({followUpStatus[0].count + followUpStatus[1].count} bệnh nhân).
              </p>
            </div>
          </div>

        </div>

        {/* Section Row 3: Complication & Safety Tracking */}
        <div className="p-7 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-[0_10px_30px_-5px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.4)] space-y-6 text-left">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500/10 to-amber-500/10 text-rose-500 border border-rose-500/20">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Theo Dõi Biến Chứng & An Toàn Y Tế
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Chi tiết các phản ứng lâm sàng nhẹ ({treatmentStats.complicationRate}% tổng số ca)
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {complications.map((comp, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-850 hover:border-amber-200 dark:hover:border-amber-800/60 transition-all duration-300 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${
                    comp.severity === 'low' ? 'bg-amber-400 shadow-md shadow-amber-400/30' : 'bg-rose-500 shadow-md shadow-rose-500/30'
                  }`} />
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-sm text-slate-900 dark:text-white">{comp.type}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Phác đồ: <strong className="text-slate-700 dark:text-slate-300 font-bold">{comp.treatment}</strong></p>
                  </div>
                </div>
                
                <div className="text-right shrink-0 space-y-1">
                  <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-white">
                    {comp.count} ca
                  </span>
                  <p className="text-[10px] font-bold text-slate-400">
                    {((comp.count / treatmentStats.totalProcedures) * 100).toFixed(1)}% ca
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Safety Evaluation Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border border-emerald-500/20 text-xs space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-black">
              <ShieldCheck className="w-4 h-4" />
              <span>Đánh giá An toàn Y tế Lâm sàng:</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
              Tỷ lệ biến chứng <b className="text-emerald-600 dark:text-emerald-400 font-black">{treatmentStats.complicationRate}%</b> thấp hơn đáng kể so với ngưỡng tiêu chuẩn ngành (3 - 5%). Tất cả các phản ứng lâm sàng nhẹ đều được kiểm soát và xử lý triệt để theo đúng phác đồ bộ y tế.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
