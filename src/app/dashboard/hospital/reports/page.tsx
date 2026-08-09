'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Bed,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Activity,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  History,
  Check,
  X,
  ArrowRight,
  HelpCircle,
  CheckCircle2
} from 'lucide-react';

// ─── CLINICAL & OPERATIONAL TYPES ────────────────────────────────────────────
interface WardOccupancy {
  current: number;
  last24h: number;
  last7d: number;
  last30d: number;
}

interface ClinicalOutcomes {
  mortalityRate: number;
  readmissionRate: number;
  patientFalls: number;
  medicationIncidents: number;
  overdueCAPAs: number;
}

interface WardStat {
  wardId: string;
  wardName: string;
  totalBeds: number;
  occupiedBeds: number;
  occupancy: WardOccupancy;
  avgLOS: number;
  losDrivers: { driver: string; weight: number }[];
  admissionsThisMonth: number;
  dischargesThisMonth: number;
  staffCount: number;
  outcomes: ClinicalOutcomes;
}

interface DailyMetric {
  date: string;
  admissions: number;
  discharges: number;
  transfers: number;
  netShift: number;
  occupancyRate: number;
}

// ─── INITIAL DATA ────────────────────────────────────────────────────────────
const INITIAL_WARD_STATS: WardStat[] = [
  {
    wardId: 'icu',
    wardName: 'Khoa Hồi Sức Tích Cực (ICU)',
    totalBeds: 12,
    occupiedBeds: 10,
    occupancy: { current: 83, last24h: 86, last7d: 84, last30d: 81 },
    avgLOS: 5.2,
    losDrivers: [
      { driver: 'ICU transfer delays (Trễ chuyển khoa)', weight: 45 },
      { driver: 'Diagnostic turnaround (Chờ kết quả xét nghiệm)', weight: 30 },
      { driver: 'Procedure preparation (Chuẩn bị thủ thuật)', weight: 25 },
    ],
    admissionsThisMonth: 28,
    dischargesThisMonth: 24,
    staffCount: 28,
    outcomes: {
      mortalityRate: 4.2,
      readmissionRate: 3.1,
      patientFalls: 0,
      medicationIncidents: 1,
      overdueCAPAs: 0,
    },
  },
  {
    wardId: 'surgery',
    wardName: 'Khoa Ngoại Tổng Hợp',
    totalBeds: 30,
    occupiedBeds: 22,
    occupancy: { current: 73, last24h: 75, last7d: 72, last30d: 70 },
    avgLOS: 4.8,
    losDrivers: [
      { driver: 'Post-operative monitoring (Theo dõi sau mổ)', weight: 50 },
      { driver: 'Physiotherapy rehab (Chờ tập vật lý trị liệu)', weight: 30 },
      { driver: 'Wound care verification (Xác nhận lành vết thương)', weight: 20 },
    ],
    admissionsThisMonth: 65,
    dischargesThisMonth: 62,
    staffCount: 65,
    outcomes: {
      mortalityRate: 0.8,
      readmissionRate: 2.5,
      patientFalls: 0,
      medicationIncidents: 0,
      overdueCAPAs: 0,
    },
  },
  {
    wardId: 'internal',
    wardName: 'Khoa Nội Tổng Hợp',
    totalBeds: 40,
    occupiedBeds: 35,
    occupancy: { current: 88, last24h: 90, last7d: 87, last30d: 85 },
    avgLOS: 6.1,
    losDrivers: [
      { driver: 'Social support discharge delays (Chờ người nhà đón)', weight: 40 },
      { driver: 'Chronic symptom control (Ổn định triệu chứng mãn)', weight: 35 },
      { driver: 'Antibiotic therapy completion (Tiêm hết đợt kháng sinh)', weight: 25 },
    ],
    admissionsThisMonth: 88,
    dischargesThisMonth: 81,
    staffCount: 88,
    outcomes: {
      mortalityRate: 1.2,
      readmissionRate: 4.0,
      patientFalls: 0,
      medicationIncidents: 0,
      overdueCAPAs: 0,
    },
  },
  {
    wardId: 'cardio',
    wardName: 'Khoa Tim Mạch',
    totalBeds: 20,
    occupiedBeds: 18,
    occupancy: { current: 90, last24h: 92, last7d: 88, last30d: 86 },
    avgLOS: 7.3,
    losDrivers: [
      { driver: 'ICU-to-Ward step-down delay (Trễ chuyển từ ICU)', weight: 48 },
      { driver: 'Cardiac catheterization schedule (Chờ đặt stent/lịch can thiệp)', weight: 32 },
      { driver: 'Medication titration (Thiết lập liều thuốc tim mạch)', weight: 20 },
    ],
    admissionsThisMonth: 42,
    dischargesThisMonth: 39,
    staffCount: 42,
    outcomes: {
      mortalityRate: 2.5,
      readmissionRate: 4.2,
      patientFalls: 1,
      medicationIncidents: 2,
      overdueCAPAs: 1,
    },
  },
];

const DAILY_METRICS: DailyMetric[] = [
  { date: '08/02', admissions: 12, discharges: 10, transfers: 4, netShift: 2, occupancyRate: 78 },
  { date: '08/03', admissions: 9,  discharges: 11, transfers: 5, netShift: -2, occupancyRate: 76 },
  { date: '08/04', admissions: 14, discharges: 8,  transfers: 3, netShift: 6, occupancyRate: 80 },
  { date: '08/05', admissions: 11, discharges: 13, transfers: 6, netShift: -2, occupancyRate: 79 },
  { date: '08/06', admissions: 15, discharges: 12, transfers: 4, netShift: 3, occupancyRate: 82 },
  { date: '08/07', admissions: 10, discharges: 9,  transfers: 2, netShift: 1, occupancyRate: 83 },
  { date: '08/08', admissions: 8,  discharges: 7,  transfers: 3, netShift: 1, occupancyRate: 84 },
];

export default function HospitalReportsPage() {
  const [activeTab, setActiveTab] = useState<'occupancy' | 'clinical' | 'flow'>('occupancy');
  const [selectedWardForAction, setSelectedWardForAction] = useState<string | null>(null);

  // Math helper
  const totalBeds = useMemo(() => INITIAL_WARD_STATS.reduce((s, w) => s + w.totalBeds, 0), []);
  const totalOccupied = useMemo(() => INITIAL_WARD_STATS.reduce((s, w) => s + w.occupiedBeds, 0), []);
  const overallOccupancy = useMemo(() => Math.round((totalOccupied / totalBeds) * 100), [totalOccupied, totalBeds]);
  
  // Total admissions of current cohort
  const totalAdmissions = useMemo(() => INITIAL_WARD_STATS.reduce((s, w) => s + w.admissionsThisMonth, 0), []);
  
  // Average LOS based on current cohort
  const avgLOS = useMemo(() => {
    return (INITIAL_WARD_STATS.reduce((sum, w) => sum + w.avgLOS, 0) / INITIAL_WARD_STATS.length).toFixed(1);
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none">
      
      {/* Header Banner - Clinical & Operational Operations theme (slate/violet/indigo) */}
      <div className="bg-gradient-to-r from-slate-900 via-violet-955 to-slate-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-violet-500/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-900/10 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-violet-400 mb-1">
              <BarChart3 className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Bella Hospital • Clinical Intelligence & Operations
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white !text-white">
              Báo Cáo Phân Tích Bệnh Viện
            </h1>
            <p className="text-violet-200/85 text-sm mt-1 max-w-xl leading-relaxed">
              Phân tích hiệu suất giường bệnh, kiểm soát an toàn lâm sàng, đối soát dòng chảy bệnh nhân (Patient Flow) và hỗ trợ quyết định điều phối.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-3 shrink-0 w-full md:w-auto text-center font-bold">
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-2xl font-black text-white">{totalBeds}</div>
              <div className="text-[9px] text-slate-300 font-semibold uppercase mt-0.5">Tổng giường</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-2xl font-black text-emerald-400">{overallOccupancy}%</div>
              <div className="text-[9px] text-slate-300 font-semibold uppercase mt-0.5">Công suất</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-2xl font-black text-blue-300">{totalAdmissions}</div>
              <div className="text-[9px] text-slate-300 font-semibold uppercase mt-0.5">Nhập viện (Tháng)</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-2xl font-black text-amber-300">{avgLOS}d</div>
              <div className="text-[9px] text-slate-300 font-semibold uppercase mt-0.5">LOS TB (30 Ngày)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1 bg-white p-1 rounded-xl shadow-sm">
        {[
          { key: 'occupancy', label: 'Công Suất Giường Bệnh',     icon: Bed },
          { key: 'clinical',  label: 'Chỉ Số Lâm Sàng Khoa Phòng', icon: Activity },
          { key: 'flow',      label: 'Xu Hướng Nhập/Xuất Viện',  icon: TrendingUp },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`flex-1 py-2.5 px-4 text-xs font-bold flex items-center justify-center space-x-2 border-b-2 transition-all ${
              activeTab === key
                ? 'border-violet-600 text-violet-700 bg-violet-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: CAPACITY & OCCUPANCY DASHBOARD */}
      {activeTab === 'occupancy' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: WARD CAPACITY LIST */}
          <div className="lg:col-span-2 space-y-4">
            {INITIAL_WARD_STATS.map((ward) => {
              const currentRate = Math.round((ward.occupiedBeds / ward.totalBeds) * 100);
              const isHigh = currentRate >= 85;
              const isCritical = currentRate >= 95;
              
              return (
                <div
                  key={ward.wardId}
                  className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 transition-all ${
                    isCritical ? 'border-rose-300 ring-1 ring-rose-50' :
                    isHigh ? 'border-amber-300 ring-1 ring-amber-50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-800 text-sm">{ward.wardName}</span>
                        {isCritical && (
                          <span className="text-[9px] font-black bg-rose-600 text-white px-2 py-0.5 rounded animate-pulse">
                            QUÁ TẢI (CRITICAL)
                          </span>
                        )}
                        {isHigh && !isCritical && (
                          <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                            Gần đầy (WATCH)
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                        Nhân sự hoạt động: {ward.staffCount} NV phân công · Ngày nằm điều trị trung bình: {ward.avgLOS}d
                      </p>
                    </div>

                    <div className="flex space-x-1.5 text-center font-bold">
                      <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                        <div className="text-[11px] text-slate-800 font-black">{ward.occupiedBeds}/{ward.totalBeds}</div>
                        <div className="text-[8px] text-slate-400 uppercase">Hiện tại</div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                        <div className="text-[11px] text-slate-800 font-black">{ward.occupancy.last24h}%</div>
                        <div className="text-[8px] text-slate-400 uppercase">24 Giờ</div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                        <div className="text-[11px] text-slate-800 font-black">{ward.occupancy.last7d}%</div>
                        <div className="text-[8px] text-slate-400 uppercase">7 Ngày</div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                        <div className="text-[11px] text-slate-800 font-black">{ward.occupancy.last30d}%</div>
                        <div className="text-[8px] text-slate-400 uppercase">30 Ngày</div>
                      </div>
                    </div>
                  </div>

                  {/* Progress capacity meter bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/50">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isCritical ? 'bg-rose-500' : isHigh ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${currentRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                      <span>Độ sử dụng giường bệnh</span>
                      <span className={isCritical ? 'text-rose-600' : isHigh ? 'text-amber-600' : 'text-emerald-600'}>
                        {currentRate}% công suất occupancy
                      </span>
                    </div>
                  </div>

                  {/* LOS Drivers details */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/50 space-y-2 text-xs font-bold text-slate-700">
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Yếu tố thúc đẩy LOS (LOS Key Drivers)</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {ward.losDrivers.map((driver, idx) => (
                        <div key={idx} className="space-y-1 bg-white border border-slate-100 p-2 rounded-lg">
                          <div className="flex justify-between text-[10px]">
                            <span className="truncate max-w-[120px] font-sans text-slate-600">{driver.driver}</span>
                            <span className="text-violet-700 font-mono font-black shrink-0">{driver.weight}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                            <div className="bg-violet-500 h-full" style={{ width: `${driver.weight}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* DECISION SUPPORT ACTIONS */}
                  {isHigh && (
                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                      <div className="flex items-center space-x-1.5 text-xs text-rose-700 font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Quyết định điều phối giường được khuyến nghị</span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setSelectedWardForAction(ward.wardName)}
                          className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all shadow-sm"
                        >
                          Hành động điều phối
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          {/* RIGHT: AI OPERATIONAL COPILOT */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-gradient-to-br from-purple-900 to-indigo-950 rounded-2xl p-5 text-white shadow-xl space-y-4 relative overflow-hidden border border-purple-500/20">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-300 animate-pulse" />
                <h4 className="font-extrabold text-sm uppercase tracking-wider text-purple-100">AI Operation COO Engine</h4>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-3.5 space-y-2 text-xs">
                <span className="text-[10px] text-purple-300 uppercase block font-extrabold">Cảnh báo công suất khoa phòng</span>
                <p className="font-medium text-slate-100 leading-relaxed">
                  <strong>Khoa Tim Mạch (Cardiology)</strong> đang ở 90% công suất giường bệnh. Dựa trên 3 lượt chờ nhập viện dự kiến từ cấp cứu, 1 ca dự báo chuyển khoa và chỉ có 1 ca xuất viện trong 24 giờ tới, AI dự kiến công suất khoa sẽ chạm ngưỡng <strong>98% (Critical)</strong> vào ngày mai.
                </p>
              </div>

              <div className="space-y-2 text-xs">
                <span className="text-[10px] text-purple-300 uppercase block font-extrabold">Khuyến nghị giải pháp vận hành:</span>
                <ul className="space-y-2">
                  {[
                    'Ưu tiên duyệt xuất viện đối với 2 bệnh nhân đủ điều kiện xuất viện sớm tại phòng Cardio-05 và Cardio-09.',
                    'Thực hiện chuyển 1 ca bệnh nhân ổn định sang giường dự phòng ở Khoa Nội Tổng Hợp.',
                    'Chuẩn bị cơ chế giường phụ/giường linh động tăng cường tại khoa Ngoại Tổng Hợp.'
                  ].map((rec, idx) => (
                    <li key={idx} className="flex items-start space-x-2 text-[11px] font-medium text-purple-100">
                      <span className="bg-purple-700 w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button className="w-full bg-white text-indigo-900 font-extrabold text-xs py-2 rounded-xl shadow hover:bg-slate-50 transition-all">
                Kích hoạt phân bổ giường tự động
              </button>
            </div>

            {/* General Hospital-wide correlations list */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Hệ thống tương quan vận hành</h4>
              <div className="space-y-3 text-xs font-bold text-slate-600">
                <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-1">
                  <span className="text-[9px] text-slate-400 block uppercase">Occupancy & LOS Correlation</span>
                  <p className="font-medium text-slate-700">Công suất giường cao (&gt;88%) làm tăng trễ hạn thủ tục lâm sàng, dẫn đến LOS tăng bình quân 0.8 ngày.</p>
                </div>
                <div className="bg-slate-50 border border-slate-150 p-3 rounded-xl space-y-1">
                  <span className="text-[9px] text-slate-400 block uppercase">Staffing & Safety Correlation</span>
                  <p className="font-medium text-slate-700">Tỷ lệ điều dưỡng/giường giảm xuống dưới chuẩn (1:5) làm gia tăng 24% lỗi dùng thuốc và 18% tỷ lệ ngã.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: CLINICAL OUTCOMES & SAFETY CORRELATION TABLE */}
      {activeTab === 'clinical' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Chỉ Số Lâm Sàng & Kiểm Soát An Toàn Khoa Phòng</h3>
              <p className="text-xs text-slate-400 mt-0.5">Đối chiếu liên tục giữa dòng chảy bệnh viện và chất lượng an toàn y khoa.</p>
            </div>
          </div>

          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 border-b border-slate-200 font-black text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Khoa Phòng</th>
                <th className="px-4 py-3 text-center">Nhập Viện (Tháng)</th>
                <th className="px-4 py-3 text-center">Xuất Viện (Tháng)</th>
                <th className="px-4 py-3 text-center">LOS TB (30d)</th>
                <th className="px-4 py-3 text-center">Tử Vong (YTD)</th>
                <th className="px-4 py-3 text-center">Tái Nhập Viện</th>
                <th className="px-4 py-3 text-center">Sự cố ngã (Morse)</th>
                <th className="px-4 py-3 text-center">Sự cố dùng thuốc</th>
                <th className="px-4 py-3 text-center">CAPA quá hạn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
              {INITIAL_WARD_STATS.map((w) => (
                <tr key={w.wardId} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3.5 font-extrabold text-slate-800">{w.wardName}</td>
                  <td className="px-4 py-3.5 text-center text-blue-700">{w.admissionsThisMonth} ca</td>
                  <td className="px-4 py-3.5 text-center text-emerald-700">{w.dischargesThisMonth} ca</td>
                  <td className="px-4 py-3.5 text-center text-slate-900">{w.avgLOS} ngày</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={w.outcomes.mortalityRate > 3 ? 'text-rose-700' : 'text-slate-700'}>
                      {w.outcomes.mortalityRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={w.outcomes.readmissionRate > 4 ? 'text-amber-700' : 'text-slate-700'}>
                      {w.outcomes.readmissionRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded ${w.outcomes.patientFalls > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-400'}`}>
                      {w.outcomes.patientFalls} vụ
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded ${w.outcomes.medicationIncidents > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-400'}`}>
                      {w.outcomes.medicationIncidents} vụ
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded ${w.outcomes.overdueCAPAs > 0 ? 'bg-rose-700 text-white font-black animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                      {w.outcomes.overdueCAPAs} CAPA
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: PATIENT FLOW INTELLIGENCE & FORECASTING */}
      {activeTab === 'flow' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* FLOW CHART & STATS */}
          <div className="lg:col-span-2 space-y-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Xu Hướng Lưu Chuyển Bệnh Nhân (Patient Flow)</h3>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">Tần suất xuất nhập viện và chuyển khoa phòng.</p>
            </div>

            <div className="space-y-4">
              {DAILY_METRICS.map((m) => (
                <div key={m.date} className="grid grid-cols-6 gap-3 items-center text-xs font-bold text-slate-700">
                  <span className="font-mono text-slate-400">{m.date}</span>
                  
                  <div className="col-span-2 flex items-center space-x-2">
                    <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/35">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(m.admissions / 20) * 100}%` }} />
                    </div>
                    <span className="text-blue-700 w-12 font-mono shrink-0">Nhập: {m.admissions}</span>
                  </div>

                  <div className="col-span-2 flex items-center space-x-2">
                    <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/35">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${(m.discharges / 20) * 100}%` }} />
                    </div>
                    <span className="text-emerald-700 w-12 font-mono shrink-0">Xuất: {m.discharges}</span>
                  </div>

                  <div className="text-right font-mono text-[10px] text-slate-500">
                    Net: <strong className={m.netShift >= 0 ? 'text-rose-600' : 'text-emerald-600'}>{m.netShift >= 0 ? `+${m.netShift}` : m.netShift}</strong>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 font-bold">
              <div className="bg-blue-50 border border-blue-150 rounded-xl p-3 text-center">
                <div className="text-[10px] text-blue-800 uppercase">Công suất trung bình 7 ngày</div>
                <div className="text-xl font-black text-blue-900 mt-1">
                  {Math.round(DAILY_METRICS.reduce((sum, m) => sum + m.occupancyRate, 0) / DAILY_METRICS.length)}%
                </div>
              </div>
              <div className="bg-violet-50 border border-violet-150 rounded-xl p-3 text-center">
                <div className="text-[10px] text-violet-800 uppercase">Dự báo công suất ngày mai</div>
                <div className="text-xl font-black text-violet-900 mt-1">92% (High occupancy alert)</div>
              </div>
            </div>
          </div>

          {/* FLOW TRANSFERS & ADMISSION SOURCE COHORT */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                Dòng chảy chuyển khoa (Transfers)
              </h4>
              <div className="space-y-3 font-mono text-[11px] text-slate-600 font-bold">
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span>Cấp cứu (ED) → Nội trú (Inpatient)</span>
                  <span className="text-slate-800">14 ca</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span>Hồi sức (ICU) → Phòng bệnh thường (Ward)</span>
                  <span className="text-slate-800">8 ca</span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span>Phòng bệnh thường (Ward) → Hồi sức (ICU)</span>
                  <span className="text-rose-700 animate-pulse">2 ca</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                Turnover & Discharge Delays
              </h4>
              <div className="space-y-2 text-xs font-bold text-slate-600">
                <div className="flex justify-between">
                  <span>Hệ số xoay giường (Bed Turnover):</span>
                  <span className="text-slate-800">3.4 lượt/giường</span>
                </div>
                <div className="flex justify-between">
                  <span>Trễ giờ xuất viện TB:</span>
                  <span className="text-rose-700">1.8 giờ</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* DECISION SUPPORT ACTIONS MODAL OR BOX */}
      {selectedWardForAction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-slate-950 text-white px-5 py-4 flex justify-between items-center border-b border-slate-800">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider">Hỗ Trợ Ra Quyết Định Điều Phối</h3>
                <span className="text-[10px] text-rose-400 font-bold">{selectedWardForAction}</span>
              </div>
              <button onClick={() => setSelectedWardForAction(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-bold text-slate-700">
              <div className="bg-slate-50 border border-slate-250 p-3.5 rounded-xl space-y-1.5">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Bệnh nhân dự kiến xuất viện (Đủ điều kiện sớm)</span>
                <div className="flex justify-between items-center text-slate-800 font-mono text-[11px]">
                  <span>1. Nguyễn Văn Hùng - Phòng 302</span>
                  <button
                    onClick={() => {
                      alert('Thông báo đẩy đã được gửi đến ĐD điều phối xuất viện bệnh nhân Nguyễn Văn Hùng.');
                      setSelectedWardForAction(null);
                    }}
                    className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-black"
                  >
                    Duyệt xuất viện
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-250 p-3.5 rounded-xl space-y-1.5">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Yêu cầu chuyển khoa phòng (Giảm tải)</span>
                <div className="flex justify-between items-center text-slate-800 font-mono text-[11px]">
                  <span>2. Chuyển 1 ca ổn định sang Ngoại Tổng Hợp</span>
                  <button
                    onClick={() => {
                      alert('Lệnh điều chuyển giường đã được gửi đến phần mềm phân khoa.');
                      setSelectedWardForAction(null);
                    }}
                    className="bg-rose-50 border border-rose-200 text-rose-700 px-2 py-0.5 rounded text-[9px] font-black"
                  >
                    Kích hoạt chuyển khoa
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
