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
  critical: { bg: 'bg-rose-50/70',  border: 'border-rose-300',   text: 'text-rose-900',   badge: 'bg-rose-100 text-rose-900 border-rose-300 font-extrabold',   dot: 'bg-rose-600' },
  high:     { bg: 'bg-amber-50/70', border: 'border-amber-300',  text: 'text-amber-900',  badge: 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold',  dot: 'bg-amber-600' },
  medium:   { bg: 'bg-yellow-50/70 text-slate-900', border: 'border-yellow-350', text: 'text-yellow-950', badge: 'bg-yellow-100 text-yellow-950 border-yellow-300 font-extrabold', dot: 'bg-yellow-500' },
};

const PHASE_COLORS: Record<string, string> = {
  'Nhập viện':         'bg-blue-100 text-blue-900 border border-blue-200',
  'Phẫu thuật':        'bg-purple-100 text-purple-900 border border-purple-200',
  'Hậu phẫu':          'bg-orange-100 text-orange-900 border border-orange-200',
  'Điều trị tích cực': 'bg-rose-100 text-rose-900 border border-rose-200',
  'Theo dõi':          'bg-amber-100 text-amber-900 border border-amber-200',
  'Phục hồi':          'bg-teal-100 text-teal-900 border border-teal-200',
  'Xuất viện':         'bg-emerald-100 text-emerald-900 border border-emerald-200',
};

const HEALTH_STATUS_CONFIG = {
  ok:       { dot: 'bg-emerald-600', text: 'text-emerald-800 bg-emerald-50 border border-emerald-250 px-2 py-0.5 rounded font-extrabold text-xs', badge: 'text-emerald-850', icon: '🟢' },
  warning:  { dot: 'bg-amber-500',   text: 'text-amber-900 bg-amber-50 border border-amber-250 px-2 py-0.5 rounded font-extrabold text-xs',   badge: 'text-amber-900',   icon: '🟡' },
  critical: { dot: 'bg-rose-600',    text: 'text-rose-900 bg-rose-50 border border-rose-250 px-2 py-0.5 rounded font-extrabold text-xs',    badge: 'text-rose-900',    icon: '🔴' },
};

const PRIORITY_CONFIG: Record<string, { ring: string; badge: string }> = {
  urgent: { ring: 'ring-1 ring-rose-300 bg-rose-50/30',   badge: 'bg-rose-100 text-rose-900 border border-rose-200' },
  high:   { ring: 'ring-1 ring-amber-300 bg-amber-50/30',  badge: 'bg-amber-100 text-amber-900 border border-amber-200' },
  normal: { ring: 'ring-1 ring-slate-300 bg-slate-50/30',  badge: 'bg-slate-100 text-slate-800 border border-slate-200' },
};

// ─── Sub-Components ───────────────────────────────────────────────────────────
function ActionIcon({ type }: { type: string }) {
  switch (type) {
    case 'heart': return <HeartPulse className="w-4.5 h-4.5 text-rose-600" />;
    case 'lab':   return <FlaskConical className="w-4.5 h-4.5 text-purple-600" />;
    case 'pill':  return <Pill className="w-4.5 h-4.5 text-blue-600" />;
    case 'doctor': return <Stethoscope className="w-4.5 h-4.5 text-teal-700" />;
    case 'discharge': return <LogOut className="w-4.5 h-4.5 text-emerald-700" />;
    default: return <Zap className="w-4.5 h-4.5 text-slate-700" />;
  }
}

function CareTeamIcon({ type }: { type: string }) {
  switch (type) {
    case 'doctor': return <Stethoscope className="w-4.5 h-4.5 text-teal-700" />;
    case 'nurse':  return <HeartPulse className="w-4.5 h-4.5 text-rose-600" />;
    case 'lab':    return <FlaskConical className="w-4.5 h-4.5 text-purple-600" />;
    case 'ward':   return <Activity className="w-4.5 h-4.5 text-blue-600" />;
    default: return <User className="w-4.5 h-4.5 text-slate-700" />;
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
    <div className="p-5 max-w-[1440px] mx-auto space-y-6">

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-950 via-emerald-900 to-emerald-950 rounded-2xl p-6 md:p-8 text-white shadow-xl border border-teal-500/20">
        {/* Decorative background blur objects */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-6">
          <div>
            <div className="flex items-center space-x-2 text-emerald-300 mb-2">
              <GitBranch className="w-5 h-5 animate-pulse text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-emerald-200">
                Bella Hospital • Clinical Care Pathway Management
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold font-serif tracking-tight drop-shadow-sm" style={{ color: '#ffffff' }}>
              Hành Trình Điều Trị Nội Trú
            </h1>
            <p className="text-sm mt-2 font-medium max-w-3xl text-emerald-100/90 leading-relaxed">
              Theo dõi tuân thủ phác đồ điều trị (Clinical Pathway) theo DRG · Phát hiện sai lệch (Variance) · Kiểm soát LOS & Discharge Readiness
            </p>
          </div>
          {/* KPI pills with glassmorphism */}
          <div className="flex flex-wrap gap-3">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-5 py-3 text-center shadow-lg hover:bg-white/15 transition-all duration-300">
              <div className="text-3xl font-black text-white tracking-tight">{MOCK_PATHWAYS.length}</div>
              <div className="text-xs text-emerald-200 font-bold uppercase tracking-wider mt-0.5">Bệnh nhân</div>
            </div>
            <div className={`backdrop-blur-md border rounded-xl px-5 py-3 text-center shadow-lg transition-all duration-300 ${
              openExceptions > 0 
                ? 'bg-rose-500/20 border-rose-500/40 hover:bg-rose-500/25' 
                : 'bg-white/10 border-white/20 hover:bg-white/15'
            }`}>
              <div className="text-3xl font-black text-white tracking-tight">{openExceptions}</div>
              <div className="text-xs text-rose-200 font-bold uppercase tracking-wider mt-0.5">Exceptions</div>
            </div>
            <div className={`backdrop-blur-md border rounded-xl px-5 py-3 text-center shadow-lg transition-all duration-300 ${
              openVariances > 0 
                ? 'bg-amber-500/20 border-amber-500/40 hover:bg-amber-500/25' 
                : 'bg-white/10 border-white/20 hover:bg-white/15'
            }`}>
              <div className="text-3xl font-black text-white tracking-tight">{openVariances}</div>
              <div className="text-xs text-amber-200 font-bold uppercase tracking-wider mt-0.5">Variances</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PERSISTENT PATIENT CONTEXT BAR (Invariant #1 Phase B2) ── */}
      <PatientContextBar patient={BELLA_DEMO_PATIENT} workspace="Care Pathway · Hành trình Điều trị" />

      {/* ── MAIN LAYOUT ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ─ LEFT: Patient List ─ */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="font-bold text-slate-800 text-sm px-1 flex items-center gap-2 tracking-wide uppercase">
            <Users className="w-4 h-4 text-teal-600" /> Bệnh nhân đang theo phác đồ
          </h2>
          <div className="space-y-3">
            {MOCK_PATHWAYS.map((p) => {
              const done = p.milestones.filter((m) => m.status === 'completed').length;
              const pct  = Math.round((done / p.milestones.length) * 100);
              const over = p.currentDay > p.targetLOS;
              const hasException = p.exceptions.length > 0;
              const isActive = selectedCase === p.caseId;
              
              return (
                <button
                  key={p.caseId}
                  onClick={() => setSelectedCase(p.caseId)}
                  className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-slate-350 transition-all duration-250 ${
                    isActive
                      ? 'border-teal-600 ring-2 ring-teal-100 bg-teal-50/20 shadow-md'
                      : over 
                        ? 'border-rose-250 hover:border-rose-350' 
                        : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm leading-snug">{p.patientName}</div>
                      <div className="text-xs font-semibold text-slate-700 mt-1 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> {p.wardBed}
                      </div>
                    </div>
                    {hasException && (
                      <span className="text-xs font-extrabold text-rose-800 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">
                        {p.exceptions.length}
                      </span>
                    )}
                  </div>
                  
                  {/* LOS badge */}
                  <div className="mt-3">
                    <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${
                      over 
                        ? 'bg-rose-50 text-rose-800 border-rose-200' 
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {over ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      LOS {p.currentDay}d / Target {p.targetLOS}d {over && `(+${p.currentDay - p.targetLOS}d)`}
                    </div>
                  </div>
                  
                  {/* Progress */}
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex justify-between text-xs text-slate-700 mb-1 font-semibold">
                      <span>Tiến độ</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-teal-600 transition-all duration-300" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-slate-750 mt-1.5 font-bold">
                      {done}/{p.milestones.length} milestones
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ─ RIGHT: Pathway Detail ─ */}
        <div className="lg:col-span-3 space-y-5">

          {/* ── PATHWAY OVERVIEW CARD ─────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-md relative overflow-hidden">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 to-emerald-500" />
            
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div className="space-y-1">
                <span className="inline-flex items-center text-xs font-extrabold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-md">
                  {pathway.drgCode}
                </span>
                <h2 className="font-bold text-slate-900 text-xl md:text-2xl font-serif tracking-tight leading-tight mt-1.5">
                  {pathway.pathwayName}
                </h2>
                <div className="text-sm font-semibold text-slate-700 mt-2 flex flex-wrap gap-x-4 gap-y-1.5 items-center">
                  <span>Bệnh nhân: <strong className="text-slate-900">{pathway.patientName}</strong></span>
                  <span className="text-slate-300 hidden sm:inline">•</span>
                  <span>Giường: <strong className="text-slate-900">{pathway.wardBed}</strong></span>
                  <span className="text-slate-300 hidden sm:inline">•</span>
                  <span>Bác sĩ phụ trách: <strong className="text-slate-900">{pathway.attendingPhysician}</strong></span>
                </div>
              </div>
              
              {/* LOS Display */}
              <div className={`rounded-xl px-5 py-4 text-right border shadow-sm shrink-0 ${
                isOverLOS ? 'bg-rose-50/80 border-rose-300' : 'bg-emerald-50/80 border-emerald-300'
              }`}>
                <div className="text-xs text-slate-700 font-extrabold uppercase tracking-wider mb-1">Ngày nằm viện</div>
                <div className={`text-3xl font-black ${isOverLOS ? 'text-rose-900' : 'text-emerald-900'} leading-none`}>
                  LOS {pathway.currentDay}d
                </div>
                <div className="text-xs text-slate-750 font-extrabold mt-1.5">
                  Mục tiêu: {pathway.targetLOS}d
                </div>
                {isOverLOS && (
                  <div className="text-xs font-extrabold text-rose-800 flex items-center justify-end gap-1 mt-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> +{losVariance}d Variance
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <div className="flex justify-between items-center text-xs text-slate-800 mb-2 font-bold uppercase tracking-wider">
                <span>Tiến độ phác đồ</span>
                <span className="text-teal-800 font-black">{progress}% ({completed}/{pathway.milestones.length} milestones)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div className="h-3 rounded-full bg-gradient-to-r from-teal-600 to-emerald-500 shadow-sm transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          {/* ── PATHWAY HEALTH + CARE TEAM ────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-5">

            {/* Pathway Health */}
            <div className="md:col-span-3 bg-white border border-slate-200 rounded-xl p-6 shadow-md">
              <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2 tracking-wide uppercase">
                <Activity className="w-4 h-4 text-teal-600" />
                Pathway Health (Sức khỏe phác đồ)
              </h3>
              <div className="space-y-3">
                {pathway.pathwayHealth.map((h) => {
                  const cfg = HEALTH_STATUS_CONFIG[h.status];
                  return (
                    <div key={h.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="text-xs text-slate-850 font-bold">{h.label}</span>
                      </div>
                      <span className={cfg.text}>{h.detail}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Care Team */}
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-6 shadow-md">
              <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2 tracking-wide uppercase">
                <Users className="w-4 h-4 text-teal-600" />
                Care Team
              </h3>
              <div className="space-y-3">
                {pathway.careTeam.map((m) => (
                  <div key={m.role} className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-slate-50/80 transition-all duration-150">
                    <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0 shadow-sm">
                      <CareTeamIcon type={m.icon} />
                    </div>
                    <div>
                      <div className="text-xs text-slate-700 font-bold">{m.role}</div>
                      <div className="text-sm text-slate-900 font-extrabold leading-tight">{m.name}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CLINICAL EXCEPTIONS (nếu có) ──────────────────────────── */}
          {pathway.exceptions.length > 0 && (
            <div className="bg-white border border-rose-300 rounded-xl p-6 shadow-md relative overflow-hidden">
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-rose-500" />
              <h3 className="font-bold text-rose-900 text-sm mb-4 flex items-center gap-2 tracking-wide uppercase">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Clinical Exceptions — {pathway.exceptions.length} cần xử lý
              </h3>
              <div className="space-y-4">
                {pathway.exceptions.map((ex) => {
                  const cfg = EX_SEVERITY_CONFIG[ex.severity];
                  return (
                    <div key={ex.id} className={`rounded-xl p-4 border shadow-sm ${cfg.bg} ${cfg.border}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${cfg.dot} animate-pulse`} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>
                              {ex.severity === 'critical' ? '🔴 CRITICAL' : ex.severity === 'high' ? '🟠 HIGH' : '🟡 MEDIUM'}
                            </span>
                            <span className={`font-extrabold text-sm ${cfg.text}`}>{ex.title}</span>
                          </div>
                          <p className="text-xs text-slate-850 font-semibold leading-relaxed">{ex.detail}</p>
                          <div className="mt-3 pt-2 border-t border-slate-200/50 flex flex-wrap gap-x-4 gap-y-2 text-xs">
                            <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                              <User className="w-3.5 h-3.5 text-slate-500" /> <strong>Owner:</strong> <span className="text-slate-900">{ex.owner}</span>
                            </span>
                            <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                              <Timer className="w-3.5 h-3.5 text-slate-500" /> <strong>Due:</strong> <span className="text-slate-900">{ex.dueTime}</span>
                            </span>
                            <span className="flex items-center gap-1.5 text-rose-800 font-bold bg-rose-100/80 border border-rose-200 px-2 py-0.5 rounded-full">
                              <ArrowRight className="w-3.5 h-3.5 text-rose-600" /> {ex.action}
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
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-md">
              <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2 tracking-wide uppercase">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Clinical Variance (Biến động lâm sàng)
              </h3>
              <div className="space-y-2.5">
                {pathway.varianceItems.map((v) => {
                  const cfg = EX_SEVERITY_CONFIG[v.severity];
                  const isResolved = v.status === 'resolved';
                  return (
                    <div
                      key={v.id}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border text-xs transition-all ${
                        isResolved 
                          ? 'bg-slate-50/50 border-slate-200 text-slate-705 font-semibold opacity-85' 
                          : `${cfg.bg} ${cfg.border} font-bold`
                      }`}
                    >
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isResolved ? 'bg-emerald-500' : cfg.dot}`} />
                      <span className="text-slate-700 font-extrabold w-24 shrink-0 uppercase tracking-wider">{v.category}</span>
                      <span className="flex-1 text-slate-900 leading-snug">{v.description}</span>
                      <span className={`font-extrabold shrink-0 px-2.5 py-0.5 rounded-full ${
                        isResolved 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-250' 
                          : `${cfg.badge} border`
                      }`}>
                        {isResolved ? '✓ Đã xử lý' : v.delta}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── MILESTONES TIMELINE ───────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-md">
            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2 tracking-wide uppercase">
              <ClipboardCheck className="w-4 h-4 text-teal-600" />
              Mốc Tiến Trình Phác Đồ Điều Trị
            </h3>
            <div className="relative">
              <div className="absolute left-[20px] top-6 bottom-6 w-0.5 bg-slate-200" />
              <div className="space-y-4">
                {pathway.milestones.map((ms) => {
                  const sc      = MS_STATUS_CONFIG[ms.status];
                  const scIcon  = MS_STATUS_ICON[ms.status];
                  const phaseColor = PHASE_COLORS[ms.phase] ?? 'bg-slate-100 text-slate-750';
                  const isLate  = ms.actualDay !== null && ms.actualDay > ms.targetDay;
                  
                  return (
                    <div key={ms.id} className="flex items-start gap-4 pl-1 group">
                      {/* Status dot */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${sc.dotColor} text-white border-2 ${sc.dotBorder} z-10 shadow-sm transition-transform duration-300 group-hover:scale-110`}>
                        {scIcon}
                      </div>
                      
                      {/* Content Card */}
                      <div 
                        className={`flex-1 rounded-xl p-4 border transition-all duration-200 ${sc.bgColor} border-opacity-70 hover:shadow-sm`}
                        style={{ borderColor: sc.dotColor.replace('bg-','').includes('slate') ? '#cbd5e1' : undefined }}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${phaseColor}`}>
                            {ms.phase}
                          </span>
                          <span className="font-extrabold text-slate-900 text-sm tracking-tight">{ms.name}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                            ms.status === 'completed'   ? 'bg-emerald-100 text-emerald-800 border-emerald-250' :
                            ms.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border-blue-250' :
                            ms.status === 'variance'    ? 'bg-rose-100 text-rose-800 border-rose-250' :
                            ms.status === 'at_risk'     ? 'bg-amber-100 text-amber-800 border-amber-250' :
                            'bg-slate-100 text-slate-700 border-slate-250'
                          }`}>
                            {sc.label}
                          </span>
                          {isLate && (
                            <span className="text-xs font-extrabold text-amber-900 bg-amber-100 border border-amber-250 px-2 py-0.5 rounded-full">
                              Trễ +{ms.actualDay! - ms.targetDay} ngày
                            </span>
                          )}
                        </div>
                        
                        <p className="text-xs text-slate-850 font-semibold leading-relaxed">{ms.description}</p>
                        
                        <div className="mt-3 pt-2 border-t border-slate-200/40 flex justify-between text-xs text-slate-700 flex-wrap gap-2">
                          <span>Phụ trách: <strong className="text-slate-900">{ms.responsible}</strong></span>
                          <span className="font-bold">
                            Mục tiêu: Ngày {ms.targetDay}
                            {ms.actualDay !== null && (
                              <> · Thực hiện: <span className={isLate ? 'text-amber-800 font-black' : 'text-emerald-850 font-black'}>Ngày {ms.actualDay}</span>
                                {isLate && <span className="text-amber-900 font-black"> (+{ms.actualDay - ms.targetDay}d)</span>}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Next Actions */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-md">
              <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2 tracking-wide uppercase">
                <Zap className="w-4 h-4 text-amber-500 animate-bounce" />
                Hành Động Lâm Sàng Tiếp Theo
              </h3>
              {pathway.nextActions.length === 0 ? (
                <div className="text-xs text-slate-550 text-center py-6 font-semibold">Không có hành động ưu tiên</div>
              ) : (
                <div className="space-y-3">
                  {pathway.nextActions.map((a) => {
                    const pcfg = PRIORITY_CONFIG[a.priority];
                    return (
                      <div key={a.id} className={`flex items-start gap-3.5 p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100/50 transition-all border border-slate-200`}>
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm border border-slate-200">
                          <ActionIcon type={a.icon} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs md:text-sm font-extrabold text-slate-900 leading-snug">{a.label}</div>
                          <div className="text-xs text-slate-700 font-bold mt-1 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                            {a.assignee}
                          </div>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end">
                          <div className={`text-xs font-extrabold px-2 py-0.5 rounded-full border shadow-sm ${pcfg.badge}`}>
                            {a.priority === 'urgent' ? '🔴 URGENT' : a.priority === 'high' ? '🟠 HIGH' : '🟢 NORMAL'}
                          </div>
                          <div className="text-xs text-slate-750 font-bold mt-2 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-500" /> {a.dueIn}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Discharge Readiness */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-md">
              <h3 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2 tracking-wide uppercase">
                <LogOut className="w-4 h-4 text-emerald-600" />
                Discharge Readiness (Đủ điều kiện xuất viện)
              </h3>
              
              <div className="flex items-center gap-4 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className={`text-3xl font-black shrink-0 ${
                  pathway.dischargeReadiness.pct >= 80 ? 'text-emerald-700' : pathway.dischargeReadiness.pct >= 50 ? 'text-amber-700' : 'text-rose-700'
                }`}>
                  {pathway.dischargeReadiness.pct}%
                </div>
                <div className="flex-1">
                  <div className="w-full bg-slate-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        pathway.dischargeReadiness.pct >= 80 ? 'bg-emerald-600' : pathway.dischargeReadiness.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${pathway.dischargeReadiness.pct}%` }}
                    />
                  </div>
                  <div className={`text-xs font-bold mt-1.5 ${
                    pathway.dischargeReadiness.pct >= 80 ? 'text-emerald-800' : 'text-amber-850'
                  }`}>
                    {pathway.dischargeReadiness.pct >= 80 ? '✓ Sẵn sàng xuất viện' : '⏳ Chưa đủ tiêu chí xuất viện'}
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                {pathway.dischargeReadiness.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-xs p-1 rounded hover:bg-slate-50">
                    {item.done
                      ? <CheckSquare className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                      : <Square className="w-4.5 h-4.5 text-slate-400 shrink-0" />
                    }
                    <span className={item.done ? 'text-slate-900 font-extrabold' : 'text-slate-750 font-bold'}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── CLINICAL INTELLIGENCE (AI) ───────────────────────────── */}
          {pathway.aiRecommendation && (
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-purple-50 to-violet-50 border border-indigo-200 rounded-xl p-6 shadow-md">
              <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
              
              <h3 className="font-bold text-indigo-900 text-sm mb-4 flex items-center gap-2 tracking-wide uppercase">
                <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                Bella Clinical Intelligence
                <span className="text-xs font-bold text-indigo-800/80 ml-1 font-sans">— AI hỗ trợ quyết định</span>
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-indigo-200 shadow-sm">
                  <div className="text-xs font-extrabold text-indigo-900 uppercase tracking-widest mb-1.5">Phát hiện</div>
                  <p className="text-sm text-slate-900 font-extrabold leading-relaxed">{pathway.aiRecommendation.finding}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-indigo-200 shadow-sm">
                    <div className="text-xs font-extrabold text-indigo-900 uppercase tracking-widest mb-1.5">Nguyên nhân dự đoán</div>
                    <p className="text-xs text-slate-800 font-extrabold leading-relaxed">{pathway.aiRecommendation.cause}</p>
                  </div>
                  <div className="p-4 bg-emerald-50/80 backdrop-blur-sm rounded-xl border border-emerald-200 shadow-sm">
                    <div className="text-xs font-extrabold text-emerald-900 uppercase tracking-widest mb-1.5">Đề xuất xử lý</div>
                    <p className="text-xs text-slate-850 font-black leading-relaxed">{pathway.aiRecommendation.suggestion}</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs pt-2">
                  <span className="flex items-center gap-1.5 text-amber-900 font-extrabold bg-amber-50 border border-amber-250 px-3.5 py-2 rounded-full shadow-sm">
                    <Brain className="w-3.5 h-3.5 text-amber-600" /> Mức ảnh hưởng: {pathway.aiRecommendation.impact}
                  </span>
                  <span className="flex items-center gap-1.5 text-indigo-900 font-extrabold bg-indigo-50 border border-indigo-250 px-3.5 py-2 rounded-full shadow-sm">
                    <User className="w-3.5 h-3.5 text-indigo-600" /> Quyền quyết định: {pathway.aiRecommendation.decisionOwner}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── VARIANCE LOG ─────────────────────────────────────────── */}
          {pathway.varianceNotes.length > 0 && (
            <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-5 shadow-sm">
              <h3 className="font-bold text-amber-900 text-sm mb-3 flex items-center gap-2 tracking-wide uppercase">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                Variance Log (Nhật ký sai lệch phác đồ)
              </h3>
              <ul className="space-y-2">
                {pathway.varianceNotes.map((note, i) => (
                  <li key={i} className="text-xs text-amber-950 font-bold flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                    <span className="leading-normal">{note}</span>
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
