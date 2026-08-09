'use client';

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Plus,
  Eye,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Percent,
  History,
  User,
  Activity,
  Search,
  ArrowRight,
  Coins,
  BarChart3,
  Check
} from 'lucide-react';

// ─── HOSPITAL INSURANCE CONTRACT TYPES ───────────────────────────────────────
interface CoverageRule {
  area: string;
  covered: boolean;
  rate: number;
  limit: number;
  notes?: string;
}

interface PatientClaim {
  id: string;
  patientName: string;
  patientMRN: string;
  encounterId: string;
  submittedAmount: number;
  approvedAmount: number;
  rejectedAmount: number;
  status: 'APPROVED' | 'PARTIAL' | 'REJECTED' | 'PENDING' | 'RECONCILED';
  submittedAt: string;
}

interface ContractAudit {
  timestamp: string;
  event: string;
  operator: string;
}

interface InsuranceContract {
  id: string;
  contractNo: string;
  insurer: string;
  type: 'bhyt' | 'commercial' | 'corporate';
  coveredServices: string[];
  coverageRate: number; // percentage
  annualCap: number;
  usedCap: number;
  validFrom: string;
  validTo: string;
  status: 'active' | 'expiring' | 'expired' | 'draft';
  totalClaimed: number;
  totalApproved: number;
  claimsCount: number;
  
  // Structured Details
  coverageRules: CoverageRule[];
  claims: PatientClaim[];
  rejectionAnalysis: {
    missingDocs: number;
    exclusion: number;
    codingError: number;
    authMissing: number;
    other: number;
  };
  aiInsight: string;
  audits: ContractAudit[];
}

// ─── INITIAL CONTRACTS MOCK DATA ────────────────────────────────────────────
const INITIAL_CONTRACTS: InsuranceContract[] = [
  {
    id: 'cnt-001',
    contractNo: 'BHYT-2026-HCM-0145',
    insurer: 'Bảo hiểm Y tế Xã hội (BHXH TP.HCM)',
    type: 'bhyt',
    coveredServices: ['Khám bệnh nội trú', 'Phẫu thuật', 'Thuốc thiết yếu', 'Cận lâm sàng', 'Điều dưỡng'],
    coverageRate: 80,
    annualCap: 5000000000,
    usedCap: 3720000000,
    validFrom: '2026-01-01',
    validTo: '2026-12-31',
    status: 'active',
    totalClaimed: 1245000000,
    totalApproved: 1100000000,
    claimsCount: 342,
    coverageRules: [
      { area: 'Khám bệnh nội trú', covered: true, rate: 80, limit: 1500000000, notes: 'Theo danh mục BHYT tuyến tỉnh.' },
      { area: 'Phẫu thuật & Can thiệp', covered: true, rate: 80, limit: 2000000000, notes: 'Không áp dụng đối với phẫu thuật thẩm mỹ.' },
      { area: 'Thuốc điều trị nội trú', covered: true, rate: 80, limit: 1000000000, notes: 'Chỉ thuốc nằm trong danh mục thanh toán Bộ Y Tế.' },
      { area: 'Cận lâm sàng & Hình ảnh', covered: true, rate: 80, limit: 500000000, notes: 'Xét nghiệm chẩn đoán y khoa.' },
    ],
    claims: [
      { id: 'clm-01', patientName: 'Nguyễn Văn Hoàng', patientMRN: 'PAT-001', encounterId: 'ENC-2026-008', submittedAmount: 18500000, approvedAmount: 14800000, rejectedAmount: 0, status: 'APPROVED', submittedAt: '2026-08-08' },
      { id: 'clm-02', patientName: 'Lê Thị Hương', patientMRN: 'PAT-002', encounterId: 'ENC-2026-009', submittedAmount: 19500000, approvedAmount: 15600000, rejectedAmount: 0, status: 'RECONCILED', submittedAt: '2026-08-07' },
      { id: 'clm-03', patientName: 'Trần Văn Tùng', patientMRN: 'PAT-014', encounterId: 'ENC-2026-042', submittedAmount: 12400000, approvedAmount: 9920000, rejectedAmount: 2480000, status: 'PARTIAL', submittedAt: '2026-08-05' },
    ],
    rejectionAnalysis: {
      missingDocs: 32,
      exclusion: 24,
      codingError: 18,
      authMissing: 15,
      other: 11,
    },
    aiInsight: 'Tỷ lệ claim bị từ chối do thiếu hồ sơ bệnh án hoặc đính kèm văn bản hội chẩn lâm sàng tăng 18% trong 30 ngày qua tại ICU. Đề xuất chuẩn hóa quy trình ký duyệt EMR trước khi gửi cổng.',
    audits: [
      { timestamp: '2026-01-01T08:00:00Z', event: 'Khởi tạo hợp đồng BHYT xã hội niên độ 2026.', operator: 'Kế toán trưởng. Lê Minh' },
      { timestamp: '2026-05-10T14:30:00Z', event: 'Cập nhật hạn mức thanh toán thêm 500 triệu.', operator: 'Kế toán trưởng. Lê Minh' },
    ],
  },
  {
    id: 'cnt-002',
    contractNo: 'TM-2026-BVL-0088',
    insurer: 'Bảo Việt Life Insurance',
    type: 'commercial',
    coveredServices: ['Phòng VIP', 'Phẫu thuật tim mạch', 'Ung thư', 'ICU nâng cao'],
    coverageRate: 100,
    annualCap: 2000000000,
    usedCap: 1540000000,
    validFrom: '2026-03-01',
    validTo: '2027-02-28',
    status: 'active',
    totalClaimed: 380000000,
    totalApproved: 375000000,
    claimsCount: 45,
    coverageRules: [
      { area: 'Phòng nội trú VIP / Suite', covered: true, rate: 100, limit: 500000000, notes: 'Hạn mức phòng tối đa 3,500,000đ/ngày.' },
      { area: 'Phẫu thuật tim mạch chuyên sâu', covered: true, rate: 100, limit: 1000000000, notes: 'Yêu cầu giấy bảo lãnh viện phí trước mổ.' },
      { area: 'Điều trị Ung thư hóa trị', covered: true, rate: 100, limit: 500000000, notes: 'Không bao gồm thử nghiệm lâm sàng mới.' },
    ],
    claims: [
      { id: 'clm-04', patientName: 'Phạm Minh Trí', patientMRN: 'PAT-104', encounterId: 'ENC-2026-112', submittedAmount: 85000000, approvedAmount: 85000000, rejectedAmount: 0, status: 'APPROVED', submittedAt: '2026-08-04' },
      { id: 'clm-05', patientName: 'Vũ Hoài Nam', patientMRN: 'PAT-120', encounterId: 'ENC-2026-149', submittedAmount: 42000000, approvedAmount: 40000000, rejectedAmount: 2000000, status: 'PARTIAL', submittedAt: '2026-08-02' },
    ],
    rejectionAnalysis: {
      missingDocs: 15,
      exclusion: 45,
      codingError: 10,
      authMissing: 25,
      other: 5,
    },
    aiInsight: 'Payer Bảo Việt có tỷ lệ duyệt cao (99%) và thời gian thanh toán trung bình ngắn (4 ngày). Khuyến nghị ưu tiên điều hướng dịch vụ bảo lãnh viện phí.',
    audits: [
      { timestamp: '2026-03-01T09:00:00Z', event: 'Khởi tạo hợp đồng bảo lãnh thương mại Bảo Việt.', operator: 'KTV. Nguyễn Lan' },
    ],
  },
  {
    id: 'cnt-003',
    contractNo: 'DN-2026-FPT-0023',
    insurer: 'FPT Corporation — Gói khám chữa bệnh nhân viên',
    type: 'corporate',
    coveredServices: ['Khám sức khỏe định kỳ', 'Cấp cứu', 'Nội trú ngắn ngày'],
    coverageRate: 90,
    annualCap: 500000000,
    usedCap: 450000000,
    validFrom: '2026-01-15',
    validTo: '2026-07-14',
    status: 'expired',
    totalClaimed: 120000000,
    totalApproved: 108000000,
    claimsCount: 28,
    coverageRules: [
      { area: 'Khám sức khỏe định kỳ', covered: true, rate: 100, limit: 200000000, notes: 'Theo danh sách nhân viên FPT.' },
      { area: 'Cấp cứu y tế khẩn cấp', covered: true, rate: 90, limit: 150000000 },
      { area: 'Điều trị nội trú ngắn ngày', covered: true, rate: 90, limit: 150000000 },
    ],
    claims: [
      { id: 'clm-06', patientName: 'Lê Hoàng Minh', patientMRN: 'PAT-202', encounterId: 'ENC-2026-088', submittedAmount: 8500000, approvedAmount: 7650000, rejectedAmount: 850000, status: 'RECONCILED', submittedAt: '2026-07-10' },
    ],
    rejectionAnalysis: {
      missingDocs: 20,
      exclusion: 10,
      codingError: 30,
      authMissing: 30,
      other: 10,
    },
    aiInsight: 'Hợp đồng đã hết hạn ngày 14/07/2026. Đang đề xuất gia hạn gói khám chữa bệnh 2026-2027 với giá trị tăng 15%.',
    audits: [
      { timestamp: '2026-01-15T08:00:00Z', event: 'Khởi tạo hợp đồng doanh nghiệp FPT.', operator: 'KTV. Nguyễn Lan' },
      { timestamp: '2026-07-14T17:00:00Z', event: 'Hợp đồng tự động chuyển trạng thái Hết Hạn.', operator: 'Hệ thống' },
    ],
  },
  {
    id: 'cnt-004',
    contractNo: 'TM-2026-PVI-0101',
    insurer: 'PVI Insurance — Gói cao cấp Premium',
    type: 'commercial',
    coveredServices: ['Toàn bộ dịch vụ nội trú', 'Chuyên gia quốc tế', 'Phòng suite'],
    coverageRate: 100,
    annualCap: 10000000000,
    usedCap: 8900000000,
    validFrom: '2026-06-01',
    validTo: '2026-11-30',
    status: 'expiring',
    totalClaimed: 890000000,
    totalApproved: 880000000,
    claimsCount: 78,
    coverageRules: [
      { area: 'Toàn bộ dịch vụ nội trú', covered: true, rate: 100, limit: 5000000000 },
      { area: 'Hội chẩn chuyên gia quốc tế', covered: true, rate: 100, limit: 3000000000 },
      { area: 'Phòng bệnh cao cấp Suite', covered: true, rate: 100, limit: 2000000000 },
    ],
    claims: [
      { id: 'clm-07', patientName: 'Hoàng Anh Tuấn', patientMRN: 'PAT-303', encounterId: 'ENC-2026-209', submittedAmount: 120000000, approvedAmount: 120000000, rejectedAmount: 0, status: 'APPROVED', submittedAt: '2026-08-01' },
    ],
    rejectionAnalysis: {
      missingDocs: 5,
      exclusion: 65,
      codingError: 15,
      authMissing: 10,
      other: 5,
    },
    aiInsight: 'Cần gia hạn hợp đồng trước ngày 30/11/2026. Công suất sử dụng hạn mức đạt 89%. Khuyến nghị đàm phán nâng hạn mức niên độ sau lên 12 tỷ.',
    audits: [
      { timestamp: '2026-06-01T08:00:00Z', event: 'Khởi tạo hợp đồng PVI Premium.', operator: 'KTV. Nguyễn Lan' },
    ],
  },
];

const TYPE_CONFIG = {
  bhyt: { label: 'BHYT Xã hội', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  commercial: { label: 'Bảo hiểm thương mại', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  corporate: { label: 'Hợp đồng doanh nghiệp', color: 'bg-teal-100 text-teal-800 border-teal-200' },
};

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  expiring: { label: 'Expiring', color: 'bg-amber-100 text-amber-800', icon: Clock },
  expired: { label: 'Expired', color: 'bg-rose-100 text-rose-800', icon: AlertCircle },
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700', icon: FileText },
};

export default function HospitalContractsPage() {
  const [contracts, setContracts] = useState<InsuranceContract[]>(INITIAL_CONTRACTS);
  const [filter, setFilter] = useState<'all' | 'bhyt' | 'commercial' | 'corporate'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Workspace active tab
  const [workspaceTab, setWorkspaceTab] = useState<'overview' | 'coverage' | 'claims' | 'rejection' | 'renewal'>('overview');

  const filtered = useMemo(() => contracts.filter((c) => filter === 'all' || c.type === filter), [contracts, filter]);

  // Operational header metrics YTD
  const activeContracts = useMemo(() => contracts.filter((c) => c.status === 'active').length, [contracts]);
  const expiringContracts = useMemo(() => contracts.filter((c) => c.status === 'expiring').length, [contracts]);
  const expiredContracts = useMemo(() => contracts.filter((c) => c.status === 'expired').length, [contracts]);
  const totalApproved = useMemo(() => contracts.reduce((s, c) => s + c.totalApproved, 0), [contracts]);

  const selectedContract = useMemo(() => contracts.find((c) => c.id === selectedId), [contracts, selectedId]);

  // Renewal Action Handler
  const handleRenew = (contractId: string) => {
    setContracts((prev) =>
      prev.map((c) => {
        if (c.id !== contractId) return c;

        const nextYear = new Date(c.validTo);
        nextYear.setFullYear(nextYear.getFullYear() + 1);

        const audit: ContractAudit = {
          timestamp: new Date().toISOString(),
          event: `Đàm phán gia hạn hợp đồng thành công. Thời hạn mới kéo dài đến ngày ${nextYear.toISOString().slice(0, 10)}.`,
          operator: 'KTV. Lê Thị Hà',
        };

        return {
          ...c,
          status: 'active',
          validTo: nextYear.toISOString().slice(0, 10),
          audits: [...c.audits, audit],
        };
      })
    );
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none">
      {/* Header banner with semantic dark teal */}
      <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-emerald-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-emerald-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-teal-900/10 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 mb-1">
              <ShieldCheck className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Bella Hospital • Insurance & Payer Intelligence
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white !text-white">
              Hợp Đồng Bảo Hiểm Bệnh Viện
            </h1>
            <p className="text-teal-200/80 text-sm mt-1 max-w-xl leading-relaxed">
              Quản lý hợp đồng bảo lãnh thương mại, thiết lập quy tắc giới hạn hạn mức đồng chi trả và phân tích dữ liệu hiệu suất bồi thường y tế.
            </p>
          </div>
          
          <div className="grid grid-cols-4 gap-3 shrink-0 w-full md:w-auto text-center font-bold">
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-emerald-500/30 transition-all duration-300">
              <div className="text-xl font-black text-emerald-400">{activeContracts} Active</div>
              <div className="text-[9px] text-emerald-200/70 font-semibold uppercase mt-0.5">Đang chạy</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-amber-500/30 transition-all duration-300">
              <div className="text-xl font-black text-amber-400">{expiringContracts} Expiring</div>
              <div className="text-[9px] text-amber-200/70 font-semibold uppercase mt-0.5">Sắp hết hạn</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-rose-500/30 transition-all duration-300">
              <div className="text-xl font-black text-rose-400">{expiredContracts} Expired</div>
              <div className="text-[9px] text-rose-200/70 font-semibold uppercase mt-0.5">Đã hết hạn</div>
            </div>
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-teal-500/30 transition-all duration-300 col-span-4 md:col-span-1">
              <div className="text-lg font-black text-teal-300">{fmt(totalApproved)}</div>
              <div className="text-[9px] text-teal-200/70 font-semibold uppercase mt-0.5">Reimbursed YTD</div>
            </div>
          </div>
        </div>
      </div>

      {/* Expiring Contract Alert (Operational trigger) */}
      {expiringContracts > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start space-x-3">
          <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0 animate-pulse" />
          <div className="text-xs">
            <div className="font-extrabold text-amber-800 text-sm">Cảnh báo kỳ hạn: 1 Hợp đồng bảo hiểm cần gia hạn gấp</div>
            <p className="text-amber-700 mt-1 font-medium">
              Gói PVI Premium sắp hết hạn trong vòng 23 ngày tới. Vui lòng bắt đầu quy trình gia hạn đàm phán phí.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: FILTERS & CONTRACTS LIST */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: 'all', label: 'Tất cả' },
                { key: 'bhyt', label: 'BHYT' },
                { key: 'commercial', label: 'Bảo hiểm TM' },
                { key: 'corporate', label: 'Doanh nghiệp' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFilter(key as typeof filter)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                    filter === key
                      ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button className="flex items-center space-x-1 px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-[11px] font-bold shadow transition-all shrink-0">
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm mới</span>
            </button>
          </div>

          {/* Cards List container */}
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {filtered.map((contract) => {
              const typeCfg = TYPE_CONFIG[contract.type];
              const statusCfg = STATUS_CONFIG[contract.status];
              const StatusIcon = statusCfg.icon;
              const approvalRate = contract.totalClaimed > 0
                ? Math.round((contract.totalApproved / contract.totalClaimed) * 100)
                : 0;
              const utilizationRate = Math.round((contract.usedCap / contract.annualCap) * 100);

              return (
                <button
                  key={contract.id}
                  onClick={() => {
                    setSelectedId(contract.id === selectedId ? null : contract.id);
                    setWorkspaceTab('overview');
                  }}
                  className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-2.5 relative ${
                    selectedId === contract.id ? 'border-teal-600 ring-2 ring-teal-100' : 'border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${typeCfg.color}`}>
                      {typeCfg.label}
                    </span>
                    <span className={`flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded border ${statusCfg.color}`}>
                      <StatusIcon className="w-2.5 h-2.5" />
                      {statusCfg.label}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-slate-900 text-xs block leading-tight">{contract.insurer}</h4>
                    <div className="text-[10px] text-slate-400 font-bold tracking-tight mt-1">
                      Mã HĐ: {contract.contractNo} · Hạn mức: {fmt(contract.annualCap)}
                    </div>
                  </div>

                  {/* Coverage indicators */}
                  <div className="flex flex-wrap gap-1">
                    {contract.coveredServices.slice(0, 3).map((s) => (
                      <span key={s} className="text-[9px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-100">
                        {s}
                      </span>
                    ))}
                    {contract.coveredServices.length > 3 && (
                      <span className="text-[9px] bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded">
                        +{contract.coveredServices.length - 3} dịch vụ
                      </span>
                    )}
                  </div>

                  {/* Claims mini strip */}
                  <div className="flex justify-between items-center text-[10px] bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                    <div className="text-slate-500">Duyệt: <strong className="text-slate-800">{approvalRate}%</strong> ({contract.claimsCount} claims)</div>
                    <div className="text-slate-500">Hạn mức: <strong className="text-indigo-700">{utilizationRate}%</strong></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMNS: CONTRACT WORKSPACE DETAIL (Columns 2 & 3) */}
        <div className="lg:col-span-2">
          {selectedContract ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[500px]">
              
              {/* Workspace Header */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-950 px-5 py-4 border-b border-slate-800 flex justify-between items-center text-white">
                <div>
                  <h3 className="font-extrabold text-slate-100 text-sm">{selectedContract.insurer}</h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Hợp đồng: {selectedContract.contractNo} · Thời hạn: {selectedContract.validFrom} → {selectedContract.validTo}
                  </p>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${STATUS_CONFIG[selectedContract.status].color}`}>
                  {STATUS_CONFIG[selectedContract.status].label}
                </span>
              </div>

              {/* Tab options bar */}
              <div className="flex border-b border-slate-100 bg-white">
                {[
                  { key: 'overview', label: 'Hiệu Suất Chung', icon: BarChart3 },
                  { key: 'coverage', label: 'Quy Tắc Hạn Mức', icon: ShieldCheck },
                  { key: 'claims', label: 'Claims Ledger', icon: FileText },
                  { key: 'rejection', label: 'AI Rejection Analysis', icon: Sparkles },
                  { key: 'renewal', label: 'Gia Hạn & Audit', icon: History },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setWorkspaceTab(tab.key as typeof workspaceTab)}
                    className={`flex-1 py-3 px-1 text-center text-xs font-bold border-b-2 flex items-center justify-center space-x-1.5 transition-all ${
                      workspaceTab === tab.key
                        ? 'border-teal-600 text-teal-700 bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <tab.icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden md:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Workspace Tab Contents */}
              <div className="p-5 flex-1 overflow-y-auto max-h-[55vh]">
                
                {/* TAB 1: HIỆU SUẤT TÀI CHÍNH CHUNG */}
                {workspaceTab === 'overview' && (
                  <div className="space-y-5 text-xs">
                    
                    {/* Cap utilization progress bar */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-slate-500">Giới hạn hạn mức bảo lãnh năm:</span>
                        <span className="text-slate-900 font-extrabold">{fmt(selectedContract.annualCap)}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-teal-600 h-full rounded-full transition-all"
                          style={{ width: `${(selectedContract.usedCap / selectedContract.annualCap) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>Đã sử dụng: {fmt(selectedContract.usedCap)} ({Math.round((selectedContract.usedCap / selectedContract.annualCap) * 100)}%)</span>
                        <span>Còn lại: {fmt(selectedContract.annualCap - selectedContract.usedCap)}</span>
                      </div>
                    </div>

                    {/* Claims Metrics details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-[10px] text-slate-400 font-bold mb-0.5">Submitted Claims</div>
                        <div className="text-sm font-black text-slate-800">{fmt(selectedContract.totalClaimed)}</div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-[10px] text-slate-400 font-bold mb-0.5">Approved Claims</div>
                        <div className="text-sm font-black text-emerald-700">{fmt(selectedContract.totalApproved)}</div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-[10px] text-slate-400 font-bold mb-0.5">Rejected Claims</div>
                        <div className="text-sm font-black text-rose-700">
                          {fmt(selectedContract.totalClaimed - selectedContract.totalApproved - 10000000)}
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <div className="text-[10px] text-slate-400 font-bold mb-0.5">Claims Approval Rate</div>
                        <div className="text-sm font-black text-indigo-700">
                          {Math.round((selectedContract.totalApproved / selectedContract.totalClaimed) * 100)}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-teal-50/50 border border-teal-200 rounded-xl p-4 font-bold text-slate-700">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Thời gian chi trả bình quân:</span>
                        <strong className="text-slate-800 text-sm">4.2 ngày</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Số lượt bồi thường phát sinh:</span>
                        <strong className="text-slate-800 text-sm">{selectedContract.claimsCount} lượt</strong>
                      </div>
                    </div>

                  </div>
                )}

                {/* TAB 2: QUY TẮC HẠN MỨC DỊCH VỤ CHI TIẾT */}
                {workspaceTab === 'coverage' && (
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Danh mục và giới hạn bảo lãnh y khoa</h4>
                    <div className="border border-slate-100 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500">
                          <tr>
                            <th className="px-4 py-2">Dịch vụ</th>
                            <th className="px-4 py-2">Tỷ lệ chi trả</th>
                            <th className="px-4 py-2">Hạn mức tối đa</th>
                            <th className="px-4 py-2">Ghi chú áp dụng</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                          {selectedContract.coverageRules.map((rule, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2.5 font-bold text-slate-800">{rule.area}</td>
                              <td className="px-4 py-2.5 text-indigo-700 font-extrabold">{rule.rate}%</td>
                              <td className="px-4 py-2.5">{fmt(rule.limit)}</td>
                              <td className="px-4 py-2.5 text-[10px] text-slate-400">{rule.notes || 'Hợp lệ.'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 3: CLAIMS LEDGER */}
                {workspaceTab === 'claims' && (
                  <div className="space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Danh sách yêu cầu bồi thường phát sinh</h4>
                    <div className="border border-slate-100 rounded-xl overflow-hidden text-xs font-mono">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Bệnh nhân</th>
                            <th className="px-3 py-2">Mã Encounter</th>
                            <th className="px-3 py-2 text-right">Đề xuất</th>
                            <th className="px-3 py-2 text-right">Phê duyệt</th>
                            <th className="px-3 py-2 text-center">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {selectedContract.claims.map((claim) => (
                            <tr key={claim.id}>
                              <td className="px-3 py-2.5 font-bold text-slate-800 font-sans">{claim.patientName}</td>
                              <td className="px-3 py-2.5">{claim.encounterId}</td>
                              <td className="px-3 py-2.5 text-right font-bold">{fmt(claim.submittedAmount)}</td>
                              <td className="px-3 py-2.5 text-right font-black text-emerald-700">{fmt(claim.approvedAmount)}</td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded ${
                                  claim.status === 'APPROVED' || claim.status === 'RECONCILED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {claim.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 4: AI REJECTION INTELLIGENCE */}
                {workspaceTab === 'rejection' && (
                  <div className="space-y-4">
                    <div className="bg-purple-950/10 border border-purple-500/20 rounded-xl p-4 space-y-4">
                      <div className="flex items-center space-x-2 text-purple-900 text-xs font-black">
                        <Sparkles className="w-4 h-4 text-purple-700 animate-pulse" />
                        <span>Insurance Rejection Predictor & Intelligence</span>
                      </div>
                      
                      <div className="space-y-2 text-xs">
                        <div className="font-bold text-slate-700">Cơ cấu lý do BHYT/Bảo hiểm từ chối bồi thường:</div>
                        <div className="space-y-2.5 mt-2 font-bold text-slate-600 text-[11px]">
                          {[
                            { name: 'Thiếu tài liệu đính kèm (Missing Docs)', percent: selectedContract.rejectionAnalysis.missingDocs },
                            { name: 'Ngoài phạm vi hợp đồng (Coverage Exclusion)', percent: selectedContract.rejectionAnalysis.exclusion },
                            { name: 'Sai mã lập trình y tế (Incorrect Coding)', percent: selectedContract.rejectionAnalysis.codingError },
                            { name: 'Chưa xin bảo lãnh (Authorization Missing)', percent: selectedContract.rejectionAnalysis.authMissing },
                            { name: 'Lý do khác', percent: selectedContract.rejectionAnalysis.other },
                          ].map((item) => (
                            <div key={item.name} className="space-y-1">
                              <div className="flex justify-between">
                                <span>{item.name}</span>
                                <span className="text-purple-700 font-extrabold">{item.percent}%</span>
                              </div>
                              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-purple-600 h-full rounded-full"
                                  style={{ width: `${item.percent}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="text-[10.5px] text-purple-800 bg-purple-50 border border-purple-200 p-2.5 rounded-lg leading-relaxed font-bold">
                        💡 <strong>Phát hiện AI:</strong> {selectedContract.aiInsight}
                      </p>
                    </div>
                  </div>
                )}

                {/* TAB 5: GIA HẠN & AUDIT TRAILS */}
                {workspaceTab === 'renewal' && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center text-xs">
                      <div>
                        <span className="font-extrabold text-slate-800 block">Tiến trình đàm phán gia hạn hợp đồng</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">Tự động tăng niên hạn hợp đồng thêm 1 năm</span>
                      </div>
                      
                      {selectedContract.status === 'expiring' || selectedContract.status === 'expired' ? (
                        <button
                          onClick={() => handleRenew(selectedContract.id)}
                          className="bg-teal-600 hover:bg-teal-700 text-white font-bold px-3 py-1.5 rounded-xl transition-all shadow"
                        >
                          Gia hạn hợp đồng (Renew)
                        </button>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Đã ký gia hạn
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">
                        Nhật ký thay đổi (Audit Log History)
                      </h4>
                      <div className="relative border-l border-slate-200 pl-4 space-y-4 font-mono text-[11px]">
                        {selectedContract.audits.map((log, idx) => (
                          <div key={idx} className="relative">
                            <div className="absolute -left-[21px] mt-1.5 w-2.5 h-2.5 rounded-full bg-slate-400 border border-white" />
                            <div className="flex justify-between font-bold text-slate-800">
                              <span>{log.event}</span>
                              <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString('vi-VN')}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Thực hiện bởi: {log.operator}
                            </div>
                          </div>
                        ))}
                      </div>
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
                    <ShieldCheck className="w-4.5 h-4.5 text-teal-600" />
                    <span>Hợp Đồng Bảo Hiểm & Hoạt Động Bồi Thường</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Chọn hợp đồng bảo hiểm ở danh sách bên trái hoặc quản lý các đầu việc thanh toán bồi thường tồn đọng dưới đây.</p>
                </div>

                {/* Insurance stats dashboard */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
                    <div className="text-xs font-bold text-slate-400">Claims chờ phê duyệt</div>
                    <div className="text-2xl font-black text-slate-800">14 claims</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
                    <div className="text-xs font-bold text-slate-400 font-sans">Hiệu suất duyệt bồi thường YTD</div>
                    <div className="text-2xl font-black text-emerald-700">91.2%</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1 col-span-2">
                    <div className="text-xs font-bold text-slate-400">Claims bị từ chối / Nghi vấn tháng này</div>
                    <div className="text-2xl font-black text-rose-700">8 claims PVI</div>
                  </div>
                </div>

                {/* Operations checklist */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Checklist Vận Hành Bảo Hiểm</h4>
                  <div className="space-y-2.5 text-xs text-slate-600 font-bold">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="line-through text-slate-400">Đối soát báo cáo chi tiết tháng 7 với BHXH TP.HCM</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-slate-300 shrink-0" />
                      <span>Bổ sung hồ sơ chẩn đoán ICU cho 8 claims PVI đang bị query</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-slate-300 shrink-0" />
                      <span>Đàm phán phí gia hạn gói Bảo Việt Premium</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-center text-slate-400 text-xs py-4 border-t border-slate-200">
                <Building2 className="w-8 h-8 mx-auto mb-1 opacity-30 text-teal-600" />
                <span>Hãy chọn một hợp đồng để quản lý chi tiết hoặc xem hoạt động bồi thường.</span>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
