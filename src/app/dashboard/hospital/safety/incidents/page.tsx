'use client';

import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Eye,
  FileText,
  User,
  Bed,
  Pill,
  TrendingUp,
  XCircle,
  Activity,
  ArrowRight,
  Sparkles,
  History,
  Check,
  Search,
  X,
  AlertCircle
} from 'lucide-react';

// ─── PATIENT SAFETY INCIDENT TYPES ───────────────────────────────────────────
type IncidentSeverity = 'near_miss' | 'no_harm' | 'minor' | 'moderate' | 'severe' | 'sentinel';
type IncidentCategory = 'fall' | 'medication' | 'hai' | 'procedure' | 'identification' | 'other';
type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
type RCAStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED';
type CAPAStatus = 'NOT_REQUIRED' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
type SubjectType = 'PATIENT' | 'STAFF' | 'VISITOR' | 'ENVIRONMENT' | 'UNKNOWN';

interface ClinicalEvent {
  time: string;
  event: string;
  source: string;
}

interface CAPAItem {
  id: string;
  description: string;
  type: 'CORRECTIVE' | 'PREVENTIVE';
  owner: string;
  dueDate: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
}

interface SafetyIncident {
  id: string;
  reportNo: string;
  reportedAt: string;
  reportedBy: string;
  incidentDate: string;
  title: string;
  description: string;
  immediateAction: string;
  
  // Structured Subject & Location
  subjectType: SubjectType;
  subjectName: string;
  patientMRN?: string;
  locationDetails: string;
  category: IncidentCategory;
  severity: IncidentSeverity;

  // Structured Multi-Statuses
  incidentStatus: IncidentStatus;
  rcaStatus: RCAStatus;
  capaStatus: CAPAStatus;

  rcaDeadline: string | null;
  
  // Structured RCA
  rcaDetails: {
    immediateCause: string;
    rootCause: string;
    contributingFactors: {
      human: string;
      process: string;
      equipment: string;
      system: string;
    };
  } | null;

  capaList: CAPAItem[];
  timeline: ClinicalEvent[];
  aiSafetyAnalysis: {
    classification: string;
    probableCauses: { cause: string; probability: number }[];
    recomCAPAs: string[];
  } | null;
  audits: { timestamp: string; event: string; operator: string }[];
}

// ─── INITIAL INCIDENTS MOCK DATA ─────────────────────────────────────────────
const INITIAL_INCIDENTS: SafetyIncident[] = [
  {
    id: 'inc-001',
    reportNo: 'SC-2026-0892-001',
    reportedAt: '2026-08-06T10:30:00Z',
    reportedBy: 'ĐD. Lý Thu Hà',
    incidentDate: '2026-08-06',
    title: 'Sai liều kháng sinh — Meropenem nhập nhầm 2g thay vì 1g',
    description: 'Điều dưỡng cấp phát Meropenem 2g do nhãn lọ giống nhau. Phát hiện lúc đối chiếu tại giường bệnh, lọ chưa truyền.',
    immediateAction: 'Giữ nguyên lọ thuốc, báo cáo bác sĩ và đổi lọ thuốc đúng 1g từ kho dược.',
    subjectType: 'PATIENT',
    subjectName: 'Nguyễn Văn Hoàng',
    patientMRN: 'PAT-001',
    locationDetails: 'ICU - Giường ICU-BED-01',
    category: 'medication',
    severity: 'near_miss', // Near Miss as a first-class citizen!
    incidentStatus: 'OPEN',
    rcaStatus: 'COMPLETED',
    capaStatus: 'IN_PROGRESS',
    rcaDeadline: '2026-08-13',
    rcaDetails: {
      immediateCause: 'Nhãn lọ Meropenem 1g và 2g cùng nhà sản xuất có thiết kế tương đồng dễ nhầm lẫn.',
      rootCause: 'Thiếu ngăn tủ trực riêng biệt cho các thuốc LASA (nhìn giống nhau/đọc giống nhau) có hàm lượng nguy cơ cao.',
      contributingFactors: {
        human: 'Điều dưỡng bị cắt ngang công việc do chuông báo động của giường bên cạnh khi đối chiếu.',
        process: 'Chưa thực hiện double-check độc lập 2 điều dưỡng đối với các kháng sinh dự phòng nguy cơ cao.',
        equipment: 'Ngăn tủ thuốc chung không có vách ngăn cơ học phân biệt hàm lượng thuốc.',
        system: 'Hệ thống chưa triển khai cảnh báo quét mã vạch barcode thuốc tại giường bệnh.',
      },
    },
    capaList: [
      { id: 'capa-01', description: 'Tách riêng tủ chứa Meropenem 1g và 2g, dán decal đỏ cảnh báo LASA.', type: 'PREVENTIVE', owner: 'DS. Trần Văn Sơn', dueDate: '2026-08-10', status: 'COMPLETED' },
      { id: 'capa-02', description: 'Đào tạo lại quy trình 5 Rights và double-check tại giường đối với thuốc ICU.', type: 'CORRECTIVE', owner: 'ĐD. Trưởng Nguyễn Lan', dueDate: '2026-08-15', status: 'IN_PROGRESS' },
    ],
    timeline: [
      { time: '06:12', event: 'Bác sĩ tạo y lệnh Meropenem 1g trên EMR.', source: 'EMR Engine' },
      { time: '06:20', event: 'Kho dược cấp phát nhầm Meropenem 2g do nhãn tương đồng.', source: 'Pharmacy Dispenser' },
      { time: '06:28', event: 'Thuốc được bàn giao tại tủ trực ICU.', source: 'Logistics Transport' },
      { time: '06:31', event: 'ĐD Lý Thu Hà chuẩn bị tiêm truyền, đối chiếu 5 Rights phát hiện sai lệch liều lượng.', source: 'MAR Check' },
      { time: '06:35', event: 'Sự cố Near-Miss được báo cáo hệ thống, ngăn chặn tổn hại.', source: 'Safety Signal' },
    ],
    aiSafetyAnalysis: {
      classification: 'Medication Error (Wrong Dose) - Near Miss',
      probableCauses: [
        { cause: 'Look-alike packaging (Thiết kế bao bì giống nhau)', probability: 68 },
        { cause: 'Workflow interruption (Bị gián đoạn công việc)', probability: 52 },
        { cause: 'Verification failure (Lỗi quy trình đối soát)', probability: 41 },
      ],
      recomCAPAs: [
        'Triển khai kiểm tra mã vạch Barcode Verification trước khi truyền.',
        'Thiết lập tủ lưu trữ LASA chuyên biệt có dán nhãn màu tương phản.'
      ],
    },
    audits: [
      { timestamp: '2026-08-06T10:30:00Z', event: 'Khởi tạo báo cáo sự cố an toàn.', operator: 'ĐD. Lý Thu Hà' },
      { timestamp: '2026-08-07T09:00:00Z', event: 'Phê duyệt biên bản họp phân tích nguyên nhân gốc rễ (RCA).', operator: 'Ủy ban An toàn' },
    ],
  },
  {
    id: 'inc-002',
    reportNo: 'SC-2026-0895-001',
    reportedAt: '2026-08-07T15:00:00Z',
    reportedBy: 'ĐD. Nguyễn Văn Phong',
    incidentDate: '2026-08-07',
    title: 'Nhiễm khuẩn liên quan thở máy (VAP) nghi ngờ',
    description: 'Bệnh nhân thở máy xâm nhập ngày 4, xuất hiện sốt cao 38.8 độ C, đờm đục tăng, phổi thâm nhiễm mới trên X-quang.',
    immediateAction: 'Thay toàn bộ bộ dây máy thở. Vệ sinh khoang miệng bằng Chlorhexidine 0.2%. Cấy BAL phế quản.',
    subjectType: 'PATIENT',
    subjectName: 'Phạm Thị Loan',
    patientMRN: 'PAT-002',
    locationDetails: 'ICU - Giường ICU-BED-03',
    category: 'hai',
    severity: 'severe',
    incidentStatus: 'INVESTIGATING',
    rcaStatus: 'IN_PROGRESS',
    capaStatus: 'PENDING',
    rcaDeadline: '2026-08-14',
    rcaDetails: null,
    capaList: [
      { id: 'capa-03', description: 'Thay thế dây máy thở định kỳ và tăng cường kiểm tra vệ sinh bộ lọc.', type: 'CORRECTIVE', owner: 'ĐD. Nguyễn Văn Phong', dueDate: '2026-08-08', status: 'IN_PROGRESS' },
    ],
    timeline: [
      { time: '08:31', event: 'Bệnh nhân được kết nối máy thở xâm nhập.', source: 'Ventilator Monitor' },
      { time: '12:05', event: 'Chỉ số SpO2 giảm xuống dưới 90%, FiO2 điều chỉnh lên 60%.', source: 'ICU Dashboard' },
      { time: '14:15', event: 'Bệnh nhân sốt cao 38.8°C, nhiều đờm đục.', source: 'Vitals Log' },
      { time: '14:45', event: 'Chỉ định chụp X-quang phổi phát hiện vùng đông đặc mới.', source: 'PACS Integration' },
      { time: '15:00', event: 'Khởi tạo tín hiệu cảnh báo VAP tự động.', source: 'Clinical Event Bus' },
    ],
    aiSafetyAnalysis: {
      classification: 'Healthcare-Associated Infection (HAI) - VAP',
      probableCauses: [
        { cause: 'Ventilator circuit contamination (Nhiễm bẩn dây thở)', probability: 58 },
        { cause: 'Inadequate oral hygiene (Chăm sóc răng miệng chưa đạt)', probability: 46 },
        { cause: 'Aspiration of secretions (Hít sặc dịch tiết)', probability: 37 },
      ],
      recomCAPAs: [
        'Áp dụng quy trình VAP Bundle chăm sóc răng miệng mỗi 4 giờ.',
        'Sử dụng hệ thống hút đờm kín chống nhiễm khuẩn chéo.'
      ],
    },
    audits: [
      { timestamp: '2026-08-07T15:00:00Z', event: 'Khởi tạo báo cáo sự cố nghi ngờ nhiễm khuẩn bệnh viện.', operator: 'ĐD. Nguyễn Văn Phong' },
    ],
  },
  {
    id: 'inc-003',
    reportNo: 'SC-2026-0001-001',
    reportedAt: '2026-08-05T08:00:00Z',
    reportedBy: 'ĐD. Hoàng Minh Tuấn',
    incidentDate: '2026-08-04',
    title: 'Bệnh nhân tự ngã khi đứng dậy từ xe lăn',
    description: 'Bệnh nhân 72 tuổi, hậu phẫu ngày 3, tự đứng dậy từ xe lăn không báo điều dưỡng hỗ trợ. Ngã ngồi xuống sàn hành lang.',
    immediateAction: 'Sơ cứu chấn thương tại chỗ. Chụp X-quang hông kiểm tra (kết quả bình thường).',
    subjectType: 'PATIENT',
    subjectName: 'Bệnh nhân tự ngã',
    patientMRN: 'PAT-003',
    locationDetails: 'Hành lang Khoa Tim mạch',
    category: 'fall',
    severity: 'minor',
    incidentStatus: 'CLOSED',
    rcaStatus: 'APPROVED',
    capaStatus: 'VERIFIED',
    rcaDeadline: null,
    rcaDetails: {
      immediateCause: 'Bệnh nhân mất thăng bằng khi đứng lên khỏi xe lăn mà phanh xe chưa được khóa chặt.',
      rootCause: 'Thiếu đánh giá nguy cơ ngã định kỳ (Morse) đối với bệnh nhân hậu phẫu di chuyển ngoài phòng bệnh.',
      contributingFactors: {
        human: 'Bệnh nhân không hợp tác bấm chuông gọi hỗ trợ.',
        process: 'Chưa tiến hành đánh giá lại nguy cơ ngã mỗi 12 giờ theo quy định hậu phẫu.',
        equipment: 'Xe lăn tủ trực bị mòn phanh dẫn đến trượt khi chịu lực tì đè.',
        system: 'Thiếu biển báo cảnh báo nguy cơ ngã cao tại các khu vực hành lang chung.',
      },
    },
    capaList: [
      { id: 'capa-04', description: 'Gắn biển cảnh báo nguy cơ ngã cao tại giường bệnh và xe lăn.', type: 'PREVENTIVE', owner: 'ĐD. Hoàng Minh Tuấn', dueDate: '2026-08-05', status: 'VERIFIED' },
      { id: 'capa-05', description: 'Kiểm tra bảo dưỡng toàn bộ hệ thống phanh xe lăn tủ trực.', type: 'PREVENTIVE', owner: 'KTV. Trần Văn Minh', dueDate: '2026-08-06', status: 'VERIFIED' },
    ],
    timeline: [
      { time: '09:12', event: 'Bệnh nhân tự di chuyển khỏi giường ra xe lăn.', source: 'Encounter Walk' },
      { time: '09:14', event: 'Bệnh nhân tự ý đứng lên tại hành lang và ngã ngồi xuống sàn.', source: 'Incident Event' },
      { time: '09:15', event: 'ĐD Hoàng Minh Tuấn phát hiện, hỗ trợ đỡ bệnh nhân lên xe lăn.', source: 'Care Event' },
      { time: '09:30', event: 'Chụp X-quang xương chậu kiểm tra loại trừ chấn thương.', source: 'PACS Result' },
    ],
    aiSafetyAnalysis: {
      classification: 'Patient Fall',
      probableCauses: [
        { cause: 'Lack of supervision (Thiếu người giám sát)', probability: 64 },
        { cause: 'Post-operative weakness (Yếu cơ sau phẫu thuật)', probability: 50 },
        { cause: 'Wheelchair brake failure (Phanh xe lăn lỏng)', probability: 35 },
      ],
      recomCAPAs: [
        'Định kỳ kiểm tra kỹ thuật chốt khóa bánh xe lăn.',
        'Đánh giá Morse định kỳ mỗi ca trực đối với bệnh nhân lớn tuổi phẫu thuật xương khớp.'
      ],
    },
    audits: [
      { timestamp: '2026-08-05T08:00:00Z', event: 'Khởi tạo báo cáo sự cố ngã.', operator: 'ĐD. Hoàng Minh Tuấn' },
      { timestamp: '2026-08-05T10:00:00Z', event: 'RCA được phê duyệt bởi Ủy ban An toàn.', operator: 'Thành viên hội đồng' },
      { timestamp: '2026-08-05T15:00:00Z', event: 'Xác minh hoàn thành tất cả CAPA, đóng hồ sơ.', operator: 'Kế toán trưởng/KTV Trưởng' },
    ],
  },
];

const SEVERITY_CONFIG: Record<IncidentSeverity, { label: string; color: string; bg: string; border: string }> = {
  near_miss: { label: 'Suýt xảy ra', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  no_harm:   { label: 'Không hại', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
  minor:     { label: 'Nhẹ', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  moderate:  { label: 'Trung bình', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  severe:    { label: 'Nặng', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  sentinel:  { label: 'Nghiêm trọng', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
};

const CATEGORY_CONFIG: Record<IncidentCategory, { label: string; icon: React.ReactNode }> = {
  fall:           { label: 'Té ngã',            icon: <User className="w-3.5 h-3.5" /> },
  medication:     { label: 'Dùng thuốc',        icon: <Pill className="w-3.5 h-3.5" /> },
  hai:            { label: 'Nhiễm khuẩn BV',   icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  procedure:      { label: 'Thủ thuật',         icon: <FileText className="w-3.5 h-3.5" /> },
  identification: { label: 'Nhầm BN',           icon: <Bed className="w-3.5 h-3.5" /> },
  other:          { label: 'Khác',              icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

export default function HospitalSafetyIncidentsPage() {
  const [incidents, setIncidents] = useState<SafetyIncident[]>(INITIAL_INCIDENTS);
  const [selected, setSelected] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | 'all'>('all');
  
  // Right Workspace active sub-tab
  const [workspaceTab, setWorkspaceTab] = useState<'overview' | 'timeline' | 'rca' | 'capa' | 'ai' | 'audit'>('overview');

  // Search input
  const [searchTerm, setSearchTerm] = useState('');

  // Wizard dialog state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAction, setNewAction] = useState('');
  const [newSubjectType, setNewSubjectType] = useState<SubjectType>('PATIENT');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newMRN, setNewMRN] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCategory, setNewCategory] = useState<IncidentCategory>('medication');
  const [newSeverity, setNewSeverity] = useState<IncidentSeverity>('moderate');

  const selectedIncident = useMemo(() => incidents.find((i) => i.id === selected), [incidents, selected]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((i) => {
      const matchSearch =
        i.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.subjectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.reportNo.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchSeverity = filterSeverity === 'all' || i.severity === filterSeverity;

      return matchSearch && matchSeverity;
    });
  }, [incidents, searchTerm, filterSeverity]);

  // Operational metrics
  const stats = useMemo(() => {
    return {
      total: incidents.length + 8, // mock addition
      investigating: incidents.filter((i) => i.incidentStatus === 'INVESTIGATING').length + 2,
      critical: incidents.filter((i) => i.severity === 'severe' || i.severity === 'sentinel').length,
      openCAPA: incidents.reduce((acc, i) => acc + i.capaList.filter((c) => c.status !== 'VERIFIED').length, 0) + 1,
      overdue: 1,
    };
  }, [incidents]);

  // Handle Wizard Submit
  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    const newInc: SafetyIncident = {
      id: `inc-${Date.now()}`,
      reportNo: `SC-2026-${Math.floor(1000 + Math.random() * 9000)}-001`,
      reportedAt: new Date().toISOString(),
      reportedBy: 'ĐD. Lê Thị Hà',
      incidentDate: new Date().toISOString().slice(0, 10),
      title: newTitle,
      description: newDesc,
      immediateAction: newAction,
      subjectType: newSubjectType,
      subjectName: newSubjectName,
      patientMRN: newMRN || undefined,
      locationDetails: newLocation,
      category: newCategory,
      severity: newSeverity,
      incidentStatus: 'OPEN',
      rcaStatus: 'NOT_STARTED',
      capaStatus: 'PENDING',
      rcaDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      rcaDetails: null,
      capaList: [],
      timeline: [
        { time: new Date().toLocaleTimeString('vi-VN').slice(0, 5), event: 'Tạo báo cáo sự cố thủ công từ biểu mẫu.', source: 'Safety System' }
      ],
      aiSafetyAnalysis: {
        classification: `${newCategory.toUpperCase()} ERROR`,
        probableCauses: [
          { cause: 'Under investigation (Đang điều tra nguyên nhân)', probability: 90 }
        ],
        recomCAPAs: [
          'Thực hiện họp phân tích lỗi lâm sàng trong vòng 7 ngày.',
        ],
      },
      audits: [
        { timestamp: new Date().toISOString(), event: 'Tạo hồ sơ sự cố an toàn bệnh nhân.', operator: 'ĐD. Lê Thị Hà' }
      ],
    };

    setIncidents((prev) => [newInc, ...prev]);
    setIsNewModalOpen(false);
    
    // Reset wizard
    setWizardStep(1);
    setNewTitle('');
    setNewDesc('');
    setNewAction('');
    setNewSubjectName('');
    setNewMRN('');
    setNewLocation('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none">
      
      {/* Header Banner - Safety theme (slate/teal/red gradient container) */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-955 to-slate-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-rose-500/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-rose-900/10 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-rose-400 mb-1">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Bella Hospital • Patient Safety Incident Reporting System
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white !text-white">
              Báo Cáo Sự Cố An Toàn Bệnh Nhân
            </h1>
            <p className="text-rose-200/85 text-sm mt-1 max-w-xl leading-relaxed">
              Ghi nhận sự cố, suýt xảy ra (Near Miss), phân tích nguyên nhân gốc rễ (RCA) và triển khai hành động khắc phục CAPA nhằm ngăn chặn nguy cơ lâm sàng.
            </p>
          </div>
          
          <div className="grid grid-cols-5 gap-2.5 shrink-0 w-full md:w-auto text-center font-bold">
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-rose-500/30 transition-all duration-300">
              <div className="text-xl font-black text-white">{stats.total}</div>
              <div className="text-[9px] text-slate-300 font-semibold uppercase mt-0.5">Incidents</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-amber-500/30 transition-all duration-300">
              <div className="text-xl font-black text-amber-300">{stats.investigating}</div>
              <div className="text-[9px] text-amber-200/80 font-semibold uppercase mt-0.5">Investigating</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-rose-500/30 transition-all duration-300">
              <div className="text-xl font-black text-rose-400">{stats.critical}</div>
              <div className="text-[9px] text-rose-200/80 font-semibold uppercase mt-0.5">High/Critical</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-indigo-500/30 transition-all duration-300">
              <div className="text-xl font-black text-indigo-300">{stats.openCAPA}</div>
              <div className="text-[9px] text-indigo-200/80 font-semibold uppercase mt-0.5">Open CAPA</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-rose-500/30 transition-all duration-300 animate-pulse">
              <div className="text-xl font-black text-rose-500">{stats.overdue}</div>
              <div className="text-[9px] text-rose-300 font-semibold uppercase mt-0.5">Overdue CAPA</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category cards grids */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => {
          const count = incidents.filter((i) => i.category === cat).length;
          return (
            <div key={cat} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex items-center space-x-3 hover:shadow transition-all">
              <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                {cfg.icon}
              </div>
              <div>
                <div className="font-extrabold text-slate-800 text-sm">{count} sự cố</div>
                <div className="text-[10px] text-slate-400 font-medium">{cfg.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter severity & search + New */}
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center space-x-2 flex-wrap gap-y-2">
          <div className="relative w-64 shrink-0">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm sự cố, bệnh nhân, mã..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full border border-slate-300 rounded-xl text-sm focus:outline-none bg-white focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <button
            onClick={() => setFilterSeverity('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              filterSeverity === 'all'
                ? 'bg-rose-700 text-white border-rose-700'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Tất cả
          </button>
          {(['near_miss', 'moderate', 'severe', 'sentinel'] as IncidentSeverity[]).map((sev) => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                filterSeverity === sev
                  ? 'bg-rose-700 text-white border-rose-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {SEVERITY_CONFIG[sev].label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="flex items-center space-x-1.5 bg-rose-700 hover:bg-rose-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Báo cáo sự cố mới</span>
        </button>
      </div>

      {/* Incident List + Detail Workspace split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: LIST */}
        <div className="lg:col-span-1 space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {filteredIncidents.map((inc) => {
            const sev = SEVERITY_CONFIG[inc.severity];
            const cat = CATEGORY_CONFIG[inc.category];
            
            return (
              <button
                key={inc.id}
                onClick={() => {
                  setSelected(inc.id === selected ? null : inc.id);
                  setWorkspaceTab('overview');
                }}
                className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-2 relative ${
                  selected === inc.id ? 'border-rose-500 ring-2 ring-rose-100' : 'border-slate-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className={`flex items-center space-x-1 text-[9px] font-black px-2 py-0.5 rounded border ${sev.bg} ${sev.color} ${sev.border}`}>
                    {cat.icon}
                    <span>{sev.label}</span>
                  </div>
                  
                  <span className="text-[9px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                    {inc.incidentStatus}
                  </span>
                </div>

                <div>
                  <h4 className="font-extrabold text-slate-800 text-xs block leading-tight">{inc.title}</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">
                    Mã: {inc.reportNo} · {inc.subjectName} {inc.patientMRN && `(${inc.patientMRN})`}
                  </p>
                </div>

                <div className="flex justify-between items-center text-[10px] border-t border-slate-100 pt-2 text-slate-400 font-bold">
                  <span>RCA: {inc.rcaStatus}</span>
                  <span>CAPA: {inc.capaStatus}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* RIGHT COLUMN: INCIDENT WORKSPACE (Detail Pane) */}
        <div className="lg:col-span-2">
          {selectedIncident ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              
              {/* Workspace Header */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-950 px-5 py-4 border-b border-slate-800 flex justify-between items-center text-white">
                <div>
                  <h3 className="font-extrabold text-slate-100 text-sm">{selectedIncident.title}</h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Mã sự cố: {selectedIncident.reportNo} · Báo cáo: {selectedIncident.reportedBy} ({new Date(selectedIncident.reportedAt).toLocaleDateString('vi-VN')})
                  </p>
                </div>
                <div className="flex space-x-1.5">
                  <span className="text-[9px] font-black px-2 py-0.5 rounded bg-slate-800 text-rose-400 border border-slate-700">
                    Incident: {selectedIncident.incidentStatus}
                  </span>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded bg-slate-800 text-purple-400 border border-slate-700">
                    RCA: {selectedIncident.rcaStatus}
                  </span>
                </div>
              </div>

              {/* Workspace Tab menu */}
              <div className="flex border-b border-slate-100 bg-white">
                {[
                  { key: 'overview', label: 'Tổng Quan', icon: ShieldAlert },
                  { key: 'timeline', label: 'Clinical Timeline', icon: Clock },
                  { key: 'rca', label: 'Phân Tích RCA', icon: FileText },
                  { key: 'capa', label: 'Hành Động CAPA', icon: CheckCircle2 },
                  { key: 'ai', label: 'AI Safety Engine', icon: Sparkles },
                  { key: 'audit', label: 'Nhật Ký Thay Đổi', icon: History },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setWorkspaceTab(tab.key as typeof workspaceTab)}
                    className={`flex-1 py-3 px-1.5 text-center text-xs font-bold border-b-2 flex items-center justify-center space-x-1 transition-all ${
                      workspaceTab === tab.key
                        ? 'border-rose-600 text-rose-700 bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden md:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Workspace Tab Contents */}
              <div className="p-5 flex-1 overflow-y-auto max-h-[50vh]">
                
                {/* TAB 1: TỔNG QUAN HỒ SƠ */}
                {workspaceTab === 'overview' && (
                  <div className="space-y-4 text-xs font-bold text-slate-700">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                      <h4 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider mb-2">Thông tin chủ thể & Vị trí xảy ra</h4>
                      <div className="grid grid-cols-2 gap-y-2 font-mono">
                        <div>Chủ thể sự cố: <strong className="text-slate-900">{selectedIncident.subjectType}</strong></div>
                        <div>Họ và tên: <strong className="text-slate-900">{selectedIncident.subjectName}</strong></div>
                        {selectedIncident.patientMRN && <div>Mã MRN bệnh nhân: <strong className="text-slate-900">{selectedIncident.patientMRN}</strong></div>}
                        <div className="col-span-2">Địa điểm cụ thể: <strong className="text-slate-900">{selectedIncident.locationDetails}</strong></div>
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                      <h5 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">Mô tả sự cố y khoa</h5>
                      <p className="font-medium text-slate-600 leading-relaxed bg-white border border-slate-100 p-2.5 rounded-lg">
                        {selectedIncident.description}
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 text-blue-800 rounded-xl p-4 space-y-1">
                      <h5 className="font-extrabold uppercase text-[10px] tracking-wider">Hành động khắc phục xử lý ngay</h5>
                      <p className="font-medium leading-relaxed">{selectedIncident.immediateAction}</p>
                    </div>
                  </div>
                )}

                {/* TAB 2: CLINICAL TIMELINE */}
                {workspaceTab === 'timeline' && (
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                      Chuỗi diễn biến lâm sàng tiền sự cố (EMR/MAR Clinical Sequence)
                    </h4>
                    <div className="relative border-l border-slate-200 pl-4 space-y-4 font-mono text-[11px] mt-3">
                      {selectedIncident.timeline.map((evt, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[21px] mt-1.5 w-2.5 h-2.5 rounded-full bg-rose-500 border border-white" />
                          <div className="flex justify-between font-bold text-slate-800">
                            <span>{evt.event}</span>
                            <span className="text-slate-400">{evt.time}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Nguồn gốc: {evt.source}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB 3: PHÂN TÍCH RCA */}
                {workspaceTab === 'rca' && (
                  <div className="space-y-4">
                    {selectedIncident.rcaDetails ? (
                      <div className="space-y-4 text-xs font-bold text-slate-700">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                          <span className="text-[10px] text-slate-400 uppercase block mb-1">Nguyên nhân trực tiếp (Immediate Cause)</span>
                          <p className="text-slate-800 font-medium">{selectedIncident.rcaDetails.immediateCause}</p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                          <span className="text-[10px] text-slate-400 uppercase block mb-1">Nguyên nhân gốc rễ (Root Cause)</span>
                          <p className="text-slate-800 font-medium">{selectedIncident.rcaDetails.rootCause}</p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                          <h5 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider mb-2">Các yếu tố đóng góp (Contributing Factors)</h5>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-slate-400 text-[10px] block">Yếu tố con người (Human):</span>
                              <p className="text-slate-800 font-medium text-[11px]">{selectedIncident.rcaDetails.contributingFactors.human}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">Quy trình vận hành (Process):</span>
                              <p className="text-slate-800 font-medium text-[11px]">{selectedIncident.rcaDetails.contributingFactors.process}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">Thiết bị y tế (Equipment):</span>
                              <p className="text-slate-800 font-medium text-[11px]">{selectedIncident.rcaDetails.contributingFactors.equipment}</p>
                            </div>
                            <div>
                              <span className="text-slate-400 text-[10px] block">Hệ thống quản lý (System):</span>
                              <p className="text-slate-800 font-medium text-[11px]">{selectedIncident.rcaDetails.contributingFactors.system}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-slate-400 text-xs">
                        ⚠️ Chưa bắt đầu phân tích nguyên nhân gốc rễ (RCA) cho sự cố này.
                        <button
                          onClick={() => {
                            setIncidents((prev) =>
                              prev.map((i) => {
                                if (i.id !== selectedIncident.id) return i;
                                return {
                                  ...i,
                                  rcaStatus: 'COMPLETED',
                                  rcaDetails: {
                                    immediateCause: 'Nhiễm khuẩn chéo trong quá trình thở máy nội khí quản.',
                                    rootCause: 'Chu kỳ làm sạch bộ dây thở máy và sát khuẩn miệng VAP bundle bị trễ ca trực.',
                                    contributingFactors: {
                                      human: 'Điều dưỡng trực quá tải số lượng bệnh nhân cấp cứu.',
                                      process: 'Thiếu kiểm toán tuân thủ VAP Bundle định kỳ hàng tuần.',
                                      equipment: 'Hết bộ dây thở máy dự phòng vô trùng tại kho trực.',
                                      system: 'Hệ thống báo chuông nhắc việc lâm sàng chưa liên kết MAR thở máy.',
                                    },
                                  },
                                  audits: [
                                    ...i.audits,
                                    { timestamp: new Date().toISOString(), event: 'Phê duyệt phân tích RCA sự cố nhiễm khuẩn.', operator: 'KTV. Nguyễn Lan' }
                                  ]
                                };
                              })
                            );
                          }}
                          className="mt-3 block mx-auto bg-rose-700 text-white font-bold px-3 py-1.5 rounded-lg transition-all shadow"
                        >
                          Khởi động họp lập RCA
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: HÀNH ĐỘNG CAPA */}
                {workspaceTab === 'capa' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Hành động khắc phục & ngăn ngừa (CAPA)</h4>
                      <button
                        onClick={() => {
                          const desc = prompt('Nhập mô tả hành động khắc phục CAPA:');
                          if (desc) {
                            const newItem: CAPAItem = {
                              id: `capa-${Date.now()}`,
                              description: desc,
                              type: 'PREVENTIVE',
                              owner: 'ĐD. Lý Thu Hà',
                              dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                              status: 'PENDING',
                            };
                            setIncidents((prev) =>
                              prev.map((i) => {
                                if (i.id !== selectedIncident.id) return i;
                                return {
                                  ...i,
                                  capaList: [...i.capaList, newItem],
                                };
                              })
                            );
                          }
                        }}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition-all"
                      >
                        + Thêm CAPA
                      </button>
                    </div>

                    <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Mô tả</th>
                            <th className="px-3 py-2">Phân loại</th>
                            <th className="px-3 py-2">Người thực hiện</th>
                            <th className="px-3 py-2">Hạn hoàn thành</th>
                            <th className="px-3 py-2 text-center">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                          {selectedIncident.capaList.map((c) => (
                            <tr key={c.id}>
                              <td className="px-3 py-2.5 font-bold text-slate-800">{c.description}</td>
                              <td className="px-3 py-2.5">{c.type}</td>
                              <td className="px-3 py-2.5">{c.owner}</td>
                              <td className="px-3 py-2.5">{c.dueDate}</td>
                              <td className="px-3 py-2.5 text-center">
                                <button
                                  onClick={() => {
                                    setIncidents((prev) =>
                                      prev.map((i) => {
                                        if (i.id !== selectedIncident.id) return i;
                                        return {
                                          ...i,
                                          capaList: i.capaList.map((cl) => {
                                            if (cl.id !== c.id) return cl;
                                            return { ...cl, status: 'VERIFIED' };
                                          }),
                                        };
                                      })
                                    );
                                  }}
                                  className={`text-[9px] font-black px-2 py-0.5 rounded border transition-all ${
                                    c.status === 'VERIFIED'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                                  }`}
                                >
                                  {c.status}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 5: AI SAFETY ENGINE */}
                {workspaceTab === 'ai' && (
                  <div className="space-y-4">
                    {selectedIncident.aiSafetyAnalysis ? (
                      <div className="bg-purple-950/10 border border-purple-500/20 rounded-xl p-4 space-y-4 text-xs font-bold text-slate-700">
                        <div className="flex items-center space-x-2 text-purple-900 font-black">
                          <Sparkles className="w-4 h-4 text-purple-700 animate-pulse" />
                          <span>AI Safety Engine Copilot</span>
                        </div>

                        <div>
                          <span>Đề xuất phân loại sự cố:</span>
                          <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded ml-2 font-mono">
                            {selectedIncident.aiSafetyAnalysis.classification}
                          </span>
                        </div>

                        <div className="space-y-2">
                          <div>Phân tích xác suất nguyên nhân (Probable Causes):</div>
                          <div className="space-y-2 text-[11px] text-slate-600 font-medium">
                            {selectedIncident.aiSafetyAnalysis.probableCauses.map((item, idx) => (
                              <div key={idx} className="space-y-1">
                                <div className="flex justify-between">
                                  <span>{item.cause}</span>
                                  <span className="text-purple-700 font-extrabold">{item.probability}%</span>
                                </div>
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-purple-600 h-full rounded-full"
                                    style={{ width: `${item.probability}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-purple-200/50 space-y-2">
                          <div>Đề xuất hành động ngăn ngừa CAPA tối ưu:</div>
                          <ul className="space-y-1 list-disc pl-4 text-[11px] text-slate-600 font-medium">
                            {selectedIncident.aiSafetyAnalysis.recomCAPAs.map((capa, idx) => (
                              <li key={idx}>{capa}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-slate-400 text-xs">
                        Không có dữ liệu phân tích an toàn lâm sàng AI.
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 6: AUDIT TRAIL */}
                {workspaceTab === 'audit' && (
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Nhật ký thay đổi hồ sơ sự cố (Incident Audit Trail)</h4>
                    <div className="relative border-l border-slate-200 pl-4 space-y-4 font-mono text-[11px] mt-3">
                      {selectedIncident.audits.map((log, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[21px] mt-1.5 w-2.5 h-2.5 rounded-full bg-slate-400 border border-white" />
                          <div className="flex justify-between font-bold text-slate-800">
                            <span>{log.event}</span>
                            <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString('vi-VN')}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Thao tác bởi: {log.operator}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

            </div>
          ) : (
            /* SMART EMPTY STATE DASHBOARD */
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 min-h-[500px] flex flex-col justify-between shadow-inner">
              <div className="space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center space-x-1.5">
                    <ShieldAlert className="w-4.5 h-4.5 text-rose-600" />
                    <span>Hệ Thống Quản Lý Sự Cố & CAPA An Toàn</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Chọn một sự cố an toàn ở danh sách bên trái hoặc rà soát các chỉ số khắc phục tồn đọng dưới đây.</p>
                </div>

                {/* Incident statistics overview */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
                    <div className="text-xs font-bold text-slate-400">Hành động khắc phục CAPA mở</div>
                    <div className="text-2xl font-black text-slate-800">{stats.openCAPA} CAPA</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
                    <div className="text-xs font-bold text-slate-400">Số vụ suýt xảy ra (Near Miss)</div>
                    <div className="text-2xl font-black text-indigo-700">1 sự cố</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1 col-span-2">
                    <div className="text-xs font-bold text-slate-400">Các hành động khắc phục quá hạn</div>
                    <div className="text-2xl font-black text-rose-700">1 CAPA</div>
                  </div>
                </div>

                {/* Operations checklist */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Checklist Vận Hành An Toàn</h4>
                  <div className="space-y-2.5 text-xs text-slate-600 font-bold">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="line-through text-slate-400">Đăng ký sự cố ngã ngồi ở hành lang Tim mạch</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-slate-300 shrink-0" />
                      <span>Thực hiện phân tích RCA cho ca nghi nhiễm khuẩn thở máy ICU</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-slate-300 shrink-0" />
                      <span>Xác nhận đóng hồ sơ và rà soát CAPA Meropenem</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center text-slate-400 text-xs py-4 border-t border-slate-200">
                <ShieldAlert className="w-8 h-8 mx-auto mb-1 opacity-30 text-rose-600" />
                <span>Hãy chọn một sự cố để quản lý tiến trình RCA/CAPA lâm sàng.</span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* MULTI-STEP NEW INCIDENT WIZARD MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto select-none">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm uppercase tracking-wider">Báo cáo Sự cố An toàn Mới</h3>
                <span className="text-[10px] text-slate-400">Bước {wizardStep} / 5</span>
              </div>
              <button onClick={() => setIsNewModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleCreateIncident} className="p-5 flex-1 space-y-4">
              
              {/* STEP 1: EVENT DETAILS */}
              {wizardStep === 1 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase mb-2">Bước 1: Chi tiết sự cố xảy ra</h4>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Tiêu đề ngắn sự cố:</label>
                    <input
                      type="text"
                      required
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Ví dụ: Bệnh nhân tự ý rút ống truyền tĩnh mạch..."
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Mô tả chi tiết diễn biến sự cố:</label>
                    <textarea
                      required
                      rows={3}
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Mô tả cụ thể chuyện gì đã xảy ra, thời gian phát hiện và hậu quả tạm thời..."
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: SUBJECT */}
              {wizardStep === 2 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase mb-2">Bước 2: Đối tượng sự cố</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Phân loại đối tượng:</label>
                      <select
                        value={newSubjectType}
                        onChange={(e) => setNewSubjectType(e.target.value as SubjectType)}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                      >
                        <option value="PATIENT">Bệnh nhân (Patient)</option>
                        <option value="STAFF">Nhân viên y tế (Staff)</option>
                        <option value="VISITOR">Khách viếng thăm (Visitor)</option>
                        <option value="ENVIRONMENT">Môi trường (Environment)</option>
                        <option value="UNKNOWN">Chưa xác định (Unknown)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Họ tên chủ thể:</label>
                      <input
                        type="text"
                        required
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        placeholder="Ví dụ: Lê Văn B..."
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                  {newSubjectType === 'PATIENT' && (
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Mã MRN bệnh nhân (nếu có):</label>
                      <input
                        type="text"
                        value={newMRN}
                        onChange={(e) => setNewMRN(e.target.value)}
                        placeholder="Ví dụ: PAT-005"
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Địa điểm xảy ra sự cố:</label>
                    <input
                      type="text"
                      required
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="Ví dụ: Phòng ICU-03, Hành lang khoa Ngoại..."
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* STEP 3: IMMEDIATE SAFETY */}
              {wizardStep === 3 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase mb-2">Bước 3: Xử lý an toàn lập tức</h4>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Hành động khắc phục tại chỗ:</label>
                    <textarea
                      required
                      rows={3}
                      value={newAction}
                      onChange={(e) => setNewAction(e.target.value)}
                      placeholder="Ghi rõ hành động lâm sàng/an toàn thực hiện ngay lập tức để giảm thiểu hậu quả..."
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>
              )}

              {/* STEP 4: CLASSIFICATION */}
              {wizardStep === 4 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 text-xs uppercase mb-2">Bước 4: Phân loại sự cố y khoa</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Danh mục lỗi:</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value as IncidentCategory)}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                      >
                        <option value="medication">Sai sót dùng thuốc (Medication)</option>
                        <option value="fall">Té ngã bệnh nhân (Fall)</option>
                        <option value="hai">Nhiễm khuẩn BV (HAI)</option>
                        <option value="procedure">Sai sót thủ thuật (Procedure)</option>
                        <option value="identification">Nhầm lẫn bệnh nhân (ID)</option>
                        <option value="other">Loại khác (Other)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">Mức độ nghiêm trọng:</label>
                      <select
                        value={newSeverity}
                        onChange={(e) => setNewSeverity(e.target.value as IncidentSeverity)}
                        className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                      >
                        <option value="near_miss">Suýt xảy ra (Near Miss)</option>
                        <option value="no_harm">Không gây hại (No Harm)</option>
                        <option value="minor">Nhẹ (Minor)</option>
                        <option value="moderate">Trung bình (Moderate)</option>
                        <option value="severe">Nặng (Severe)</option>
                        <option value="sentinel">Rất nghiêm trọng (Sentinel)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: ASSIGNMENT & SUBMIT */}
              {wizardStep === 5 && (
                <div className="space-y-4 text-xs font-bold text-slate-700 text-center py-6">
                  <h4 className="font-bold text-slate-800 text-sm uppercase mb-2">Hoàn tất lập hồ sơ báo cáo</h4>
                  <p className="text-slate-500 font-medium">Hệ thống an toàn sẽ tự động:</p>
                  <ul className="text-slate-600 text-left list-disc pl-6 space-y-1 inline-block text-[11px] font-medium">
                    <li>Gắn mã số báo cáo theo quy chuẩn (SC-2026-xxxx-001).</li>
                    <li>Khởi chạy quy trình rà soát an toàn & RCA.</li>
                    <li>Thiết lập hạn hoàn thành biên bản điều tra RCA tự động (7 ngày).</li>
                  </ul>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-md transition-all mt-4"
                  >
                    Gửi Báo Cáo & Khởi Động RCA
                  </button>
                </div>
              )}

              {/* Wizard navigation bar */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep - 1)}
                    className="border border-slate-300 hover:bg-slate-50 text-slate-600 font-bold px-4 py-1.5 rounded-lg text-xs"
                  >
                    Quay lại
                  </button>
                ) : (
                  <div />
                )}

                {wizardStep < 5 && (
                  <button
                    type="button"
                    onClick={() => setWizardStep(wizardStep + 1)}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-1.5 rounded-lg text-xs"
                  >
                    Tiếp tục
                  </button>
                )}
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
