'use client';

/**
 * Bella Education — Executive Analytics & Decision Support Center
 * 
 * Scalable Architecture:
 * - Decision-Support Flow: WHAT ➔ CHANGE ➔ WHY ➔ RISK ➔ ACTION
 * - Global Reporting Context: Time Period (Tháng 09/2026) + Campus Context (Cơ Sở 1)
 * - Canonical Metrics Integrity: Attendance %, WHO BMI %, Financial Cash Collection, Parent CSAT
 * - Operational Anomaly Detection & AI Executive Insights Box
 * - 6-Month Trend Visualizations: Attendance, Tuition Cashflow, Capacity & CSAT Progression
 * - Sub-Workspace Tabs:
 *   1. Tổng Quan Phân Tích Điều Hành (Executive Overview & Decision Support)
 *   2. Phân Tích Chuyên Cần & Anomaly (Attendance Anomaly & Drill-down)
 *   3. Tài Chính & Thu Học Phí (Finance, Receivable & Collection Rate)
 *   4. Phát Triển Thể Chất & BMI (Child Growth & WHO Health Metrics)
 *   5. Tương Tác Phụ Huynh & CSAT (Parent CSAT & Engagement Analytics)
 */

import { useState } from 'react';
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
  Award,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Heart,
  Bot,
  ChevronRight,
  Filter,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  FileSpreadsheet
} from 'lucide-react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'finance' | 'health' | 'csat'>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('Tháng 09/2026');
  const [selectedCampus, setSelectedCampus] = useState('Bella Preschool — Cơ Sở 1');

  return (
    <div className="w-full p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
      {/* ── UNIFIED PAGE HEADER ── */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/education"
              className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors shrink-0"
              title="Quay lại Dashboard Education"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0">
                <BarChart3 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                  Executive Analytics & Decision Support Center
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Hệ thống phân tích điều hành, phát hiện bất thường chuyên cần, dòng tiền học phí & chỉ số hài lòng phụ huynh
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
            {/* Global Reporting Context Selectors */}
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="appearance-none bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-2xl px-4 py-2.5 cursor-pointer"
            >
              <option>Tháng 09/2026</option>
              <option>Học kỳ I (2026-2027)</option>
            </select>
            <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer">
              <Download className="w-4 h-4" />
              <span>Xuất Báo Cáo Excel / PDF</span>
            </button>
          </div>
        </div>

        {/* ── DECISION-SUPPORT CANONICAL KPI CARDS (WHAT ➔ CHANGE ➔ RISK ➔ ACTION) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Attendance */}
          <div className="p-5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                1. Chuyên Cần Trung Bình
              </span>
              <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" /> +1.5%
              </span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">97.2% Đi Học</p>
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Mầm +3.2% • <strong className="text-rose-600">Chồi B2 giảm -4.1% (7 trẻ)</strong>
            </p>
          </div>

          {/* KPI 2: Physical Growth WHO */}
          <div className="p-5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                2. Thể Chất Chuẩn WHO (BMI)
              </span>
              <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" /> +0.8%
              </span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">94.8% Đạt Chuẩn</p>
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              265/280 trẻ đạt chuẩn • 15 trẻ có chế độ riêng
            </p>
          </div>

          {/* KPI 3: Financial Revenue & Collection Rate */}
          <div className="p-5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                3. Học Phí Thực Thu
              </span>
              <span className="text-xs font-bold text-slate-500">88.5% Collection</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">1.84 Tỷ VNĐ</p>
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Phải thu: 2.08 Tỷ • <strong className="text-rose-600">Nợ quá hạn: 240 Triệu</strong>
            </p>
          </div>

          {/* KPI 4: Parent CSAT Satisfaction */}
          <div className="p-5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                4. Hài Lòng Phụ Huynh (CSAT)
              </span>
              <span className="text-xs font-bold text-amber-600">240 Phiếu Khảo Sát</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">96 / 100 Điểm</p>
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
              Chất lượng chăm sóc & giao tiếp đạt 4.9/5⭐
            </p>
          </div>
        </div>

        {/* ── WORKSPACE TABS NAVIGATION ── */}
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-700/60 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Tổng Quan Phân Tích Điều Hành
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'attendance'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Phân Tích Chuyên Cần & Anomaly
          </button>
          <button
            onClick={() => setActiveTab('finance')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'finance'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Tài Chính & Thu Học Phí
          </button>
          <button
            onClick={() => setActiveTab('health')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'health'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Thể Chất WHO & BMI
          </button>
          <button
            onClick={() => setActiveTab('csat')}
            className={`px-4 py-2.5 text-xs font-extrabold rounded-2xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'csat'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            CSAT Phụ Huynh & Engagement
          </button>
        </div>
      </div>

      {/* ── TAB CONTENT 1: EXECUTIVE DECISION SUPPORT OVERVIEW ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* AI Executive Insights & Anomaly Box */}
          <div className="p-6 rounded-3xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-600" />
                AI Executive Insights & Anomaly Detection (Tháng 09/2026)
              </span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full">
                Xác thực từ dữ liệu Canonical Domains
              </span>
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
              • <strong>Chuyên cần:</strong> Tỷ lệ đi học toàn trường đạt 97.2% (+1.5% MoM). Phát hiện bất thường tại <strong>Lớp Chồi B2 (giảm -4.1%)</strong> do 5 trẻ có triệu chứng vi rút hô hấp.<br />
              • <strong>Dòng tiền học phí:</strong> Thực thu 1.84 Tỷ (88.5% Collection Rate). Cần tập trung nhắc 17 khoản nợ quá hạn 240 triệu trước ngày 15/09.<br />
              • <strong>Công suất trường:</strong> Đã lấp đầy 280/300 chỉ tiêu (93.3% Occupancy). Lớp Lá C1 đã đạt 100% sĩ số.
            </p>
          </div>

          {/* 6-Month Executive Trend Visualizations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Attendance 6-Month Trend */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  Xu Hướng Chuyên Cần 6 Tháng (Tháng 4 ➔ Tháng 9)
                </h3>
                <span className="text-xs font-bold text-emerald-600">Trung bình: 96.1%</span>
              </div>
              <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2">
                {[
                  { month: 'Thg 4', val: 95.2 },
                  { month: 'Thg 5', val: 96.0 },
                  { month: 'Thg 6', val: 94.8 },
                  { month: 'Thg 7', val: 95.5 },
                  { month: 'Thg 8', val: 95.7 },
                  { month: 'Thg 9', val: 97.2 },
                ].map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{item.val}%</span>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-t-xl overflow-hidden h-28 flex items-end">
                      <div className="w-full bg-emerald-500 rounded-t-xl transition-all" style={{ height: `${(item.val - 90) * 10}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">{item.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart 2: Financial Cashflow Collection Trend */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/60 pb-3">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-rose-500" />
                  Dòng Tiền Thu Học Phí (Phải Thu vs Đã Thu)
                </h3>
                <span className="text-xs font-bold text-slate-500">Thu thực tế: 1.84 Tỷ</span>
              </div>
              <div className="h-44 flex items-end justify-between gap-3 pt-4 px-2">
                {[
                  { month: 'Thg 4', target: 2.0, actual: 1.88 },
                  { month: 'Thg 5', target: 2.0, actual: 1.92 },
                  { month: 'Thg 6', target: 2.0, actual: 1.85 },
                  { month: 'Thg 7', target: 2.0, actual: 1.80 },
                  { month: 'Thg 8', target: 2.05, actual: 1.89 },
                  { month: 'Thg 9', target: 2.08, actual: 1.84 },
                ].map((item, idx) => (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{item.actual}T</span>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-t-xl overflow-hidden h-28 flex items-end gap-1 px-1">
                      <div className="w-1/2 bg-slate-300 dark:bg-slate-600 rounded-t-sm" style={{ height: `${(item.target / 2.2) * 100}%` }} />
                      <div className="w-1/2 bg-rose-500 rounded-t-sm" style={{ height: `${(item.actual / 2.2) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 font-semibold">{item.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 2: ATTENDANCE ANOMALY & DRILL-DOWN ── */}
      {activeTab === 'attendance' && (
        <div className="rounded-3xl bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" />
            Phân Tích Chuyên Cần Theo Khối & Danh Sách Anomaly
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 space-y-2">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Khối Mầm (3 Tuổi)</h4>
              <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">98.1% Đi Học</p>
              <p className="text-xs text-slate-500">65 / 66 Bé đi học đều trong tháng</p>
            </div>
            <div className="p-5 rounded-2xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 space-y-2">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Khối Chồi (4 Tuổi)</h4>
              <p className="text-xl font-extrabold text-rose-600 dark:text-rose-400">96.9% Đi Học (⚠ Anomaly)</p>
              <p className="text-xs text-rose-700 dark:text-rose-300 font-semibold">Chồi B2 giảm -4.1% • 7 trẻ nghỉ ≥3 ngày liên tiếp</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 space-y-2">
              <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">Khối Lá (5 Tuổi)</h4>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">97.5% Đi Học</p>
              <p className="text-xs text-slate-500">78 / 80 Bé đi học đều trong tháng</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
