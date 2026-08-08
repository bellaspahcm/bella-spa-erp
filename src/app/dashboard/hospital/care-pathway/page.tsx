'use client';

import React, { useState } from 'react';
import { PatientContextBar, BELLA_DEMO_PATIENT } from '@/components/hospital/PatientContextBar';
import {
  GitBranch,
  CheckCircle2,
  Clock,
  Circle,
  AlertCircle,
  ChevronRight,
  Pill,
  Stethoscope,
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  User,
  Users,
  Brain,
  Zap,
  ArrowRight,
  Timer,
  ClipboardCheck,
  HeartPulse,
  FlaskConical,
  Syringe,
  LogOut,
  CheckSquare,
  Square,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type MilestoneStatus = 'completed' | 'in_progress' | 'at_risk' | 'variance' | 'pending';
type ExceptionSeverity = 'critical' | 'high' | 'medium';
type DischargeItem = { label: string; done: boolean };

interface CarePathwayMilestone {
  id: string;
  phase: string;
  name: string;
  description: string;
  targetDay: number;
  actualDay: number | null;
  status: MilestoneStatus;
  responsible: string;
  icon: string;
}

interface ClinicalVarianceItem {
  id: string;
  severity: ExceptionSeverity;
  category: string;
  description: string;
  delta: string;
  status: 'open' | 'monitoring' | 'resolved';
}

interface ClinicalException {
  id: string;
  severity: ExceptionSeverity;
  title: string;
  detail: string;
  owner: string;
  dueTime: string;
  action: string;
}

interface NextAction {
  id: string;
  icon: string;
  label: string;
  dueIn: string;
  priority: 'urgent' | 'high' | 'normal';
  assignee: string;
}

interface CareTeamMember {
  role: string;
  name: string;
  icon: string;
}

interface CarePathwayCase {
  caseId: string;
  encounterId: string;
  patientName: string;
  dob: string;
  wardBed: string;
  pathwayName: string;
  drgCode: string;
  admittedAt: string;
  currentDay: number;
  targetLOS: number;
  attendingPhysician: string;
  milestones: CarePathwayMilestone[];
  varianceItems: ClinicalVarianceItem[];
  exceptions: ClinicalException[];
  nextActions: NextAction[];
  careTeam: CareTeamMember[];
  dischargeReadiness: { pct: number; items: DischargeItem[] };
  pathwayHealth: { label: string; status: 'ok' | 'warning' | 'critical'; detail: string }[];
  aiRecommendation: { finding: string; cause: string; suggestion: string; impact: string; decisionOwner: string } | null;
  varianceNotes: string[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_PATHWAYS: CarePathwayCase[] = [
  {
    caseId: 'cp-001',
    encounterId: 'ENC-HOS-2026-0887',
    patientName: 'Lê Thị Hương',
    dob: '1978-09-22',
    wardBed: 'NGOAI-BED-03',
    pathwayName: 'Phác đồ Viêm Ruột Thừa Cấp — Phẫu Thuật Nội Soi',
    drgCode: 'DRG-341',
    admittedAt: '2026-08-01',
    currentDay: 7,
    targetLOS: 5,
    attendingPhysician: 'BS.CKII Phạm Quốc Việt',
    milestones: [
      { id: 'ms-01', phase: 'Nhập viện', name: 'Tiếp nhận & Đánh giá ban đầu', description: 'Khám lâm sàng, siêu âm bụng, xét nghiệm máu', targetDay: 1, actualDay: 1, status: 'completed', responsible: 'BS. Cấp cứu', icon: 'stethoscope' },
      { id: 'ms-02', phase: 'Phẫu thuật', name: 'Cắt ruột thừa nội soi', description: 'Phẫu thuật nội soi 3 trocar, gây mê nội khí quản', targetDay: 1, actualDay: 1, status: 'completed', responsible: 'BS.CKII Phạm Quốc Việt', icon: 'stethoscope' },
      { id: 'ms-03', phase: 'Hậu phẫu', name: 'Theo dõi phòng hồi tỉnh (PACU)', description: 'Theo dõi sinh hiệu 2g, đánh giá tỉnh mê, đau sau mổ', targetDay: 1, actualDay: 1, status: 'completed', responsible: 'Điều dưỡng PACU', icon: 'activity' },
      { id: 'ms-04', phase: 'Hậu phẫu', name: 'Kháng sinh dự phòng & Giảm đau', description: 'Cefazolin 1g IV Q8H × 24h, Paracetamol IV Q6H', targetDay: 2, actualDay: 2, status: 'completed', responsible: 'BS. Điều trị', icon: 'pill' },
      { id: 'ms-05', phase: 'Phục hồi', name: 'Bắt đầu ăn lỏng', description: 'Đánh giá nhu động ruột, cho uống nước và ăn lỏng', targetDay: 2, actualDay: 3, status: 'completed', responsible: 'Điều dưỡng', icon: 'activity' },
      { id: 'ms-06', phase: 'Phục hồi', name: 'Rút drain bụng', description: 'Kiểm tra dịch drain < 50ml/24h, rút drain', targetDay: 3, actualDay: 5, status: 'completed', responsible: 'BS.CKII Phạm Quốc Việt', icon: 'stethoscope' },
      { id: 'ms-07', phase: 'Xuất viện', name: 'Đánh giá tiêu chuẩn xuất viện', description: 'VAS ≤ 3, ăn được, không sốt, vết mổ khô', targetDay: 5, actualDay: 8, status: 'variance', responsible: 'BS. Điều trị', icon: 'discharge' },
      { id: 'ms-08', phase: 'Xuất viện', name: 'Lập toa & Hướng dẫn xuất viện', description: 'Toa Augmentin, lịch tái khám, hướng dẫn chăm sóc vết mổ', targetDay: 5, actualDay: null, status: 'pending', responsible: 'BS. Điều trị', icon: 'filetext' },
    ],
    varianceItems: [
      { id: 'v1', severity: 'critical', category: 'LOS', description: 'Ngày nằm viện vượt mục tiêu pathway', delta: '+2 ngày', status: 'open' },
      { id: 'v2', severity: 'high', category: 'Discharge', description: 'Chưa hoàn thành đánh giá tiêu chuẩn xuất viện', delta: 'Trễ 2 ngày', status: 'open' },
      { id: 'v3', severity: 'medium', category: 'Phục hồi', description: 'Bắt đầu ăn lỏng trễ hơn pathway 1 ngày', delta: '+1 ngày', status: 'resolved' },
      { id: 'v4', severity: 'medium', category: 'Thủ thuật', description: 'Rút drain trễ hơn do dịch còn nhiều ngày 3', delta: '+2 ngày', status: 'resolved' },
    ],
    exceptions: [
      { id: 'ex1', severity: 'critical', title: 'LOS Variance', detail: 'Ngày nằm viện hiện tại: 7 ngày, mục tiêu DRG-341: 5 ngày. Vượt +2 ngày.', owner: 'BS.CKII Phạm Quốc Việt', dueTime: '16:00 hôm nay', action: 'Đánh giá discharge readiness & lên kế hoạch xuất viện' },
      { id: 'ex2', severity: 'high', title: 'Discharge Milestone Chưa Hoàn Thành', detail: 'Milestone "Đánh giá tiêu chuẩn xuất viện" đã quá Ngày 5, đang ở Ngày 7.', owner: 'BS. Điều trị', dueTime: '18:00 hôm nay', action: 'Hoàn thành đánh giá VAS, ăn uống, vết mổ' },
    ],
    nextActions: [
      { id: 'na1', icon: 'heart', label: 'Đánh giá đau sau phẫu thuật (VAS)', dueIn: 'Trong 2 giờ', priority: 'urgent', assignee: 'Điều dưỡng Nguyễn Thị Lan' },
      { id: 'na2', icon: 'lab', label: 'Kiểm tra CBC & CRP', dueIn: 'Trong 3 giờ', priority: 'urgent', assignee: 'Khoa Xét nghiệm' },
      { id: 'na3', icon: 'pill', label: 'Đánh giá tiếp tục kháng sinh', dueIn: 'Trong 4 giờ', priority: 'high', assignee: 'BS.CKII Phạm Quốc Việt' },
      { id: 'na4', icon: 'doctor', label: 'Đánh giá khả năng xuất viện', dueIn: 'Trước 16:00', priority: 'urgent', assignee: 'BS.CKII Phạm Quốc Việt' },
      { id: 'na5', icon: 'discharge', label: 'Xác nhận discharge readiness checklist', dueIn: 'Trước 17:00', priority: 'high', assignee: 'Điều dưỡng trưởng khoa' },
    ],
    careTeam: [
      { role: 'BS Điều trị', name: 'BS.CKII Phạm Quốc Việt', icon: 'doctor' },
      { role: 'Điều dưỡng', name: 'Điều dưỡng Nguyễn Thị Lan', icon: 'nurse' },
      { role: 'Xét nghiệm', name: 'Khoa CLS', icon: 'lab' },
      { role: 'Khoa', name: 'Ngoại tổng hợp', icon: 'ward' },
    ],
    dischargeReadiness: {
      pct: 57,
      items: [
        { label: 'Sinh hiệu ổn định', done: true },
        { label: 'Ăn uống được (ít nhất 50%)', done: true },
        { label: 'Đau kiểm soát (VAS ≤ 3)', done: true },
        { label: 'Vận động an toàn', done: true },
        { label: 'Kết quả xét nghiệm cuối cùng', done: false },
        { label: 'Bác sĩ duyệt xuất viện', done: false },
        { label: 'Hồ sơ thanh toán hoàn tất', done: false },
      ],
    },
    pathwayHealth: [
      { label: 'Clinical Milestones', status: 'warning', detail: '6/8 hoàn thành' },
      { label: 'Thuốc (Medication)', status: 'ok', detail: 'Đúng pathway' },
      { label: 'Xét nghiệm (Lab)', status: 'ok', detail: 'Đúng tiến độ' },
      { label: 'Thủ thuật (Procedure)', status: 'ok', detail: 'Đã hoàn thành' },
      { label: 'Điều dưỡng (Nursing)', status: 'ok', detail: 'Đúng pathway' },
      { label: 'LOS', status: 'critical', detail: 'Vượt +2 ngày' },
      { label: 'Discharge Readiness', status: 'warning', detail: '57% — Chưa sẵn sàng' },
    ],
    aiRecommendation: {
      finding: 'LOS hiện tại vượt pathway DRG-341 +2 ngày. Discharge Readiness đạt 57%, chưa đáp ứng tiêu chí.',
      cause: 'Milestone "Đánh giá xuất viện" bị delay; chưa có kết quả xét nghiệm cuối và phê duyệt bác sĩ.',
      suggestion: 'Ưu tiên đánh giá discharge readiness trong vòng 4 giờ tới và phối hợp CLS để có kết quả CBC trước 14:00.',
      impact: 'Medium — Mỗi ngày vượt LOS phát sinh chi phí giường bệnh và ảnh hưởng công suất khoa.',
      decisionOwner: 'BS.CKII Phạm Quốc Việt',
    },
    varianceNotes: [
      'Ngày 3: Trễ ăn lỏng do buồn nôn sau gây mê — đã xử lý bằng Ondansetron.',
      'Ngày 5: Trễ rút drain do còn 80ml dịch — giảm về 25ml ngày 5, rút được ngày 5.',
      'Ngày 5–7: Kéo dài nằm viện 2 ngày so với LOS mục tiêu.',
    ],
  },
  {
    caseId: 'cp-002',
    encounterId: 'ENC-HOS-2026-0901',
    patientName: 'Trần Đức Mạnh',
    dob: '1958-03-18',
    wardBed: 'NOI-BED-07',
    pathwayName: 'Phác đồ Đợt Cấp Suy Tim (ADHF)',
    drgCode: 'DRG-127',
    admittedAt: '2026-08-06',
    currentDay: 2,
    targetLOS: 5,
    attendingPhysician: 'BS. Nguyễn Thu Hà',
    milestones: [
      { id: 'ms-11', phase: 'Nhập viện', name: 'Đánh giá và ổn định ban đầu', description: 'ECG 12 chuyển đạo, X-quang ngực, BNP, siêu âm tim', targetDay: 1, actualDay: 1, status: 'completed', responsible: 'BS. Cấp cứu', icon: 'stethoscope' },
      { id: 'ms-12', phase: 'Điều trị tích cực', name: 'Lợi tiểu IV tĩnh mạch', description: 'Furosemide IV bolus → infusion, mục tiêu âm 1–2L/ngày', targetDay: 1, actualDay: 1, status: 'completed', responsible: 'BS. Nguyễn Thu Hà', icon: 'pill' },
      { id: 'ms-13', phase: 'Điều trị tích cực', name: 'Tối ưu hóa phác đồ nền', description: 'Điều chỉnh RAAS, beta-blocker, thêm SGLT2i nếu thích hợp', targetDay: 2, actualDay: null, status: 'in_progress', responsible: 'BS. Nguyễn Thu Hà', icon: 'pill' },
      { id: 'ms-14', phase: 'Theo dõi', name: 'Theo dõi cân nặng & cân bằng dịch', description: 'Cân nặng buổi sáng, I&O chart mỗi ca, siêu âm IVC', targetDay: 3, actualDay: null, status: 'pending', responsible: 'Điều dưỡng', icon: 'activity' },
      { id: 'ms-15', phase: 'Phục hồi', name: 'Chuyển sang thuốc uống', description: 'Khi khô phổi, chuyển Furosemide IV → PO', targetDay: 3, actualDay: null, status: 'pending', responsible: 'BS. Nguyễn Thu Hà', icon: 'pill' },
      { id: 'ms-16', phase: 'Xuất viện', name: 'Giáo dục bệnh nhân & Lập kế hoạch xuất viện', description: 'Hướng dẫn chế độ ăn giảm muối, theo dõi cân nặng tại nhà', targetDay: 5, actualDay: null, status: 'pending', responsible: 'Điều dưỡng + BS', icon: 'discharge' },
    ],
    varianceItems: [],
    exceptions: [],
    nextActions: [
      { id: 'na1', icon: 'heart', label: 'Đánh giá đáp ứng lợi tiểu — cân bằng dịch', dueIn: 'Buổi chiều hôm nay', priority: 'high', assignee: 'BS. Nguyễn Thu Hà' },
      { id: 'na2', icon: 'lab', label: 'Xét nghiệm điện giải, BMP', dueIn: 'Sáng mai', priority: 'normal', assignee: 'Khoa Xét nghiệm' },
      { id: 'na3', icon: 'pill', label: 'Hoàn thành tối ưu phác đồ nền (RAAS/BB)', dueIn: 'Ngày hôm nay', priority: 'high', assignee: 'BS. Nguyễn Thu Hà' },
    ],
    careTeam: [
      { role: 'BS Điều trị', name: 'BS. Nguyễn Thu Hà', icon: 'doctor' },
      { role: 'Điều dưỡng', name: 'Điều dưỡng Trần Minh Châu', icon: 'nurse' },
      { role: 'Xét nghiệm', name: 'Khoa CLS', icon: 'lab' },
      { role: 'Khoa', name: 'Nội Tim mạch', icon: 'ward' },
    ],
    dischargeReadiness: {
      pct: 15,
      items: [
        { label: 'Sinh hiệu ổn định', done: true },
        { label: 'Phù giảm / Khô phổi', done: false },
        { label: 'Điện giải bình thường', done: false },
        { label: 'Phác đồ oral hoàn chỉnh', done: false },
        { label: 'Bệnh nhân hiểu hướng dẫn tự chăm sóc', done: false },
        { label: 'Bác sĩ duyệt xuất viện', done: false },
        { label: 'Lịch tái khám đã đặt', done: false },
      ],
    },
    pathwayHealth: [
      { label: 'Clinical Milestones', status: 'ok', detail: '2/6 hoàn thành (đúng tiến độ)' },
      { label: 'Thuốc (Medication)', status: 'ok', detail: 'Đúng pathway' },
      { label: 'Xét nghiệm (Lab)', status: 'ok', detail: 'Đúng tiến độ' },
      { label: 'Thủ thuật (Procedure)', status: 'ok', detail: 'Chưa đến giai đoạn' },
      { label: 'Điều dưỡng (Nursing)', status: 'ok', detail: 'Đúng pathway' },
      { label: 'LOS', status: 'ok', detail: 'Ngày 2/5 — Đúng kế hoạch' },
      { label: 'Discharge Readiness', status: 'ok', detail: '15% — Còn sớm (Ngày 2)' },
    ],
    aiRecommendation: null,
    varianceNotes: [],
  },
];

// ─── Config Maps ──────────────────────────────────────────────────────────────
const MS_STATUS_CONFIG: Record<MilestoneStatus, { label: string; dotColor: string; dotBorder: string; textColor: string; bgColor: string }> = {
  completed:   { label: 'Hoàn thành', dotColor: 'bg-emerald-500', dotBorder: 'border-emerald-600', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50' },
  in_progress: { label: 'Đang thực hiện', dotColor: 'bg-blue-500', dotBorder: 'border-blue-600', textColor: 'text-blue-700', bgColor: 'bg-blue-50' },
  at_risk:     { label: 'Có nguy cơ', dotColor: 'bg-amber-400', dotBorder: 'border-amber-500', textColor: 'text-amber-700', bgColor: 'bg-amber-50' },
  variance:    { label: 'Sai lệch', dotColor: 'bg-rose-500', dotBorder: 'border-rose-600', textColor: 'text-rose-700', bgColor: 'bg-rose-50' },
  pending:     { label: 'Chưa đến', dotColor: 'bg-slate-200', dotBorder: 'border-slate-300', textColor: 'text-slate-400', bgColor: 'bg-slate-50' },
};

const MS_STATUS_ICON: Record<MilestoneStatus, React.ReactNode> = {
  completed:   <CheckCircle2 className="w-4 h-4" />,
  in_progress: <Activity className="w-4 h-4 animate-pulse" />,
  at_risk:     <AlertTriangle className="w-4 h-4" />,
  variance:    <AlertCircle className="w-4 h-4" />,
  pending:     <Circle className="w-4 h-4" />,
};

const EX_SEVERITY_CONFIG: Record<ExceptionSeverity, { bg: string; border: string; text: string; badge: string; dot: string }> = {
  critical: { bg: 'bg-rose-50',   border: 'border-rose-200',   text: 'text-rose-800',   badge: 'bg-rose-100 text-rose-800 border-rose-300',   dot: 'bg-rose-500' },
  high:     { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  badge: 'bg-amber-100 text-amber-800 border-amber-300',  dot: 'bg-amber-500' },
  medium:   { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', badge: 'bg-yellow-100 text-yellow-800 border-yellow-300', dot: 'bg-yellow-400' },
};

const PHASE_COLORS: Record<string, string> = {
  'Nhập viện':         'bg-blue-100 text-blue-800',
  'Phẫu thuật':        'bg-purple-100 text-purple-800',
  'Hậu phẫu':          'bg-orange-100 text-orange-800',
  'Điều trị tích cực': 'bg-rose-100 text-rose-800',
  'Theo dõi':          'bg-amber-100 text-amber-800',
  'Phục hồi':          'bg-teal-100 text-teal-800',
  'Xuất viện':         'bg-emerald-100 text-emerald-800',
};

const HEALTH_STATUS_CONFIG = {
  ok:       { dot: 'bg-emerald-500', text: 'text-emerald-700', badge: 'text-emerald-700', icon: '🟢' },
  warning:  { dot: 'bg-amber-400',   text: 'text-amber-700',   badge: 'text-amber-700',   icon: '🟡' },
  critical: { dot: 'bg-rose-500',    text: 'text-rose-700',    badge: 'text-rose-700',    icon: '🔴' },
};

const PRIORITY_CONFIG: Record<string, { ring: string; badge: string }> = {
  urgent: { ring: 'ring-1 ring-rose-200',   badge: 'bg-rose-100 text-rose-700' },
  high:   { ring: 'ring-1 ring-amber-200',  badge: 'bg-amber-100 text-amber-700' },
  normal: { ring: 'ring-1 ring-slate-200',  badge: 'bg-slate-100 text-slate-600' },
};

// ─── Sub-Components ───────────────────────────────────────────────────────────
function ActionIcon({ type }: { type: string }) {
  switch (type) {
    case 'heart': return <HeartPulse className="w-4 h-4 text-rose-500" />;
    case 'lab':   return <FlaskConical className="w-4 h-4 text-purple-500" />;
    case 'pill':  return <Pill className="w-4 h-4 text-blue-500" />;
    case 'doctor': return <Stethoscope className="w-4 h-4 text-teal-600" />;
    case 'discharge': return <LogOut className="w-4 h-4 text-emerald-600" />;
    default: return <Zap className="w-4 h-4 text-slate-500" />;
  }
}

function CareTeamIcon({ type }: { type: string }) {
  switch (type) {
    case 'doctor': return <Stethoscope className="w-4 h-4 text-teal-600" />;
    case 'nurse':  return <HeartPulse className="w-4 h-4 text-rose-500" />;
    case 'lab':    return <FlaskConical className="w-4 h-4 text-purple-500" />;
    case 'ward':   return <Activity className="w-4 h-4 text-blue-500" />;
    default: return <User className="w-4 h-4 text-slate-500" />;
  }
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HospitalCarePathwayPage() {
  const [selectedCase, setSelectedCase] = useState<string>(MOCK_PATHWAYS[0].caseId);
  const pathway = MOCK_PATHWAYS.find((p) => p.caseId === selectedCase) ?? MOCK_PATHWAYS[0];

  const completed  = pathway.milestones.filter((m) => m.status === 'completed').length;
  const progress   = Math.round((completed / pathway.milestones.length) * 100);
  const isOverLOS  = pathway.currentDay > pathway.targetLOS;
  const losVariance = pathway.currentDay - pathway.targetLOS;
  const openExceptions = pathway.exceptions.length;
  const openVariances  = pathway.varianceItems.filter((v) => v.status === 'open').length;

  return (
    <div className="p-5 max-w-[1440px] mx-auto space-y-5">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-green-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center space-x-2 text-teal-300 mb-1">
              <GitBranch className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#ffffff' }}>
                Bella Hospital • Clinical Care Pathway Management
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#ffffff' }}>Hành Trình Điều Trị Nội Trú</h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Theo dõi tuân thủ phác đồ điều trị (Clinical Pathway) theo DRG · Phát hiện sai lệch (Variance) · Kiểm soát LOS & Discharge Readiness
            </p>
          </div>
          {/* KPI pills */}
          <div className="flex flex-wrap gap-2">
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-xl px-4 py-2 text-center">
              <div className="text-2xl font-black text-white">{MOCK_PATHWAYS.length}</div>
              <div className="text-[10px] text-teal-200 font-medium">Bệnh nhân</div>
            </div>
            <div className={`backdrop-blur border rounded-xl px-4 py-2 text-center ${openExceptions > 0 ? 'bg-rose-500/20 border-rose-400/40' : 'bg-white/10 border-white/20'}`}>
              <div className="text-2xl font-black text-white">{openExceptions}</div>
              <div className="text-[10px] text-teal-200 font-medium">Exceptions</div>
            </div>
            <div className={`backdrop-blur border rounded-xl px-4 py-2 text-center ${openVariances > 0 ? 'bg-amber-500/20 border-amber-400/40' : 'bg-white/10 border-white/20'}`}>
              <div className="text-2xl font-black text-white">{openVariances}</div>
              <div className="text-[10px] text-teal-200 font-medium">Variances</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PERSISTENT PATIENT CONTEXT BAR (Invariant #1 Phase B2) ── */}
      <PatientContextBar patient={BELLA_DEMO_PATIENT} workspace="Care Pathway · Hành trình Điều trị" />

      {/* ── MAIN LAYOUT ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">

        {/* ─ LEFT: Patient List ─ */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="font-bold text-slate-700 text-sm px-1 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-teal-600" /> Bệnh nhân đang theo phác đồ
          </h3>
          {MOCK_PATHWAYS.map((p) => {
            const done = p.milestones.filter((m) => m.status === 'completed').length;
            const pct  = Math.round((done / p.milestones.length) * 100);
            const over = p.currentDay > p.targetLOS;
            const hasException = p.exceptions.length > 0;
            return (
              <button
                key={p.caseId}
                onClick={() => setSelectedCase(p.caseId)}
                className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all ${
                  selectedCase === p.caseId
                    ? 'border-teal-500 ring-2 ring-teal-200'
                    : over ? 'border-rose-300' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{p.patientName}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{p.wardBed}</div>
                  </div>
                  {hasException && (
                    <span className="text-[9px] font-bold text-white bg-rose-500 px-1.5 py-0.5 rounded-full">{p.exceptions.length}</span>
                  )}
                </div>
                {/* LOS badge */}
                <div className={`mt-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  over ? 'bg-rose-100 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {over ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  LOS {p.currentDay}d / Target {p.targetLOS}d {over && `(+${p.currentDay - p.targetLOS}d)`}
                </div>
                {/* Progress */}
                <div className="mt-2">
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-teal-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{pct}% · {done}/{p.milestones.length} milestones</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* ─ RIGHT: Pathway Detail ─ */}
        <div className="lg:col-span-3 space-y-4">

          {/* ── PATHWAY OVERVIEW CARD ─────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-md">
            <div className="flex justify-between items-start flex-wrap gap-3">
              <div>
                <div className="text-xs font-bold text-slate-400 tracking-wider">{pathway.drgCode}</div>
                <h2 className="font-bold text-slate-900 text-lg leading-tight">{pathway.pathwayName}</h2>
                <div className="text-sm text-slate-500 mt-1">
                  {pathway.patientName} · {pathway.wardBed} · {pathway.attendingPhysician}
                </div>
              </div>
              {/* LOS Display — cải thiện theo yêu cầu */}
              <div className={`rounded-xl px-4 py-3 text-right border ${isOverLOS ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="text-xs text-slate-500 font-medium mb-0.5">Ngày nằm viện</div>
                <div className={`text-2xl font-black ${isOverLOS ? 'text-rose-700' : 'text-teal-700'}`}>
                  LOS {pathway.currentDay}d
                  <span className="text-sm font-bold text-slate-400 ml-1">/ Target {pathway.targetLOS}d</span>
                </div>
                {isOverLOS && (
                  <div className="text-[11px] font-bold text-rose-600 flex items-center justify-end gap-1 mt-0.5">
                    <AlertTriangle className="w-3 h-3" /> +{losVariance}d Variance
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span className="font-medium">Tiến độ phác đồ</span>
                <span className="font-bold text-teal-700">{progress}% ({completed}/{pathway.milestones.length} milestones)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5">
                <div className="h-2.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          {/* ── PATHWAY HEALTH + CARE TEAM ────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

            {/* Pathway Health */}
            <div className="md:col-span-3 bg-white border border-slate-200 rounded-xl p-5 shadow-md">
              <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-teal-600" />
                Pathway Health
              </h3>
              <div className="space-y-2">
                {pathway.pathwayHealth.map((h) => {
                  const cfg = HEALTH_STATUS_CONFIG[h.status];
                  return (
                    <div key={h.label} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="text-xs text-slate-700 font-medium">{h.label}</span>
                      </div>
                      <span className={`text-xs font-semibold ${cfg.text}`}>{h.detail}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Care Team */}
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-md">
              <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-600" />
                Care Team
              </h3>
              <div className="space-y-2.5">
                {pathway.careTeam.map((m) => (
                  <div key={m.role} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                      <CareTeamIcon type={m.icon} />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">{m.role}</div>
                      <div className="text-xs text-slate-800 font-semibold leading-tight">{m.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CLINICAL EXCEPTIONS (nếu có) ──────────────────────────── */}
          {pathway.exceptions.length > 0 && (
            <div className="bg-white border border-rose-200 rounded-xl p-5 shadow-md">
              <h3 className="font-bold text-rose-800 text-sm mb-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Clinical Exceptions — {pathway.exceptions.length} cần xử lý
              </h3>
              <div className="space-y-3">
                {pathway.exceptions.map((ex) => {
                  const cfg = EX_SEVERITY_CONFIG[ex.severity];
                  return (
                    <div key={ex.id} className={`rounded-xl p-4 border ${cfg.bg} ${cfg.border}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${cfg.dot}`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                              {ex.severity === 'critical' ? '🔴 CRITICAL' : ex.severity === 'high' ? '🟠 HIGH' : '🟡 MEDIUM'}
                            </span>
                            <span className={`font-bold text-sm ${cfg.text}`}>{ex.title}</span>
                          </div>
                          <p className="text-xs text-slate-600">{ex.detail}</p>
                          <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                            <span className="flex items-center gap-1 text-slate-500">
                              <User className="w-3 h-3" /> <strong>Owner:</strong> {ex.owner}
                            </span>
                            <span className="flex items-center gap-1 text-slate-500">
                              <Timer className="w-3 h-3" /> <strong>Due:</strong> {ex.dueTime}
                            </span>
                            <span className="flex items-center gap-1 text-rose-600 font-semibold">
                              <ArrowRight className="w-3 h-3" /> {ex.action}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── CLINICAL VARIANCE ─────────────────────────────────────── */}
          {pathway.varianceItems.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-md">
              <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Clinical Variance
              </h3>
              <div className="space-y-2">
                {pathway.varianceItems.map((v) => {
                  const cfg = EX_SEVERITY_CONFIG[v.severity];
                  const isResolved = v.status === 'resolved';
                  return (
                    <div
                      key={v.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-xs ${
                        isResolved ? 'bg-slate-50 border-slate-100 opacity-60' : `${cfg.bg} ${cfg.border}`
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isResolved ? 'bg-emerald-400' : cfg.dot}`} />
                      <span className="text-slate-500 font-semibold w-20 shrink-0">{v.category}</span>
                      <span className="flex-1 text-slate-700">{v.description}</span>
                      <span className={`font-bold shrink-0 ${isResolved ? 'text-emerald-600' : cfg.text}`}>
                        {isResolved ? '✓ Đã xử lý' : v.delta}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── MILESTONES TIMELINE ───────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-md">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-teal-600" />
              Milestones Phác Đồ Điều Trị
              <span className="text-xs text-slate-400 font-normal ml-1">— 5 trạng thái: Hoàn thành · Đang thực hiện · Có nguy cơ · Sai lệch · Chưa đến</span>
            </h3>
            <div className="relative">
              <div className="absolute left-[18px] top-4 bottom-4 w-0.5 bg-slate-200" />
              <div className="space-y-3">
                {pathway.milestones.map((ms) => {
                  const sc      = MS_STATUS_CONFIG[ms.status];
                  const scIcon  = MS_STATUS_ICON[ms.status];
                  const phaseColor = PHASE_COLORS[ms.phase] ?? 'bg-slate-100 text-slate-700';
                  const isLate  = ms.actualDay !== null && ms.actualDay > ms.targetDay;
                  return (
                    <div key={ms.id} className="flex items-start gap-3 pl-1">
                      {/* Status dot */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${sc.dotColor} text-white border-2 ${sc.dotBorder} z-10 shadow-sm`}>
                        {scIcon}
                      </div>
                      {/* Content */}
                      <div className={`flex-1 rounded-xl p-3.5 border ${sc.bgColor} border-opacity-60`} style={{ borderColor: sc.dotColor.replace('bg-','').includes('slate') ? '#e2e8f0' : undefined }}>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${phaseColor}`}>{ms.phase}</span>
                          <span className="font-semibold text-slate-800 text-sm">{ms.name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            ms.status === 'completed'   ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            ms.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            ms.status === 'variance'    ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            ms.status === 'at_risk'     ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            {sc.label}
                          </span>
                          {isLate && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Trễ +{ms.actualDay! - ms.targetDay} ngày
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{ms.description}</div>
                        <div className="mt-2 flex justify-between text-[11px] text-slate-400 flex-wrap gap-1">
                          <span>Phụ trách: <strong className="text-slate-600">{ms.responsible}</strong></span>
                          <span className="font-medium">
                            Mục tiêu: Ngày {ms.targetDay}
                            {ms.actualDay !== null && (
                              <> · Thực hiện: Ngày {ms.actualDay}
                                {isLate && <span className="text-amber-600 font-bold"> (+{ms.actualDay - ms.targetDay}d)</span>}
                              </>
                            )}
                            {ms.status === 'pending' && ' · Chưa đến thời điểm'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── NEXT CLINICAL ACTIONS + DISCHARGE READINESS ───────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Next Actions */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-md">
              <h3 className="font-bold text-slate-800 text-sm mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                Next Clinical Actions
              </h3>
              {pathway.nextActions.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4">Không có hành động ưu tiên</div>
              ) : (
                <div className="space-y-2">
                  {pathway.nextActions.map((a) => {
                    const pcfg = PRIORITY_CONFIG[a.priority];
                    return (
                      <div key={a.id} className={`flex items-start gap-3 p-3 rounded-xl bg-slate-50 ${pcfg.ring}`}>
                        <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm border border-slate-100">
                          <ActionIcon type={a.icon} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-800 leading-tight">{a.label}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{a.assignee}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${pcfg.badge}`}>
                            {a.priority === 'urgent' ? '🔴' : a.priority === 'high' ? '🟠' : '🟢'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> {a.dueIn}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Discharge Readiness */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-md">
              <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
                <LogOut className="w-4 h-4 text-emerald-600" />
                Discharge Readiness
              </h3>
              <div className="flex items-center gap-3 mb-3">
                <div className={`text-2xl font-black ${pathway.dischargeReadiness.pct >= 80 ? 'text-emerald-600' : pathway.dischargeReadiness.pct >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {pathway.dischargeReadiness.pct}%
                </div>
                <div className="flex-1">
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${pathway.dischargeReadiness.pct >= 80 ? 'bg-emerald-500' : pathway.dischargeReadiness.pct >= 50 ? 'bg-amber-400' : 'bg-rose-500'}`}
                      style={{ width: `${pathway.dischargeReadiness.pct}%` }}
                    />
                  </div>
                  <div className={`text-[10px] font-semibold mt-0.5 ${pathway.dischargeReadiness.pct >= 80 ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {pathway.dischargeReadiness.pct >= 80 ? '✓ Sẵn sàng xuất viện' : '⏳ Chưa đủ tiêu chí'}
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                {pathway.dischargeReadiness.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {item.done
                      ? <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                      : <Square className="w-4 h-4 text-slate-300 shrink-0" />
                    }
                    <span className={item.done ? 'text-slate-600' : 'text-slate-400'}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CLINICAL INTELLIGENCE (AI) ───────────────────────────── */}
          {pathway.aiRecommendation && (
            <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-5 shadow-md">
              <h3 className="font-bold text-indigo-900 text-sm mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                Bella Clinical Intelligence
                <span className="text-[10px] font-normal text-indigo-400 ml-1">— AI hỗ trợ, không tự quyết định lâm sàng</span>
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-white/70 rounded-xl border border-indigo-100">
                  <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Phát hiện</div>
                  <p className="text-sm text-slate-800">{pathway.aiRecommendation.finding}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-white/70 rounded-xl border border-indigo-100">
                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">Nguyên nhân có thể</div>
                    <p className="text-xs text-slate-700">{pathway.aiRecommendation.cause}</p>
                  </div>
                  <div className="p-3 bg-white/70 rounded-xl border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Đề xuất hành động</div>
                    <p className="text-xs text-slate-700">{pathway.aiRecommendation.suggestion}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="flex items-center gap-1 text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
                    <Brain className="w-3 h-3" /> Mức ảnh hưởng: {pathway.aiRecommendation.impact}
                  </span>
                  <span className="flex items-center gap-1 text-indigo-700 font-semibold bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
                    <User className="w-3 h-3" /> Quyền quyết định: {pathway.aiRecommendation.decisionOwner}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── VARIANCE LOG ─────────────────────────────────────────── */}
          {pathway.varianceNotes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
              <h3 className="font-bold text-amber-800 text-sm mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Variance Log — Nhật ký sai lệch so với phác đồ
              </h3>
              <ul className="space-y-1.5">
                {pathway.varianceNotes.map((note, i) => (
                  <li key={i} className="text-xs text-amber-700 flex items-start gap-2">
                    <ChevronRight className="w-3 h-3 mt-0.5 shrink-0" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
