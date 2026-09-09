/**
 * Bella Education — Preschool Analytics & Statistical Reports
 *
 * Full viewport width layout, attendance statistics, growth milestone analytics, and tuition revenue trends.
 */

import Link from 'next/link';
import { 
  BarChart3, 
  ArrowLeft, 
  TrendingUp, 
  Users, 
  Calendar, 
  Download, 
  Sparkles,
  PieChart,
  Award
} from 'lucide-react';

const STATS_CARDS = [
  {
    title: 'Tỷ Lệ Chuyên Cần Trung Bình Tháng 9',
    value: '97.2%',
    sub: '+1.5% so với tháng trước',
    theme: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/80 text-emerald-600',
  },
  {
    title: 'Tỷ Lệ Đạt Chuẩn Phát Triển Thể Chất (BMI)',
    value: '94.8%',
    sub: '265/280 bé tăng cân đạt chuẩn',
    theme: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200/80 text-indigo-600',
  },
  {
    title: 'Doanh Thu Học Phí Thực Thu',
    value: '1.84 Tỷ VNĐ',
    sub: 'Đạt 92.4% chỉ tiêu tài chính',
    theme: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200/80 text-rose-600',
  },
  {
    title: 'Chỉ Số Hài Lòng Phụ Huynh (NPS)',
    value: '96 / 100',
    sub: 'Dựa trên 240 phụ huynh khảo sát',
    theme: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200/80 text-amber-600',
  },
];

export default function ReportsPage() {
  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* Header Banner */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link 
              href="/dashboard/education" 
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Báo Cáo Thống Kê & Phân Tích Mầm Non
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Tổng hợp báo cáo chuyên cần, biểu đồ tăng trưởng chiều cao cân nặng & tài chính
                </p>
              </div>
            </div>
          </div>

          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 shrink-0">
            <Download className="w-4 h-4" />
            <span>Xuất Báo Cáo Excel / PDF</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {STATS_CARDS.map((card, idx) => (
            <div key={idx} className={`p-5 rounded-2xl border ${card.theme} space-y-1`}>
              <p className="text-[11px] font-extrabold opacity-90">{card.title}</p>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-white">{card.value}</p>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics Breakdown Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 shadow-sm space-y-6">
        <h2 className="text-base font-extrabold text-gray-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 pb-4">
          <TrendingUp className="w-5 h-5 text-emerald-500" />
          Phân Tích Tỷ Lệ Đi Học & Sĩ Số Các Khối
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <h4 className="text-xs font-extrabold text-gray-900 dark:text-white">Khối Mầm (3 Tuổi)</h4>
            <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">98.1% Đi Học</p>
            <p className="text-xs text-gray-500">65 / 66 Bé đi học đều trong tháng</p>
          </div>
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <h4 className="text-xs font-extrabold text-gray-900 dark:text-white">Khối Chồi (4 Tuổi)</h4>
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">96.9% Đi Học</p>
            <p className="text-xs text-gray-500">95 / 98 Bé đi học đều trong tháng</p>
          </div>
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <h4 className="text-xs font-extrabold text-gray-900 dark:text-white">Khối Lá (5 Tuổi)</h4>
            <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400">97.5% Đi Học</p>
            <p className="text-xs text-gray-500">78 / 80 Bé đi học đều trong tháng</p>
          </div>
        </div>
      </div>
    </div>
  );
}
