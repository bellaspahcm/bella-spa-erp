'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  BedDouble,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Heart,
  Wind,
  Stethoscope,
  ShieldAlert,
  Wifi,
  WifiOff,
  RefreshCw,
  ChevronRight,
  X,
  AlertCircle,
  Gauge,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  Bell,
  MonitorCheck,
  Siren,
  ArrowUpRight,
  Timer,
  FlaskConical,
  Scan,
  ClipboardList,
  Brain,
  PersonStanding,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Severity = 'very_critical' | 'critical' | 'monitoring' | 'stable';
type BedStatus = 'occupied' | 'empty' | 'cleaning' | 'reserved' | 'maintenance';
type AlertLevel = 'critical' | 'warning' | 'info';
type TransferPriority = 'emergency' | 'priority' | 'routine';
type TransferStatus = 'pending' | 'approved' | 'in_progress' | 'rejected';
type StaffStatus = 'on_duty' | 'break' | 'off_duty';
type StaffRole = 'physician' | 'nurse' | 'resident';

interface VitalTrend {
  values: number[];   // last 6 readings
  trend: 'up' | 'down' | 'stable';
}

interface ICUBed {
  bedId: string;
  bedCode: string;
  patientName: string | null;
  encounterId: string | null;
  mrn: string | null;
  age: number | null;
  gender: 'Nam' | 'Nữ' | null;
  assignedNurse: string | null;
  assignedPhysician: string | null;
  admittedAt: string | null;
  diagnosis: string | null;
  severity: Severity;
  ventilator: boolean;
  isolation: boolean;
  apacheScore: number | null;
  apacheTrend: 'up' | 'down' | 'stable';
  sofaScore: number | null;
  news2Score: number | null;
  latestHR: number | null;
  latestSpO2: number | null;
  latestMap: number | null;
  hrTrend: VitalTrend;
  spo2Trend: VitalTrend;
  mapTrend: VitalTrend;
  activeAlerts: number;
  pendingLabs: number;
  status: BedStatus;
}

interface ActiveAlert {
  id: string;
  bedCode: string;
  patientName: string;
  message: string;
  level: AlertLevel;
  triggeredAt: string;
  acknowledged: boolean;
}

interface TransferRequest {
  id: string;
  patientName: string;
  mrn: string;
  fromBed: string;
  toWard: string;
  requestedBy: string;
  reason: string;
  priority: TransferPriority;
  status: TransferStatus;
  requestedAt: string;
  slaMinutes: number;  // SLA deadline in minutes from requestedAt
}

interface ICUShiftStaff {
  id: string;
  name: string;
  role: StaffRole;
  shift: string;
  assignedBeds: string[];
  status: StaffStatus;
  onCall: boolean;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_ICU_BEDS: ICUBed[] = [
  {
    bedId: 'icu-01', bedCode: 'ICU-01',
    patientName: 'Nguyễn Văn Hoàng', encounterId: 'ENC-HOS-2026-0892',
    mrn: 'pat-001', age: 58, gender: 'Nam',
    assignedNurse: 'ĐD. Lý Thu Hà', assignedPhysician: 'BS. Trần Văn Nam',
    admittedAt: '2026-08-03T08:00:00Z', diagnosis: 'ARDS — Suy hô hấp cấp',
    severity: 'critical', ventilator: true, isolation: false,
    apacheScore: 22, apacheTrend: 'stable',
    sofaScore: 8, news2Score: 7,
    latestHR: 90, latestSpO2: 95, latestMap: 78,
    hrTrend:   { values: [88, 91, 87, 93, 90, 90], trend: 'stable' },
    spo2Trend: { values: [96, 96, 95, 95, 95, 95], trend: 'down' },
    mapTrend:  { values: [82, 80, 79, 78, 78, 78], trend: 'down' },
    activeAlerts: 1, pendingLabs: 2, status: 'occupied',
  },
  {
    bedId: 'icu-02', bedCode: 'ICU-02',
    patientName: 'Trần Bá Dũng', encounterId: 'ENC-HOS-2026-0901',
    mrn: 'pat-002', age: 67, gender: 'Nam',
    assignedNurse: 'ĐD. Nguyễn Văn Phong', assignedPhysician: 'BS. Trần Văn Nam',
    admittedAt: '2026-08-06T14:00:00Z', diagnosis: 'Nhồi máu cơ tim cấp STEMI',
    severity: 'very_critical', ventilator: false, isolation: false,
    apacheScore: 28, apacheTrend: 'up',
    sofaScore: 11, news2Score: 9,
    latestHR: 112, latestSpO2: 93, latestMap: 65,
    hrTrend:   { values: [98, 103, 107, 110, 111, 112], trend: 'up' },
    spo2Trend: { values: [97, 96, 95, 94, 93, 93], trend: 'down' },
    mapTrend:  { values: [74, 72, 70, 67, 65, 65], trend: 'down' },
    activeAlerts: 2, pendingLabs: 3, status: 'occupied',
  },
  {
    bedId: 'icu-03', bedCode: 'ICU-03',
    patientName: 'Phạm Thị Loan', encounterId: 'ENC-HOS-2026-0895',
    mrn: 'pat-003', age: 52, gender: 'Nữ',
    assignedNurse: 'ĐD. Lý Thu Hà', assignedPhysician: 'PGS.TS.BS Lê Minh Khoa',
    admittedAt: '2026-08-05T06:30:00Z', diagnosis: 'Nhiễm khuẩn huyết — Septic Shock',
    severity: 'very_critical', ventilator: true, isolation: true,
    apacheScore: 31, apacheTrend: 'up',
    sofaScore: 13, news2Score: 11,
    latestHR: 118, latestSpO2: 90, latestMap: 58,
    hrTrend:   { values: [110, 113, 115, 116, 118, 118], trend: 'up' },
    spo2Trend: { values: [94, 93, 92, 91, 90, 90], trend: 'down' },
    mapTrend:  { values: [68, 65, 63, 60, 58, 58], trend: 'down' },
    activeAlerts: 3, pendingLabs: 1, status: 'occupied',
  },
  {
    bedId: 'icu-04', bedCode: 'ICU-04',
    patientName: 'Lê Quốc Hùng', encounterId: 'ENC-HOS-2026-0889',
    mrn: 'pat-004', age: 44, gender: 'Nam',
    assignedNurse: 'ĐD. Hoàng Minh Tuấn', assignedPhysician: 'PGS.TS.BS Lê Minh Khoa',
    admittedAt: '2026-08-07T18:00:00Z', diagnosis: 'Hậu phẫu tim hở — Van 2 lá',
    severity: 'monitoring', ventilator: false, isolation: false,
    apacheScore: 14, apacheTrend: 'down',
    sofaScore: 4, news2Score: 3,
    latestHR: 72, latestSpO2: 98, latestMap: 82,
    hrTrend:   { values: [78, 76, 75, 73, 72, 72], trend: 'down' },
    spo2Trend: { values: [97, 97, 97, 98, 98, 98], trend: 'stable' },
    mapTrend:  { values: [80, 81, 81, 82, 82, 82], trend: 'stable' },
    activeAlerts: 0, pendingLabs: 0, status: 'occupied',
  },
  {
    bedId: 'icu-05', bedCode: 'ICU-05',
    patientName: null, encounterId: null, mrn: null, age: null, gender: null,
    assignedNurse: null, assignedPhysician: null, admittedAt: null, diagnosis: null,
    severity: 'stable', ventilator: false, isolation: false,
    apacheScore: null, apacheTrend: 'stable', sofaScore: null, news2Score: null,
    latestHR: null, latestSpO2: null, latestMap: null,
    hrTrend: { values: [], trend: 'stable' },
    spo2Trend: { values: [], trend: 'stable' },
    mapTrend: { values: [], trend: 'stable' },
    activeAlerts: 0, pendingLabs: 0, status: 'empty',
  },
  {
    bedId: 'icu-06', bedCode: 'ICU-06',
    patientName: null, encounterId: null, mrn: null, age: null, gender: null,
    assignedNurse: null, assignedPhysician: null, admittedAt: null, diagnosis: null,
    severity: 'stable', ventilator: false, isolation: false,
    apacheScore: null, apacheTrend: 'stable', sofaScore: null, news2Score: null,
    latestHR: null, latestSpO2: null, latestMap: null,
    hrTrend: { values: [], trend: 'stable' },
    spo2Trend: { values: [], trend: 'stable' },
    mapTrend: { values: [], trend: 'stable' },
    activeAlerts: 0, pendingLabs: 0, status: 'cleaning',
  },
];

const MOCK_ALERTS: ActiveAlert[] = [
  { id: 'al-001', bedCode: 'ICU-03', patientName: 'Phạm Thị Loan',  message: 'MAP < 60 — Shock không đáp ứng Noradrenaline', level: 'critical', triggeredAt: '00:42 trước', acknowledged: false },
  { id: 'al-002', bedCode: 'ICU-02', patientName: 'Trần Bá Dũng',   message: 'STEMI protocol — Chưa hội chẩn can thiệp mạch', level: 'critical', triggeredAt: '02:11 trước', acknowledged: false },
  { id: 'al-003', bedCode: 'ICU-01', patientName: 'Nguyễn Văn Hoàng', message: 'SpO₂ giảm dần — Đang theo dõi ARDS tiến triển', level: 'warning', triggeredAt: '15:00 trước', acknowledged: false },
  { id: 'al-004', bedCode: 'ICU-02', patientName: 'Trần Bá Dũng',   message: 'Kết quả Troponin I chưa được duyệt (LIS Panic)', level: 'warning', triggeredAt: '18:30 trước', acknowledged: true },
];

const MOCK_TRANSFERS: TransferRequest[] = [
  {
    id: 'tr-001', patientName: 'Trần Bá Dũng', mrn: 'pat-002',
    fromBed: 'ICU-02', toWard: 'Cath Lab — Phòng Can thiệp',
    requestedBy: 'BS. Trần Văn Nam', reason: 'STEMI — Cần can thiệp mạch vành khẩn',
    priority: 'emergency', status: 'pending',
    requestedAt: '2026-08-08T21:12:00Z', slaMinutes: 30,
  },
  {
    id: 'tr-002', patientName: 'Phạm Thị Loan', mrn: 'pat-003',
    fromBed: 'Cấp cứu', toWard: 'ICU-05 — Chờ tiếp nhận',
    requestedBy: 'BS. CK Cấp cứu Nguyễn Anh', reason: 'Septic shock — Cần theo dõi ICU tích cực',
    priority: 'priority', status: 'pending',
    requestedAt: '2026-08-08T20:58:00Z', slaMinutes: 60,
  },
  {
    id: 'tr-003', patientName: 'Lê Quốc Hùng', mrn: 'pat-004',
    fromBed: 'ICU-04', toWard: 'Khoa Tim Mạch — Giường 08',
    requestedBy: 'PGS.TS.BS Lê Minh Khoa', reason: 'Hậu phẫu ổn định, đủ điều kiện chuyển khoa',
    priority: 'routine', status: 'approved',
    requestedAt: '2026-08-08T09:00:00Z', slaMinutes: 120,
  },
];

const MOCK_STAFF: ICUShiftStaff[] = [
  { id: 'st-01', name: 'PGS.TS.BS Lê Minh Khoa', role: 'physician', shift: 'Sáng', assignedBeds: ['ICU-03', 'ICU-04'], status: 'on_duty', onCall: false },
  { id: 'st-02', name: 'BS. Trần Văn Nam',        role: 'physician', shift: 'Sáng', assignedBeds: ['ICU-01', 'ICU-02'], status: 'on_duty', onCall: false },
  { id: 'st-03', name: 'BS. Nội trú Hùng',        role: 'resident',  shift: 'Sáng', assignedBeds: ['ICU-05', 'ICU-06'], status: 'on_duty', onCall: false },
  { id: 'st-04', name: 'ĐD. Lý Thu Hà',           role: 'nurse',     shift: 'Sáng', assignedBeds: ['ICU-01', 'ICU-03'], status: 'on_duty', onCall: false },
  { id: 'st-05', name: 'ĐD. Nguyễn Văn Phong',    role: 'nurse',     shift: 'Sáng', assignedBeds: ['ICU-02'],           status: 'break',   onCall: false },
  { id: 'st-06', name: 'ĐD. Hoàng Minh Tuấn',     role: 'nurse',     shift: 'Sáng', assignedBeds: ['ICU-04'],           status: 'on_duty', onCall: false },
  { id: 'st-07', name: 'BS. Nguyễn Thành Công',   role: 'physician', shift: 'Chiều', assignedBeds: [],                  status: 'off_duty', onCall: true },
  { id: 'st-08', name: 'BS. Trịnh Thị Mai',       role: 'physician', shift: 'Đêm',  assignedBeds: [],                  status: 'off_duty', onCall: true },
];

// ─── Severity Config ────────────────────────────────────────────────────────────
const SEV_CFG: Record<Severity, { label: string; headerBg: string; ring: string; dot: string; badge: string }> = {
  very_critical: {
    label: 'CRITICAL',
    headerBg: 'bg-gradient-to-r from-rose-700 to-rose-900 border-b border-rose-800',
    ring: 'ring-4 ring-rose-500/80 shadow-rose-950/40 shadow-lg scale-[1.01]',
    dot: 'bg-rose-500 animate-pulse',
    badge: 'bg-rose-50 text-rose-950 border-rose-300 font-black',
  },
  critical: {
    label: 'SEVERE',
    headerBg: 'bg-gradient-to-r from-orange-600 to-orange-800 border-b border-orange-700',
    ring: 'ring-4 ring-orange-400/80 shadow-orange-950/40 shadow-lg scale-[1.01]',
    dot: 'bg-orange-500',
    badge: 'bg-orange-50 text-orange-900 border-orange-300 font-extrabold',
  },
  monitoring: {
    label: 'MONITORING',
    headerBg: 'bg-gradient-to-r from-amber-500 to-amber-600 border-b border-amber-500',
    ring: 'ring-2 ring-amber-400 shadow-md',
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-950 border-amber-300 font-bold',
  },
  stable: {
    label: 'STABLE',
    headerBg: 'bg-gradient-to-r from-emerald-600 to-emerald-700 border-b border-emerald-500',
    ring: 'ring-1 ring-emerald-400 shadow-sm',
    dot: 'bg-emerald-400',
    badge: 'bg-emerald-50 text-emerald-950 border-emerald-200 font-semibold',
  },
};

// ─── Mini Sparkline Component ──────────────────────────────────────────────────
function MiniSparkline({ values, trend, color }: { values: number[]; trend: 'up' | 'down' | 'stable'; color: string }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 60;
  const h = 20;
  
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 2 - ((v - min) / range) * (h - 4);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const strokeColor = trend === 'up' ? '#ef4444' : trend === 'down' ? '#f97316' : '#10b981';
  const lastPt = points[points.length - 1];

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      {/* Translucent glow shadow line */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-25 blur-[1px]"
      />
      {/* Crisp primary line */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Pulse circle at current coordinate */}
      {lastPt && (
        <>
          <circle cx={lastPt.x} cy={lastPt.y} r="2" fill={strokeColor} />
          <circle cx={lastPt.x} cy={lastPt.y} r="4.5" fill={strokeColor} className="animate-ping opacity-75" />
        </>
      )}
    </svg>
  );
}

// ─── Trend Icon ────────────────────────────────────────────────────────────────
function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <TrendingUp className="w-3 h-3 text-rose-500" />;
  if (trend === 'down') return <TrendingDown className="w-3 h-3 text-orange-500" />;
  return <Minus className="w-3 h-3 text-slate-400" />;
}

// ─── SLA Timer ─────────────────────────────────────────────────────────────────
function SLATimer({ requestedAt, slaMinutes }: { requestedAt: string; slaMinutes: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(requestedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 60000));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [requestedAt]);

  const remaining = slaMinutes - elapsed;
  const pct = Math.min(100, (elapsed / slaMinutes) * 100);
  const isOver = remaining <= 0;
  const isWarn = remaining <= 10 && remaining > 0;

  return (
    <div className="flex items-center gap-2">
      <Timer className={`w-3.5 h-3.5 ${isOver ? 'text-rose-500 animate-pulse' : isWarn ? 'text-amber-500' : 'text-slate-400'}`} />
      <div className="flex-1">
        <div className={`text-[10px] font-bold ${isOver ? 'text-rose-600' : isWarn ? 'text-amber-600' : 'text-slate-500'}`}>
          SLA: {isOver ? `Quá hạn ${Math.abs(remaining)} phút` : `Còn ${remaining} phút`}
        </div>
        <div className="h-1 w-full bg-slate-200 rounded-full mt-0.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isOver ? 'bg-rose-500' : isWarn ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Patient Workspace Modal ────────────────────────────────────────────────────
function PatientWorkspaceModal({ bed, onClose }: { bed: ICUBed; onClose: () => void }) {
  const [wsTab, setWsTab] = useState<'overview' | 'vitals' | 'mar' | 'labs' | 'pacs'>('overview');
  const tabs: { key: typeof wsTab; label: string; icon: React.ElementType }[] = [
    { key: 'overview', label: 'Overview', icon: MonitorCheck },
    { key: 'vitals',   label: 'Vitals',   icon: Activity },
    { key: 'mar',      label: 'MAR',      icon: ClipboardList },
    { key: 'labs',     label: 'Labs',     icon: FlaskConical },
    { key: 'pacs',     label: 'PACS',     icon: Scan },
  ];
  const sev = SEV_CFG[bed.severity];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className={`px-6 py-4 ${sev.headerBg} text-white flex items-center justify-between`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Patient Clinical Workspace</div>
            <div className="text-lg font-black mt-0.5">{bed.patientName}</div>
            <div className="text-xs opacity-80 mt-0.5">{bed.bedCode} · {bed.age}t · {bed.gender} · MRN: {bed.mrn} · {bed.diagnosis}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 gap-1">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setWsTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
                wsTab === key ? 'border-rose-600 text-rose-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        {/* Workspace Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {wsTab === 'overview' && (
            <div className="space-y-4">
              {/* Acuity Scores */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'APACHE II', value: bed.apacheScore, trend: bed.apacheTrend, warn: (bed.apacheScore ?? 0) >= 25 },
                  { label: 'SOFA', value: bed.sofaScore, trend: 'stable' as const, warn: (bed.sofaScore ?? 0) >= 10 },
                  { label: 'NEWS2', value: bed.news2Score, trend: 'stable' as const, warn: (bed.news2Score ?? 0) >= 7 },
                ].map((s) => (
                  <div key={s.label} className={`rounded-xl p-4 border ${s.warn ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">{s.label}</div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-black ${s.warn ? 'text-rose-700' : 'text-slate-800'}`}>{s.value ?? '—'}</span>
                      <TrendIcon trend={s.trend as 'up' | 'down' | 'stable'} />
                    </div>
                    {s.warn && <div className="text-[9px] text-rose-600 font-semibold mt-1 uppercase">High Risk</div>}
                  </div>
                ))}
              </div>
              {/* Active Alerts summary */}
              {bed.activeAlerts > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-rose-700 font-bold text-sm mb-2">
                    <AlertCircle className="w-4 h-4" />
                    {bed.activeAlerts} Active Alert{bed.activeAlerts > 1 ? 's' : ''}
                  </div>
                  {MOCK_ALERTS.filter((a) => a.bedCode === bed.bedCode).map((al) => (
                    <div key={al.id} className="text-xs text-rose-700 border-t border-rose-200 pt-2 mt-2 first:border-0 first:pt-0 first:mt-0">
                      <span className={`font-bold mr-1 ${al.level === 'critical' ? 'text-rose-700' : 'text-amber-600'}`}>
                        {al.level === 'critical' ? '🔴' : '🟡'}
                      </span>
                      {al.message}
                      <span className="text-rose-500 ml-1">· {al.triggeredAt}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Staff */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Bác sĩ điều trị</div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-black text-[10px]">BS</div>
                    <div className="text-sm font-semibold text-slate-800">{bed.assignedPhysician}</div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Điều dưỡng phụ trách</div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-white font-black text-[10px]">ĐD</div>
                    <div className="text-sm font-semibold text-slate-800">{bed.assignedNurse}</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {wsTab !== 'overview' && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Brain className="w-8 h-8 mb-2 opacity-30" />
              <div className="text-sm font-medium">Chuyển sang module {wsTab.toUpperCase()} từ Clinical Timeline</div>
              <div className="text-xs mt-1 text-slate-300">Kết nối với LIS / MAR / PACS tại Phase B3</div>
            </div>
          )}
        </div>

        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-all">Đóng</button>
          <button className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5" /> Mở toàn màn hình EMR
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function ICUCommandCenter() {
  const [activeTab, setActiveTab] = useState<'beds' | 'staff' | 'transfer'>('beds');
  const [alerts, setAlerts] = useState<ActiveAlert[]>(MOCK_ALERTS);
  const [transfers, setTransfers] = useState<TransferRequest[]>(MOCK_TRANSFERS);
  const [selectedBed, setSelectedBed] = useState<ICUBed | null>(null);
  const [liveTime, setLiveTime] = useState('');
  const [isLive, setIsLive] = useState(true);

  // Live clock
  useEffect(() => {
    const tick = () => setLiveTime(new Date().toLocaleTimeString('vi-VN'));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Simulate connectivity check
  useEffect(() => {
    const id = setInterval(() => setIsLive(true), 5000);
    return () => clearInterval(id);
  }, []);

  // Derived stats
  const occupiedBeds = MOCK_ICU_BEDS.filter((b) => b.status === 'occupied').length;
  const criticalCount = MOCK_ICU_BEDS.filter((b) => b.severity === 'very_critical' || b.severity === 'critical').length;
  const onVentilator = MOCK_ICU_BEDS.filter((b) => b.ventilator).length;
  const isolationCount = MOCK_ICU_BEDS.filter((b) => b.isolation).length;
  const availableCount = MOCK_ICU_BEDS.filter((b) => b.status === 'empty').length;
  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged).length;
  const pendingTransfers = transfers.filter((t) => t.status === 'pending').length;

  const physicians = MOCK_STAFF.filter((s) => s.role === 'physician' || s.role === 'resident');
  const nurses = MOCK_STAFF.filter((s) => s.role === 'nurse');
  const onDutyPhysicians = physicians.filter((s) => s.status === 'on_duty').length;
  const onDutyNurses = nurses.filter((s) => s.status === 'on_duty').length;

  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, acknowledged: true } : a));
  }, []);

  const approveTransfer = useCallback((id: string) => {
    setTransfers((prev) => prev.map((t) => t.id === id ? { ...t, status: 'approved' } : t));
  }, []);

  const rejectTransfer = useCallback((id: string) => {
    setTransfers((prev) => prev.map((t) => t.id === id ? { ...t, status: 'rejected' } : t));
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-4">

      {/* ══════════════════════════════════════════════════════════
          TẦNG 1 — COMMAND SUMMARY (Bright design)
          ══════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 rounded-2xl p-6 text-slate-800 shadow-md border border-slate-200/80 relative overflow-hidden">
        {/* Glowing backdrop elements */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title block */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4.5 h-4.5 text-rose-600 animate-pulse" />
              <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">
                Bella Hospital · ICU Command Center
              </span>
              {/* Live indicator */}
              <div className={`flex items-center gap-1.5 ml-3 px-2.5 py-0.5 rounded-full border text-[9px] font-bold ${
                isLive ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-amber-200 text-amber-700 bg-amber-50'
              }`}>
                {isLive
                  ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />LIVE · {liveTime}</>
                  : <><WifiOff className="w-3 h-3" />DEGRADED</>
                }
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-serif text-slate-900" style={{ color: '#0f172a' }}>
              ICU Real-Time Dispatch
            </h1>
            <p className="text-slate-500 text-xs font-semibold">
              Điều phối khoa Hồi sức tích cực · Giám sát bệnh nhân · Cảnh báo lâm sàng · Quản lý chuyển khoa
            </p>
          </div>

          {/* KPI Chips — Command Summary */}
          <div className="grid grid-cols-3 lg:grid-cols-6 gap-2 shrink-0">
            {[
              { value: MOCK_ICU_BEDS.length, label: 'ICU Beds', color: 'text-slate-800', bg: 'bg-slate-50 border-slate-200' },
              { value: occupiedBeds,          label: 'Occupied',  color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
              { value: criticalCount,         label: 'Critical',  color: 'text-rose-600 animate-pulse', sub: '⬤', bg: 'bg-rose-50 border-rose-200' },
              { value: onVentilator,          label: 'Ventilated',color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
              { value: isolationCount,        label: 'Isolation', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
              { value: availableCount,        label: 'Available', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
            ].map(({ value, label, color, sub, bg }) => (
              <div key={label} className={`text-center ${bg} border rounded-xl px-4 py-3 shadow-sm hover:scale-[1.02] hover:shadow-md transition-all duration-150`}>
                <div className={`text-2xl font-black ${color}`}>{sub && <span className="text-[10px] mr-0.5">{sub}</span>}{value}</div>
                <div className="text-[9px] text-slate-500 font-bold uppercase mt-1 tracking-wider">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          TẦNG 2 — OPERATIONAL RAIL
          Alert Rail | Transfer Queue | Staffing
          ══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Alert Rail (Bright Theme) ──────────────────────────── */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden transition-all duration-200">
          <div className="px-4 py-3.5 bg-gradient-to-r from-rose-50/50 to-slate-50 border-b border-rose-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Siren className="w-4 h-4 text-rose-600 animate-pulse" />
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Active Alerts</span>
            </div>
            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
              unacknowledgedAlerts > 0 ? 'bg-rose-600 border-rose-500 text-white animate-pulse' : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}>
              {unacknowledgedAlerts} NEW
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {alerts.map((al) => (
              <div key={al.id} className={`px-4 py-3 flex items-start gap-3 transition-all hover:bg-slate-50/50 ${al.acknowledged ? 'opacity-40' : ''}`}>
                <div className="relative mt-1 shrink-0">
                  <div className={`w-2.5 h-2.5 rounded-full ${al.level === 'critical' ? 'bg-rose-500' : 'bg-amber-500 bg-amber-500'}`} />
                  {al.level === 'critical' && !al.acknowledged && (
                    <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-rose-400 bg-rose-400 animate-ping" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-slate-800 tracking-wide flex items-center gap-1.5">
                    <span className="bg-slate-100 border border-slate-200 px-1 py-0.5 rounded text-[9px] font-mono text-slate-700 font-extrabold">{al.bedCode}</span>
                    <span className="truncate font-black text-slate-900">{al.patientName}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 text-slate-600 font-semibold leading-relaxed mt-1">{al.message}</div>
                  <div className="text-[9px] text-slate-400 mt-1.5 font-bold flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {al.triggeredAt}
                  </div>
                </div>
                {!al.acknowledged && (
                  <button
                    onClick={() => acknowledgeAlert(al.id)}
                    className="shrink-0 p-1.5 rounded-lg bg-slate-50 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-rose-600 active:scale-95 transition-all"
                    title="Acknowledge"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
            <button className="text-[10px] text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1 transition-colors">
              <Bell className="w-3 h-3" /> View all active alerts
            </button>
          </div>
        </div>

        {/* ── Transfer Dispatch ──────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
          <div className="px-4 py-3.5 bg-gradient-to-r from-indigo-50/50 via-slate-50/30 to-white border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Transfer Requests</span>
            </div>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
              pendingTransfers > 0 ? 'bg-amber-50 border-amber-200 border-amber-200 text-amber-700 font-extrabold animate-pulse' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              {pendingTransfers} Pending
            </span>
          </div>
          <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
            {transfers.map((t) => {
              const prioStyles = t.priority === 'emergency' ? 'text-rose-700 bg-rose-50 border border-rose-200' :
                t.priority === 'priority' ? 'text-amber-800 bg-amber-50 border border-amber-200' :
                'text-slate-700 bg-slate-50 border border-slate-200';
              return (
                <div key={t.id} className="px-4 py-3 space-y-2 hover:bg-slate-50/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{t.patientName}</div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 mt-1">
                        <span className="font-bold bg-slate-100 px-1 py-0.2 rounded text-[9px] text-slate-700">{t.fromBed}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span className="font-bold bg-indigo-50 text-indigo-700 px-1 py-0.2 border border-indigo-100 rounded text-[9px]">{t.toWard}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 mt-1 leading-normal italic font-medium">{t.reason}</div>
                    </div>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border shrink-0 uppercase tracking-wider ${prioStyles}`}>
                      {t.priority}
                    </span>
                  </div>
                  {t.status === 'pending' && (
                    <div className="space-y-2 pt-1">
                      <SLATimer requestedAt={t.requestedAt} slaMinutes={t.slaMinutes} />
                      <div className="flex gap-1.5">
                        <button onClick={() => approveTransfer(t.id)}
                          className="flex-1 py-1.5 text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm hover:shadow active:scale-95 transition-all">
                          ✓ Accept
                        </button>
                        <button className="px-3 py-1.5 text-[10px] font-extrabold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg active:scale-95 transition-all">
                          Assign Bed
                        </button>
                        <button onClick={() => rejectTransfer(t.id)}
                          className="px-2 py-1.5 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg active:scale-95 transition-all">
                          ✗
                        </button>
                      </div>
                    </div>
                  )}
                  {t.status === 'approved' && (
                    <span className="inline-block text-[9px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      ✓ Approved
                    </span>
                  )}
                  {t.status === 'rejected' && (
                    <span className="inline-block text-[9px] font-extrabold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-full">
                      ✗ Rejected
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Staffing Intelligence ─────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
          <div className="px-4 py-3.5 bg-gradient-to-r from-teal-50/50 via-slate-50/30 to-white border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">Staffing · Ca Sáng</span>
            </div>
            <span className="text-[10px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
              Active
            </span>
          </div>
          {/* Ratio summary */}
          <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/30">
            <div className="px-4 py-3 text-center">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Bác sĩ</div>
              <div className="text-xl font-black text-slate-800 mt-0.5">{onDutyPhysicians} <span className="text-xs font-bold text-slate-400">/ {physicians.length}</span></div>
              <div className="text-[9px] text-slate-500 font-semibold font-medium">đang trực</div>
            </div>
            <div className="px-4 py-3 text-center">
              <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Điều dưỡng</div>
              <div className="text-xl font-black text-slate-800 mt-0.5">{onDutyNurses} <span className="text-xs font-bold text-slate-400">/ {nurses.length}</span></div>
              <div className="text-[9px] text-slate-500 font-semibold font-medium">đang trực</div>
            </div>
          </div>
          {/* Nurse ratio alert */}
          <div className="px-4 py-2.5 bg-amber-50/70 border-b border-amber-100">
            <div className="text-[10px] font-bold text-amber-800 flex items-center gap-1.5 leading-normal">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Tỷ lệ: 1 ĐD : {Math.round(occupiedBeds / (onDutyNurses || 1))} BN <span className="font-semibold text-amber-600/90">(Khuyến nghị 1:2 hoặc tốt hơn)</span></span>
            </div>
          </div>
          {/* Staff list compact */}
          <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto">
            {MOCK_STAFF.filter((s) => s.status !== 'off_duty' || s.onCall).map((s) => (
              <div key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50/40 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[9px] text-white shrink-0 ${
                    s.role === 'physician' ? 'bg-blue-600' : s.role === 'resident' ? 'bg-purple-600' : 'bg-teal-600'
                  }`}>
                    {s.role === 'physician' ? 'BS' : s.role === 'resident' ? 'NT' : 'ĐD'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-800 truncate">{s.name}</div>
                    {s.assignedBeds.length > 0 ? (
                      <div className="text-[9px] text-slate-400 font-semibold truncate mt-0.5">Giường: {s.assignedBeds.join(', ')}</div>
                    ) : (
                      s.onCall && <div className="text-[9px] text-indigo-600 font-bold mt-0.5">On-call</div>
                    )}
                  </div>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  s.status === 'on_duty' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                  s.status === 'break' ? 'bg-amber-50 bg-amber-50 text-amber-800 border border-amber-100' :
                  'bg-slate-50 bg-slate-50 text-slate-500 border border-slate-100'
                }`}>
                  {s.status === 'on_duty' ? 'Trực' : s.status === 'break' ? 'Nghỉ' : 'On-call'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        {/* Tab bar */}
        <div className="flex border-b border-slate-200 gap-1.5 mb-5 bg-slate-50/50 p-1 rounded-xl">
          {[
            { key: 'beds'     as const, label: 'Sơ Đồ Giường ICU',    icon: BedDouble },
            { key: 'staff'    as const, label: 'Nhân Sự Ca Trực',     icon: Users },
            { key: 'transfer' as const, label: `Chuyển Khoa (${pendingTransfers} Pending)`, icon: ArrowRight },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-2 px-4.5 text-xs font-bold flex items-center gap-2 rounded-lg transition-all active:scale-95 ${
                activeTab === key
                  ? 'bg-white text-rose-700 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/50 border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${activeTab === key ? 'text-rose-600' : 'text-slate-400'}`} />
              {label}
            </button>
          ))}
          {/* Refresh */}
          <div className="ml-auto flex items-center pr-1">
            <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 hover:shadow-sm transition-all active:scale-95">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── BED GRID TAB ──────────────────────────────────────── */}
        {activeTab === 'beds' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {MOCK_ICU_BEDS.map((bed) => {
              // Empty / Cleaning bed
              if (bed.status === 'empty' || bed.status === 'cleaning' || bed.status === 'maintenance') {
                const emptyColors = {
                  empty: 'border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50/50 shadow-inner shadow-emerald-100/10',
                  cleaning: 'border-amber-200 bg-amber-50/20 hover:bg-amber-50/40 shadow-inner shadow-amber-100/10',
                  maintenance: 'border-slate-200 bg-slate-50 hover:bg-slate-100/50',
                };
                const iconColors = {
                  empty: 'text-emerald-500',
                  cleaning: 'text-amber-500',
                  maintenance: 'text-slate-400',
                };
                return (
                  <div key={bed.bedId} className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center min-h-[190px] transition-all duration-200 ${emptyColors[bed.status]}`}>
                    <div className="p-3 bg-white rounded-full shadow-sm border border-slate-100 mb-2">
                      <BedDouble className={`w-6 h-6 ${iconColors[bed.status]}`} />
                    </div>
                    <div className="font-extrabold text-slate-800 text-lg tracking-wide">{bed.bedCode}</div>
                    <div className={`text-xs font-bold mt-1.5 ${
                      bed.status === 'empty' ? 'text-emerald-700' :
                      bed.status === 'cleaning' ? 'text-amber-700' : 'text-slate-500'
                    }`}>
                      {bed.status === 'empty' ? '✓ Sẵn sàng tiếp nhận' :
                       bed.status === 'cleaning' ? '↻ Đang vệ sinh khử khuẩn' : '⚙ Bảo trì thiết bị'}
                    </div>
                    {bed.status === 'empty' && (
                      <button className="mt-3.5 text-[10px] font-extrabold text-emerald-800 bg-white hover:bg-emerald-600 hover:text-white border border-emerald-300 hover:border-emerald-600 px-4 py-1.5 rounded-xl shadow-sm hover:shadow active:scale-95 transition-all">
                        + Tiếp nhận BN
                      </button>
                    )}
                  </div>
                );
              }

              const sev = SEV_CFG[bed.severity];

              return (
                <div
                  key={bed.bedId}
                  className={`bg-white border rounded-2xl shadow-sm overflow-hidden cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 ${sev.ring}`}
                  onClick={() => setSelectedBed(bed)}
                >
                  {/* Card header */}
                  <div className={`${sev.headerBg} px-4 py-3 flex items-center justify-between text-white`}>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <div className={`w-2.5 h-2.5 rounded-full ${sev.dot}`} />
                        {bed.severity === 'very_critical' && (
                          <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-rose-400 bg-rose-400 animate-ping" />
                        )}
                      </div>
                      <span className="font-black text-white text-sm tracking-wide">{bed.bedCode}</span>
                      {bed.isolation && (
                        <span className="text-[8px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full flex items-center gap-0.5 tracking-wider">
                          <ShieldAlert className="w-2.5 h-2.5" /> ISOLATION
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {bed.activeAlerts > 0 && (
                        <span className="text-[8px] font-black bg-rose-600/90 text-white border border-rose-500 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <Bell className="w-2.5 h-2.5 animate-bounce" /> {bed.activeAlerts}
                        </span>
                      )}
                      <span className="text-[8px] font-black bg-white/25 text-white px-2 py-0.5 rounded-full tracking-wider uppercase">{sev.label}</span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3.5">
                    {/* Patient */}
                    <div>
                      <div className="font-extrabold text-slate-900 text-base tracking-tight">{bed.patientName}</div>
                      <div className="text-[10px] text-slate-500 font-semibold mt-1">{bed.age} tuổi · {bed.gender} · MRN: <span className="font-mono text-slate-700 font-bold">{bed.mrn}</span></div>
                      <div className="text-xs font-semibold text-slate-600 mt-1 line-clamp-1">{bed.diagnosis}</div>
                    </div>

                    {/* Vitals with sparklines */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50/70 border border-slate-100 rounded-2xl p-3">
                      {/* HR */}
                      <div className="text-center space-y-0.5">
                        <div className="flex items-center justify-center gap-0.5 text-rose-600">
                          <Heart className="w-3.5 h-3.5 fill-rose-50/10" />
                          <TrendIcon trend={bed.hrTrend.trend} />
                        </div>
                        <div className={`text-base font-black tracking-tight ${(bed.latestHR ?? 0) > 100 || (bed.latestHR ?? 0) < 50 ? 'text-rose-700' : 'text-slate-800'}`}>
                          {bed.latestHR}
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">HR/ph</div>
                        <div className="pt-1 flex justify-center">
                          <MiniSparkline values={bed.hrTrend.values} trend={bed.hrTrend.trend} color="rose" />
                        </div>
                      </div>
                      {/* SpO₂ */}
                      <div className="text-center space-y-0.5">
                        <div className="flex items-center justify-center gap-0.5 text-blue-600">
                          <Wind className="w-3.5 h-3.5" />
                          <TrendIcon trend={bed.spo2Trend.trend} />
                        </div>
                        <div className={`text-base font-black tracking-tight ${(bed.latestSpO2 ?? 100) < 94 ? 'text-rose-700' : 'text-slate-800'}`}>
                          {bed.latestSpO2}%
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">SpO₂</div>
                        <div className="pt-1 flex justify-center">
                          <MiniSparkline values={bed.spo2Trend.values} trend={bed.spo2Trend.trend} color="blue" />
                        </div>
                      </div>
                      {/* MAP */}
                      <div className="text-center space-y-0.5">
                        <div className="flex items-center justify-center gap-0.5 text-violet-600">
                          <Gauge className="w-3.5 h-3.5" />
                          <TrendIcon trend={bed.mapTrend.trend} />
                        </div>
                        <div className={`text-base font-black tracking-tight ${(bed.mapTrend?.values?.at(-1) ?? 70) < 65 ? 'text-rose-700' : 'text-slate-800'}`}>
                          {bed.latestMap}
                        </div>
                        <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">MAP</div>
                        <div className="pt-1 flex justify-center">
                          <MiniSparkline values={bed.mapTrend.values} trend={bed.mapTrend.trend} color="violet" />
                        </div>
                      </div>
                    </div>

                    {/* Acuity + Equipment tags */}
                    <div className="flex flex-wrap gap-1">
                      {bed.ventilator && (
                        <span className="text-[9px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200/65 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Wind className="w-3 h-3" /> Ventilator
                        </span>
                      )}
                      {bed.apacheScore !== null && (
                        <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                          bed.apacheScore >= 25 ? 'bg-rose-50 border-rose-200 text-rose-700 font-extrabold' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                          APACHE II {bed.apacheScore}
                          <TrendIcon trend={bed.apacheTrend} />
                        </span>
                      )}
                      {bed.sofaScore !== null && (
                        <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border ${
                          bed.sofaScore >= 10 ? 'bg-rose-50 border-rose-200 text-rose-700 font-extrabold' : 'bg-slate-50 border-slate-200 text-slate-600'
                        }`}>
                          SOFA {bed.sofaScore}
                        </span>
                      )}
                      {bed.pendingLabs > 0 && (
                        <span className="text-[9px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200/80 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <FlaskConical className="w-3 h-3 text-amber-600" /> {bed.pendingLabs} Lab
                        </span>
                      )}
                    </div>

                    {/* Staff row — Lucide, no emoji */}
                    <div className="flex justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-2.5 gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Stethoscope className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                        <span className="truncate font-semibold text-slate-700">{bed.assignedPhysician}</span>
                      </div>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <PersonStanding className="w-3.5 h-3.5 shrink-0 text-teal-600" />
                        <span className="truncate font-semibold text-slate-700">{bed.assignedNurse}</span>
                      </div>
                    </div>

                    {/* Click hint */}
                    <div className="flex items-center justify-end text-[9px] text-slate-300 font-bold hover:text-slate-400 transition-colors gap-0.5">
                      <ChevronRight className="w-3 h-3" /> Open workspace
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── STAFF TAB ─────────────────────────────────────────── */}
        {activeTab === 'staff' && (
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                Ca Trực Hiện Tại — {new Date().toLocaleDateString('vi-VN')}
              </h3>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full">Bác sĩ: {onDutyPhysicians}/{physicians.length}</span>
                <span className="bg-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full">Điều dưỡng: {onDutyNurses}/{nurses.length}</span>
                <span className={`px-2.5 py-0.5 rounded-full border ${onDutyNurses / occupiedBeds < 0.6 ? 'bg-amber-50 border-amber-200 text-amber-700 font-extrabold animate-pulse' : 'bg-emerald-50 border-emerald-200 text-emerald-700 font-extrabold'}`}>
                  Tỷ lệ ĐD/BN: 1:{Math.round(occupiedBeds / (onDutyNurses || 1))}
                </span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {MOCK_STAFF.map((s) => (
                <div key={s.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/30 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs text-white shadow-sm shrink-0 \s.role === 'physician' ? 'bg-blue-600' : s.role === 'resident' ? 'bg-purple-600' : 'bg-teal-600'
                    }`}>
                      {s.role === 'physician' ? 'BS' : s.role === 'resident' ? 'NT' : 'ĐD'}
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-800 text-sm">{s.name}</div>
                      <div className="text-xs text-slate-500 font-semibold mt-0.5">
                        {s.assignedBeds.length > 0 ? (
                          <span className="text-slate-600">Giường phụ trách: <span className="font-bold text-slate-800">{s.assignedBeds.join(', ')}</span></span>
                        ) : s.onCall ? (
                          <span className="text-indigo-600 font-bold">On-call trực dự phòng</span>
                        ) : 'Ca Chiều/Đêm (Ngoại ca)'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {s.onCall && (
                      <span className="text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                        ON CALL
                      </span>
                    )}
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      s.status === 'on_duty' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                      s.status === 'break' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                      'bg-slate-50 bg-slate-50 text-slate-500 text-slate-500'
                    }`}>
                      {s.status === 'on_duty' ? 'Đang trực' : s.status === 'break' ? 'Nghỉ ca' : 'Hết ca'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TRANSFER TAB ──────────────────────────────────────── */}
        {activeTab === 'transfer' && (
          <div className="space-y-4">
            {transfers.map((t) => {
              const prioStyles = {
                emergency: 'border-rose-300 bg-rose-50/30 hover:bg-rose-50/50',
                priority: 'border-amber-300 bg-amber-50/20 hover:bg-amber-50/40',
                routine: 'border-slate-200 bg-white hover:bg-slate-50/30',
              };
              const prioBadge = {
                emergency: 'bg-rose-600 text-white border-rose-500',
                priority: 'bg-amber-500 bg-amber-500 text-white border-amber-400',
                routine: 'bg-slate-100 text-slate-700 border-slate-200',
              };
              return (
                <div key={t.id} className={`border border-l-4 rounded-xl p-5 shadow-sm transition-all duration-200 ${prioStyles[t.priority]} ${
                  t.priority === 'emergency' ? 'border-l-rose-600' : t.priority === 'priority' ? 'border-l-amber-500' : 'border-l-slate-400'
                }`}>
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${prioBadge[t.priority]}`}>
                          {t.priority === 'emergency' ? '🔴 Emergency' : t.priority === 'priority' ? '🟠 Priority' : '🔵 Routine'}
                        </span>
                        {t.status === 'approved' && (
                          <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            ✓ Approved
                          </span>
                        )}
                        {t.status === 'rejected' && (
                          <span className="text-[9px] font-extrabold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-0.5 rounded-full">
                            ✗ Rejected
                          </span>
                        )}
                      </div>
                      <div className="font-extrabold text-slate-900 text-base">{t.patientName} <span className="text-xs font-semibold text-slate-500">· MRN: <span className="font-mono">{t.mrn}</span></span></div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] text-slate-800">{t.fromBed}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 text-slate-400" />
                        <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px]">{t.toWard}</span>
                      </div>
                      <div className="text-xs text-slate-600 font-semibold leading-relaxed">{t.reason}</div>
                      <div className="text-[10px] text-slate-400 font-bold">Yêu cầu bởi: {t.requestedBy} · {new Date(t.requestedAt).toLocaleString('vi-VN')}</div>
                    </div>
                    {t.status === 'pending' && (
                      <div className="flex flex-row md:flex-col gap-2 shrink-0">
                        <button onClick={() => approveTransfer(t.id)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold shadow hover:shadow-md active:scale-95 transition-all flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                        </button>
                        <button className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-extrabold active:scale-95 transition-all flex items-center gap-1.5">
                          <BedDouble className="w-3.5 h-3.5" /> Assign Bed
                        </button>
                        <button onClick={() => rejectTransfer(t.id)}
                          className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold active:scale-95 transition-all">
                          Từ chối
                        </button>
                      </div>
                    )}
                  </div>
                  {t.status === 'pending' && (
                    <div className="mt-3.5 pt-3.5 border-t border-slate-100">
                      <SLATimer requestedAt={t.requestedAt} slaMinutes={t.slaMinutes} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
