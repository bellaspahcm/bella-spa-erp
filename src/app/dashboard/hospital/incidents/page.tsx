'use client';

/**
 * Bella General Hospital — Incident Management Center
 *
 * Quản lý sự cố lâm sàng chính thức:
 * - Báo cáo sự cố (Fall / Medication Error / Near Miss / Procedure Complication / Equipment Failure)
 * - Phân loại mức độ (Sentinel / Serious / Moderate / Minor / Near Miss)
 * - Vòng đời: Open → Investigating → RCA → CAPA → Closed
 * - Root Cause Analysis (RCA)
 * - Corrective and Preventive Actions (CAPA)
 *
 * Architecture:
 * Alert (queue/page) → triggers → Incident (this page) → RCA → CAPA → Closed
 *
 * ⚠ NOT the same as queue/page.tsx (real-time safety alerts).
 * Incidents are FORMAL records created AFTER an alert is escalated.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  FileText,
  ClipboardList,
  Search,
  Filter,
  ChevronDown,
  Clock,
  User,
  Bed,
  CheckCircle2,
  Circle,
  XCircle,
  Plus,
  ArrowRight,
  ShieldAlert,
  Activity,
  Pill,
  Wrench,
  PersonStanding,
  Stethoscope,
  CalendarDays,
  TrendingDown,
  BarChart3,
  ChevronRight,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

type IncidentCategory =
  | 'fall'
  | 'medication_error'
  | 'near_miss'
  | 'procedure_complication'
  | 'equipment_failure'
  | 'infection'
  | 'other';

type IncidentSeverity = 'sentinel' | 'serious' | 'moderate' | 'minor' | 'near_miss';
type IncidentStatus   = 'open' | 'investigating' | 'rca' | 'capa' | 'closed';

interface CAPAItem {
  id: string;
  action: string;
  owner: string;
  dueDate: string;
  done: boolean;
}

interface Incident {
  id: string;
  reportedAt: string;
  reportedBy: string;
  patientId: string;
  patientName: string;
  ward: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  immediateActions: string[];
  rootCause?: string;
  capaItems: CAPAItem[];
  closedAt?: string;
}

// ─── Config ──────────────────────────────────────────────────────────────────────

const CATEGORY_CFG: Record<IncidentCategory, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  fall:                   { label: 'Ngã bệnh nhân',          icon: PersonStanding,  color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  medication_error:       { label: 'Sai sót thuốc',          icon: Pill,            color: 'text-rose-700',   bg: 'bg-rose-50 border-rose-200' },
  near_miss:              { label: 'Gần sự cố',              icon: AlertTriangle,   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  procedure_complication: { label: 'Biến chứng thủ thuật',   icon: Stethoscope,    color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  equipment_failure:      { label: 'Sự cố thiết bị',         icon: Wrench,          color: 'text-slate-700',  bg: 'bg-slate-50 border-slate-200' },
  infection:              { label: 'Nhiễm khuẩn bệnh viện',  icon: Activity,        color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  other:                  { label: 'Khác',                   icon: FileText,        color: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200' },
};

const SEVERITY_CFG: Record<IncidentSeverity, { label: string; labelEN: string; color: string; bg: string; ring: string; priority: number }> = {
  sentinel:  { label: 'Sentinel',   labelEN: 'Sentinel Event',   color: 'text-red-700',    bg: 'bg-red-100',    ring: 'ring-red-500',    priority: 1 },
  serious:   { label: 'Nghiêm trọng', labelEN: 'Serious',        color: 'text-rose-700',   bg: 'bg-rose-100',   ring: 'ring-rose-500',   priority: 2 },
  moderate:  { label: 'Trung bình', labelEN: 'Moderate',         color: 'text-orange-700', bg: 'bg-orange-100', ring: 'ring-orange-400',  priority: 3 },
  minor:     { label: 'Nhẹ',        labelEN: 'Minor',            color: 'text-amber-700',  bg: 'bg-amber-100',  ring: 'ring-amber-400',   priority: 4 },
  near_miss: { label: 'Gần sự cố',  labelEN: 'Near Miss',        color: 'text-blue-700',   bg: 'bg-blue-100',   ring: 'ring-blue-400',    priority: 5 },
};

const STATUS_CFG: Record<IncidentStatus, { label: string; color: string; bg: string; icon: React.ElementType; step: number }> = {
  open:          { label: 'Mới mở',        color: 'text-red-700',    bg: 'bg-red-50',    icon: Circle,        step: 1 },
  investigating: { label: 'Điều tra',      color: 'text-orange-700', bg: 'bg-orange-50', icon: Search,        step: 2 },
  rca:           { label: 'Phân tích RCA', color: 'text-blue-700',   bg: 'bg-blue-50',   icon: ClipboardList, step: 3 },
  capa:          { label: 'CAPA',          color: 'text-purple-700', bg: 'bg-purple-50', icon: Wrench,        step: 4 },
  closed:        { label: 'Đã đóng',       color: 'text-emerald-700',bg: 'bg-emerald-50',icon: CheckCircle2,  step: 5 },
};

// ─── Mock Data ────────────────────────────────────────────────────────────────────

const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'INC-2026-0041',
    reportedAt: '2026-08-08T06:20:00',
    reportedBy: 'ĐD. Nguyễn Lan Anh',
    patientId: 'pat-003',
    patientName: 'Nguyễn Văn Bình',
    ward: 'ICU-BED-03',
    category: 'medication_error',
    severity: 'serious',
    status: 'rca',
    title: 'Tiêm Norepinephrine sai liều — vượt 2x y lệnh',
    description: 'Bệnh nhân nhận 0.2 mcg/kg/min thay vì 0.1 mcg/kg/min. Phát hiện sau 25 phút bởi ĐD. trưởng khi kiểm tra bơm tiêm. Huyết áp tăng 185/110 mmHg.',
    immediateActions: [
      'Giảm tốc độ bơm về đúng y lệnh ngay lập tức',
      'Báo bác sĩ trực — BS. Lê Minh Khoa đã có mặt',
      'Monitor huyết áp mỗi 5 phút',
      'Ghi nhận toàn bộ MAR, chụp ảnh bơm tiêm',
    ],
    rootCause: 'Lỗi tính toán liều theo cân nặng. Bệnh nhân 68 kg nhưng điều dưỡng nhập 34 kg vào bơm tiêm thông minh. Hệ thống DERS (Drug Error Reduction Software) chưa cảnh báo do threshold chưa cấu hình đủ nhạy.',
    capaItems: [
      { id: 'capa-1', action: 'Kiểm tra lại cấu hình weight-based dosing trên tất cả bơm tiêm ICU', owner: 'DS. Vũ Thị Thảo', dueDate: '2026-08-10', done: false },
      { id: 'capa-2', action: 'Đào tạo lại quy trình "5 Rights" cho toàn bộ ĐD ICU', owner: 'ĐD. Trưởng Lan Anh', dueDate: '2026-08-12', done: false },
      { id: 'capa-3', action: 'Bổ sung bước kiểm tra 2 người (double-check) trước mỗi lần chỉnh liều vasoactive', owner: 'PGS.TS. Lê Minh Khoa', dueDate: '2026-08-09', done: true },
    ],
  },
  {
    id: 'INC-2026-0040',
    reportedAt: '2026-08-07T22:45:00',
    reportedBy: 'ĐD. Phạm Thị Bình',
    patientId: 'pat-005',
    patientName: 'Trần Minh Phúc',
    ward: 'W2-BED-08',
    category: 'fall',
    severity: 'moderate',
    status: 'capa',
    title: 'Bệnh nhân ngã khi tự đứng dậy đi vệ sinh — ca đêm',
    description: 'BN Trần Minh Phúc (68 tuổi, Morse Fall Score: 55 — nguy cơ cao) tự đứng dậy lúc 22:40 không gọi chuông. Trượt ngã ở đầu giường, chấn thương vùng hông phải nhẹ. Không gãy xương (X-quang).',
    immediateActions: [
      'Đỡ bệnh nhân về giường, kiểm tra chấn thương',
      'X-quang hông phải (kết quả: không gãy xương)',
      'Thông báo thân nhân',
      'Bổ sung thanh chắn giường 2 bên',
    ],
    rootCause: 'Bệnh nhân được đánh giá Morse Fall Score cao nhưng chưa đeo vòng nhận diện nguy cơ té ngã màu vàng. Chuông gọi điều dưỡng đặt xa tầm tay.',
    capaItems: [
      { id: 'capa-4', action: 'Tất cả BN Morse ≥ 45 đeo vòng nhận diện vàng ngay khi nhập viện', owner: 'ĐD. Phạm Thị Bình', dueDate: '2026-08-08', done: true },
      { id: 'capa-5', action: 'Di chuyển chuông gọi về phía bàn tay thuận của BN', owner: 'ĐD. Hoàng Minh Tuấn', dueDate: '2026-08-08', done: true },
      { id: 'capa-6', action: 'Audit lại toàn bộ BN nguy cơ cao trong khoa Nội', owner: 'BS. Nguyễn Vân Khánh', dueDate: '2026-08-09', done: false },
    ],
  },
  {
    id: 'INC-2026-0039',
    reportedAt: '2026-08-07T14:10:00',
    reportedBy: 'KTV. Bùi Văn Hà',
    patientId: 'pat-008',
    patientName: 'Lê Thị Thu',
    ward: 'LIS-Lab',
    category: 'near_miss',
    severity: 'near_miss',
    status: 'closed',
    title: 'Gần phát nhầm mẫu xét nghiệm — phát hiện trước khi xử lý',
    description: 'Hai mẫu máu của BN Lê Thị Thu (pat-008) và Lê Thị Thúy (pat-012) có nhãn tương tự, gần bị hoán đổi. KTV. Bùi Văn Hà phát hiện khi barcode scan không khớp MPI trước khi đưa vào máy phân tích.',
    immediateActions: [
      'Dừng xử lý cả 2 mẫu',
      'Xác nhận lại mẫu bằng patient bracelet',
      'Lấy mẫu lại cho cả 2 bệnh nhân',
      'Báo cáo ngay với BS. phụ trách',
    ],
    rootCause: 'Nhãn in bằng hệ thống cũ — font nhỏ, thiếu màu sắc phân biệt. Tên 2 bệnh nhân quá giống nhau.',
    capaItems: [
      { id: 'capa-7', action: 'Nâng cấp máy in nhãn LIS sang font lớn + màu theo khoa', owner: 'KTV. Bùi Văn Hà', dueDate: '2026-08-15', done: false },
      { id: 'capa-8', action: 'Bổ sung bước scan bracelet bệnh nhân trước khi nhận mẫu', owner: 'PGS.TS. Lê Minh Khoa', dueDate: '2026-08-10', done: true },
    ],
    closedAt: '2026-08-08T09:00:00',
  },
  {
    id: 'INC-2026-0038',
    reportedAt: '2026-08-06T08:30:00',
    reportedBy: 'BS. Trần Bá Long',
    patientId: 'pat-011',
    patientName: 'Hoàng Văn Nam',
    ward: 'W3-BED-02',
    category: 'procedure_complication',
    severity: 'minor',
    status: 'closed',
    title: 'Hematoma sau đặt catheter tĩnh mạch trung tâm',
    description: 'Sau khi đặt CVC cảnh trong phải, BN xuất hiện hematoma nhỏ tại vị trí chọc. Không ảnh hưởng hô hấp, không tràn khí màng phổi (X-quang kiểm tra sau thủ thuật).',
    immediateActions: [
      'Băng ép tại chỗ 20 phút',
      'X-quang phổi kiểm tra — không có biến chứng',
      'Theo dõi sát 4 giờ',
    ],
    rootCause: 'Bệnh nhân có rối loạn đông máu nhẹ (INR 1.4) chưa được chuẩn bị đủ trước thủ thuật. Chỉ định CVC cấp cứu không cho phép trì hoãn.',
    capaItems: [
      { id: 'capa-9', action: 'Bổ sung checklist đông máu trước CVC vào quy trình', owner: 'BS. Trần Bá Long', dueDate: '2026-08-07', done: true },
    ],
    closedAt: '2026-08-07T16:00:00',
  },
  {
    id: 'INC-2026-0037',
    reportedAt: '2026-08-08T09:05:00',
    reportedBy: 'ĐD. Lê Quang Vinh',
    patientId: 'pat-002',
    patientName: 'Phạm Thị Lan',
    ward: 'ICU-BED-02',
    category: 'equipment_failure',
    severity: 'serious',
    status: 'investigating',
    title: 'Máy thở ICU-VENT-02 báo lỗi alarm trong ca đêm',
    description: 'Máy thở Medtronic PB980 đặt tại ICU-BED-02 xuất hiện lỗi "Flow Sensor Error" lúc 03:15 sáng. Alarm lặp lại 3 lần trong 20 phút. BN được chuyển sang máy thở dự phòng. Engineering được thông báo ngay.',
    immediateActions: [
      'Chuyển BN sang máy thở dự phòng ICU-VENT-05',
      'Kiểm tra SpO₂ và thông khí — BN ổn định',
      'Cách ly máy lỗi, gắn tag "DO NOT USE"',
      'Báo Engineering và Biomedical team',
    ],
    capaItems: [],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function daysSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / 86400000);
}

// ─── Status Pipeline Component ────────────────────────────────────────────────────

function StatusPipeline({ current }: { current: IncidentStatus }) {
  const steps: IncidentStatus[] = ['open', 'investigating', 'rca', 'capa', 'closed'];
  const currentStep = STATUS_CFG[current].step;

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const cfg = STATUS_CFG[s];
        const Icon = cfg.icon;
        const isActive = cfg.step === currentStep;
        const isDone = cfg.step < currentStep;
        const isLast = i === steps.length - 1;

        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all
                ${isDone  ? 'bg-emerald-500 border-emerald-500 text-white' : ''}
                ${isActive ? 'bg-blue-600 border-blue-600 text-white ring-2 ring-blue-300' : ''}
                ${!isDone && !isActive ? 'bg-slate-100 border-slate-300 text-slate-400' : ''}
              `}>
                <Icon className="w-3 h-3" />
              </div>
              <span className={`text-[8px] font-bold mt-0.5 whitespace-nowrap
                ${isActive ? 'text-blue-700' : isDone ? 'text-emerald-600' : 'text-slate-400'}
              `}>
                {cfg.label}
              </span>
            </div>
            {!isLast && (
              <div className={`h-0.5 w-6 mb-3 mx-0.5 transition-all ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────────

export default function IncidentManagementPage() {
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<IncidentCategory | 'all'>('all');
  const [selected, setSelected] = useState<Incident | null>(null);

  const filtered = MOCK_INCIDENTS.filter((inc) => {
    const matchSearch  = search === '' || inc.title.toLowerCase().includes(search.toLowerCase()) || inc.patientName.toLowerCase().includes(search.toLowerCase()) || inc.id.toLowerCase().includes(search.toLowerCase());
    const matchSev     = filterSeverity === 'all' || inc.severity === filterSeverity;
    const matchStatus  = filterStatus === 'all' || inc.status === filterStatus;
    const matchCat     = filterCategory === 'all' || inc.category === filterCategory;
    return matchSearch && matchSev && matchStatus && matchCat;
  }).sort((a, b) => SEVERITY_CFG[a.severity].priority - SEVERITY_CFG[b.severity].priority);

  // KPIs
  const openCount   = MOCK_INCIDENTS.filter(i => i.status === 'open').length;
  const activeCount = MOCK_INCIDENTS.filter(i => ['open','investigating','rca','capa'].includes(i.status)).length;
  const sentinelCount = MOCK_INCIDENTS.filter(i => i.severity === 'sentinel' || i.severity === 'serious').length;
  const closedThisMonth = MOCK_INCIDENTS.filter(i => i.status === 'closed').length;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-red-950 text-white rounded-2xl px-6 py-5 shadow-xl border border-red-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Bella General Hospital · Patient Safety
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black">Quản Lý Sự Cố Lâm Sàng</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Incident Report · Root Cause Analysis (RCA) · Corrective &amp; Preventive Action (CAPA)
          </p>
        </div>
        {/* KPIs */}
        <div className="flex gap-2 flex-wrap shrink-0">
          <div className="bg-red-900/50 border border-red-700 rounded-xl px-4 py-2 text-center">
            <div className="text-xl font-black text-red-300">{openCount}</div>
            <div className="text-[9px] text-red-500 font-bold uppercase">Mới mở</div>
          </div>
          <div className="bg-orange-900/40 border border-orange-700 rounded-xl px-4 py-2 text-center">
            <div className="text-xl font-black text-orange-300">{activeCount}</div>
            <div className="text-[9px] text-orange-500 font-bold uppercase">Đang xử lý</div>
          </div>
          <div className="bg-rose-900/40 border border-rose-700 rounded-xl px-4 py-2 text-center">
            <div className="text-xl font-black text-rose-300">{sentinelCount}</div>
            <div className="text-[9px] text-rose-500 font-bold uppercase">Nghiêm trọng</div>
          </div>
          <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl px-4 py-2 text-center">
            <div className="text-xl font-black text-emerald-300">{closedThisMonth}</div>
            <div className="text-[9px] text-emerald-500 font-bold uppercase">Đã đóng</div>
          </div>
        </div>
      </div>

      {/* ── Category Summary ── */}
      <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
        {(Object.keys(CATEGORY_CFG) as IncidentCategory[]).map((cat) => {
          const cfg = CATEGORY_CFG[cat];
          const Icon = cfg.icon;
          const count = MOCK_INCIDENTS.filter(i => i.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
              className={`border rounded-xl p-2.5 flex flex-col items-center gap-1 text-center transition-all cursor-pointer hover:shadow-sm
                ${filterCategory === cat ? `${cfg.bg} ring-2 ring-offset-1 ${cfg.color.replace('text-','ring-')}` : 'bg-white border-slate-200 hover:border-slate-300'}
              `}
            >
              <Icon className={`w-4 h-4 ${cfg.color}`} />
              <div className="text-[9px] font-black text-slate-600 leading-tight">{cfg.label}</div>
              <div className={`text-lg font-black ${count > 0 ? cfg.color : 'text-slate-300'}`}>{count}</div>
            </button>
          );
        })}
      </div>

      {/* ── Filters + List ── */}
      <div className="flex flex-col lg:flex-row gap-5">

        {/* List Panel */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Filter bar */}
          <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                placeholder="Tìm INC-ID, tên BN, tiêu đề..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            {/* Severity */}
            <div className="relative">
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value as IncidentSeverity | 'all')}
                className="pl-3 pr-6 py-1.5 text-xs border border-slate-200 rounded-xl appearance-none bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="all">Mức độ</option>
                {(Object.keys(SEVERITY_CFG) as IncidentSeverity[]).map(s => (
                  <option key={s} value={s}>{SEVERITY_CFG[s].label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
            {/* Status */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as IncidentStatus | 'all')}
                className="pl-3 pr-6 py-1.5 text-xs border border-slate-200 rounded-xl appearance-none bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="all">Trạng thái</option>
                {(Object.keys(STATUS_CFG) as IncidentStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
            <span className="text-[10px] text-slate-400 ml-auto">{filtered.length} sự cố</span>
          </div>

          {/* Incident list */}
          <div className="divide-y divide-slate-100">
            {filtered.map((inc) => {
              const catCfg = CATEGORY_CFG[inc.category];
              const CatIcon = catCfg.icon;
              const sevCfg = SEVERITY_CFG[inc.severity];
              const statusCfg = STATUS_CFG[inc.status];
              const StatusIcon = statusCfg.icon;
              const isSelected = selected?.id === inc.id;
              const daysOld = daysSince(inc.reportedAt);
              const doneCapa = inc.capaItems.filter(c => c.done).length;

              return (
                <div
                  key={inc.id}
                  onClick={() => setSelected(isSelected ? null : inc)}
                  className={`px-4 py-3 cursor-pointer transition-all hover:bg-slate-50 ${isSelected ? 'bg-blue-50/60 border-l-2 border-blue-600' : 'border-l-2 border-transparent'}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Category icon */}
                    <div className={`p-2 rounded-xl border ${catCfg.bg} shrink-0 mt-0.5`}>
                      <CatIcon className={`w-4 h-4 ${catCfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] font-black text-slate-400 font-mono">{inc.id}</span>
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${sevCfg.bg} ${sevCfg.color}`}>
                              {sevCfg.label}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-slate-800 mt-0.5 leading-tight">{inc.title}</div>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-slate-400 shrink-0 mt-1 transition-transform ${isSelected ? 'rotate-90 text-blue-600' : ''}`} />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                        <span className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Bed className="w-3 h-3" /> {inc.ward} · {inc.patientName}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock className="w-3 h-3" /> {formatDateTime(inc.reportedAt)}
                          {daysOld > 0 && <span className="text-slate-400">({daysOld}N)</span>}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-slate-500">
                          <User className="w-3 h-3" /> {inc.reportedBy}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        {/* Status */}
                        <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusCfg.label}
                        </div>
                        {/* CAPA progress */}
                        {inc.capaItems.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <div className="h-1 w-16 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${(doneCapa / inc.capaItems.length) * 100}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-slate-400 font-semibold">CAPA {doneCapa}/{inc.capaItems.length}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isSelected && (
                    <div className="mt-3 ml-11 space-y-3">
                      {/* Status pipeline */}
                      <StatusPipeline current={inc.status} />

                      {/* Description */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-700 leading-relaxed">
                        {inc.description}
                      </div>

                      {/* Immediate actions */}
                      <div>
                        <div className="text-[10px] font-black uppercase text-slate-500 mb-1.5">Hành động khẩn cấp</div>
                        <div className="space-y-1">
                          {inc.immediateActions.map((act, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                              {act}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Root cause */}
                      {inc.rootCause && (
                        <div>
                          <div className="text-[10px] font-black uppercase text-slate-500 mb-1.5">Nguyên nhân gốc (RCA)</div>
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">
                            {inc.rootCause}
                          </div>
                        </div>
                      )}

                      {/* CAPA items */}
                      {inc.capaItems.length > 0 && (
                        <div>
                          <div className="text-[10px] font-black uppercase text-slate-500 mb-1.5">CAPA — Hành động khắc phục &amp; phòng ngừa</div>
                          <div className="space-y-1.5">
                            {inc.capaItems.map((capa) => (
                              <div key={capa.id} className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-[11px] ${capa.done ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                                {capa.done
                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                                  : <Circle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                }
                                <div className="flex-1">
                                  <div className={`font-semibold ${capa.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{capa.action}</div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                                    <span>{capa.owner}</span>
                                    <span>·</span>
                                    <span className={capa.done ? 'text-emerald-600' : 'text-slate-500'}>Hạn: {capa.dueDate}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="p-12 text-center text-slate-400 text-xs font-semibold">
                Không tìm thấy sự cố phù hợp.
              </div>
            )}
          </div>
        </div>

        {/* Right: Trend chart (static) */}
        <div className="w-full lg:w-64 space-y-4 shrink-0">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h3 className="text-[10px] font-black uppercase text-slate-700">Xu Hướng Sự Cố</h3>
            </div>
            <div className="p-4 space-y-2">
              {[
                { month: 'T6/2026', count: 8, max: 12 },
                { month: 'T7/2026', count: 11, max: 12 },
                { month: 'T8/2026', count: 5,  max: 12 },
              ].map(({ month, count, max }) => (
                <div key={month}>
                  <div className="flex justify-between text-[10px] font-semibold text-slate-600 mb-1">
                    <span>{month}</span>
                    <span className="font-black">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${count > 8 ? 'bg-rose-500' : count > 6 ? 'bg-orange-400' : 'bg-blue-500'}`}
                      style={{ width: `${(count / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                <TrendingDown className="w-3.5 h-3.5" />
                Giảm 54.5% so với T7
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-indigo-600" />
              <h3 className="text-[10px] font-black uppercase text-slate-700">Theo Loại Sự Cố</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {(Object.keys(CATEGORY_CFG) as IncidentCategory[])
                .map(cat => ({ cat, count: MOCK_INCIDENTS.filter(i => i.category === cat).length }))
                .filter(x => x.count > 0)
                .sort((a, b) => b.count - a.count)
                .map(({ cat, count }) => {
                  const cfg = CATEGORY_CFG[cat];
                  const Icon = cfg.icon;
                  return (
                    <div key={cat} className="px-4 py-2.5 flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${cfg.color} shrink-0`} />
                      <span className="text-[10px] font-semibold text-slate-600 flex-1 truncate">{cfg.label}</span>
                      <span className="text-xs font-black text-slate-800">{count}</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Pending CAPA */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-amber-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <h3 className="text-[10px] font-black uppercase text-amber-700">CAPA Chưa Hoàn Thành</h3>
            </div>
            <div className="p-4">
              {MOCK_INCIDENTS.flatMap(i => i.capaItems.filter(c => !c.done).map(c => ({ ...c, incId: i.id }))).map((c) => (
                <div key={c.id} className="flex items-start gap-1.5 text-[10px] text-amber-900 pb-2 mb-2 border-b border-amber-100 last:border-0 last:pb-0 last:mb-0">
                  <Circle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold leading-tight">{c.action.slice(0, 48)}{c.action.length > 48 ? '…' : ''}</div>
                    <div className="text-amber-600 mt-0.5">{c.incId} · Hạn {c.dueDate}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
