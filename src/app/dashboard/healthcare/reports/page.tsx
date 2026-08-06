'use client';

import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  Download, 
  Sparkles, 
  Activity, 
  ArrowRight, 
  CheckCircle, 
  Flame, 
  UserCheck, 
  PieChart, 
  ThumbsUp, 
  CalendarX, 
  HardDrive, 
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Bot
} from 'lucide-react';
import { toast } from 'sonner';

export default function HealthcareReportsPage() {
  const [selectedTime, setSelectedTime] = useState<'TODAY' | 'WEEK' | 'MONTH'>('TODAY');
  const [aiApplied, setAiApplied] = useState<Record<string, boolean>>({});

  const handleApplyAiRecommendation = (key: string, message: string) => {
    setAiApplied((prev) => ({ ...prev, [key]: true }));
    toast.success(`🎉 Đã áp dụng đề xuất AI COO: ${message}`);
  };

  // Mock SLA & Hourly Trend
  const hourlySla = [
    { hour: '08:00', patients: 12, waitMin: 6.5, status: 'optimal' },
    { hour: '09:00', patients: 28, waitMin: 11.2, status: 'optimal' },
    { hour: '10:00', patients: 45, waitMin: 18.4, status: 'warning' }, // Peak
    { hour: '11:00', patients: 38, waitMin: 15.0, status: 'warning' },
    { hour: '13:30', patients: 20, waitMin: 8.0, status: 'optimal' },
    { hour: '14:30', patients: 32, waitMin: 12.5, status: 'optimal' },
    { hour: '15:30', patients: 24, waitMin: 9.5, status: 'optimal' },
    { hour: '16:30', patients: 14, waitMin: 5.0, status: 'optimal' },
  ];

  // Room Heatmap Data
  const roomHeatmap = [
    { room: 'Phòng Khám 1 (BS. Minh)', load: 97, patients: 32, status: 'CRITICAL', color: 'bg-rose-500 text-white' },
    { room: 'Phòng Khám 2 (BS. Hùng)', load: 48, patients: 16, status: 'LOW', color: 'bg-emerald-500 text-white' },
    { room: 'Phòng Khám 3 (Nha Khoa)', load: 78, patients: 24, status: 'NORMAL', color: 'bg-amber-500 text-white' },
    { room: 'Phòng Xét Nghiệm LIS', load: 88, patients: 36, status: 'HIGH', color: 'bg-orange-500 text-white' },
    { room: 'Phòng DICOM PACS', load: 76, patients: 22, status: 'NORMAL', color: 'bg-indigo-500 text-white' },
    { room: 'Nhà Thuốc & Cấp Phát', load: 35, patients: 18, status: 'LOW', color: 'bg-teal-500 text-white' },
  ];

  // Top 5 Bottleneck Causes
  const rootCauses = [
    { rank: 1, cause: 'Chờ trả kết quả Xét Nghiệm Máu LIS', impact: 38, avgDelay: '14.5 phút', dept: 'LIS' },
    { rank: 2, cause: 'Bệnh nhân đến trễ so với giờ hẹn online', impact: 22, avgDelay: '8.2 phút', dept: 'Tiếp đón' },
    { rank: 3, cause: 'Kiểm tra CDSS Tương tác Thuốc phức tạp', impact: 15, avgDelay: '4.0 phút', dept: 'Nhà Thuốc' },
    { rank: 4, cause: 'Xác thực thẻ BHYT cổng BHXH quốc gia', impact: 12, avgDelay: '3.5 phút', dept: 'Viện Phí' },
    { rank: 5, cause: 'Dựng phim 3D PACS ca CT-Scanner Cấp cứu', impact: 13, avgDelay: '6.0 phút', dept: 'CĐHA' },
  ];

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-slate-50/50 dark:bg-slate-950 min-h-screen font-sans text-left">
      {/* 1. Header & AI Executive Hero */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 shrink-0">
            <Bot className="w-7 h-7" />
          </div>
          <div className="space-y-1 text-left">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Phân Hệ AI COO & Báo Cáo SLA Bottleneck
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-extrabold text-[10px] uppercase border border-purple-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-600" /> Executive AI Intelligence
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Trợ Lý AI COO Tự Động Đưa Ra Quyết Định Điều Chuyển Vận Hành, Giám Sát SLA & Dự Báo Quá Tải.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
            {(['TODAY', 'WEEK', 'MONTH'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTime(t)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  selectedTime === t ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t === 'TODAY' ? 'Hôm nay' : t === 'WEEK' ? 'Tuần này' : 'Tháng này'}
              </button>
            ))}
          </div>

          <button
            onClick={() => toast.success('Đang kết xuất Báo Cáo AI COO Executive PDF...')}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md flex items-center gap-2 cursor-pointer transition-all shrink-0"
          >
            <Download className="w-4 h-4" /> Xuất Báo Cáo COO
          </button>
        </div>
      </div>

      {/* 2. AI COO EXECUTIVE DECISION ASSISTANT CARD ⭐⭐⭐⭐⭐ */}
      <div className="p-6 rounded-[28px] bg-gradient-to-br from-purple-900 via-indigo-900 to-slate-900 text-white border border-purple-500/30 shadow-2xl space-y-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between border-b border-purple-400/20 pb-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30 animate-pulse">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                🤖 AI COO Live Operational Insights & Decision Support
              </h2>
              <p className="text-xs text-purple-200 font-medium">Hệ thống phân tích tự động dữ liệu vận hành thời gian thực & đưa ra gợi ý hành động</p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-400/30">
            ✓ 3 Đề Xuất Khuyến Nghị Active
          </span>
        </div>

        {/* 3 AI Recommendations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Recommendation 1 */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-rose-500/40 space-y-3 relative group hover:border-rose-400 transition-all">
            <div className="flex items-start justify-between">
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-black text-[10px] flex items-center gap-1 border border-rose-500/30">
                <AlertTriangle className="w-3 h-3" /> Điểm Nghẽn LIS (63%)
              </span>
              <span className="text-[10px] font-mono text-slate-400">Ưu tiên Cao</span>
            </div>

            <p className="text-slate-200 leading-relaxed font-medium">
              🔴 <b className="text-rose-400">Phòng Xét Nghiệm (LIS)</b> đang tạo ra <b className="text-rose-300">63% thời gian chờ</b> toàn viện.
            </p>

            <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/30 space-y-1 text-[11px] text-purple-200">
              <div className="font-bold text-white">💡 Gợi Ý AI COO:</div>
              <div>• Điều chuyển 1 KTV từ Trạm Vitals ➔ LIS.</div>
              <div>• Ưu tiên tự động chạy mẫu Cấp Cứu STAT.</div>
              <div className="text-emerald-400 font-bold mt-1">➔ Dự kiến giảm SLA LIS xuống 13 phút.</div>
            </div>

            <button
              disabled={aiApplied['lis']}
              onClick={() => handleApplyAiRecommendation('lis', 'Điều chuyển 1 KTV sang LIS & Ưu tiên ca STAT')}
              className={`w-full py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                aiApplied['lis']
                  ? 'bg-emerald-600/40 text-emerald-300 border border-emerald-500/40'
                  : 'bg-rose-600 hover:bg-rose-700 text-white shadow-md'
              }`}
            >
              {aiApplied['lis'] ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiApplied['lis'] ? 'Đã Áp Dụng Điều Chuyển' : 'Áp Dụng Đề Xuất Điều Chuyển'}
            </button>
          </div>

          {/* Recommendation 2 */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/40 space-y-3 relative group hover:border-amber-400 transition-all">
            <div className="flex items-start justify-between">
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-black text-[10px] flex items-center gap-1 border border-amber-500/30">
                <SlidersHorizontal className="w-3 h-3" /> Cân Bằng Tải Bác Sĩ
              </span>
              <span className="text-[10px] font-mono text-slate-400">Ưu tiên Vừa</span>
            </div>

            <p className="text-slate-200 leading-relaxed font-medium">
              🟡 Công suất <b className="text-amber-300">BS. Minh (PK1) đạt 97%</b>, trong khi <b className="text-emerald-300">BS. Hùng (PK2) chỉ đạt 48%</b>.
            </p>

            <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/30 space-y-1 text-[11px] text-purple-200">
              <div className="font-bold text-white">💡 Gợi Ý AI COO:</div>
              <div>• Chuyển tự động 4 bệnh nhân chờ từ PK1 ➔ PK2.</div>
              <div className="text-emerald-400 font-bold mt-1">➔ Giảm thời gian chờ PK1 từ 18m xuống 10m.</div>
            </div>

            <button
              disabled={aiApplied['doctor']}
              onClick={() => handleApplyAiRecommendation('doctor', 'Đã điều chuyển 4 bệnh nhân chờ sang Phòng Khám 2')}
              className={`w-full py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                aiApplied['doctor']
                  ? 'bg-emerald-600/40 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-600 hover:bg-amber-700 text-white shadow-md'
              }`}
            >
              {aiApplied['doctor'] ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiApplied['doctor'] ? 'Đã Chuyển Lịch Khám' : 'Chuyển Lịch Khám Tự Động'}
            </button>
          </div>

          {/* Recommendation 3 */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-indigo-500/40 space-y-3 relative group hover:border-indigo-400 transition-all">
            <div className="flex items-start justify-between">
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-black text-[10px] flex items-center gap-1 border border-indigo-500/30">
                <TrendingUp className="w-3 h-3" /> Dự Báo Quá Tải 30-60m
              </span>
              <span className="text-[10px] font-mono text-slate-400">Dự báo AI</span>
            </div>

            <p className="text-slate-200 leading-relaxed font-medium">
              ⚡ Dự báo khung giờ <b className="text-cyan-300">10:00 - 11:00</b> lượng bệnh nhân chờ CĐHA sẽ tăng <b className="text-cyan-300">145%</b>.
            </p>

            <div className="p-2.5 rounded-xl bg-purple-950/60 border border-purple-500/30 space-y-1 text-[11px] text-purple-200">
              <div className="font-bold text-white">💡 Gợi Ý AI COO:</div>
              <div>• Kích hoạt mở thêm Phòng Chẩn Đoán Hình Ảnh Số 3.</div>
              <div className="text-emerald-400 font-bold mt-1">➔ Tránh nguy cơ vỡ SLA phòng CĐHA.</div>
            </div>

            <button
              disabled={aiApplied['pacs']}
              onClick={() => handleApplyAiRecommendation('pacs', 'Đã kích hoạt mở Phòng CĐHA PACS Số 3')}
              className={`w-full py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                aiApplied['pacs']
                  ? 'bg-emerald-600/40 text-emerald-300 border border-emerald-500/40'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
              }`}
            >
              {aiApplied['pacs'] ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Sparkles className="w-3.5 h-3.5" />}
              {aiApplied['pacs'] ? 'Đã Mở Phòng CĐHA Số 3' : 'Kích Hoạt Phòng CĐHA Số 3'}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Operational Executive KPI Metrics (8 Cards Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Tổng Ca Khám</span>
            <Users className="w-4 h-4 text-cyan-600" />
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-white block">42 ca</span>
          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +12% so với hôm qua
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Thời Gian Chờ SLA TB</span>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block">11.5 phút</span>
          <span className="text-[11px] text-emerald-600 font-bold">Đạt mục tiêu cam kết &lt; 15p</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Tỷ Lệ Bệnh Nhàn Quay Lại</span>
            <UserCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 block">84.5%</span>
          <span className="text-[11px] text-indigo-600 font-bold">Tỷ lệ bệnh nhân trung thành cao</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">NPS Hài Lòng Bệnh Nhân</span>
            <ThumbsUp className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-black text-amber-600 dark:text-amber-400 block">92.8 / 100</span>
          <span className="text-[11px] text-amber-600 font-bold">★ 4.9/5 sao đánh giá y tế</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Tỷ Lệ Hủy Lịch / Bỏ Khám</span>
            <CalendarX className="w-4 h-4 text-rose-500" />
          </div>
          <span className="text-2xl font-black text-slate-900 dark:text-white block">3.2%</span>
          <span className="text-[11px] text-emerald-600 font-bold">Tối ưu nhờ SMS Reminder</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Công Suất Ghế Khám</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400 block">84%</span>
          <span className="text-[11px] text-slate-500 font-medium">4/4 ghế phòng khám hoạt động</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Công Suất Thiết Bị CĐHA</span>
            <HardDrive className="w-4 h-4 text-purple-600" />
          </div>
          <span className="text-2xl font-black text-purple-600 dark:text-purple-400 block">88.5%</span>
          <span className="text-[11px] text-slate-500 font-medium">MRI: 92% • CT: 88% • US: 95%</span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold">Tỷ Lệ Quyết Toán BHYT</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 block">98.5%</span>
          <span className="text-[11px] text-emerald-600 font-bold">Duyệt cổng BHXH tự động</span>
        </div>
      </div>

      {/* 4. Room Occupancy & Patient Load Heatmap */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-500" />
            Heatmap Tải Bệnh Nhân & Công Suất Từng Phòng Khám
          </h3>
          <span className="text-xs text-slate-400 font-mono">Cập nhật realtime 30 giây/lần</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {roomHeatmap.map((r, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate text-[11px]">{r.room}</span>
              </div>
              <div className="text-xl font-black text-slate-900 dark:text-white">{r.load}% Tải</div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>{r.patients} ca/ngày</span>
                <span className={`px-2 py-0.5 rounded-full font-black text-[9px] ${r.color}`}>{r.status}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className={`h-full ${r.load > 90 ? 'bg-rose-500' : r.load > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${r.load}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Hourly SLA Trend Stream (08:00 -> 17:00) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
        <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-500" />
          Xu Hướng SLA Thời Gian Chờ Theo Khung Giờ Trong Ngày
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
          {hourlySla.map((item, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-2xl border text-center space-y-1.5 transition-all ${
                item.status === 'warning'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="font-mono font-bold text-[11px] text-slate-400">{item.hour}</div>
              <div className="text-lg font-black text-slate-900 dark:text-white">{item.waitMin}m</div>
              <div className="text-[10px] text-slate-500 font-medium">{item.patients} ca đến</div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Top 5 Bottleneck Causes & Doctor Workload Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Bottleneck Causes */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            Top 5 Nguyên Nhân Gây Chậm SLA Toàn Viện
          </h3>

          <div className="space-y-3 text-xs">
            {rootCauses.map((c) => (
              <div key={c.rank} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-600 font-black flex items-center justify-center text-xs">
                    #{c.rank}
                  </span>
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">{c.cause}</span>
                    <span className="text-[10px] text-slate-400 font-mono">Bộ phận: {c.dept}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-black text-rose-600 block">{c.impact}% Trễ</span>
                  <span className="text-[10px] text-slate-400 font-mono">Chậm TB +{c.avgDelay}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Doctor Workload & SLA Breakdown */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-500" />
            Thời Gian Chờ & Công Suất Từng Bác Sĩ
          </h3>

          <div className="space-y-3 text-xs">
            {[
              { doc: 'BS. Nguyễn Văn Minh (Nội tổng quát)', ca: '32 ca', load: 97, avgWait: '18.4 min', status: 'OVERLOAD' },
              { doc: 'BS. Trần Đức Hùng (Ngoại tổng quát)', ca: '16 ca', load: 48, avgWait: '7.2 min', status: 'OPTIMAL' },
              { doc: 'BS. Lê Thị Mai (Nha khoa)', ca: '24 ca', load: 78, avgWait: '11.0 min', status: 'NORMAL' },
              { doc: 'BS. Phạm Thị Hoa (CĐHA PACS)', ca: '22 ca', load: 76, avgWait: '9.5 min', status: 'NORMAL' },
            ].map((d, i) => (
              <div key={i} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">{d.doc}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{d.ca} khám hôm nay</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-slate-900 dark:text-white block">Chờ: {d.avgWait}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${
                    d.status === 'OVERLOAD' ? 'bg-rose-500/10 text-rose-600' : 'bg-emerald-500/10 text-emerald-600'
                  }`}>
                    Tải {d.load}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
