'use client';

import React, { useState, useMemo } from 'react';
import { BHYTXml130Service, BHYTXml130ExportPayload } from '@/services/healthcare/bhyt-actions';
import {
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  ShieldCheck,
  Zap,
  Search,
  Building2,
  History,
  Clock,
  ArrowRight,
  User,
  Check,
  Activity,
  FileCode,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

// ─── TYPES & INTERFACES ──────────────────────────────────────────────────────
type SubmissionStatus =
  | 'DRAFT'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'GENERATED'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'ACCEPTED'
  | 'REJECTED';

interface ReadinessCheck {
  label: string;
  status: 'complete' | 'warning' | 'error';
  details: string;
}

interface ValidationError {
  id: string;
  category: 'Clinical' | 'Billing' | 'Insurance' | 'Services' | 'Medication';
  severity: 'error' | 'warning';
  message: string;
  actionLabel: string;
  actionLink: string;
}

interface AuditLogEntry {
  timestamp: string;
  event: string;
  status: SubmissionStatus;
  operator: string;
  notes?: string;
}

interface BHYTEncounterClaim {
  encounterId: string;
  patientName: string;
  patientMRN: string;
  patientAge: number;
  patientGender: 'Nam' | 'Nữ' | 'Khác';
  admissionDate: string;
  encounterType: 'Ngoại trú' | 'Nội trú';
  insuranceCardCode: string;
  insuranceFacilityCode: string;
  diagnosesText: string;
  totalCharges: number;
  readinessScore: number;
  readinessChecks: ReadinessCheck[];
  errors: ValidationError[];
  submissionStatus: SubmissionStatus;
  submissionId?: string;
  auditLogs: AuditLogEntry[];
}

// ─── INITIAL ENCOUNTERS MOCK DATA ────────────────────────────────────────────
const INITIAL_CLAIMS: BHYTEncounterClaim[] = [
  {
    encounterId: 'enc-101',
    patientName: 'Nguyễn Văn Hùng',
    patientMRN: 'PAT-9912',
    patientAge: 62,
    patientGender: 'Nam',
    admissionDate: '2026-08-08',
    encounterType: 'Ngoại trú',
    insuranceCardCode: 'GD4797913000123',
    insuranceFacilityCode: '79012',
    diagnosesText: 'Viêm phế quản cấp (J20), Tăng huyết áp (I10)',
    totalCharges: 1450000,
    readinessScore: 96,
    readinessChecks: [
      { label: 'Thông tin hành chính bệnh nhân', status: 'complete', details: 'Họ tên, ngày sinh, giới tính đầy đủ.' },
      { label: 'Thẻ BHYT & Thời hạn giá trị', status: 'complete', details: 'Mã thẻ hợp lệ. Thời hạn đến 31/12/2026.' },
      { label: 'Hồ sơ lượt khám (Encounter)', status: 'complete', details: 'Thời gian bắt đầu/kết thúc hợp lệ.' },
      { label: 'Chẩn đoán lâm sàng & ICD-10', status: 'complete', details: 'Có chẩn đoán chính J20.' },
      { label: 'Ánh xạ dịch vụ kỹ thuật', status: 'complete', details: '1 dịch vụ đã được ánh xạ mã Bộ Y Tế.' },
      { label: 'Chỉ định thuốc nội trú', status: 'warning', details: 'Thuốc Amoxicillin thiếu đường dùng chỉ định.' },
      { label: 'Quyết toán viện phí', status: 'complete', details: 'Đã hoàn tất thanh toán đồng chi trả.' },
    ],
    errors: [
      {
        id: 'err-med-1',
        category: 'Medication',
        severity: 'warning',
        message: 'Y lệnh thuốc [Amoxicillin 500mg] thiếu chi tiết đường dùng chỉ định.',
        actionLabel: 'Đến Dược lâm sàng',
        actionLink: '/dashboard/hospital/pharmacy',
      },
    ],
    submissionStatus: 'DRAFT',
    auditLogs: [
      { timestamp: '2026-08-08T08:30:00Z', event: 'Khởi tạo hồ sơ BHYT nháp tự động từ Encounter.', status: 'DRAFT', operator: 'Hệ thống' },
    ],
  },
  {
    encounterId: 'enc-102',
    patientName: 'Trần Thị Thu Hà',
    patientMRN: 'PAT-8841',
    patientAge: 45,
    patientGender: 'Nữ',
    admissionDate: '2026-08-07',
    encounterType: 'Nội trú',
    insuranceCardCode: 'GD4798104002495',
    insuranceFacilityCode: '79012',
    diagnosesText: 'Chưa xác định',
    totalCharges: 18900000,
    readinessScore: 72,
    readinessChecks: [
      { label: 'Thông tin hành chính bệnh nhân', status: 'complete', details: 'Đầy đủ thông tin.' },
      { label: 'Thẻ BHYT & Thời hạn giá trị', status: 'complete', details: 'Mã thẻ hợp lệ.' },
      { label: 'Hồ sơ lượt khám (Encounter)', status: 'complete', details: 'Đầy đủ thông tin.' },
      { label: 'Chẩn đoán lâm sàng & ICD-10', status: 'error', details: 'Chẩn đoán chính ICD-10 chưa được chỉ định.' },
      { label: 'Ánh xạ dịch vụ kỹ thuật', status: 'error', details: 'Dịch vụ Xét nghiệm sinh hóa máu chưa có mapping BHYT.' },
      { label: 'Chỉ định thuốc nội trú', status: 'complete', details: 'Hợp lệ.' },
      { label: 'Quyết toán viện phí', status: 'complete', details: 'Hợp lệ.' },
    ],
    errors: [
      {
        id: 'err-cli-1',
        category: 'Clinical',
        severity: 'error',
        message: 'Chẩn đoán chính ICD-10 chưa được chỉ định trong bệnh án điện tử.',
        actionLabel: 'Đến EMR chỉ định chẩn đoán',
        actionLink: '/dashboard/hospital/emr',
      },
      {
        id: 'err-srv-1',
        category: 'Services',
        severity: 'error',
        message: 'Mã dịch vụ [Xét nghiệm sinh hóa máu] (XN-SHM-01) chưa được ánh xạ mã BHYT tương ứng.',
        actionLabel: 'Đến Ánh xạ Viện phí',
        actionLink: '/dashboard/hospital/billing',
      },
    ],
    submissionStatus: 'DRAFT',
    auditLogs: [
      { timestamp: '2026-08-07T10:00:00Z', event: 'Khởi tạo hồ sơ BHYT nháp từ Encounter.', status: 'DRAFT', operator: 'Hệ thống' },
    ],
  },
  {
    encounterId: 'enc-103',
    patientName: 'Lê Hoàng Nam',
    patientMRN: 'PAT-7703',
    patientAge: 29,
    patientGender: 'Nam',
    admissionDate: '2026-08-06',
    encounterType: 'Ngoại trú',
    insuranceCardCode: 'GD4795294029415',
    insuranceFacilityCode: '79012',
    diagnosesText: 'Viêm mũi họng cấp (J00)',
    totalCharges: 850000,
    readinessScore: 100,
    readinessChecks: [
      { label: 'Thông tin hành chính bệnh nhân', status: 'complete', details: 'Đầy đủ thông tin.' },
      { label: 'Thẻ BHYT & Thời hạn giá trị', status: 'complete', details: 'Mã thẻ hợp lệ.' },
      { label: 'Hồ sơ lượt khám (Encounter)', status: 'complete', details: 'Đầy đủ thông tin.' },
      { label: 'Chẩn đoán lâm sàng & ICD-10', status: 'complete', details: 'Hợp lệ.' },
      { label: 'Ánh xạ dịch vụ kỹ thuật', status: 'complete', details: 'Hợp lệ.' },
      { label: 'Chỉ định thuốc nội trú', status: 'complete', details: 'Hợp lệ.' },
      { label: 'Quyết toán viện phí', status: 'complete', details: 'Hợp lệ.' },
    ],
    errors: [],
    submissionStatus: 'ACCEPTED',
    submissionId: 'BHYT-2026-008912',
    auditLogs: [
      { timestamp: '2026-08-06T15:00:00Z', event: 'Khởi tạo hồ sơ BHYT nháp.', status: 'DRAFT', operator: 'Hệ thống' },
      { timestamp: '2026-08-06T15:15:00Z', event: 'Chạy kiểm định chất lượng dữ liệu - Đạt 100% hợp lệ.', status: 'VALIDATED', operator: 'KTV. Nguyễn Lan' },
      { timestamp: '2026-08-06T15:30:00Z', event: 'Tạo tệp XML 130 đóng gói dữ liệu.', status: 'GENERATED', operator: 'KTV. Nguyễn Lan' },
      { timestamp: '2026-08-06T15:35:00Z', event: 'Gửi hồ sơ lên cổng giám định BHYT Bộ Y Tế. ID: BHYT-2026-008912.', status: 'SUBMITTED', operator: 'KTV. Nguyễn Lan' },
      { timestamp: '2026-08-06T16:00:00Z', event: 'Cổng BHYT chấp nhận thanh toán viện phí đề xuất.', status: 'ACCEPTED', operator: 'BHYT Portal Portal' },
    ],
  },
];

const STEPS: { status: SubmissionStatus; label: string }[] = [
  { status: 'DRAFT', label: 'Nháp' },
  { status: 'VALIDATING', label: 'Đang kiểm tra' },
  { status: 'VALIDATED', label: 'Hợp lệ' },
  { status: 'GENERATED', label: 'Đã tạo XML' },
  { status: 'SUBMITTED', label: 'Đã gửi cổng' },
  { status: 'PROCESSING', label: 'Đang giám định' },
  { status: 'ACCEPTED', label: 'Chấp nhận' },
];

export default function HospitalBHYTPage() {
  const [claims, setClaims] = useState<BHYTEncounterClaim[]>(INITIAL_CLAIMS);
  const [selectedId, setSelectedId] = useState<string>('enc-101');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  
  // XML Preview & Tabs
  const [payload, setPayload] = useState<BHYTXml130ExportPayload | null>(null);
  const [activeXmlTab, setActiveXmlTab] = useState<'xml1' | 'xml2' | 'xml3' | 'xml4' | 'xml5'>('xml1');
  
  // Workspace Tab Panel
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'overview' | 'errors' | 'preview' | 'audit'>('overview');

  const selectedClaim = useMemo(() => claims.find((c) => c.encounterId === selectedId)!, [claims, selectedId]);

  const filteredDropdownClaims = useMemo(() => {
    return claims.filter(
      (c) =>
        c.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.patientMRN.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.encounterId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [claims, searchTerm]);

  // Operational KPIs
  const kpis = useMemo(() => {
    return {
      backlog: 127,
      errors: claims.reduce((acc, c) => acc + c.errors.length, 0) + 16, // mock additional
      submitted: claims.filter((c) => c.submissionStatus === 'SUBMITTED' || c.submissionStatus === 'PROCESSING').length + 41,
      accepted: claims.filter((c) => c.submissionStatus === 'ACCEPTED').length + 95,
    };
  }, [claims]);

  // Run validation engine
  const handleValidate = () => {
    setClaims((prev) =>
      prev.map((c) => {
        if (c.encounterId !== selectedId) return c;

        const validationLog: AuditLogEntry = {
          timestamp: new Date().toISOString(),
          event: `Chạy bộ quy tắc kiểm định Quyết định 130/QĐ-BYT. Kết quả: Sẵn sàng ${c.readinessScore}%. Phát hiện ${c.errors.length} cảnh báo/lỗi.`,
          status: c.errors.length > 0 ? 'DRAFT' : 'VALIDATED',
          operator: 'KTV. Lê Thị Hà',
        };

        return {
          ...c,
          submissionStatus: c.errors.length > 0 ? 'DRAFT' : 'VALIDATED',
          auditLogs: [...c.auditLogs, validationLog],
        };
      })
    );
    
    // Set view tab to overview
    setActiveWorkspaceTab('overview');
  };

  // Generate XML Payload
  const handleGenerateXml = async () => {
    try {
      const data = await BHYTXml130Service.generateClaimPayload(selectedId);
      setPayload(data);

      setClaims((prev) =>
        prev.map((c) => {
          if (c.encounterId !== selectedId) return c;

          const log: AuditLogEntry = {
            timestamp: new Date().toISOString(),
            event: 'Tạo tệp dữ liệu XML 130 (XML1 - XML5) thành công.',
            status: 'GENERATED',
            operator: 'KTV. Lê Thị Hà',
          };

          return {
            ...c,
            submissionStatus: 'GENERATED',
            auditLogs: [...c.auditLogs, log],
          };
        })
      );

      setActiveWorkspaceTab('preview');
    } catch {
      alert('Không thể xuất dữ liệu XML 130');
    }
  };

  // Submit to Portal
  const handleSubmitToPortal = () => {
    const claimId = `BHYT-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    
    setClaims((prev) =>
      prev.map((c) => {
        if (c.encounterId !== selectedId) return c;

        const logs: AuditLogEntry[] = [
          {
            timestamp: new Date().toISOString(),
            event: `Gửi hồ sơ lên cổng giám định thành công. Mã giao dịch: ${claimId}.`,
            status: 'SUBMITTED',
            operator: 'KTV. Lê Thị Hà',
          },
          {
            timestamp: new Date(Date.now() + 1000).toISOString(),
            event: 'Cổng tiếp nhận đang chạy thuật toán giám định hồ sơ tự động.',
            status: 'PROCESSING',
            operator: 'BHYT Portal',
          },
          {
            timestamp: new Date(Date.now() + 3000).toISOString(),
            event: 'Giám định BHYT chấp nhận chi trả (Approved). Ghi sổ kế toán thành công.',
            status: 'ACCEPTED',
            operator: 'BHYT Portal',
          }
        ];

        return {
          ...c,
          submissionStatus: 'ACCEPTED',
          submissionId: claimId,
          auditLogs: [...c.auditLogs, ...logs],
        };
      })
    );

    setActiveWorkspaceTab('audit');
  };

  // Download XML file
  const handleDownloadXml = () => {
    if (!payload) return;

    const xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<GIAM_DINH_BHYT>
  <XML1>
    <MA_LK>${payload.xml1.MA_LK}</MA_LK>
    <MA_BN>${payload.xml1.MA_BN}</MA_BN>
    <HO_TEN>${payload.xml1.HO_TEN}</HO_TEN>
    <NGAY_SINH>${payload.xml1.NGAY_SINH}</NGAY_SINH>
    <GIOI_TINH>${payload.xml1.GIOI_TINH}</GIOI_TINH>
    <MA_THE_BHYT>${payload.xml1.MA_THE_BHYT}</MA_THE_BHYT>
    <MA_DKBD>${payload.xml1.MA_DKBD}</MA_DKBD>
    <MA_BENH>${payload.xml1.MA_BENH}</MA_BENH>
    <NGAY_VAO>${payload.xml1.NGAY_VAO}</NGAY_VAO>
    <NGAY_RA>${payload.xml1.NGAY_RA}</NGAY_RA>
    <TONG_CHI>${payload.xml1.TONG_CHI}</TONG_CHI>
  </XML1>
</GIAM_DINH_BHYT>`;

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BHYT_XML130_${selectedId}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format currencies
  const fmt = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-950 via-slate-900 to-emerald-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-emerald-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/10 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 mb-1">
              <FileText className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Vietnam Country Pack • BHYT & Insurance Gateway
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white !text-white">
              Cổng Kết Xuất & Giám Định BHYT XML 130
            </h1>
            <p className="text-emerald-200/80 text-sm mt-1 max-w-xl leading-relaxed">
              Thẩm định dữ liệu chuẩn định dạng XML 130, rà soát cảnh báo nghiệp vụ và chuyển gửi hồ sơ giám định Bảo hiểm Y tế của Bộ Y tế.
            </p>
          </div>

          {/* Operational KPIs */}
          <div className="grid grid-cols-4 gap-3 shrink-0 w-full md:w-auto">
            <div className="text-center bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-emerald-500/30 transition-all duration-300">
              <div className="text-xl font-black text-emerald-300">{kpis.backlog}</div>
              <div className="text-[9px] text-emerald-200/70 font-bold uppercase tracking-wider mt-0.5">Chờ Xuất</div>
            </div>
            <div className="text-center bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-rose-500/30 transition-all duration-300">
              <div className="text-xl font-black text-rose-400">{kpis.errors}</div>
              <div className="text-[9px] text-rose-200/70 font-bold uppercase tracking-wider mt-0.5">Lỗi Dữ Liệu</div>
            </div>
            <div className="text-center bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-blue-500/30 transition-all duration-300">
              <div className="text-xl font-black text-blue-300">{kpis.submitted}</div>
              <div className="text-[9px] text-blue-200/70 font-bold uppercase tracking-wider mt-0.5">Đã Gửi</div>
            </div>
            <div className="text-center bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-emerald-500/30 transition-all duration-300">
              <div className="text-xl font-black text-emerald-400">{kpis.accepted}</div>
              <div className="text-[9px] text-emerald-200/70 font-bold uppercase tracking-wider mt-0.5">Được Duyệt</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: ENCOUNTER SELECTOR & INTERACTIVE GATEWAY ACTIONS */}
        <div className="lg:col-span-1 space-y-4">
          
          {/* Advanced Encounter Selector Dropdown Search */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 relative">
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-1">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Lượt Khám Chờ Giám Định</span>
            </h4>
            
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full text-left bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 flex justify-between items-center hover:bg-slate-100/50 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <div>
                  <div className="text-slate-900">{selectedClaim.patientName} ({selectedClaim.patientAge}T)</div>
                  <div className="text-[10px] text-slate-400 font-medium">
                    {selectedClaim.encounterId} · {selectedClaim.encounterType} · {selectedClaim.readinessScore}% Sẵn sàng
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0 transform rotate-95" />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                  <div className="p-2 border-b border-slate-100">
                    <input
                      type="text"
                      placeholder="Tìm kiếm bệnh nhân, MRN..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {filteredDropdownClaims.map((claim) => (
                      <button
                        key={claim.encounterId}
                        onClick={() => {
                          setSelectedId(claim.encounterId);
                          setPayload(null);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs border-b border-slate-50 flex justify-between items-center transition-all ${
                          selectedId === claim.encounterId
                            ? 'bg-indigo-50 text-indigo-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div>
                          <div>{claim.patientName}</div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {claim.encounterId} · {claim.encounterType}
                          </div>
                        </div>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${
                          claim.readinessScore === 100
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : claim.readinessScore > 80
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {claim.readinessScore}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Clinical Data Readiness Checklist Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                Độ Sẵn Sàng Dữ Liệu
              </h4>
              <span className={`text-xs font-black ${
                selectedClaim.readinessScore === 100
                  ? 'text-emerald-600'
                  : selectedClaim.readinessScore > 80
                  ? 'text-amber-600'
                  : 'text-rose-600'
              }`}>
                {selectedClaim.readinessScore}%
              </span>
            </div>

            {/* Progress line */}
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  selectedClaim.readinessScore === 100
                    ? 'bg-emerald-500'
                    : selectedClaim.readinessScore > 80
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${selectedClaim.readinessScore}%` }}
              />
            </div>

            {/* Checklist elements */}
            <div className="space-y-2 text-xs mt-3">
              {selectedClaim.readinessChecks.map((chk, idx) => (
                <div key={idx} className="flex items-start space-x-2 border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
                  {chk.status === 'complete' && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  )}
                  {chk.status === 'warning' && (
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  {chk.status === 'error' && (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold text-slate-700 block">{chk.label}</span>
                    <span className="text-[10px] text-slate-400">{chk.details}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMNS: SUBMISSION WORKSPACE TABS & PREVIEW (Columns 2 & 3) */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Submission State Progress bar (Horizontal layout) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-md">
            <h4 className="text-[10px] uppercase font-bold text-white/80 !text-white/80 tracking-wider mb-3">
              Tiến Trình Cổng Giám Định BHYT
            </h4>
            <div className="flex items-center justify-between relative">
              {/* background connector line */}
              <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-slate-800 z-0" />
              
              {STEPS.map((s, idx) => {
                const isPassed =
                  selectedClaim.submissionStatus === s.status ||
                  STEPS.findIndex((st) => st.status === selectedClaim.submissionStatus) >= idx;
                
                return (
                  <div key={idx} className="flex flex-col items-center z-10">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 ${
                      isPassed
                        ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-950 border-slate-700 text-slate-200'
                    }`}>
                      {isPassed ? (
                        <Check className="w-4 h-4 shrink-0" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>
                    <span className={`text-[9px] font-bold mt-1.5 ${
                      isPassed ? 'text-emerald-400 font-extrabold' : 'text-slate-200'
                    }`}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action triggers box */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap gap-2.5 items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={handleValidate}
                className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow transition-all"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Chạy kiểm tra dữ liệu</span>
              </button>

              <button
                onClick={handleGenerateXml}
                disabled={selectedClaim.readinessScore < 80}
                className={`font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow transition-all ${
                  selectedClaim.readinessScore >= 80
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Tạo file XML 130</span>
              </button>
            </div>

            <div className="flex gap-2">
              {payload && (
                <button
                  onClick={handleSubmitToPortal}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 shadow transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Gửi cổng BHYT</span>
                </button>
              )}

              {payload && (
                <button
                  onClick={handleDownloadXml}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải file XML</span>
                </button>
              )}
            </div>
          </div>

          {/* Workspace Tabs & Output preview container */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[400px] flex flex-col">
            
            {/* Header selector tab */}
            <div className="flex border-b border-slate-100 bg-slate-50/50">
              {[
                { key: 'overview', label: 'Tổng Quan Lâm Sàng', icon: Building2 },
                { key: 'errors', label: 'Cảnh Báo Lỗi', icon: AlertCircle },
                { key: 'preview', label: 'Xem Trước XML 130', icon: FileCode },
                { key: 'audit', label: 'Nhật Ký Giao Dịch BHYT', icon: History },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveWorkspaceTab(tab.key as typeof activeWorkspaceTab)}
                  className={`flex-1 py-3 text-center text-xs font-bold border-b-2 flex items-center justify-center space-x-1.5 transition-all ${
                    activeWorkspaceTab === tab.key
                      ? 'border-emerald-600 text-emerald-800 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between">
              
              {/* TAB 1: TỔNG QUAN LÂM SÀNG */}
              {activeWorkspaceTab === 'overview' && (
                <div className="space-y-4 text-xs text-slate-600">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <h5 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider mb-2">Tóm tắt y khoa hành chính</h5>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 font-mono">
                      <div>Họ và tên: <strong className="text-slate-800">{selectedClaim.patientName}</strong></div>
                      <div>Mã MRN: <strong className="text-slate-800">{selectedClaim.patientMRN}</strong></div>
                      <div>Giới tính: <strong className="text-slate-800">{selectedClaim.patientGender}</strong></div>
                      <div>Mã thẻ BHYT: <strong className="text-slate-800">{selectedClaim.insuranceCardCode}</strong></div>
                      <div>Nơi đăng ký KCB ban đầu: <strong className="text-slate-800">{selectedClaim.insuranceFacilityCode}</strong></div>
                      <div>Ngày nhập viện: <strong className="text-slate-800">{selectedClaim.admissionDate}</strong></div>
                      <div className="col-span-2">Chẩn đoán ra viện: <strong className="text-slate-800">{selectedClaim.diagnosesText}</strong></div>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center">
                    <div>
                      <span className="font-bold text-slate-700 block">Tổng chi phí y tế phát sinh đề xuất:</span>
                      <span className="text-[10px] text-slate-400">Tự động tổng hợp từ Billing & Pharmacy</span>
                    </div>
                    <span className="text-lg font-black text-emerald-800">{fmt(selectedClaim.totalCharges)}</span>
                  </div>
                </div>
              )}

              {/* TAB 2: CẢNH BÁO LỖI */}
              {activeWorkspaceTab === 'errors' && (
                <div className="space-y-3">
                  {selectedClaim.errors.length > 0 ? (
                    selectedClaim.errors.map((err) => (
                      <div
                        key={err.id}
                        className={`p-3.5 rounded-xl border flex items-start justify-between gap-4 text-xs ${
                          err.severity === 'error'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : 'bg-amber-50 border-amber-200 text-amber-800'
                        }`}
                      >
                        <div className="flex items-start space-x-2.5">
                          <AlertCircle className={`w-4.5 h-4.5 mt-0.5 shrink-0 ${
                            err.severity === 'error' ? 'text-rose-600' : 'text-amber-600'
                          }`} />
                          <div>
                            <span className="font-extrabold uppercase tracking-tight block">[{err.category}]</span>
                            <p className="mt-0.5 font-medium leading-relaxed">{err.message}</p>
                          </div>
                        </div>

                        {/* Redirection link back to clinical source */}
                        <a
                          href={err.actionLink}
                          className={`shrink-0 font-bold px-3 py-1 rounded-lg border transition-all text-[10px] flex items-center space-x-1 hover:shadow-sm ${
                            err.severity === 'error'
                              ? 'border-rose-300 text-rose-700 hover:bg-rose-100/50'
                              : 'border-amber-300 text-amber-700 hover:bg-amber-100/50'
                          }`}
                        >
                          <span>{err.actionLabel}</span>
                          <ArrowRight className="w-3 h-3" />
                        </a>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-slate-400 text-xs space-y-1">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 opacity-60" />
                      <div className="font-bold text-slate-700">✓ Không phát hiện lỗi hoặc cảnh báo dữ liệu nào</div>
                      <p className="text-[10px]">Hồ sơ đã đạt tiêu chuẩn 100% sẵn sàng xuất XML 130.</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: XEM TRƯỚC XML 130 */}
              {activeWorkspaceTab === 'preview' && (
                <div className="space-y-4 flex-1 flex flex-col">
                  {payload ? (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1">
                      
                      {/* Sub-tabs list */}
                      <div className="space-y-1.5 lg:col-span-1">
                        {[
                          { key: 'xml1', label: 'XML1 (Hành Chính)' },
                          { key: 'xml2', label: 'XML2 (Thuốc)' },
                          { key: 'xml3', label: 'XML3 (Dịch Vụ)' },
                          { key: 'xml4', label: 'XML4 (CLS)' },
                          { key: 'xml5', label: 'XML5 (Diễn Biến)' },
                        ].map((subTab) => (
                          <button
                            key={subTab.key}
                            onClick={() => setActiveXmlTab(subTab.key as typeof activeXmlTab)}
                            className={`w-full text-left px-3 py-2 rounded-lg border text-[11px] font-bold transition-all ${
                              activeXmlTab === subTab.key
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-black'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {subTab.label}
                          </button>
                        ))}
                      </div>

                      {/* Code Preview box */}
                      <div className="lg:col-span-3 bg-slate-950 border border-slate-900 rounded-xl p-4 font-mono text-[10.5px] text-cyan-100 overflow-auto max-h-[250px] shadow-inner">
                        {activeXmlTab === 'xml1' && (
                          <pre className="whitespace-pre">{JSON.stringify(payload.xml1, null, 2)}</pre>
                        )}
                        {activeXmlTab === 'xml2' && (
                          <pre className="whitespace-pre">{JSON.stringify(payload.xml2, null, 2)}</pre>
                        )}
                        {activeXmlTab === 'xml3' && (
                          <pre className="whitespace-pre">{JSON.stringify(payload.xml3, null, 2)}</pre>
                        )}
                        {activeXmlTab === 'xml4' && (
                          <pre className="whitespace-pre">{JSON.stringify(payload.xml4, null, 2)}</pre>
                        )}
                        {activeXmlTab === 'xml5' && (
                          <pre className="whitespace-pre">{JSON.stringify(payload.xml5, null, 2)}</pre>
                        )}
                      </div>

                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      Hãy nhấp vào nút **"Tạo file XML 130"** ở trên để kết xuất và kiểm duyệt dữ liệu thẻ XML mẫu.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: NHẬT KÝ GIAO DỊCH BHYT */}
              {activeWorkspaceTab === 'audit' && (
                <div className="space-y-4">
                  {selectedClaim.submissionId && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono flex justify-between items-center">
                      <span>Mã định danh giao dịch (Submission ID):</span>
                      <strong className="text-slate-800">{selectedClaim.submissionId}</strong>
                    </div>
                  )}

                  <div className="relative border-l border-slate-200 pl-4 space-y-4 text-[11px] font-mono">
                    {selectedClaim.auditLogs.map((log, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[21px] mt-1.5 w-2.5 h-2.5 rounded-full bg-emerald-600 border border-white" />
                        <div className="flex justify-between font-bold text-slate-800">
                          <span>[{log.status}] {log.event}</span>
                          <span className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString('vi-VN')}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Tác vụ bởi: {log.operator}
                        </div>
                      </div>
                    ))}
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
