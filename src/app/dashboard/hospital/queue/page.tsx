'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Clock,
  ArrowRight,
  Eye,
  PhoneCall,
  History,
  AlertCircle,
  RefreshCw,
  UserCheck,
  Bell,
  Siren,
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Pill,
  HeartPulse,
  Stethoscope,
  Brain,
  Info,
  Timer,
  TrendingDown,
  X,
  ClipboardList,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type AlertSeverity  = 'critical' | 'high' | 'warning';
type AlertStatus    = 'open' | 'acknowledged' | 'reported' | 'escalated' | 'closed';
type AlertSource    = 'nursing_vitals' | 'lis' | 'mar' | 'icu_monitor' | 'clinical_rule' | 'ai';
type ActionTaken    = 'oxygen_adjusted' | 'physician_notified' | 'patient_assessed' | 'rapid_response' | 'medication_held' | 'other';

interface AlertPatient {
  name: string;
  age: number;
  gender: 'Nam' | 'Nữ';
  mrn: string;
  bed: string;
  ward: string;
  daysAdmitted: number;
  allergies: string[];
}

interface VitalSnapshot {
  parameter: string;
  value: string;
  previousValues: string[];   // last 3 readings → trend
  threshold: string;
  abnormal: boolean;
}

interface AuditEntry {
  time: string;
  actor: string;
  action: string;
}

interface SafetyAlert {
  id: string;
  severity: AlertSeverity;
  priority: 'P0' | 'P1' | 'P2';
  status: AlertStatus;
  message: string;            // "What"
  source: AlertSource;
  sourceName: string;         // Human-readable source
  ruleId: string;             // Rule that triggered
  patient: AlertPatient;
  vital: VitalSnapshot;
  detectedAt: string;         // ISO timestamp
  detectedDisplay: string;    // Human display
  ackSlaMinutes: number;      // SLA in minutes
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  owner: string | null;
  aiAssist: { summary: string; confidence: number } | null;  // AI layer, clearly separated
  auditTrail: AuditEntry[];
  actionsSelected: ActionTaken[];
  actionNote: string;
}

type SafetyDomainStatus = 'normal' | 'alert';
interface SafetyDomain {
  name: string;
  status: SafetyDomainStatus;
  alertCount: number;
}

// ─── Alert Source Config ────────────────────────────────────────────────────────
const SOURCE_CFG: Record<AlertSource, { label: string; icon: React.ElementType; color: string }> = {
  nursing_vitals: { label: 'Nursing Vitals',   icon: HeartPulse,    color: 'text-rose-600' },
  lis:            { label: 'LIS (Lab)',         icon: FlaskConical,  color: 'text-indigo-600' },
  mar:            { label: 'MAR (Medication)',  icon: Pill,          color: 'text-amber-600' },
  icu_monitor:    { label: 'ICU Monitor',       icon: Activity,      color: 'text-blue-600' },
  clinical_rule:  { label: 'Clinical Rule',     icon: ShieldAlert,   color: 'text-slate-600' },
  ai:             { label: 'AI Assist',         icon: Brain,         color: 'text-violet-600' },
};

// ─── Mock Alerts ───────────────────────────────────────────────────────────────
const INITIAL_ALERTS: SafetyAlert[] = [
  {
    id: 'alt-001',
    severity: 'critical', priority: 'P0', status: 'open',
    message: 'SpO₂ < 90% — Dưới ngưỡng an toàn ICU',
    source: 'nursing_vitals', sourceName: 'Nursing Vitals', ruleId: 'ICU-SPO2-001',
    patient: {
      name: 'Nguyễn Văn Hùng', age: 67, gender: 'Nam',
      mrn: 'MRN-00182', bed: 'ICU-02', ward: 'Khoa Hồi sức tích cực',
      daysAdmitted: 5, allergies: ['Penicillin'],
    },
    vital: {
      parameter: 'SpO₂', value: '82%', previousValues: ['94%', '91%', '87%'],
      threshold: '< 90%', abnormal: true,
    },
    detectedAt: '2026-08-08T21:42:03Z', detectedDisplay: '21:42:03',
    ackSlaMinutes: 2,
    acknowledgedBy: null, acknowledgedAt: null, owner: null,
    aiAssist: {
      summary: 'Pattern phù hợp với đợt cấp ARDS. Khuyến nghị đánh giá lại PEEP và FiO₂.',
      confidence: 87,
    },
    auditTrail: [
      { time: '21:42:03', actor: 'Alert Engine', action: 'Alert OPEN — SpO₂ 82% detected (rule ICU-SPO2-001)' },
    ],
    actionsSelected: [], actionNote: '',
  },
  {
    id: 'alt-002',
    severity: 'critical', priority: 'P0', status: 'open',
    message: 'MAP < 60 — Shock chưa đáp ứng vận mạch',
    source: 'icu_monitor', sourceName: 'ICU Monitor', ruleId: 'ICU-MAP-002',
    patient: {
      name: 'Phạm Thị Loan', age: 52, gender: 'Nữ',
      mrn: 'MRN-00391', bed: 'ICU-03', ward: 'Khoa Hồi sức tích cực',
      daysAdmitted: 3, allergies: ['Sulfonamides', 'Contrast media'],
    },
    vital: {
      parameter: 'MAP', value: '54 mmHg', previousValues: ['68', '61', '57'],
      threshold: '< 60 mmHg', abnormal: true,
    },
    detectedAt: '2026-08-08T21:46:21Z', detectedDisplay: '21:46:21',
    ackSlaMinutes: 2,
    acknowledgedBy: null, acknowledgedAt: null, owner: null,
    aiAssist: null,
    auditTrail: [
      { time: '21:46:21', actor: 'Alert Engine', action: 'Alert OPEN — MAP 54 mmHg (rule ICU-MAP-002)' },
    ],
    actionsSelected: [], actionNote: '',
  },
  {
    id: 'alt-003',
    severity: 'high', priority: 'P1', status: 'acknowledged',
    message: 'Y lệnh MAR chưa thực hiện quá 30 phút',
    source: 'mar', sourceName: 'MAR (Medication)', ruleId: 'MAR-DELAY-001',
    patient: {
      name: 'Trần Thị Thu Hà', age: 44, gender: 'Nữ',
      mrn: 'MRN-00259', bed: 'Nội 305', ward: 'Khoa Nội tổng hợp',
      daysAdmitted: 2, allergies: [],
    },
    vital: {
      parameter: 'Medication', value: 'Furosemide 40mg — Chưa thực hiện', previousValues: [],
      threshold: 'Quá 30 phút so với y lệnh', abnormal: true,
    },
    detectedAt: '2026-08-08T21:38:12Z', detectedDisplay: '21:38:12',
    ackSlaMinutes: 5,
    acknowledgedBy: 'ĐD. Trưởng khoa Nội', acknowledgedAt: '21:40:02', owner: 'Trạm ĐD Nội 3',
    aiAssist: null,
    auditTrail: [
      { time: '21:38:12', actor: 'Alert Engine', action: 'Alert OPEN — MAR delay >30min (Furosemide 40mg)' },
      { time: '21:40:02', actor: 'ĐD. Trưởng khoa Nội', action: 'ACKNOWLEDGED — Giao Trạm ĐD Nội 3 xử lý' },
    ],
    actionsSelected: ['physician_notified'], actionNote: 'Đã thông báo bác sĩ trực, đang chuẩn bị thuốc.',
  },
  {
    id: 'alt-004',
    severity: 'warning', priority: 'P2', status: 'open',
    message: 'Troponin I Panic — Chưa được xác nhận bởi bác sĩ',
    source: 'lis', sourceName: 'LIS (Lab)', ruleId: 'LIS-PANIC-003',
    patient: {
      name: 'Trần Bá Dũng', age: 67, gender: 'Nam',
      mrn: 'MRN-00421', bed: 'ICU-02', ward: 'Khoa Hồi sức tích cực',
      daysAdmitted: 2, allergies: ['Heparin (HIT)'],
    },
    vital: {
      parameter: 'Troponin I', value: '28.4 ng/mL', previousValues: ['5.2 ng/mL', '14.8 ng/mL'],
      threshold: 'Panic > 10 ng/mL', abnormal: true,
    },
    detectedAt: '2026-08-08T21:28:41Z', detectedDisplay: '21:28:41',
    ackSlaMinutes: 10,
    acknowledgedBy: null, acknowledgedAt: null, owner: null,
    aiAssist: {
      summary: 'Troponin tăng nhanh kết hợp STEMI. Đề xuất hội chẩn Can thiệp mạch vành khẩn.',
      confidence: 91,
    },
    auditTrail: [
      { time: '21:28:41', actor: 'Alert Engine', action: 'Alert OPEN — Troponin I Panic 28.4 (rule LIS-PANIC-003)' },
    ],
    actionsSelected: [], actionNote: '',
  },
  {
    id: 'alt-005',
    severity: 'high', priority: 'P1', status: 'closed',
    message: 'HR > 130 — Tachycardia',
    source: 'nursing_vitals', sourceName: 'Nursing Vitals', ruleId: 'VIT-HR-001',
    patient: {
      name: 'Lê Quốc Hùng', age: 44, gender: 'Nam',
      mrn: 'MRN-00512', bed: 'ICU-04', ward: 'Khoa Hồi sức tích cực',
      daysAdmitted: 1, allergies: [],
    },
    vital: {
      parameter: 'HR', value: '131 bpm', previousValues: ['88', '105', '119'],
      threshold: '> 130 bpm', abnormal: true,
    },
    detectedAt: '2026-08-08T20:15:10Z', detectedDisplay: '20:15:10',
    ackSlaMinutes: 2,
    acknowledgedBy: 'ĐD. Hoàng Minh Tuấn', acknowledgedAt: '20:16:30', owner: 'BS. PGS.TS Lê Minh Khoa',
    aiAssist: null,
    auditTrail: [
      { time: '20:15:10', actor: 'Alert Engine', action: 'Alert OPEN — HR 131 bpm' },
      { time: '20:16:30', actor: 'ĐD. Hoàng Minh Tuấn', action: 'ACKNOWLEDGED' },
      { time: '20:18:00', actor: 'BS. PGS.TS Lê Minh Khoa', action: 'Đã đánh giá lâm sàng — Tăng liều Metoprolol' },
      { time: '20:45:00', actor: 'Nursing Vitals', action: 'HR 82 bpm — Trở về ngưỡng bình thường' },
      { time: '20:46:00', actor: 'ĐD. Hoàng Minh Tuấn', action: 'CLOSED — Alert resolved, patient stable' },
    ],
    actionsSelected: ['physician_notified', 'patient_assessed', 'medication_held'],
    actionNote: 'Bác sĩ đã đánh giá, điều chỉnh liều Metoprolol. HR hồi phục 82 sau 30 phút.',
  },
];

const SAFETY_DOMAINS: SafetyDomain[] = [
  { name: 'Cấp phát thuốc (MAR)',           status: 'alert',  alertCount: 1 },
  { name: 'Theo dõi sinh hiệu (Vitals)',     status: 'alert',  alertCount: 2 },
  { name: 'Xác thực danh tính (Identity)',   status: 'normal', alertCount: 0 },
  { name: 'Kiểm soát dị ứng (Allergy)',      status: 'normal', alertCount: 0 },
  { name: 'Giá trị xét nghiệm (Panic Lab)', status: 'alert',  alertCount: 1 },
  { name: 'Truyền máu (Blood Safety)',       status: 'normal', alertCount: 0 },
  { name: 'Bảo vệ phòng mổ (Surgical)',      status: 'normal', alertCount: 0 },
  { name: 'Cấp cứu phân loại (Triage)',      status: 'normal', alertCount: 0 },
];

const ACTION_OPTIONS: { key: ActionTaken; label: string }[] = [
  { key: 'oxygen_adjusted',   label: 'Điều chỉnh Oxy/Thở máy' },
  { key: 'physician_notified',label: 'Đã thông báo bác sĩ' },
  { key: 'patient_assessed',  label: 'Đánh giá lâm sàng BN' },
  { key: 'rapid_response',    label: 'Kích hoạt Rapid Response' },
  { key: 'medication_held',   label: 'Tạm giữ y lệnh thuốc' },
  { key: 'other',             label: 'Hành động khác (ghi chú)' },
];

const STATUS_CFG: Record<AlertStatus, { label: string; color: string; bg: string }> = {
  open:         { label: 'OPEN',         color: 'text-rose-700',   bg: 'bg-rose-600 text-white animate-pulse' },
  acknowledged: { label: 'ACKNOWLEDGED', color: 'text-amber-700',  bg: 'bg-amber-500 text-white' },
  reported:     { label: 'REPORTED',     color: 'text-blue-700',   bg: 'bg-blue-600 text-white' },
  escalated:    { label: 'ESCALATED',    color: 'text-violet-700', bg: 'bg-violet-600 text-white' },
  closed:       { label: 'CLOSED',       color: 'text-emerald-700',bg: 'bg-emerald-600 text-white' },
};

// ─── ACK SLA Timer ─────────────────────────────────────────────────────────────
function AckTimer({ detectedAt, slaMinutes, status }: { detectedAt: string; slaMinutes: number; status: AlertStatus }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== 'open') return;
    const start = new Date(detectedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [detectedAt, status]);

  if (status !== 'open') return null;

  const slaSecs = slaMinutes * 60;
  const remaining = slaSecs - elapsed;
  const pct = Math.min(100, (elapsed / slaSecs) * 100);
  const isBreached = remaining <= 0;
  const isWarn = remaining <= 30 && remaining > 0;  // < 30s

  const fmt = (s: number) => {
    const abs = Math.abs(s);
    const m = Math.floor(abs / 60);
    const sec = abs % 60;
    return `${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  };

  return (
    <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-[11px] font-bold ${
      isBreached 
        ? 'bg-rose-100 border-rose-300 text-rose-900 font-extrabold shadow-sm' 
        : isWarn 
          ? 'bg-amber-100 border-amber-300 text-amber-900 animate-pulse' 
          : 'bg-blue-50 border-blue-200 text-blue-900'
    }`}>
      <Timer className={`w-4 h-4 shrink-0 ${isBreached ? 'text-rose-600 animate-bounce' : isWarn ? 'text-amber-600' : 'text-blue-600'}`} />
      <div className="flex-1 min-w-0">
        <div className="uppercase tracking-wide">
          {isBreached ? `SLA Phản hồi: ĐÃ QUÁ HẠN +${fmt(elapsed - slaSecs)}` : `SLA Phản hồi: ${fmt(remaining)} còn lại`}
        </div>
        <div className="h-1 w-full bg-slate-200/60 rounded-full mt-1.5 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${isBreached ? 'bg-rose-600' : isWarn ? 'bg-amber-500' : 'bg-blue-600'}`}
            style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Alert Card ─────────────────────────────────────────────────────────────────
function AlertCard({
  alert,
  onAcknowledge,
  onAddAction,
  onToggleAction,
  onUpdateNote,
  onEscalate,
  onClose,
  onOpenPatient,
  onNotifyPhysician,
}: {
  alert: SafetyAlert;
  onAcknowledge: (id: string) => void;
  onAddAction: (id: string) => void;
  onToggleAction: (id: string, action: ActionTaken) => void;
  onUpdateNote: (id: string, note: string) => void;
  onEscalate: (id: string) => void;
  onClose: (id: string) => void;
  onOpenPatient: (mrn: string, bed: string) => void;
  onNotifyPhysician: (alertId: string, patientName: string, message: string) => void;
}) {
  const [expanded, setExpanded] = useState(alert.status === 'open');
  const [showActions, setShowActions] = useState(false);
  const srcCfg = SOURCE_CFG[alert.source];
  const SourceIcon = srcCfg.icon;
  const statusCfg = STATUS_CFG[alert.status];
  const isCritical = alert.severity === 'critical';
  const isOpen = alert.status === 'open';
  const isClosed = alert.status === 'closed';

  const severityBorder: Record<AlertSeverity, string> = {
    critical: 'border-rose-400 bg-rose-50',
    high: 'border-amber-300 bg-amber-50/60',
    warning: 'border-yellow-300 bg-yellow-50/40',
  };

  return (
    <div className={`border-2 rounded-2xl overflow-hidden shadow-md transition-all ${
      isClosed ? 'opacity-60 border-slate-200 bg-slate-50' : severityBorder[alert.severity]
    }`}>
      {/* ── Card Header ── */}
      <div
        className={`px-4 py-3 flex items-start justify-between gap-3 cursor-pointer ${
          isCritical && isOpen ? 'bg-rose-700 text-white' :
          alert.severity === 'high' && isOpen ? 'bg-amber-600 text-white' :
          alert.severity === 'warning' && isOpen ? 'bg-yellow-400 text-slate-900' :
          'bg-slate-100 text-slate-700'
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Status + severity + what */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
              isClosed ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
              isOpen ? 'bg-white/20 text-white border-white/20' : statusCfg.bg
            }`}>
              {statusCfg.label}
            </span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
              alert.priority === 'P0' ? 'bg-rose-900/30 text-white' :
              alert.priority === 'P1' ? 'bg-amber-900/30 text-white' :
              'bg-white/10 text-white/80'
            }`}>
              {alert.priority}
            </span>
            <span className={`flex items-center gap-1 text-[9px] font-semibold ${
              isOpen && isCritical ? 'text-white/80' : 'text-slate-500'
            }`}>
              <SourceIcon className="w-3 h-3" />
              {srcCfg.label}
            </span>
            <span className={`text-[9px] ${isOpen && (isCritical || alert.severity === 'high') ? 'text-white/70' : 'text-slate-400'}`}>
              Rule: {alert.ruleId}
            </span>
          </div>
          <div className={`font-black text-sm leading-snug ${
            isOpen ? 'text-white' : 'text-slate-800'
          }`}>
            {alert.message}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 shrink-0 mt-0.5" /> : <ChevronDown className="w-4 h-4 shrink-0 mt-0.5" />}
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          {/* ── 5 Questions answered ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

            {/* Q1+Q2: Patient Context (persistent invariant) */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Bệnh nhân</div>
              <div className="font-black text-slate-900 text-sm">{alert.patient.name}</div>
              <div className="text-[11px] font-bold text-slate-600">{alert.patient.age}t · {alert.patient.gender} · {alert.patient.mrn}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                  {alert.patient.bed}
                </span>
                <span className="text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-0.5 rounded-full">
                  Ngày điều trị {alert.patient.daysAdmitted}
                </span>
                {alert.patient.allergies.map((a) => (
                  <span key={a} className="text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full">
                    ⚠ {a}
                  </span>
                ))}
              </div>
            </div>

            {/* Q3: Vital + Trend */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                {alert.vital.parameter} · Ngưỡng: {alert.vital.threshold}
              </div>
              <div className={`font-black text-2xl ${alert.vital.abnormal ? 'text-rose-700' : 'text-slate-800'}`}>
                {alert.vital.value}
                {alert.vital.abnormal && <TrendingDown className="inline w-5 h-5 ml-1 text-rose-500" />}
              </div>
              {alert.vital.previousValues.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                  <span className="font-bold text-slate-400">Xu hướng:</span>
                  {alert.vital.previousValues.map((v, i) => (
                    <React.Fragment key={i}>
                      <span className="font-bold">{v}</span>
                      <ArrowRight className="w-2.5 h-2.5 text-rose-300" />
                    </React.Fragment>
                  ))}
                  <span className="font-black text-rose-700">{alert.vital.value}</span>
                </div>
              )}
            </div>
          </div>

          {/* Detection + SLA */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 font-medium">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Detected: <strong className="text-slate-800 font-bold">{alert.detectedDisplay}</strong>
            </span>
            {alert.acknowledgedBy && (
              <span className="flex items-center gap-1 text-amber-800 font-bold">
                <UserCheck className="w-3.5 h-3.5" />
                ACK: <strong className="text-amber-900 font-black">{alert.acknowledgedBy}</strong> · {alert.acknowledgedAt}
              </span>
            )}
            {alert.owner && (
              <span className="flex items-center gap-1 text-blue-800 font-bold">
                <Stethoscope className="w-3.5 h-3.5" />
                Owner: <strong className="text-blue-900 font-black">{alert.owner}</strong>
              </span>
            )}
          </div>

          {/* ACK SLA timer — only for open */}
          {isOpen && (
            <AckTimer detectedAt={alert.detectedAt} slaMinutes={alert.ackSlaMinutes} status={alert.status} />
          )}

          {/* AI Assist — clearly separated from Clinical Fact */}
          {alert.aiAssist && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Brain className="w-3.5 h-3.5 text-violet-600" />
                <span className="text-[10px] font-black text-violet-700 uppercase">AI Assist — NOT a Clinical Diagnosis</span>
                <span className="ml-auto text-[9px] font-bold bg-violet-200 text-violet-800 px-1.5 py-0.5 rounded-full">
                  {alert.aiAssist.confidence}% confidence
                </span>
              </div>
              <p className="text-xs text-violet-700 leading-relaxed">{alert.aiAssist.summary}</p>
            </div>
          )}

          {/* ── Q5: Action Taken workflow ── */}
          {!isClosed && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-black text-slate-500 uppercase">Hành động đã thực hiện</div>
                <button
                  onClick={() => setShowActions(!showActions)}
                  className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <ClipboardList className="w-3 h-3" />
                  {showActions ? 'Ẩn' : 'Chọn hành động'}
                </button>
              </div>
              {showActions && (
                <div className="grid grid-cols-2 gap-1.5">
                  {ACTION_OPTIONS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-1.5 cursor-pointer text-[10px] font-semibold text-slate-700">
                      <input
                        type="checkbox"
                        checked={alert.actionsSelected.includes(key)}
                        onChange={() => onToggleAction(alert.id, key)}
                        className="w-3 h-3 accent-indigo-600"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}
              {alert.actionsSelected.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {alert.actionsSelected.map((a) => (
                    <span key={a} className="text-[9px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                      ✓ {ACTION_OPTIONS.find((o) => o.key === a)?.label}
                    </span>
                  ))}
                </div>
              )}
              <textarea
                rows={2}
                placeholder="Ghi chú lâm sàng (không bắt buộc)..."
                value={alert.actionNote}
                onChange={(e) => onUpdateNote(alert.id, e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
              />
            </div>
          )}

          {/* ── Audit Trail ── */}
          {alert.auditTrail.length > 0 && (
            <div className="border-l-2 border-slate-200 pl-3 space-y-2">
              {alert.auditTrail.map((entry, i) => (
                <div key={i} className="text-[10px]">
                  <span className="text-slate-400 font-mono mr-1.5">{entry.time}</span>
                  <span className="text-slate-500 mr-1">{entry.actor}:</span>
                  <span className="text-slate-700 font-semibold">{entry.action}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── Action Buttons (Q5: What to do next) ── */}
          {!isClosed && (
            <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-200">
              <button
                onClick={() => onAcknowledge(alert.id)}
                disabled={alert.status !== 'open'}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                {alert.status === 'open' ? 'Acknowledge' : 'Acknowledged ✓'}
              </button>
              <button
                onClick={() => onOpenPatient(alert.patient.mrn, alert.patient.bed)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all"
              >
                <Eye className="w-3.5 h-3.5" />
                Open Patient
              </button>
              <button
                onClick={() => onNotifyPhysician(alert.id, alert.patient.name, alert.message)}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                Notify Physician
              </button>
              {(alert.status === 'acknowledged' || alert.status === 'reported') && (
                <button
                  onClick={() => onEscalate(alert.id)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition-all"
                >
                  <Siren className="w-3.5 h-3.5" />
                  Escalate
                </button>
              )}
              {alert.status !== 'open' && (
                <button
                  onClick={() => onClose(alert.id)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all ml-auto"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Close Alert
                </button>
              )}
            </div>
          )}

          {/* Closed: Resolution summary */}
          {isClosed && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-700 font-semibold">
              ✓ Alert resolved — {alert.actionNote}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
function ClinicalSafetyContent() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<SafetyAlert[]>(INITIAL_ALERTS);
  const [liveTime, setLiveTime] = useState('');

  useEffect(() => {
    const tick = () => setLiveTime(new Date().toLocaleTimeString('vi-VN', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Alert groups
  const needsAction  = alerts.filter((a) => a.status === 'open');
  const acknowledged = alerts.filter((a) => a.status === 'acknowledged' || a.status === 'reported' || a.status === 'escalated');
  const resolved     = alerts.filter((a) => a.status === 'closed');

  // Stats
  const criticalOpen = needsAction.filter((a) => a.severity === 'critical').length;
  const totalAlerts  = alerts.filter((a) => a.status !== 'closed').length;

  // Handlers
  const handleAcknowledge = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const now = new Date().toLocaleTimeString('vi-VN');
      return {
        ...a,
        status: 'acknowledged' as AlertStatus,
        acknowledgedBy: 'Điều dưỡng trực',
        acknowledgedAt: now,
        auditTrail: [...a.auditTrail, { time: now, actor: 'Điều dưỡng trực', action: 'ACKNOWLEDGED' }],
      };
    }));
  }, []);

  const handleEscalate = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const now = new Date().toLocaleTimeString('vi-VN');
      return {
        ...a,
        status: 'escalated' as AlertStatus,
        auditTrail: [...a.auditTrail, { time: now, actor: 'Điều dưỡng trực', action: 'ESCALATED — Chuyển cấp bác sĩ trực khoa' }],
      };
    }));
  }, []);

  const handleClose = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const now = new Date().toLocaleTimeString('vi-VN');
      return {
        ...a,
        status: 'closed' as AlertStatus,
        auditTrail: [...a.auditTrail, { time: now, actor: 'Điều dưỡng trực', action: 'CLOSED — Alert resolved' }],
      };
    }));
  }, []);

  const handleToggleAction = useCallback((id: string, action: ActionTaken) => {
    setAlerts((prev) => prev.map((a) => {
      if (a.id !== id) return a;
      const has = a.actionsSelected.includes(action);
      return { ...a, actionsSelected: has ? a.actionsSelected.filter((x) => x !== action) : [...a.actionsSelected, action] };
    }));
  }, []);

  const handleUpdateNote = useCallback((id: string, note: string) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, actionNote: note } : a));
  }, []);

  const handleOpenPatient = useCallback((mrn: string, bed: string) => {
    // Navigate to admissions page with patient filter
    router.push(`/dashboard/hospital/admissions?search=${mrn}`);
  }, [router]);
    // Option 2: Navigate to admissions page and scroll to patient
    router.push(`/dashboard/hospital/admissions?mrn=${mrn}&highlight=true`);
    
    // Note: Alert dialog removed - now directly navigates
  }, [router]);

  const handleNotifyPhysician = useCallback((alertId: string, patientName: string, message: string) => {
    const now = new Date().toLocaleTimeString('vi-VN');
    
    // Update alert audit trail
    setAlerts((prev) => prev.map((a) => {
      if (a.id !== alertId) return a;
      return {
        ...a,
        auditTrail: [
          ...a.auditTrail,
          { 
            time: now, 
            actor: 'Hệ thống thông báo', 
            action: 'PHYSICIAN NOTIFIED — Gửi cảnh báo tới bác sĩ trực qua SMS + App' 
          }
        ],
        actionsSelected: a.actionsSelected.includes('physician_notified') 
          ? a.actionsSelected 
          : [...a.actionsSelected, 'physician_notified']
      };
    }));

    // Show success notification
    alert(
      `✅ Đã gửi thông báo tới Bác sĩ trực\n\n` +
      `Bệnh nhân: ${patientName}\n` +
      `Cảnh báo: ${message}\n` +
      `Thời gian: ${now}\n\n` +
      `Kênh gửi:\n` +
      `- SMS hotline\n` +
      `- Push notification (App)\n` +
      `- Email backup`
    );

    // In real app: Call notification API
    // await NotificationService.notifyPhysician({ alertId, patientName, message });
  }, []);

  const commonCardProps = {
    onAcknowledge: handleAcknowledge,
    onAddAction: () => undefined,
    onToggleAction: handleToggleAction,
    onUpdateNote: handleUpdateNote,
    onEscalate: handleEscalate,
    onClose: handleClose,
    onOpenPatient: handleOpenPatient,
    onNotifyPhysician: handleNotifyPhysician,
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="bg-slate-950 text-white rounded-2xl px-6 py-4 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">
              Bella Hospital · Clinical Safety Alert Center
            </span>
            <div className="flex items-center gap-1.5 ml-2 px-2.5 py-0.5 rounded-full border border-emerald-700 bg-emerald-950/50 text-[9px] font-bold text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              LIVE · {liveTime}
            </div>
          </div>
          <h1 className="text-xl md:text-2xl font-black !text-white">Cảnh Báo An Toàn Lâm Sàng</h1>
          <p className="text-[11px] text-slate-300 mt-0.5 font-medium">
            Detect → Understand → Acknowledge → Act → Escalate → Resolve → Audit
          </p>
        </div>
        {/* Alert summary pills */}
        <div className="flex gap-2 shrink-0 flex-wrap">
          {criticalOpen > 0 && (
            <div className="flex items-center gap-2 bg-rose-900/60 border border-rose-700 rounded-xl px-3 py-2">
              <Siren className="w-4 h-4 text-rose-400 animate-pulse" />
              <div>
                <div className="text-lg font-black text-rose-300">{criticalOpen}</div>
                <div className="text-[9px] text-rose-400 font-bold uppercase">P0 Critical</div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 bg-amber-900/40 border border-amber-800 rounded-xl px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-lg font-black text-amber-300">{needsAction.length}</div>
              <div className="text-[9px] text-amber-400 font-bold uppercase">Needs Action</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2">
            <Bell className="w-4 h-4 text-slate-400" />
            <div>
              <div className="text-lg font-black text-slate-300">{totalAlerts}</div>
              <div className="text-[9px] text-slate-500 font-bold uppercase">Total Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main 2-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* LEFT: Attention Queue (2/3) */}
        <div className="lg:col-span-2 space-y-5">

          {/* GROUP 1: NEEDS IMMEDIATE ACTION */}
          <div className="space-y-3">
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${
              needsAction.length > 0 ? 'bg-rose-950 border-rose-800' : 'bg-emerald-950 border-emerald-800'
            }`}>
              {needsAction.length > 0
                ? <Siren className="w-4 h-4 text-rose-400 animate-pulse" />
                : <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              }
              <span className={`text-xs font-black uppercase ${needsAction.length > 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                {needsAction.length > 0 ? `Cần xử lý ngay` : 'Không có cảnh báo mới'}
              </span>
              <span className={`ml-auto text-xs font-black px-2 py-0.5 rounded-full ${
                needsAction.length > 0 ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-900 text-emerald-400'
              }`}>
                {needsAction.length}
              </span>
            </div>
            {needsAction.length === 0 && (
              <div className="p-8 border-2 border-dashed border-emerald-200 rounded-2xl flex flex-col items-center justify-center bg-emerald-50/50">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />
                <div className="text-sm font-black text-emerald-700">Tất cả cảnh báo đã được xử lý</div>
                <p className="text-xs text-emerald-500 mt-1">Clinical Safety Surface — All clear</p>
              </div>
            )}
            {needsAction.map((alert) => (
              <AlertCard key={alert.id} alert={alert} {...commonCardProps} />
            ))}
          </div>

          {/* GROUP 2: ACKNOWLEDGED */}
          {acknowledged.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-amber-950/40 border-amber-800">
                <UserCheck className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase text-amber-300">Đã Xác Nhận — Đang Xử Lý</span>
                <span className="ml-auto text-xs font-black bg-amber-700 text-white px-2 py-0.5 rounded-full">{acknowledged.length}</span>
              </div>
              {acknowledged.map((alert) => (
                <AlertCard key={alert.id} alert={alert} {...commonCardProps} />
              ))}
            </div>
          )}

          {/* GROUP 3: RESOLVED */}
          {resolved.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-slate-100 border-slate-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-semibold text-slate-500 uppercase">Đã Đóng / Resolved</span>
                <span className="ml-auto text-xs font-black bg-slate-300 text-slate-700 px-2 py-0.5 rounded-full">{resolved.length}</span>
              </div>
              {resolved.map((alert) => (
                <AlertCard key={alert.id} alert={alert} {...commonCardProps} />
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Safety Domains + Event Stream (1/3) */}
        <div className="space-y-4">

          {/* Safety Domains */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-black text-slate-700 uppercase">Trạng Thái Phân Hệ An Toàn</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {SAFETY_DOMAINS.map((d) => (
                <div key={d.name} className={`px-4 py-3 flex items-center justify-between text-xs transition-all hover:bg-slate-50 ${d.status === 'alert' ? 'bg-amber-50/40' : ''}`}>
                  <span className={`font-bold ${d.status === 'alert' ? 'text-amber-900' : 'text-slate-700'}`}>{d.name}</span>
                  <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                    d.status === 'alert' ? 'bg-amber-100 text-amber-800 border-amber-300 font-extrabold' : 'bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold'
                  }`}>
                    {d.status === 'alert' ? `${d.alertCount} Alert` : 'Normal'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Alert Lifecycle explanation */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-wider">
              <Info className="w-4 h-4 text-indigo-600" />
              Quy Trình Xử Lý Cảnh Báo
            </div>
            <div className="space-y-2">
              {[
                { status: 'open' as const, desc: 'Cảnh báo mới kích hoạt, chưa có ai tiếp nhận' },
                { status: 'acknowledged' as const, desc: 'Điều dưỡng trực đã xác nhận nhận biết tín hiệu' },
                { status: 'reported' as const, desc: 'Bác sĩ trực/người liên quan đã được thông báo' },
                { status: 'escalated' as const, desc: 'Tình huống nguy kịch vượt ngưỡng, chuyển cấp cứu ICU' },
                { status: 'closed' as const, desc: 'Sự cố kết thúc, sinh hiệu bệnh nhân đã ổn định trở lại' },
              ].map(({ status, desc }) => {
                const cfg = STATUS_CFG[status];
                return (
                  <div key={status} className="flex items-start gap-2.5 text-[11px] leading-relaxed">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shrink-0 border uppercase font-mono ${cfg.bg}`}>
                      {cfg.label}
                    </span>
                    <span className="text-slate-600 font-semibold">{desc}</span>
                  </div>
                );
              })}
            </div>
            <div className="pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 italic font-medium">
              * ACK (Xác nhận) chỉ có nghĩa đã nhận biết tín hiệu, sự cố chỉ đóng (CLOSED) khi lâm sàng an toàn.
            </div>
          </div>

          {/* Recent Event Stream */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-black text-slate-700 uppercase">Safety Event Stream</h3>
              <span className="ml-auto text-[9px] text-slate-400">Real-time</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {alerts.flatMap((a) => a.auditTrail.map((e) => ({ ...e, alertId: a.id, severity: a.severity })))
                .sort((a, b) => b.time.localeCompare(a.time))
                .slice(0, 12)
                .map((e, i) => (
                  <div key={i} className="px-4 py-2 flex items-start gap-2 text-[10px]">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                      e.severity === 'critical' ? 'bg-rose-500' :
                      e.severity === 'high' ? 'bg-amber-500' : 'bg-yellow-400'
                    }`} />
                    <span className="text-slate-400 font-mono shrink-0">{e.time}</span>
                    <span className="text-slate-600">{e.action}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClinicalSafetyCommandCenter() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-xs font-bold text-slate-500">Đang tải Clinical Safety Center...</div>}>
      <ClinicalSafetyContent />
    </Suspense>
  );
}
