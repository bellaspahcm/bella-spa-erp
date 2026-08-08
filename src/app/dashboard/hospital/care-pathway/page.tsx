'use client';

import React, { useState } from 'react';
import {
  GitBranch,
  CheckCircle2,
  Clock,
  Circle,
  AlertCircle,
  ChevronRight,
  Bed,
  Pill,
  Stethoscope,
  FileText,
  Activity,
  LogOut,
} from 'lucide-react';

// ─── Care Pathway Types ───────────────────────────────────────────────────────
type MilestoneStatus = 'completed' | 'in_progress' | 'pending' | 'skipped';

interface CarePathwayMilestone {
  id: string;
  phase: string;
  name: string;
  description: string;
  targetDay: number;
  actualDay: number | null;
  status: MilestoneStatus;
  responsible: string;
  icon: 'bed' | 'pill' | 'stethoscope' | 'lab' | 'activity' | 'discharge';
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
      {
        id: 'ms-01', phase: 'Nhập viện', name: 'Tiếp nhận & Đánh giá ban đầu',
        description: 'Khám lâm sàng, siêu âm bụng, xét nghiệm máu',
        targetDay: 1, actualDay: 1, status: 'completed', responsible: 'BS. Cấp cứu', icon: 'stethoscope',
      },
      {
        id: 'ms-02', phase: 'Phẫu thuật', name: 'Cắt ruột thừa nội soi',
        description: 'Phẫu thuật nội soi 3 trocar, gây mê nội khí quản',
        targetDay: 1, actualDay: 1, status: 'completed', responsible: 'BS.CKII Phạm Quốc Việt', icon: 'stethoscope',
      },
      {
        id: 'ms-03', phase: 'Hậu phẫu', name: 'Theo dõi phòng hồi tỉnh (PACU)',
        description: 'Theo dõi sinh hiệu 2g, đánh giá tỉnh mê, đau sau mổ',
        targetDay: 1, actualDay: 1, status: 'completed', responsible: 'Điều dưỡng PACU', icon: 'activity',
      },
      {
        id: 'ms-04', phase: 'Hậu phẫu', name: 'Kháng sinh dự phòng & Giảm đau',
        description: 'Cefazolin 1g IV Q8H × 24h, Paracetamol IV Q6H',
        targetDay: 2, actualDay: 2, status: 'completed', responsible: 'BS. Điều trị', icon: 'pill',
      },
      {
        id: 'ms-05', phase: 'Phục hồi', name: 'Bắt đầu ăn lỏng',
        description: 'Đánh giá nhu động ruột, cho uống nước và ăn lỏng',
        targetDay: 2, actualDay: 3, status: 'completed', responsible: 'Điều dưỡng', icon: 'activity',
      },
      {
        id: 'ms-06', phase: 'Phục hồi', name: 'Rút drain bụng',
        description: 'Kiểm tra dịch drain < 50ml/24h, rút drain',
        targetDay: 3, actualDay: 5, status: 'completed', responsible: 'BS.CKII Phạm Quốc Việt', icon: 'stethoscope',
      },
      {
        id: 'ms-07', phase: 'Xuất viện', name: 'Đánh giá tiêu chuẩn xuất viện',
        description: 'VAS ≤ 3, ăn được, không sốt, vết mổ khô',
        targetDay: 5, actualDay: 8, status: 'in_progress', responsible: 'BS. Điều trị', icon: 'discharge',
      },
      {
        id: 'ms-08', phase: 'Xuất viện', name: 'Lập toa & Hướng dẫn xuất viện',
        description: 'Toa Augmentin, lịch tái khám, hướng dẫn chăm sóc vết mổ',
        targetDay: 5, actualDay: null, status: 'pending', responsible: 'BS. Điều trị', icon: 'filetext',
      },
    ],
    varianceNotes: [
      'Ngày 3: Trễ ăn lỏng do bệnh nhân buồn nôn sau gây mê — đã xử lý bằng Ondansetron.',
      'Ngày 5: Trễ rút drain do vẫn còn 80ml dịch — giảm về 25ml ngày 5, rút được ngày 5.',
      'Ngày 5-7: Kéo dài nằm viện 2 ngày so với LOS mục tiêu.',
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
      {
        id: 'ms-11', phase: 'Nhập viện', name: 'Đánh giá và ổn định ban đầu',
        description: 'ECG 12 chuyển đạo, X-quang ngực, BNP, siêu âm tim',
        targetDay: 1, actualDay: 1, status: 'completed', responsible: 'BS. Cấp cứu', icon: 'stethoscope',
      },
      {
        id: 'ms-12', phase: 'Điều trị tích cực', name: 'Lợi tiểu IV tĩnh mạch',
        description: 'Furosemide IV bolus → infusion, mục tiêu âm 1-2L/ngày',
        targetDay: 1, actualDay: 1, status: 'completed', responsible: 'BS. Nguyễn Thu Hà', icon: 'pill',
      },
      {
        id: 'ms-13', phase: 'Điều trị tích cực', name: 'Tối ưu hóa phác đồ nền',
        description: 'Điều chỉnh RAAS, beta-blocker, thêm SGLT2i nếu thích hợp',
        targetDay: 2, actualDay: null, status: 'in_progress', responsible: 'BS. Nguyễn Thu Hà', icon: 'pill',
      },
      {
        id: 'ms-14', phase: 'Theo dõi', name: 'Theo dõi cân nặng & cân bằng dịch',
        description: 'Cân nặng buổi sáng, I&O chart mỗi ca, siêu âm IVC',
        targetDay: 3, actualDay: null, status: 'pending', responsible: 'Điều dưỡng', icon: 'activity',
      },
      {
        id: 'ms-15', phase: 'Phục hồi', name: 'Chuyển sang thuốc uống',
        description: 'Khi khô phổi, chuyển Furosemide IV → PO',
        targetDay: 3, actualDay: null, status: 'pending', responsible: 'BS. Nguyễn Thu Hà', icon: 'pill',
      },
      {
        id: 'ms-16', phase: 'Xuất viện', name: 'Giáo dục bệnh nhân & Lập kế hoạch xuất viện',
        description: 'Hướng dẫn chế độ ăn giảm muối, theo dõi cân nặng tại nhà',
        targetDay: 5, actualDay: null, status: 'pending', responsible: 'Điều dưỡng + BS', icon: 'discharge',
      },
    ],
    varianceNotes: [],
  },
];

const MILESTONE_STATUS_CONFIG: Record<MilestoneStatus, { icon: React.ReactNode; color: string; bg: string }> = {
  completed:   { icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-700', bg: 'bg-emerald-500' },
  in_progress: { icon: <Activity className="w-4 h-4" />,    color: 'text-blue-700',    bg: 'bg-blue-500' },
  pending:     { icon: <Circle className="w-4 h-4" />,       color: 'text-slate-400',   bg: 'bg-slate-200' },
  skipped:     { icon: <AlertCircle className="w-4 h-4" />,  color: 'text-amber-600',   bg: 'bg-amber-400' },
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

export default function HospitalCarePathwayPage() {
  const [selectedCase, setSelectedCase] = useState<string>(MOCK_PATHWAYS[0].caseId);
  const pathway = MOCK_PATHWAYS.find((p) => p.caseId === selectedCase) ?? MOCK_PATHWAYS[0];
  const completed = pathway.milestones.filter((m) => m.status === 'completed').length;
  const progress = Math.round((completed / pathway.milestones.length) * 100);
  const isOverLOS = pathway.currentDay > pathway.targetLOS;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-900 via-emerald-900 to-green-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center space-x-2 text-teal-300 mb-1">
          <GitBranch className="w-5 h-5" />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Bella Hospital • Clinical Care Pathway Management
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold">Hành Trình Điều Trị Nội Trú</h1>
        <p className="text-teal-100 text-sm mt-1">
          Theo dõi tuân thủ phác đồ điều trị (Clinical Pathway) theo DRG, phát hiện sai lệch (variance) và tối ưu thời gian nằm viện.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Case List */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="font-bold text-slate-700 text-sm px-1">Bệnh nhân đang theo phác đồ</h3>
          {MOCK_PATHWAYS.map((p) => {
            const done = p.milestones.filter((m) => m.status === 'completed').length;
            const pct = Math.round((done / p.milestones.length) * 100);
            const over = p.currentDay > p.targetLOS;
            return (
              <button
                key={p.caseId}
                onClick={() => setSelectedCase(p.caseId)}
                className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all ${
                  selectedCase === p.caseId ? 'border-teal-500 ring-2 ring-teal-200' : over ? 'border-amber-300' : 'border-slate-200'
                }`}
              >
                <div className="font-bold text-slate-800 text-sm">{p.patientName}</div>
                <div className="text-xs text-slate-500 mt-0.5">{p.wardBed} · Ngày {p.currentDay}/{p.targetLOS}</div>
                {over && (
                  <div className="text-[10px] font-bold text-amber-700 mt-1">⚠ Vượt LOS mục tiêu {p.currentDay - p.targetLOS} ngày</div>
                )}
                <div className="mt-2">
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{pct}% hoàn thành ({done}/{p.milestones.length} milestones)</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Pathway Detail */}
        <div className="lg:col-span-3 space-y-5">
          {/* Case Header */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs text-slate-500 font-semibold">{pathway.drgCode}</div>
                <h2 className="font-bold text-slate-900 text-lg">{pathway.pathwayName}</h2>
                <div className="text-sm text-slate-600 mt-0.5">
                  {pathway.patientName} · {pathway.wardBed} · BS: {pathway.attendingPhysician}
                </div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-black ${isOverLOS ? 'text-amber-700' : 'text-teal-700'}`}>
                  Ngày {pathway.currentDay}/{pathway.targetLOS}
                </div>
                <div className="text-xs text-slate-500">LOS hiện tại / mục tiêu</div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Tiến độ phác đồ</span>
                <span className="font-bold text-teal-700">{progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Milestones Timeline */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Milestones Phác Đồ Điều Trị</h3>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />
              <div className="space-y-4">
                {pathway.milestones.map((ms) => {
                  const sc = MILESTONE_STATUS_CONFIG[ms.status];
                  const phaseColor = PHASE_COLORS[ms.phase] ?? 'bg-slate-100 text-slate-700';
                  const isLate = ms.actualDay !== null && ms.actualDay > ms.targetDay;
                  return (
                    <div key={ms.id} className="flex items-start space-x-4 pl-2">
                      {/* Status dot */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${sc.bg} text-white z-10`}>
                        {sc.icon}
                      </div>
                      <div className="flex-1 bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${phaseColor}`}>
                            {ms.phase}
                          </span>
                          <span className="font-semibold text-slate-800 text-sm">{ms.name}</span>
                          {isLate && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                              Trễ {(ms.actualDay! - ms.targetDay)} ngày
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{ms.description}</div>
                        <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
                          <span>Phụ trách: <strong className="text-slate-600">{ms.responsible}</strong></span>
                          <span>
                            Mục tiêu: Ngày {ms.targetDay}
                            {ms.actualDay !== null && ` · Thực hiện: Ngày ${ms.actualDay}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Variance Notes */}
          {pathway.varianceNotes.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-sm">
              <h3 className="font-bold text-amber-800 text-sm mb-3 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4" />
                <span>Ghi nhận sai lệch so với phác đồ (Variance Log)</span>
              </h3>
              <ul className="space-y-1.5">
                {pathway.varianceNotes.map((note, i) => (
                  <li key={i} className="text-xs text-amber-700 flex items-start space-x-2">
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
