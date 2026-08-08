'use client';

/**
 * Bella General Hospital — Incident Management Center (v2)
 *
 * Architecture layer:
 *   Clinical Event Engine → Safety Alert → Incident → RCA → CAPA → Effectiveness → Quality Intelligence
 *
 * Key design decisions (frozen):
 * - Alert ≠ Incident (alert is signal; incident is downstream formal record)
 * - Severity ≠ Priority ≠ Harm (three independent dimensions)
 * - SLA is measured from detection → acknowledgement
 * - Event stream is immutable clinical black box
 * - AI suggests only; humans approve + own
 *
 * Data model:
 *   Incident { status, severity, priority, harmLevel, patientRisk, operationalImpact,
 *              slaMinutes, detectedAt, acknowledgedAt, investigatingAt, closedAt,
 *              reporter, owner, investigator, capaOwner,
 *              immediateActions, rootCause, capaItems, eventStream }
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, ShieldAlert, FileText, ClipboardList,
  Search, Filter, ChevronDown, Clock, User, Bed, CheckCircle2, Circle,
  XCircle, Activity, Pill, Wrench, PersonStanding, Stethoscope,
  CalendarDays, TrendingDown, BarChart3, ChevronRight, ArrowRight,
  Timer, Flame, UserCheck, MessageSquare, ArrowUpCircle, ZapOff,
  GitBranch, Layers, Brain, Shield, X, Plus, AlertOctagon,
  HeartPulse, FlaskConical, Scan, Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type IncidentCategory = 'fall' | 'medication_error' | 'near_miss' | 'procedure_complication' | 'equipment_failure' | 'infection' | 'other';
type IncidentSeverity  = 'sentinel' | 'serious' | 'moderate' | 'minor' | 'near_miss';
type IncidentPriority  = 'P1' | 'P2' | 'P3' | 'P4';
type HarmLevel         = 'H0' | 'H1' | 'H2' | 'H3' | 'H4' | 'H5';
type PatientRisk       = 'critical' | 'high' | 'medium' | 'low';
type IncidentStatus    = 'open' | 'investigating' | 'rca' | 'capa' | 'closed';

type ClinicalEventType = 'detected' | 'acknowledged' | 'assigned' | 'action' | 'clinical' | 'escalated' | 'resolved' | 'note' | 'rca' | 'capa';

interface ClinicalEvent {
  time: string;   // ISO
  type: ClinicalEventType;
  actor: string;
  description: string;
  source?: string;
  value?: string;
}

interface CAPAItem {
  id: string;
  action: string;
  owner: string;
  dueDate: string;
  done: boolean;
  verifiedAt?: string;
}

interface Incident {
  id: string;
  detectedAt: string;
  acknowledgedAt?: string;
  assignedAt?: string;
  investigatingAt?: string;
  closedAt?: string;

  category: IncidentCategory;
  severity: IncidentSeverity;
  priority: IncidentPriority;
  harmLevel: HarmLevel;
  patientRisk: PatientRisk;
  operationalImpact: 'high' | 'medium' | 'low';

  status: IncidentStatus;

  patientId: string;
  patientName: string;
  patientAge: number;
  ward: string;
  department: string;

  reporter: string;
  owner?: string;
  investigator?: string;
  capaOwner?: string;

  title: string;
  description: string;
  immediateActions: string[];
  rootCauseCategory?: string;
  rootCause?: string;
  contributingFactors?: string;
  capaItems: CAPAItem[];
  eventStream: ClinicalEvent[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

const PRIORITY_CFG: Record<IncidentPriority, { label: string; slaMins: number; color: string; bg: string; border: string; ring: string }> = {
  P1: { label: 'P1',  slaMins: 15,  color: 'text-red-700',    bg: 'bg-red-600',    border: 'border-red-500',    ring: 'ring-red-500' },
  P2: { label: 'P2',  slaMins: 30,  color: 'text-orange-700', bg: 'bg-orange-500', border: 'border-orange-400', ring: 'ring-orange-400' },
  P3: { label: 'P3',  slaMins: 60,  color: 'text-amber-700',  bg: 'bg-amber-400',  border: 'border-amber-300',  ring: 'ring-amber-400' },
  P4: { label: 'P4',  slaMins: 240, color: 'text-blue-700',   bg: 'bg-blue-500',   border: 'border-blue-400',   ring: 'ring-blue-400' },
};

const SEVERITY_CFG: Record<IncidentSeverity, { label: string; color: string; bg: string }> = {
  sentinel:  { label: 'Sentinel',     color: 'text-red-700',    bg: 'bg-red-100' },
  serious:   { label: 'Nghiêm trọng', color: 'text-rose-700',   bg: 'bg-rose-100' },
  moderate:  { label: 'Trung bình',   color: 'text-orange-700', bg: 'bg-orange-100' },
  minor:     { label: 'Nhẹ',          color: 'text-amber-700',  bg: 'bg-amber-100' },
  near_miss: { label: 'Near Miss',    color: 'text-blue-700',   bg: 'bg-blue-100' },
};

const HARM_CFG: Record<HarmLevel, { label: string; desc: string; color: string }> = {
  H0: { label: 'H0', desc: 'Không tổn hại',         color: 'text-slate-500' },
  H1: { label: 'H1', desc: 'Tổn hại tạm thời nhẹ',  color: 'text-amber-600' },
  H2: { label: 'H2', desc: 'Cần can thiệp',          color: 'text-orange-600' },
  H3: { label: 'H3', desc: 'Tổn hại kéo dài',        color: 'text-red-600' },
  H4: { label: 'H4', desc: 'Đe dọa tính mạng',       color: 'text-red-800' },
  H5: { label: 'H5', desc: 'Tử vong',                color: 'text-black' },
};

const RISK_CFG: Record<PatientRisk, { label: string; color: string }> = {
  critical: { label: 'Nguy kịch',    color: 'text-red-700' },
  high:     { label: 'Cao',          color: 'text-orange-700' },
  medium:   { label: 'Trung bình',   color: 'text-amber-700' },
  low:      { label: 'Thấp',         color: 'text-slate-500' },
};

const STATUS_CFG: Record<IncidentStatus, { label: string; color: string; bg: string; step: number }> = {
  open:          { label: 'Mới mở',     color: 'text-red-700',     bg: 'bg-red-50',     step: 1 },
  investigating: { label: 'Điều tra',   color: 'text-orange-700',  bg: 'bg-orange-50',  step: 2 },
  rca:           { label: 'RCA',        color: 'text-blue-700',    bg: 'bg-blue-50',    step: 3 },
  capa:          { label: 'CAPA',       color: 'text-purple-700',  bg: 'bg-purple-50',  step: 4 },
  closed:        { label: 'Đã đóng',    color: 'text-emerald-700', bg: 'bg-emerald-50', step: 5 },
};

const CATEGORY_CFG: Record<IncidentCategory, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  fall:                   { label: 'Ngã bệnh nhân',        icon: PersonStanding, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  medication_error:       { label: 'Sai sót thuốc',        icon: Pill,           color: 'text-rose-700',   bg: 'bg-rose-50 border-rose-200' },
  near_miss:              { label: 'Near Miss',             icon: AlertTriangle,  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  procedure_complication: { label: 'Biến chứng thủ thuật', icon: Stethoscope,    color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  equipment_failure:      { label: 'Sự cố thiết bị',       icon: Wrench,         color: 'text-slate-700',  bg: 'bg-slate-50 border-slate-200' },
  infection:              { label: 'Nhiễm khuẩn BV',       icon: Activity,       color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  other:                  { label: 'Khác',                  icon: FileText,       color: 'text-slate-500',  bg: 'bg-slate-50 border-slate-200' },
};

const EVENT_CFG: Record<ClinicalEventType, { icon: React.ElementType; color: string }> = {
  detected:     { icon: AlertOctagon, color: 'text-red-600' },
  acknowledged: { icon: UserCheck,    color: 'text-orange-600' },
  assigned:     { icon: User,         color: 'text-blue-600' },
  action:       { icon: Zap,          color: 'text-emerald-600' },
  clinical:     { icon: HeartPulse,   color: 'text-violet-600' },
  escalated:    { icon: ArrowUpCircle,color: 'text-red-700' },
  resolved:     { icon: CheckCircle2, color: 'text-emerald-700' },
  note:         { icon: MessageSquare,color: 'text-slate-600' },
  rca:          { icon: GitBranch,    color: 'text-blue-700' },
  capa:         { icon: Layers,       color: 'text-purple-700' },
};

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const NOW_BASE = new Date('2026-08-08T09:00:00');
function minsAgo(mins: number) {
  return new Date(NOW_BASE.getTime() - mins * 60 * 1000).toISOString();
}

const MOCK_INCIDENTS: Incident[] = [
  {
    id: 'INC-2026-0041',
    detectedAt:       minsAgo(158),
    acknowledgedAt:   minsAgo(155),
    assignedAt:       minsAgo(153),
    investigatingAt:  minsAgo(148),
    category: 'medication_error',
    severity: 'serious',
    priority: 'P1',
    harmLevel: 'H2',
    patientRisk: 'high',
    operationalImpact: 'high',
    status: 'rca',
    patientId: 'pat-003',
    patientName: 'Nguyễn Văn Bình',
    patientAge: 58,
    ward: 'ICU-BED-03',
    department: 'Hồi sức tích cực',
    reporter: 'ĐD. Nguyễn Lan Anh',
    owner: 'BS. Trưởng Khoa ICU',
    investigator: 'PGS.TS. Lê Minh Khoa',
    capaOwner: 'DS. Vũ Thị Thảo',
    title: 'Tiêm Norepinephrine sai liều — vượt 2x y lệnh',
    description: 'BN nhận 0.2 mcg/kg/min thay vì 0.1 mcg/kg/min. Phát hiện sau 25 phút bởi ĐD. trưởng khi kiểm tra bơm tiêm. HA tăng 185/110 mmHg.',
    immediateActions: [
      'Giảm tốc độ bơm về đúng y lệnh ngay lập tức',
      'Báo BS. Lê Minh Khoa — đã có mặt tại ICU',
      'Monitor HA mỗi 5 phút',
      'Chụp ảnh bơm tiêm, ghi nhận toàn bộ MAR',
    ],
    rootCauseCategory: 'Human error',
    rootCause: 'Lỗi tính toán liều theo cân nặng. BN 68 kg nhưng điều dưỡng nhập 34 kg vào bơm tiêm thông minh. DERS chưa cấu hình ngưỡng đủ nhạy.',
    contributingFactors: 'Ca trực đêm, 1 ĐD phụ trách 3 giường ICU. Bơm tiêm không có double-check bắt buộc cho vasoactive.',
    capaItems: [
      { id: 'c1', action: 'Kiểm tra cấu hình weight-based dosing trên tất cả bơm tiêm ICU', owner: 'DS. Vũ Thị Thảo', dueDate: '2026-08-10', done: false },
      { id: 'c2', action: 'Đào tạo lại 5 Rights cho toàn bộ ĐD ICU', owner: 'ĐD. Trưởng Lan Anh', dueDate: '2026-08-12', done: false },
      { id: 'c3', action: 'Bổ sung double-check bắt buộc trước mỗi lần chỉnh liều vasoactive', owner: 'PGS.TS. Lê Minh Khoa', dueDate: '2026-08-09', done: true },
    ],
    eventStream: [
      { time: minsAgo(158), type: 'detected',     actor: 'MAR System',           description: 'Bơm tiêm báo liều vượt ngưỡng',                 source: 'MAR', value: '0.2 mcg/kg/min' },
      { time: minsAgo(155), type: 'acknowledged', actor: 'ĐD. Nguyễn Lan Anh',  description: 'Xác nhận sự cố — giảm tốc độ bơm về y lệnh' },
      { time: minsAgo(154), type: 'clinical',     actor: 'Nursing Vitals',       description: 'HA 185/110 mmHg → bắt đầu giảm về 162/98',      source: 'Vitals', value: 'BP 162/98' },
      { time: minsAgo(153), type: 'assigned',     actor: 'PGS.TS. Lê Minh Khoa',description: 'Nhận điều tra — có mặt ICU' },
      { time: minsAgo(148), type: 'action',       actor: 'PGS.TS. Lê Minh Khoa',description: 'Bắt đầu điều tra — review MAR, bơm tiêm, ca trực' },
      { time: minsAgo(80),  type: 'clinical',     actor: 'Nursing Vitals',       description: 'HA ổn định 128/82 mmHg',                         source: 'Vitals', value: 'BP 128/82' },
      { time: minsAgo(60),  type: 'rca',          actor: 'PGS.TS. Lê Minh Khoa',description: 'RCA initiated — root cause: weight entry error + DERS config gap' },
      { time: minsAgo(30),  type: 'capa',         actor: 'DS. Vũ Thị Thảo',     description: '3 CAPA items created — 1 đã thực hiện ngay' },
    ],
  },
  {
    id: 'INC-2026-0040',
    detectedAt:       minsAgo(610),
    acknowledgedAt:   minsAgo(607),
    assignedAt:       minsAgo(605),
    investigatingAt:  minsAgo(600),
    category: 'fall',
    severity: 'moderate',
    priority: 'P2',
    harmLevel: 'H1',
    patientRisk: 'medium',
    operationalImpact: 'medium',
    status: 'capa',
    patientId: 'pat-005',
    patientName: 'Trần Minh Phúc',
    patientAge: 68,
    ward: 'W2-BED-08',
    department: 'Nội khoa tổng hợp',
    reporter: 'ĐD. Phạm Thị Bình',
    owner: 'BS. Nguyễn Vân Khánh',
    investigator: 'ĐD. Phạm Thị Bình',
    capaOwner: 'ĐD. Trưởng Lan Anh',
    title: 'Bệnh nhân ngã khi tự đứng dậy đi vệ sinh — ca đêm',
    description: 'BN Trần Minh Phúc (68T, Morse Fall Score: 55 — nguy cơ cao) tự đứng dậy lúc 22:40 không gọi chuông. Trượt ngã đầu giường, chấn thương hông phải nhẹ. X-quang: không gãy.',
    immediateActions: [
      'Đỡ BN về giường, kiểm tra chấn thương',
      'X-quang hông phải — không gãy xương',
      'Thông báo thân nhân',
      'Bổ sung thanh chắn giường 2 bên',
    ],
    rootCauseCategory: 'Process',
    rootCause: 'BN có Morse ≥ 45 nhưng chưa đeo vòng nhận diện vàng. Chuông gọi đặt xa tầm tay.',
    contributingFactors: 'Ca đêm — ít nhân lực. BN không quen môi trường BV, không biết gọi chuông.',
    capaItems: [
      { id: 'c4', action: 'Tất cả BN Morse ≥ 45 đeo vòng vàng ngay khi nhập viện', owner: 'ĐD. Phạm Thị Bình', dueDate: '2026-08-08', done: true },
      { id: 'c5', action: 'Di chuyển chuông gọi về bàn tay thuận của BN', owner: 'ĐD. Hoàng Minh Tuấn', dueDate: '2026-08-08', done: true },
      { id: 'c6', action: 'Audit toàn bộ BN nguy cơ cao trong khoa Nội', owner: 'BS. Nguyễn Vân Khánh', dueDate: '2026-08-09', done: false },
    ],
    eventStream: [
      { time: minsAgo(610), type: 'detected',     actor: 'ĐD. Phạm Thị Bình',   description: 'Phát hiện BN ngã — hông phải đau' },
      { time: minsAgo(607), type: 'acknowledged', actor: 'ĐD. Phạm Thị Bình',   description: 'Báo cáo sự cố — đặt BN lên giường' },
      { time: minsAgo(600), type: 'action',       actor: 'BS. Nguyễn Vân Khánh',description: 'Khám lâm sàng — chỉ định X-quang' },
      { time: minsAgo(585), type: 'clinical',     actor: 'LIS',                  description: 'X-quang hông phải: không gãy xương', source: 'LIS' },
      { time: minsAgo(570), type: 'note',         actor: 'ĐD. Phạm Thị Bình',   description: 'Thông báo gia đình — ký biên bản' },
      { time: minsAgo(540), type: 'rca',          actor: 'ĐD. Phạm Thị Bình',   description: 'RCA: root cause là Morse vòng + chuông xa' },
      { time: minsAgo(480), type: 'capa',         actor: 'ĐD. Trưởng Lan Anh',  description: '3 CAPA items — 2 đã thực hiện ngay ca sáng' },
    ],
  },
  {
    id: 'INC-2026-0039',
    detectedAt:       minsAgo(900),
    acknowledgedAt:   minsAgo(899),
    closedAt:         minsAgo(810),
    category: 'near_miss',
    severity: 'near_miss',
    priority: 'P3',
    harmLevel: 'H0',
    patientRisk: 'low',
    operationalImpact: 'medium',
    status: 'closed',
    patientId: 'pat-008',
    patientName: 'Lê Thị Thu',
    patientAge: 44,
    ward: 'LIS-Lab',
    department: 'Xét nghiệm',
    reporter: 'KTV. Bùi Văn Hà',
    owner: 'TP. Xét nghiệm',
    investigator: 'KTV. Bùi Văn Hà',
    title: 'Gần phát nhầm mẫu xét nghiệm — phát hiện trước khi xử lý',
    description: 'Hai mẫu máu tên gần giống (Lê Thị Thu / Lê Thị Thúy) gần bị hoán đổi. KTV phát hiện qua barcode scan trước khi vào máy phân tích.',
    immediateActions: [
      'Dừng xử lý cả 2 mẫu',
      'Xác nhận lại qua bracelet BN',
      'Lấy mẫu lại cho cả 2 BN',
    ],
    rootCauseCategory: 'System',
    rootCause: 'Nhãn in font nhỏ, thiếu màu phân biệt. Tên 2 BN quá giống nhau.',
    capaItems: [
      { id: 'c7', action: 'Nâng cấp máy in nhãn LIS sang font lớn + màu theo khoa', owner: 'KTV. Bùi Văn Hà', dueDate: '2026-08-15', done: false },
      { id: 'c8', action: 'Scan bracelet BN trước khi nhận mẫu — bắt buộc', owner: 'PGS.TS. Lê Minh Khoa', dueDate: '2026-08-10', done: true, verifiedAt: '2026-08-08T09:00:00' },
    ],
    eventStream: [
      { time: minsAgo(900), type: 'detected',     actor: 'KTV. Bùi Văn Hà',     description: 'Barcode scan không khớp MPI — phát hiện nhầm mẫu', source: 'LIS' },
      { time: minsAgo(899), type: 'acknowledged', actor: 'KTV. Bùi Văn Hà',     description: 'Dừng xử lý — tách 2 mẫu ra' },
      { time: minsAgo(890), type: 'action',       actor: 'TP. Xét nghiệm',       description: 'Yêu cầu lấy mẫu lại cả 2 BN' },
      { time: minsAgo(810), type: 'resolved',     actor: 'TP. Xét nghiệm',       description: 'Sự cố đóng — không có tổn hại BN' },
    ],
    closedAt: minsAgo(810),
  },
  {
    id: 'INC-2026-0037',
    detectedAt:       minsAgo(53),
    category: 'equipment_failure',
    severity: 'serious',
    priority: 'P1',
    harmLevel: 'H1',
    patientRisk: 'critical',
    operationalImpact: 'high',
    status: 'investigating',
    patientId: 'pat-002',
    patientName: 'Phạm Thị Lan',
    patientAge: 72,
    ward: 'ICU-BED-02',
    department: 'Hồi sức tích cực',
    reporter: 'ĐD. Lê Quang Vinh',
    owner: 'Trưởng Kỹ Thuật',
    title: 'Máy thở ICU-VENT-02 lỗi "Flow Sensor Error" — ca đêm',
    description: 'Máy thở PB980 tại ICU-BED-02 lỗi lặp lại 3 lần trong 20 phút. BN chuyển sang máy dự phòng VENT-05. Engineering được thông báo.',
    immediateActions: [
      'Chuyển BN sang máy thở dự phòng ICU-VENT-05',
      'Kiểm tra SpO₂ và thông khí — BN ổn định',
      'Tag "DO NOT USE" trên VENT-02',
      'Báo Engineering + Biomedical team',
    ],
    capaItems: [],
    eventStream: [
      { time: minsAgo(53), type: 'detected',     actor: 'ICU Monitor',          description: 'VENT-02 Flow Sensor Error #1', source: 'ICU Monitor' },
      { time: minsAgo(50), type: 'clinical',     actor: 'ICU Monitor',          description: 'SpO₂ 94% → 91% (2 phút)', source: 'Vitals', value: 'SpO₂ 91%' },
      { time: minsAgo(48), type: 'action',       actor: 'ĐD. Lê Quang Vinh',   description: 'Chuyển sang VENT-05 dự phòng — BN ổn định' },
      { time: minsAgo(47), type: 'clinical',     actor: 'ICU Monitor',          description: 'SpO₂ phục hồi 96%', source: 'Vitals', value: 'SpO₂ 96%' },
      { time: minsAgo(45), type: 'acknowledged', actor: 'ĐD. Lê Quang Vinh',   description: 'Mở sự cố — gọi Engineering' },
      { time: minsAgo(38), type: 'assigned',     actor: 'Trưởng Kỹ Thuật',     description: 'Nhận điều tra — đang tới ICU' },
    ],
  },
];

// ─── SLA Timer ────────────────────────────────────────────────────────────────

function useSLATimer(detectedAt: string, acknowledgedAt: string | undefined, slaMinutes: number) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(detectedAt).getTime();
    const end = acknowledgedAt ? new Date(acknowledgedAt).getTime() : Date.now();
    const tick = () => {
      const now = acknowledgedAt ? new Date(acknowledgedAt).getTime() : Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    };
    tick();
    if (!acknowledgedAt) {
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }
  }, [detectedAt, acknowledgedAt]);

  const slaSeconds = slaMinutes * 60;
  const remaining = slaSeconds - elapsed;
  const breached = elapsed > slaSeconds;
  const pct = Math.min((elapsed / slaSeconds) * 100, 100);

  const fmt = (s: number) => {
    const abs = Math.abs(s);
    const m = Math.floor(abs / 60).toString().padStart(2, '0');
    const sec = (abs % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  return { elapsed, remaining, breached, pct, fmtElapsed: fmt(elapsed), fmtRemaining: fmt(remaining) };
}

// ─── SLA Badge ────────────────────────────────────────────────────────────────

function SLABadge({ incident }: { incident: Incident }) {
  const { breached, pct, fmtElapsed, fmtRemaining, remaining } = useSLATimer(
    incident.detectedAt, incident.acknowledgedAt, PRIORITY_CFG[incident.priority].slaMins
  );

  if (incident.status === 'closed') return null;
  if (incident.acknowledgedAt && incident.status !== 'open') {
    // Show acknowledged time
    const elapsed = Math.floor((new Date(incident.acknowledgedAt).getTime() - new Date(incident.detectedAt).getTime()) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    return (
      <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold">
        <Timer className="w-3 h-3" />
        ACK {String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')} / SLA {PRIORITY_CFG[incident.priority].slaMins}m
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 text-[10px] font-bold ${breached ? 'text-red-700' : 'text-slate-600'}`}>
      {breached ? (
        <span className="flex items-center gap-1 bg-red-100 border border-red-300 rounded-full px-2 py-0.5 animate-pulse">
          <AlertOctagon className="w-3 h-3" />
          SLA BREACHED +{fmtElapsed}
        </span>
      ) : (
        <span className={`flex items-center gap-1 ${remaining < 120 ? 'text-orange-700' : 'text-slate-600'}`}>
          <Timer className="w-3 h-3" />
          Còn {fmtRemaining} / {PRIORITY_CFG[incident.priority].slaMins}m SLA
        </span>
      )}
    </div>
  );
}

// ─── Status Pipeline ──────────────────────────────────────────────────────────

function StatusPipeline({ current }: { current: IncidentStatus }) {
  const steps: IncidentStatus[] = ['open', 'investigating', 'rca', 'capa', 'closed'];
  const currentStep = STATUS_CFG[current].step;
  return (
    <div className="flex items-center">
      {steps.map((s, i) => {
        const cfg = STATUS_CFG[s];
        const isDone   = cfg.step < currentStep;
        const isActive = cfg.step === currentStep;
        const isLast   = i === steps.length - 1;
        return (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black border-2 transition-all
                ${isDone   ? 'bg-emerald-500 border-emerald-500 text-white' : ''}
                ${isActive ? 'bg-blue-600 border-blue-600 text-white ring-2 ring-blue-200' : ''}
                ${!isDone && !isActive ? 'bg-slate-100 border-slate-300 text-slate-400' : ''}
              `}>{cfg.step}</div>
              <span className={`text-[8px] font-bold mt-0.5 whitespace-nowrap
                ${isActive ? 'text-blue-700' : isDone ? 'text-emerald-600' : 'text-slate-400'}
              `}>{cfg.label}</span>
            </div>
            {!isLast && (
              <div className={`h-0.5 w-5 mb-3 mx-0.5 ${isDone ? 'bg-emerald-400' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Incident Workspace (right panel) ────────────────────────────────────────

function IncidentWorkspace({ incident, onClose }: { incident: Incident; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'rca' | 'capa'>('overview');
  const priCfg = PRIORITY_CFG[incident.priority];
  const sevCfg = SEVERITY_CFG[incident.severity];
  const harmCfg = HARM_CFG[incident.harmLevel];
  const riskCfg = RISK_CFG[incident.patientRisk];
  const statusCfg = STATUS_CFG[incident.status];
  const catCfg = CATEGORY_CFG[incident.category];
  const CatIcon = catCfg.icon;

  const tabs = ['overview', 'timeline', 'rca', 'capa'] as const;
  const tabLabels: Record<typeof tabs[number], string> = { overview: 'Tổng quan', timeline: 'Timeline', rca: 'RCA', capa: 'CAPA' };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 overflow-hidden">
      {/* Workspace header */}
      <div className="bg-slate-950 text-white px-4 py-3 shrink-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[9px] font-black text-white/50 font-mono`}>{incident.id}</span>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full text-white ${priCfg.bg}`}>{priCfg.label} HIGH</span>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${sevCfg.bg} ${sevCfg.color}`}>{sevCfg.label}</span>
            </div>
            <div className="text-xs font-bold text-white/90 leading-tight">{incident.title}</div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0">
            <X className="w-4 h-4 text-white/60" />
          </button>
        </div>
        {/* 4 dimensions */}
        <div className="grid grid-cols-2 gap-1.5 mt-2">
          {[
            { label: 'Severity',    value: sevCfg.label,              color: sevCfg.color,    bg: sevCfg.bg },
            { label: 'Priority',    value: priCfg.label,              color: 'text-white',    bg: `${priCfg.bg} text-white` },
            { label: 'Patient Risk',value: riskCfg.label,             color: riskCfg.color,   bg: 'bg-white' },
            { label: 'Harm',        value: `${harmCfg.label} — ${harmCfg.desc.split(' ').slice(0,2).join(' ')}`, color: harmCfg.color, bg: 'bg-white' },
          ].map(d => (
            <div key={d.label} className={`rounded-lg px-2 py-1 ${d.bg}`}>
              <div className="text-[8px] font-black text-slate-500 uppercase">{d.label}</div>
              <div className={`text-[10px] font-black ${d.color}`}>{d.value}</div>
            </div>
          ))}
        </div>
        {/* SLA */}
        <div className="mt-2">
          <SLABadge incident={incident} />
        </div>
        {/* Status pipeline */}
        <div className="mt-2 bg-white/5 rounded-xl p-2">
          <StatusPipeline current={incident.status} />
        </div>
      </div>

      {/* Patient context banner */}
      <div className="bg-blue-950 px-4 py-2 flex items-center gap-3 border-b border-blue-900 shrink-0">
        <div>
          <div className="text-[10px] font-black text-blue-300">{incident.patientName} · {incident.patientAge}T</div>
          <div className="text-[9px] text-blue-400">{incident.ward} · {incident.department}</div>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[9px] text-blue-400">
          <span>Reporter: <span className="text-blue-200 font-bold">{incident.reporter}</span></span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 shrink-0 bg-slate-50">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-3 py-2 text-[10px] font-black uppercase transition-colors border-b-2
              ${activeTab === t ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── OVERVIEW TAB ── */}
        {activeTab === 'overview' && (
          <div className="p-4 space-y-4">
            {/* People */}
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase mb-2">Ownership</div>
              <div className="space-y-1.5">
                {[
                  { label: 'Reporter',     value: incident.reporter },
                  { label: 'Owner',        value: incident.owner },
                  { label: 'Investigator', value: incident.investigator },
                  { label: 'CAPA Owner',   value: incident.capaOwner },
                ].filter(r => r.value).map(r => (
                  <div key={r.label} className="flex justify-between text-[10px]">
                    <span className="text-slate-500 font-semibold">{r.label}</span>
                    <span className="font-bold text-slate-800">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase mb-2">Mô tả sự cố</div>
              <div className="text-[11px] text-slate-700 bg-slate-50 rounded-xl p-3 leading-relaxed border border-slate-200">{incident.description}</div>
            </div>

            {/* Immediate actions */}
            <div>
              <div className="text-[9px] font-black text-slate-400 uppercase mb-2">Hành động khẩn cấp</div>
              <div className="space-y-1">
                {incident.immediateActions.map((a, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                    {a}
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              {incident.status !== 'closed' && (
                <>
                  <button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold py-2 rounded-xl transition-colors">
                    <ArrowUpCircle className="w-3.5 h-3.5" /> Escalate sự cố
                  </button>
                  <button className="w-full flex items-center justify-center gap-2 border border-slate-300 text-slate-700 text-[11px] font-bold py-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" /> Thêm ghi chú
                  </button>
                  {incident.status === 'capa' && (
                    <button className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold py-2 rounded-xl transition-colors">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Đóng sự cố
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── TIMELINE TAB (Clinical Black Box) ── */}
        {activeTab === 'timeline' && (
          <div className="p-4">
            <div className="text-[9px] font-black text-slate-400 uppercase mb-3 flex items-center gap-1.5">
              <Activity className="w-3 h-3" /> Clinical Event Stream — Black Box
            </div>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
              <div className="space-y-3 ml-8">
                {incident.eventStream.map((ev, i) => {
                  const cfg = EVENT_CFG[ev.type];
                  const Icon = cfg.icon;
                  const t = new Date(ev.time);
                  const timeStr = t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  return (
                    <div key={i} className="relative">
                      <div className={`absolute -left-5 w-3 h-3 rounded-full border-2 border-white bg-white flex items-center justify-center`}
                        style={{ marginTop: '2px' }}>
                        <div className={`w-1.5 h-1.5 rounded-full ${ev.type === 'detected' ? 'bg-red-500' : ev.type === 'resolved' ? 'bg-emerald-500' : ev.type === 'clinical' ? 'bg-violet-500' : 'bg-slate-400'}`} />
                      </div>
                      <div className={`bg-slate-50 border border-slate-200 rounded-xl p-2.5 ${ev.type === 'detected' ? 'border-red-200 bg-red-50' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <Icon className={`w-3 h-3 ${cfg.color} shrink-0`} />
                            <span className="text-[10px] font-bold text-slate-700">{ev.description}</span>
                          </div>
                          {ev.value && (
                            <span className="text-[9px] font-black text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full shrink-0">{ev.value}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-mono text-slate-400 font-bold">{timeStr}</span>
                          <span className="text-[9px] text-slate-500">{ev.actor}</span>
                          {ev.source && (
                            <span className="text-[8px] text-indigo-600 bg-indigo-50 border border-indigo-200 px-1 py-0.5 rounded font-bold">{ev.source}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── RCA TAB ── */}
        {activeTab === 'rca' && (
          <div className="p-4 space-y-4">
            <div className="text-[9px] font-black text-slate-400 uppercase">Root Cause Analysis</div>

            {incident.rootCauseCategory ? (
              <>
                <div>
                  <div className="text-[9px] font-bold text-slate-500 mb-1">RCA Category</div>
                  <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-bold px-3 py-1.5 rounded-xl">
                    <GitBranch className="w-3.5 h-3.5" />
                    {incident.rootCauseCategory}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold text-slate-500 mb-1">Root Cause</div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 leading-relaxed">{incident.rootCause}</div>
                </div>
                {incident.contributingFactors && (
                  <div>
                    <div className="text-[9px] font-bold text-slate-500 mb-1">Contributing Factors</div>
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-[11px] text-orange-900 leading-relaxed">{incident.contributingFactors}</div>
                  </div>
                )}
                {/* RCA taxonomy visualization */}
                <div>
                  <div className="text-[9px] font-bold text-slate-500 mb-2">RCA Framework</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'People', active: incident.rootCauseCategory === 'Human error' },
                      { label: 'Process', active: incident.rootCauseCategory === 'Process' },
                      { label: 'System',  active: incident.rootCauseCategory === 'System' },
                      { label: 'Equipment', active: incident.rootCauseCategory === 'Equipment' },
                      { label: 'Communication', active: false },
                      { label: 'Environment', active: false },
                    ].map(c => (
                      <div key={c.label} className={`text-center py-2 rounded-xl border text-[9px] font-bold ${c.active ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                        {c.label}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
                <GitBranch className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <div className="text-xs font-bold text-slate-500 mb-1">RCA chưa được thực hiện</div>
                <div className="text-[10px] text-slate-400">Hoàn thành Investigation trước khi bắt đầu RCA</div>
              </div>
            )}

            {/* AI assist box */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-purple-600" />
                <span className="text-[10px] font-black text-purple-700 uppercase">AI Safety Assist — Suggestion Only</span>
              </div>
              <div className="text-[10px] text-purple-800 leading-relaxed">
                Dựa trên event stream và clinical context, AI gợi ý xem xét: <strong>workflow gap trong double-check protocol</strong> và <strong>DERS configuration threshold</strong>. Con người xác nhận và chịu trách nhiệm.
              </div>
              <div className="text-[9px] text-purple-500 mt-1.5 font-bold">AI đề xuất · Không phải clinical fact</div>
            </div>
          </div>
        )}

        {/* ── CAPA TAB ── */}
        {activeTab === 'capa' && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[9px] font-black text-slate-400 uppercase">Corrective &amp; Preventive Actions</div>
              <div className="text-[9px] text-slate-500 font-semibold">{incident.capaItems.filter(c => c.done).length}/{incident.capaItems.length} hoàn thành</div>
            </div>

            {incident.capaItems.length === 0 ? (
              <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center">
                <Layers className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <div className="text-xs font-bold text-slate-500">Chưa có CAPA</div>
                <div className="text-[10px] text-slate-400">Hoàn thành RCA trước khi tạo CAPA</div>
              </div>
            ) : (
              <>
                {/* CAPA control summary */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Quá hạn',  count: incident.capaItems.filter(c => !c.done && new Date(c.dueDate) < new Date()).length, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
                    { label: 'Đúng hạn', count: incident.capaItems.filter(c => !c.done && new Date(c.dueDate) >= new Date()).length, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                    { label: 'Xong',     count: incident.capaItems.filter(c => c.done).length, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                  ].map(s => (
                    <div key={s.label} className={`text-center p-2 rounded-xl border ${s.bg}`}>
                      <div className={`text-xl font-black ${s.color}`}>{s.count}</div>
                      <div className={`text-[8px] font-bold ${s.color}`}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* CAPA items */}
                <div className="space-y-2">
                  {incident.capaItems.map((capa, i) => (
                    <div key={capa.id} className={`p-3 rounded-xl border ${capa.done ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                      <div className="flex items-start gap-2">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${capa.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                          {i + 1}
                        </span>
                        {capa.done
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          : <Circle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        }
                        <div className="flex-1">
                          <div className={`text-[11px] font-semibold leading-tight ${capa.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{capa.action}</div>
                          <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-400">
                            <span>{capa.owner}</span>
                            <span>·</span>
                            <span className={capa.done ? 'text-emerald-600 font-bold' : 'text-slate-500'}>Hạn: {capa.dueDate}</span>
                          </div>
                          {capa.verifiedAt && (
                            <div className="text-[9px] text-emerald-600 font-bold mt-0.5">✓ Đã kiểm chứng hiệu quả</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Effectiveness block */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <div className="text-[10px] font-black text-indigo-700 mb-1">Effectiveness Check</div>
                  <div className="text-[10px] text-indigo-600">Kiểm chứng hiệu quả CAPA sau 30 ngày triển khai. Nếu incident tương tự không tái diễn → CAPA effective.</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IncidentManagementPage() {
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<IncidentCategory | 'all'>('all');
  const [workspace, setWorkspace] = useState<Incident | null>(null);

  const filtered = MOCK_INCIDENTS.filter(inc => {
    const matchSearch = search === '' || inc.title.toLowerCase().includes(search.toLowerCase()) || inc.patientName.toLowerCase().includes(search.toLowerCase()) || inc.id.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (filterSeverity === 'all' || inc.severity === filterSeverity) && (filterStatus === 'all' || inc.status === filterStatus) && (filterCategory === 'all' || inc.category === filterCategory);
  }).sort((a, b) => {
    const pOrder: Record<IncidentPriority, number> = { P1: 1, P2: 2, P3: 3, P4: 4 };
    if (a.status === 'closed' && b.status !== 'closed') return 1;
    if (b.status === 'closed' && a.status !== 'closed') return -1;
    return pOrder[a.priority] - pOrder[b.priority];
  });

  const openCount     = MOCK_INCIDENTS.filter(i => i.status === 'open').length;
  const activeCount   = MOCK_INCIDENTS.filter(i => !['closed'].includes(i.status)).length;
  const p1Count       = MOCK_INCIDENTS.filter(i => i.priority === 'P1' && i.status !== 'closed').length;
  const closedCount   = MOCK_INCIDENTS.filter(i => i.status === 'closed').length;
  const pendingCAPAs  = MOCK_INCIDENTS.flatMap(i => i.capaItems.filter(c => !c.done));
  const overdueCAPAs  = pendingCAPAs.filter(c => new Date(c.dueDate) < new Date());

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 md:p-6 flex-1 overflow-auto max-w-full">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* ── Header ── */}
          <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-red-950 text-white rounded-2xl px-6 py-5 shadow-xl border border-red-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">Bella Hospital · Patient Safety · Quality Management</span>
              </div>
              <h1 className="text-xl md:text-2xl font-black !text-white">Quản Lý Sự Cố Lâm Sàng</h1>
              <p className="text-[11px] text-slate-200 mt-0.5 font-medium">Incident Report · RCA · CAPA · Effectiveness Check · Quality Intelligence</p>
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              {[
                { v: openCount,   label: 'Mới mở',      bg: 'bg-red-900/50 border-red-700',     txt: 'text-red-300',     sub: 'text-red-200' },
                { v: activeCount, label: 'Đang xử lý',  bg: 'bg-orange-900/40 border-orange-700', txt: 'text-orange-300', sub: 'text-orange-200' },
                { v: p1Count,     label: 'P1 Active',   bg: 'bg-rose-900/40 border-rose-700',   txt: 'text-rose-300',    sub: 'text-rose-200' },
                { v: overdueCAPAs.length, label: 'CAPA Quá hạn', bg: 'bg-amber-900/30 border-amber-700', txt: overdueCAPAs.length > 0 ? 'text-amber-300' : 'text-emerald-300', sub: 'text-amber-200' },
                { v: closedCount, label: 'Đã đóng',     bg: 'bg-emerald-900/30 border-emerald-700', txt: 'text-emerald-300', sub: 'text-emerald-200' },
              ].map(k => (
                <div key={k.label} className={`border rounded-xl px-3 py-2 text-center ${k.bg}`}>
                  <div className={`text-xl font-black ${k.txt}`}>{k.v}</div>
                  <div className={`text-[9px] font-bold uppercase ${k.sub}`}>{k.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Category bar ── */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setFilterCategory('all')}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${filterCategory === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >Tất cả ({MOCK_INCIDENTS.length})</button>
            {(Object.keys(CATEGORY_CFG) as IncidentCategory[]).map(cat => {
              const cfg = CATEGORY_CFG[cat];
              const Icon = cfg.icon;
              const count = MOCK_INCIDENTS.filter(i => i.category === cat).length;
              if (count === 0) return null;
              return (
                <button key={cat} onClick={() => setFilterCategory(filterCategory === cat ? 'all' : cat)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all
                    ${filterCategory === cat ? `${cfg.bg} ring-2` : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                >
                  <Icon className={`w-3 h-3 ${cfg.color}`} />
                  {cfg.label} ({count})
                </button>
              );
            })}
          </div>

          {/* ── Content: List + Workspace ── */}
          <div className={`flex gap-5 ${workspace ? 'min-h-[600px]' : ''}`}>

            {/* Incident list */}
            <div className={`flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col`}>
              {/* Filter toolbar */}
              <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[140px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    placeholder="Tìm INC-ID, BN, tiêu đề..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                {[
                  { val: filterSeverity, set: setFilterSeverity, opts: Object.entries(SEVERITY_CFG).map(([v,c]) => ({ v, l: c.label })), placeholder: 'Severity' },
                  { val: filterStatus,   set: setFilterStatus,   opts: Object.entries(STATUS_CFG).map(([v,c]) => ({ v, l: c.label })),   placeholder: 'Status' },
                ].map((f, idx) => (
                  <div key={idx} className="relative">
                    <select value={f.val} onChange={e => (f.set as (v: string) => void)(e.target.value)}
                      className="pl-3 pr-6 py-1.5 text-xs border border-slate-200 rounded-xl appearance-none bg-white focus:outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="all">{f.placeholder}</option>
                      {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                  </div>
                ))}
                <span className="text-[10px] text-slate-400 ml-auto">{filtered.length} sự cố</span>
              </div>

              {/* Incident cards */}
              <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                {filtered.map(inc => {
                  const catCfg = CATEGORY_CFG[inc.category];
                  const CatIcon = catCfg.icon;
                  const sevCfg = SEVERITY_CFG[inc.severity];
                  const priCfg = PRIORITY_CFG[inc.priority];
                  const harmCfg = HARM_CFG[inc.harmLevel];
                  const statusCfg = STATUS_CFG[inc.status];
                  const isOpen = workspace?.id === inc.id;
                  const doneCapa = inc.capaItems.filter(c => c.done).length;

                  return (
                    <div key={inc.id}
                      className={`px-4 py-3 transition-all ${isOpen ? 'bg-blue-50 border-l-[3px] border-blue-600' : 'hover:bg-slate-50 border-l-[3px] border-transparent'}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Category icon + Priority dot */}
                        <div className="relative shrink-0 mt-0.5">
                          <div className={`p-2 rounded-xl border ${catCfg.bg}`}>
                            <CatIcon className={`w-4 h-4 ${catCfg.color}`} />
                          </div>
                          <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-black text-white ${priCfg.bg}`}>
                            {priCfg.label}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] font-black text-slate-400 font-mono">{inc.id}</span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${sevCfg.bg} ${sevCfg.color}`}>{sevCfg.label}</span>
                                <span className={`text-[9px] font-bold ${harmCfg.color}`}>{harmCfg.label}</span>
                              </div>
                              <div className="text-xs font-bold text-slate-800 leading-tight mt-0.5">{inc.title}</div>
                            </div>
                          </div>

                          {/* Meta */}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                            <span className="flex items-center gap-1 text-[10px] text-slate-500">
                              <Bed className="w-3 h-3" />{inc.ward} · {inc.patientName} · {inc.patientAge}T
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-slate-500">
                              <Clock className="w-3 h-3" />{new Date(inc.detectedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          </div>

                          {/* Status + SLA + CAPA */}
                          <div className="flex items-center justify-between mt-1.5 flex-wrap gap-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                                {statusCfg.label}
                              </span>
                              <SLABadge incident={inc} />
                            </div>
                            {inc.capaItems.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <div className="h-1 w-12 bg-slate-200 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(doneCapa / inc.capaItems.length) * 100}%` }} />
                                </div>
                                <span className="text-[9px] text-slate-400">CAPA {doneCapa}/{inc.capaItems.length}</span>
                              </div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="flex items-center gap-1.5 mt-2">
                            <button
                              onClick={() => setWorkspace(isOpen ? null : inc)}
                              className={`flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg border transition-all
                                ${isOpen ? 'bg-blue-600 text-white border-blue-600' : 'border-blue-300 text-blue-700 hover:bg-blue-50'}`}
                            >
                              <FileText className="w-3 h-3" /> Workspace
                            </button>
                            {inc.status !== 'closed' && (
                              <>
                                <button className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-all">
                                  <UserCheck className="w-3 h-3" /> Assign
                                </button>
                                <button className="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-lg border border-orange-300 text-orange-700 hover:bg-orange-50 transition-all">
                                  <ArrowUpCircle className="w-3 h-3" /> Escalate
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filtered.length === 0 && (
                  <div className="p-12 text-center text-slate-400 text-xs font-semibold">Không tìm thấy sự cố.</div>
                )}
              </div>
            </div>

            {/* Right: Workspace OR stats sidebar */}
            <div className={`${workspace ? 'w-[420px] lg:w-[460px]' : 'w-64'} shrink-0`}>
              {workspace ? (
                <div className="rounded-2xl overflow-hidden shadow-xl border border-slate-200 h-full flex flex-col">
                  <IncidentWorkspace incident={workspace} onClose={() => setWorkspace(null)} />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Trend */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-indigo-600" />
                      <span className="text-[10px] font-black uppercase text-slate-700">Xu Hướng Sự Cố</span>
                    </div>
                    <div className="p-4 space-y-2">
                      {[{ month: 'T6/2026', count: 8 }, { month: 'T7/2026', count: 11 }, { month: 'T8/2026', count: 5 }].map(({ month, count }) => (
                        <div key={month}>
                          <div className="flex justify-between text-[10px] font-semibold text-slate-600 mb-1"><span>{month}</span><span className="font-black">{count}</span></div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${count > 8 ? 'bg-rose-500' : count > 6 ? 'bg-orange-400' : 'bg-blue-500'}`} style={{ width: `${(count / 12) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                      <div className="pt-1 flex items-center gap-1 text-[10px] text-emerald-600 font-bold"><TrendingDown className="w-3.5 h-3.5" />Giảm 54.5% so với T7</div>
                    </div>
                  </div>

                  {/* CAPA Control */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3.5 border-b border-slate-100 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-600" />
                      <span className="text-[10px] font-black uppercase text-slate-700">CAPA Control</span>
                    </div>
                    <div className="p-3 grid grid-cols-2 gap-2">
                      {[
                        { label: 'Quá hạn',      count: overdueCAPAs.length, color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
                        { label: '< 7 ngày',     count: pendingCAPAs.filter(c => { const d = new Date(c.dueDate); const n = new Date(); return d >= n && (d.getTime() - n.getTime()) < 7*86400000; }).length, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
                        { label: 'Đúng hạn',     count: pendingCAPAs.filter(c => { const d = new Date(c.dueDate); const n = new Date(); return d >= n && (d.getTime() - n.getTime()) >= 7*86400000; }).length, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                        { label: 'Hoàn thành',   count: MOCK_INCIDENTS.flatMap(i => i.capaItems).filter(c => c.done).length, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                      ].map(s => (
                        <div key={s.label} className={`text-center p-2 rounded-xl border ${s.bg}`}>
                          <div className={`text-xl font-black ${s.color}`}>{s.count}</div>
                          <div className={`text-[9px] font-bold ${s.color}`}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Priority breakdown */}
                  <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3.5 border-b border-slate-100">
                      <span className="text-[10px] font-black uppercase text-slate-700">Active Incidents by Priority</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {(['P1','P2','P3','P4'] as IncidentPriority[]).map(p => {
                        const count = MOCK_INCIDENTS.filter(i => i.priority === p && i.status !== 'closed').length;
                        const cfg = PRIORITY_CFG[p];
                        return (
                          <div key={p} className="px-4 py-2.5 flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black text-white ${cfg.bg}`}>{p}</div>
                            <span className="text-[10px] text-slate-600 flex-1">{cfg.slaMins}m SLA</span>
                            <span className={`text-sm font-black ${count > 0 ? cfg.color : 'text-slate-300'}`}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
