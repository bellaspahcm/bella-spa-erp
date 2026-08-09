'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Plus,
  BarChart3,
  TrendingUp,
  Sparkles,
  User,
  Activity,
  History,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  PlusCircle,
  Search
} from 'lucide-react';

// ─── SAFETY AUDIT TYPES ──────────────────────────────────────────────────────
type AuditStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue';
type AuditCategory = 'hand_hygiene' | 'medication_safety' | 'infection_control' | 'fall_prevention' | 'documentation' | 'emergency_response';
type FindingResult = 'compliant' | 'partial' | 'non_compliant' | 'na';
type RiskRating = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
type AuditFramework = 'JCI' | 'WHO' | 'CDC' | 'ISO' | 'Hospital-defined';

interface CorrectiveAction {
  id: string;
  action: string;
  owner: string;
  dueDate: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
}

interface AuditChecklistItem {
  id: string;
  criterion: string;
  standard: string;
  result: FindingResult;
  risk: RiskRating;
  finding: string;
  isRecurring: boolean;
  action?: CorrectiveAction;
}

interface SafetyAudit {
  id: string;
  auditNo: string;
  title: string;
  category: AuditCategory;
  framework: AuditFramework;
  targetWard: string;
  auditor: string;
  scheduledDate: string;
  completedDate: string | null;
  status: AuditStatus;
  overallScore: number | null;
  previousScore: number | null;
  totalItems: number;
  compliantItems: number;
  checklist: AuditChecklistItem[];
  historicalScores: { month: string; score: number }[];
}

// ─── INITIAL MOCK DATA ────────────────────────────────────────────────────────
const INITIAL_AUDITS: SafetyAudit[] = [
  {
    id: 'aud-001',
    auditNo: 'AUD-2026-08-001',
    title: 'Kiểm toán Vệ Sinh Tay & Phòng Ngừa KSNK — Khoa ICU',
    category: 'hand_hygiene',
    framework: 'JCI',
    targetWard: 'Khoa ICU',
    auditor: 'ThS. Phạm Thị Lan — Ủy ban KSNK',
    scheduledDate: '2026-08-05',
    completedDate: '2026-08-05',
    status: 'completed',
    overallScore: 78,
    previousScore: 71,
    totalItems: 10,
    compliantItems: 7,
    historicalScores: [
      { month: 'Jun 2026', score: 83 },
      { month: 'Jul 2026', score: 71 },
      { month: 'Aug 2026', score: 78 }
    ],
    checklist: [
      { id: 'ci-01', criterion: 'Rửa tay đúng 6 bước WHO trước chăm sóc BN', standard: 'WHO Hand Hygiene 5 Moments', result: 'compliant', risk: 'LOW', finding: 'Tất cả nhân viên thực hiện đúng.', isRecurring: false },
      { id: 'ci-02', criterion: 'Sử dụng dung dịch sát khuẩn tay nhanh đúng vị trí', standard: 'WHO / JCI', result: 'compliant', risk: 'LOW', finding: 'Bình rửa tay đầy đủ, dễ tiếp cận.', isRecurring: false },
      { id: 'ci-03', criterion: 'Thay găng tay giữa các bệnh nhân', standard: 'CDC 2024', result: 'partial', risk: 'MEDIUM', finding: '2/8 quan sát không thay găng giữa BN liền kề.', isRecurring: true, action: {
        id: 'act-01', action: 'Đào tạo lại quy trình thay găng tay vô khuẩn cho điều dưỡng ca trực.', owner: 'Điều dưỡng trưởng ICU', dueDate: '2026-08-15', status: 'IN_PROGRESS'
      }},
      { id: 'ci-04', criterion: 'Tuân thủ quy trình đặt và chăm sóc catheter trung tâm (CLABSI bundle)', standard: 'IHI CLABSI Bundle', result: 'non_compliant', risk: 'HIGH', finding: 'Thiếu check-list xác nhận khi đặt CVC. 1 trường hợp không dùng tấm drap toàn thân.', isRecurring: true, action: {
        id: 'act-02', action: 'Bổ sung checklist đặt CVC bắt buộc tại bàn chuẩn bị dụng cụ.', owner: 'BS. Trưởng khoa ICU', dueDate: '2026-08-12', status: 'PENDING'
      }},
      { id: 'ci-05', criterion: 'Thay bộ dây truyền dịch đúng lịch (96h)', standard: 'CDC IV Bundle', result: 'compliant', risk: 'LOW', finding: 'Có dán nhãn ngày thay đầy đủ.', isRecurring: false },
    ],
  },
  {
    id: 'aud-002',
    auditNo: 'AUD-2026-08-002',
    title: 'Kiểm toán An Toàn Dùng Thuốc — Khoa Nội Tổng Hợp',
    category: 'medication_safety',
    framework: 'ISO',
    targetWard: 'Khoa Nội Tổng Hợp',
    auditor: 'DS. Nguyễn Thị Mai — Khoa Dược',
    scheduledDate: '2026-08-07',
    completedDate: null,
    status: 'in_progress',
    overallScore: null,
    previousScore: 85,
    totalItems: 8,
    compliantItems: 0,
    historicalScores: [
      { month: 'Jun 2026', score: 88 },
      { month: 'Jul 2026', score: 85 }
    ],
    checklist: [
      { id: 'ci-11', criterion: 'Ghi y lệnh điện tử đầy đủ (liều, đường dùng, tần suất)', standard: 'ISMP 2024', result: 'compliant', risk: 'LOW', finding: 'Hệ thống e-prescription hoạt động tốt.', isRecurring: false },
      { id: 'ci-12', criterion: 'Double-check thuốc có nguy cơ cao (Kali Clorua, Insulin) trước tiêm', standard: 'ISMP High-Alert Medications', result: 'non_compliant', risk: 'CRITICAL', finding: 'ĐD tiêm truyền Kali Clorua không thực hiện đối chiếu độc lập 2 người.', isRecurring: false, action: {
        id: 'act-03', action: 'Đình chỉ lâm sàng tạm thời đối với nhân sự vi phạm quy trình high-alert, đào tạo lại bắt buộc.', owner: 'ĐD. Trưởng Nội khoa', dueDate: '2026-08-09', status: 'IN_PROGRESS'
      }},
    ],
  },
  {
    id: 'aud-003',
    auditNo: 'AUD-2026-08-003',
    title: 'Kiểm toán Phòng Ngừa Té Ngã — Khoa Tim Mạch',
    category: 'fall_prevention',
    framework: 'WHO',
    targetWard: 'Khoa Tim Mạch',
    auditor: 'ĐD. Trưởng khoa Hường',
    scheduledDate: '2026-08-10',
    completedDate: null,
    status: 'scheduled',
    overallScore: null,
    previousScore: null,
    totalItems: 6,
    compliantItems: 0,
    historicalScores: [],
    checklist: [],
  },
  {
    id: 'aud-004',
    auditNo: 'AUD-2026-07-005',
    title: 'Kiểm toán Hồ Sơ Bệnh Án & Tài Liệu Lâm Sàng — Khoa Ngoại',
    category: 'documentation',
    framework: 'CDC',
    targetWard: 'Khoa Ngoại',
    auditor: 'BS. Chất lượng Hoài',
    scheduledDate: '2026-07-25',
    completedDate: null,
    status: 'overdue',
    overallScore: null,
    previousScore: 80,
    totalItems: 12,
    compliantItems: 0,
    historicalScores: [
      { month: 'Jun 2026', score: 80 }
    ],
    checklist: [],
  },
];

const CATEGORY_CONFIG: Record<AuditCategory, { label: string; color: string }> = {
  hand_hygiene:       { label: 'Vệ sinh tay',       color: 'bg-blue-50 text-blue-700 border-blue-200' },
  medication_safety:  { label: 'An toàn thuốc',     color: 'bg-purple-50 text-purple-700 border-purple-200' },
  infection_control:  { label: 'Kiểm soát NK',      color: 'bg-rose-50 text-rose-700 border-rose-200' },
  fall_prevention:    { label: 'Phòng ngừa ngã',    color: 'bg-amber-50 text-amber-700 border-amber-200' },
  documentation:      { label: 'Hồ sơ tài liệu',   color: 'bg-teal-50 text-teal-700 border-teal-200' },
  emergency_response: { label: 'Đáp ứng cấp cứu',  color: 'bg-orange-50 text-orange-700 border-orange-200' },
};

const STATUS_CONFIG: Record<AuditStatus, { label: string; color: string }> = {
  scheduled:   { label: 'Lên kế hoạch', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  in_progress: { label: 'Đang tiến hành', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  completed:   { label: 'Hoàn thành',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  overdue:     { label: 'Quá hạn',      color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const RESULT_CONFIG: Record<FindingResult, { label: string; icon: React.ReactNode; color: string; border: string }> = {
  compliant:     { label: 'Tuân thủ',    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, color: 'bg-emerald-50 text-emerald-800', border: 'border-emerald-200' },
  partial:       { label: 'Tuân thủ 1 phần', icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, color: 'bg-amber-50 text-amber-800', border: 'border-amber-200' },
  non_compliant: { label: 'Không tuân thủ', icon: <XCircle className="w-4 h-4 text-rose-600" />, color: 'bg-rose-50 text-rose-800', border: 'border-rose-200' },
  na:            { label: 'Không áp dụng', icon: <Clock className="w-4 h-4 text-slate-400" />, color: 'bg-slate-50 text-slate-700', border: 'border-slate-200' },
};

const RISK_CONFIG: Record<RiskRating, { label: string; color: string }> = {
  LOW:      { label: 'Low Risk',      color: 'bg-slate-100 text-slate-700' },
  MEDIUM:   { label: 'Medium Risk',   color: 'bg-amber-100 text-amber-800' },
  HIGH:     { label: 'High Risk',     color: 'bg-orange-100 text-orange-800' },
  CRITICAL: { label: 'Critical Risk', color: 'bg-rose-100 text-rose-800 animate-pulse' },
};

export default function HospitalSafetyAuditPage() {
  const [audits, setAudits] = useState<SafetyAudit[]>(INITIAL_AUDITS);
  const [selected, setSelected] = useState<string | null>('aud-001');

  // Search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFramework, setFilterFramework] = useState<AuditFramework | 'all'>('all');

  // Modal scheduler
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<AuditCategory>('hand_hygiene');
  const [newFramework, setNewFramework] = useState<AuditFramework>('JCI');
  const [newWard, setNewWard] = useState('');
  const [newAuditor, setNewAuditor] = useState('');
  const [newDate, setNewDate] = useState('');

  const selectedAudit = useMemo(() => audits.find((a) => a.id === selected), [audits, selected]);

  const filteredAudits = useMemo(() => {
    return audits.filter((a) => {
      const matchSearch =
        a.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.targetWard.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchFramework = filterFramework === 'all' || a.framework === filterFramework;

      return matchSearch && matchFramework;
    });
  }, [audits, searchTerm, filterFramework]);

  // Calculations for KPI
  const completedAudits = audits.filter((a) => a.status === 'completed').length;
  const overdueAudits = audits.filter((a) => a.status === 'overdue').length;
  
  const avgScore = useMemo(() => {
    const scored = audits.filter((a) => a.overallScore !== null);
    if (scored.length === 0) return 0;
    return Math.round(scored.reduce((sum, a) => sum + (a.overallScore ?? 0), 0) / scored.length);
  }, [audits]);

  const scoreTrendText = "+4.2% vs tháng trước";

  // Priority order checklist: Non-compliant and partial items first
  const sortedChecklist = useMemo(() => {
    if (!selectedAudit || !selectedAudit.checklist) return [];
    return [...selectedAudit.checklist].sort((a, b) => {
      const order: Record<FindingResult, number> = { non_compliant: 1, partial: 2, compliant: 3, na: 4 };
      return order[a.result] - order[b.result];
    });
  }, [selectedAudit]);

  // Quality cross-domain AI analysis text for audits
  const aiQualityInsight = useMemo(() => {
    if (!selectedAudit) return null;
    if (selectedAudit.id === 'aud-001') {
      return {
        correlation: 'Phát hiện sự tương quan chéo: Khoa ICU có 3 lần không tuân thủ CLABSI bundle trong 90 ngày qua, trùng hợp với 2 sự cố nhiễm khuẩn catheter trung tâm được ghi nhận ở Safety Incident Engine. Tần suất ĐD trực quá tải liên đới làm tăng 35% nguy cơ rủi ro.',
        recurringCount: 2,
        probRecurring: 'HIGH (88%)',
        suggestion: 'Kiểm tra quy cách vật tư catheter trung tâm dự phòng và tăng chu kỳ giám sát KSNK mỗi ca trực.'
      };
    }
    if (selectedAudit.id === 'aud-002') {
      return {
        correlation: 'Định danh rủi ro Critical: Việc không thực hiện đối chiếu thuốc high-alert tại Nội khoa trùng hợp với một sự cố Near Miss liên quan cấp phát kháng sinh kháng thuốc tuần trước. Thiếu hụt cơ chế đối chiếu kép có thể dẫn đến hậu quả nghiêm trọng.',
        recurringCount: 1,
        probRecurring: 'MEDIUM (62%)',
        suggestion: 'Áp dụng khóa số y lệnh điện tử tiêm truyền Kali Clorua trừ khi có chữ ký số xác nhận của 2 ĐD.'
      };
    }
    return null;
  }, [selectedAudit]);

  // Handle create scheduled audit
  const handleScheduleAudit = (e: React.FormEvent) => {
    e.preventDefault();
    const newAuditObj: SafetyAudit = {
      id: `aud-${Date.now()}`,
      auditNo: `AUD-2026-08-0${Math.floor(10 + Math.random() * 90)}`,
      title: newTitle,
      category: newCategory,
      framework: newFramework,
      targetWard: newWard,
      auditor: newAuditor,
      scheduledDate: newDate,
      completedDate: null,
      status: 'scheduled',
      overallScore: null,
      previousScore: 82, // mock previous
      totalItems: 5,
      compliantItems: 0,
      checklist: [],
      historicalScores: [],
    };
    setAudits((prev) => [newAuditObj, ...prev]);
    setIsScheduleOpen(false);
    setNewTitle('');
    setNewWard('');
    setNewAuditor('');
    setNewDate('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none">
      
      {/* Header Banner - Clinical Safety & Quality Control theme (indigo/teal container) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-indigo-500/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-indigo-400 mb-1">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Bella Hospital • Clinical Safety Audit System
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white !text-white">
              Kiểm Toán An Toàn Bệnh Viện
            </h1>
            <p className="text-indigo-200/85 text-sm mt-1 max-w-xl leading-relaxed">
              Quan sát hành vi lâm sàng, đối soát tuân thủ tiêu chuẩn chất lượng JCI, WHO, CDC và tự động khởi tạo luồng giải pháp cải tiến chất lượng an toàn.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 shrink-0 w-full md:w-auto text-center font-bold">
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-2xl font-black text-emerald-400">{completedAudits}</div>
              <div className="text-[10px] text-slate-300 font-semibold uppercase mt-0.5">Hoàn thành</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-2xl font-black text-rose-400">{overdueAudits}</div>
              <div className="text-[10px] text-rose-200/80 font-semibold uppercase mt-0.5">Quá hạn</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10">
              <div className="text-2xl font-black text-amber-300">{avgScore}%</div>
              <div className="text-[9px] text-slate-200 font-semibold mt-0.5">{scoreTrendText}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter panel & search */}
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          <div className="relative w-64 shrink-0">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm kiểm toán, khoa phòng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-slate-300 rounded-xl text-sm focus:outline-none bg-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center space-x-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600">
            <span>Tiêu chuẩn:</span>
            <select
              value={filterFramework}
              onChange={(e) => setFilterFramework(e.target.value as AuditFramework | 'all')}
              className="bg-transparent border-none outline-none font-bold text-slate-800"
            >
              <option value="all">Tất cả Framework</option>
              <option value="JCI">JCI</option>
              <option value="WHO">WHO</option>
              <option value="CDC">CDC</option>
              <option value="ISO">ISO</option>
              <option value="Hospital-defined">Nội bộ Viện</option>
            </select>
          </div>
        </div>

        <button
          onClick={() => setIsScheduleOpen(true)}
          className="flex items-center space-x-1.5 bg-indigo-700 hover:bg-indigo-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Lên lịch kiểm toán mới</span>
        </button>
      </div>

      {/* Audit List + Details workspace split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: AUDITS LIST */}
        <div className="lg:col-span-1 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {filteredAudits.map((audit) => {
            const cat = CATEGORY_CONFIG[audit.category];
            const status = STATUS_CONFIG[audit.status];
            return (
              <button
                key={audit.id}
                onClick={() => setSelected(audit.id === selected ? null : audit.id)}
                className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-2 relative ${
                  selected === audit.id ? 'border-indigo-600 ring-2 ring-indigo-100' :
                  audit.status === 'overdue' ? 'border-rose-200 bg-rose-50/10' : 'border-slate-200'
                }`}
              >
                <div className="flex justify-between items-center flex-wrap gap-1">
                  <div className={`text-[9px] font-black px-2 py-0.5 rounded border ${cat.color}`}>
                    {cat.label} ({audit.framework})
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${status.color}`}>
                    {status.label}
                  </span>
                </div>

                <div>
                  <h4 className="font-extrabold text-slate-800 text-xs block leading-tight">{audit.title}</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">
                    Khoa: {audit.targetWard} · Hạn: {audit.scheduledDate}
                  </p>
                </div>

                {audit.overallScore !== null && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[9px] font-black text-slate-500">
                      <span>Điểm tuân thủ: {audit.overallScore}%</span>
                      {audit.previousScore && (
                        <span className={audit.overallScore >= audit.previousScore ? 'text-emerald-600' : 'text-rose-600'}>
                          {audit.overallScore >= audit.previousScore ? '▲' : '▼'} {Math.abs(audit.overallScore - audit.previousScore)}% vs trước
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          audit.overallScore >= 80 ? 'bg-emerald-500' : audit.overallScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${audit.overallScore}%` }}
                      />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* RIGHT COLUMN: WORKSPACE DETAILS */}
        <div className="lg:col-span-2">
          {selectedAudit ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              
              {/* Workspace Header */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-950 px-5 py-4 border-b border-slate-800 flex justify-between items-center text-white">
                <div>
                  <span className="text-[9px] font-black text-indigo-400 border border-indigo-500/20 bg-indigo-950/40 px-2 py-0.5 rounded uppercase">
                    Tiêu chuẩn {selectedAudit.framework}
                  </span>
                  <h3 className="font-extrabold text-slate-100 text-sm mt-1">{selectedAudit.title}</h3>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Mã kiểm toán: {selectedAudit.auditNo} · Giám sát: {selectedAudit.auditor}
                  </p>
                </div>
                <span className={`text-[9px] font-black px-2 py-1 rounded border uppercase ${STATUS_CONFIG[selectedAudit.status].color}`}>
                  {STATUS_CONFIG[selectedAudit.status].label}
                </span>
              </div>

              {/* Workspace Body */}
              <div className="p-5 flex-1 space-y-6 overflow-y-auto max-h-[60vh]">
                
                {/* 1. COMPLIANCE SCORE METER */}
                {selectedAudit.overallScore !== null && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                      <span>Điểm tuân thủ tổng hợp</span>
                      <div className="flex items-center space-x-2">
                        {selectedAudit.previousScore && (
                          <span className={`text-[10px] font-extrabold ${selectedAudit.overallScore >= selectedAudit.previousScore ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {selectedAudit.overallScore >= selectedAudit.previousScore ? 'Tăng' : 'Giảm'} {Math.abs(selectedAudit.overallScore - selectedAudit.previousScore)}% vs kỳ trước ({selectedAudit.previousScore}%)
                          </span>
                        )}
                        <span className={`text-2xl font-black ${selectedAudit.overallScore >= 80 ? 'text-emerald-700' : selectedAudit.overallScore >= 60 ? 'text-amber-700' : 'text-rose-700'}`}>
                          {selectedAudit.overallScore}%
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${selectedAudit.overallScore >= 80 ? 'bg-emerald-500' : selectedAudit.overallScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                        style={{ width: `${selectedAudit.overallScore}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                      <span>Tuân thủ {selectedAudit.compliantItems}/{selectedAudit.totalItems} tiêu chuẩn kiểm toán</span>
                      {selectedAudit.overallScore < 80 ? (
                        <span className="text-rose-600">Dưới ngưỡng an toàn bệnh viện (yêu cầu ≥80%)</span>
                      ) : (
                        <span className="text-emerald-600">Đạt ngưỡng an toàn bệnh viện</span>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. OPTIMIZED VISUAL HIERARCHY: CRITICAL & NON-COMPLIANT FINDINGS FIRST */}
                {selectedAudit.checklist.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                      Kết quả chi tiết (Sự cố không tuân thủ xếp trước)
                    </h4>
                    
                    <div className="space-y-3">
                      {sortedChecklist.map((item) => {
                        const rc = RESULT_CONFIG[item.result];
                        const risk = RISK_CONFIG[item.risk];
                        
                        return (
                          <div
                            key={item.id}
                            className={`border rounded-xl p-4 shadow-sm flex flex-col gap-3 relative transition-all ${
                              item.result === 'non_compliant' ? 'bg-rose-50/30 border-rose-200' :
                              item.result === 'partial' ? 'bg-amber-50/20 border-amber-200' : 'bg-white border-slate-100'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-start space-x-2">
                                <div className="mt-0.5 shrink-0">{rc.icon}</div>
                                <div>
                                  <h5 className="font-bold text-slate-800 text-xs">{item.criterion}</h5>
                                  <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Tiêu chuẩn: {item.standard}</span>
                                </div>
                              </div>

                              <div className="flex space-x-1 shrink-0">
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border uppercase ${rc.color} ${rc.border}`}>
                                  {rc.label}
                                </span>
                                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${risk.color}`}>
                                  {risk.label}
                                </span>
                                {item.isRecurring && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-700 text-white animate-pulse">
                                    Recurring Non-Conformity
                                  </span>
                                )}
                              </div>
                            </div>

                            {item.finding && (
                              <div className="text-xs font-semibold text-slate-700 bg-white/70 border border-slate-100 p-2.5 rounded-lg italic">
                                &ldquo; {item.finding} &rdquo;
                              </div>
                            )}

                            {/* 3. EMBEDDED CORRECTIVE ACTION / CAPA LEDGER */}
                            {(item.result === 'non_compliant' || item.result === 'partial') && (
                              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2.5">
                                <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 uppercase">
                                  <span>Hành động khắc phục CAPA</span>
                                  {item.action && (
                                    <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                      CAPA: {item.action.status}
                                    </span>
                                  )}
                                </div>

                                {item.action ? (
                                  <div className="text-xs font-bold text-slate-700 space-y-1.5 font-mono">
                                    <div>Phương án: <span className="text-slate-900 font-sans">{item.action.action}</span></div>
                                    <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 pt-1">
                                      <div>Chịu trách nhiệm: <strong className="text-slate-700">{item.action.owner}</strong></div>
                                      <div>Hạn chót: <strong className="text-slate-700">{item.action.dueDate}</strong></div>
                                    </div>
                                    
                                    {item.action.status !== 'VERIFIED' && (
                                      <button
                                        onClick={() => {
                                          setAudits((prev) =>
                                            prev.map((a) => {
                                              if (a.id !== selectedAudit.id) return a;
                                              return {
                                                ...a,
                                                checklist: a.checklist.map((cl) => {
                                                  if (cl.id !== item.id) return cl;
                                                  return {
                                                    ...cl,
                                                    action: cl.action ? { ...cl.action, status: 'VERIFIED' } : undefined,
                                                  };
                                                }),
                                              };
                                            })
                                          );
                                        }}
                                        className="mt-2 text-[9px] bg-slate-800 hover:bg-slate-900 text-white font-bold px-2 py-1 rounded transition-all"
                                      >
                                        Xác nhận khắc phục hoàn thành (Verify)
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] text-slate-400 font-medium">Chưa có hành động khắc phục nào được khởi tạo.</span>
                                    <button
                                      onClick={() => {
                                        const actionDesc = prompt('Mô tả hành động khắc phục:');
                                        if (actionDesc) {
                                          const newAct: CorrectiveAction = {
                                            id: `act-${Date.now()}`,
                                            action: actionDesc,
                                            owner: 'Điều dưỡng trưởng ICU',
                                            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                                            status: 'PENDING',
                                          };
                                          setAudits((prev) =>
                                            prev.map((a) => {
                                              if (a.id !== selectedAudit.id) return a;
                                              return {
                                                ...a,
                                                checklist: a.checklist.map((cl) => {
                                                  if (cl.id !== item.id) return cl;
                                                  return { ...cl, action: newAct };
                                                }),
                                              };
                                            })
                                          );
                                        }
                                      }}
                                      className="bg-rose-700 hover:bg-rose-800 text-white font-bold text-[9px] px-2 py-1 rounded transition-all"
                                    >
                                      + Tạo CAPA mới
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>

                  </div>
                )}

                {/* 4. PREVIOUS AUDIT COMPARISON & HISTORY */}
                {selectedAudit.historicalScores.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Lịch sử điểm tuân thủ các tháng trước</h4>
                    <div className="flex justify-between items-end h-16 pt-2 font-mono text-[10px]">
                      {selectedAudit.historicalScores.map((h, idx) => (
                        <div key={idx} className="flex flex-col items-center space-y-1.5 flex-1">
                          <div className="font-bold text-slate-700">{h.score}%</div>
                          <div
                            className={`w-8 rounded-t ${h.score >= 80 ? 'bg-emerald-400' : h.score >= 60 ? 'bg-amber-400' : 'bg-rose-400'}`}
                            style={{ height: `${(h.score / 100) * 40}px` }}
                          />
                          <div className="text-[9px] text-slate-400">{h.month}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. AI QUALITY INSIGHT (Cross-domain clinical correlation) */}
                {aiQualityInsight && (
                  <div className="bg-purple-950/10 border border-purple-500/20 rounded-xl p-4 space-y-3 text-xs font-bold text-slate-700">
                    <div className="flex items-center space-x-2 text-purple-900 font-black">
                      <Sparkles className="w-4 h-4 text-purple-700 animate-pulse" />
                      <span>AI Quality Correlation Engine</span>
                    </div>
                    <p className="text-slate-600 font-medium leading-relaxed">
                      {aiQualityInsight.correlation}
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-500 pt-1 border-t border-purple-200/50">
                      <div>Lỗi lặp lại (Recurring count): <strong className="text-slate-800 font-mono">{aiQualityInsight.recurringCount} lần</strong></div>
                      <div>Xác suất lỗi tiếp theo: <strong className="text-purple-700 font-mono">{aiQualityInsight.probRecurring}</strong></div>
                      <div className="col-span-2 text-[11px] text-purple-900 mt-1">
                        💡 Khuyến nghị cải tiến: <span className="font-medium text-slate-700">{aiQualityInsight.suggestion}</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-xl h-full min-h-[300px] flex items-center justify-center">
              <div className="text-center text-slate-400">
                <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Chọn cuộc kiểm toán để xem chi tiết</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* SCHEDULE AUDIT DIALOG MODAL */}
      {isScheduleOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            
            <div className="bg-slate-950 text-white px-5 py-4 flex justify-between items-center border-b border-slate-800">
              <h3 className="font-black text-sm uppercase tracking-wider">Lên lịch Kiểm toán An toàn</h3>
              <button onClick={() => setIsScheduleOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleScheduleAudit} className="p-5 space-y-3.5 text-xs font-bold text-slate-700">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Tên chương trình kiểm toán:</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ví dụ: Kiểm toán An toàn Dùng Thuốc..."
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Danh mục kiểm soát:</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as AuditCategory)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5"
                  >
                    <option value="hand_hygiene">Vệ sinh tay</option>
                    <option value="medication_safety">An toàn thuốc</option>
                    <option value="infection_control">Kiểm soát KSNK</option>
                    <option value="fall_prevention">Phòng ngừa té ngã</option>
                    <option value="documentation">Hồ sơ tài liệu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Chuẩn Framework:</label>
                  <select
                    value={newFramework}
                    onChange={(e) => setNewFramework(e.target.value as AuditFramework)}
                    className="w-full border border-slate-300 rounded-lg px-2 py-1.5"
                  >
                    <option value="JCI">JCI (Mỹ)</option>
                    <option value="WHO">WHO</option>
                    <option value="CDC">CDC</option>
                    <option value="ISO">ISO 15189</option>
                    <option value="Hospital-defined">Quy định bệnh viện</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Khoa / Phòng mục tiêu:</label>
                  <input
                    type="text"
                    required
                    value={newWard}
                    onChange={(e) => setNewWard(e.target.value)}
                    placeholder="Ví dụ: Khoa ICU, Khoa Ngoại..."
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Kiểm toán viên (Auditor):</label>
                  <input
                    type="text"
                    required
                    value={newAuditor}
                    onChange={(e) => setNewAuditor(e.target.value)}
                    placeholder="Họ tên và chức vụ..."
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Ngày dự kiến kiểm toán:</label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-bold shadow-md transition-all mt-4"
              >
                Lập kế hoạch & phân công nhiệm vụ
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
