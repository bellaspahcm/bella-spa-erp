'use client';

import React, { useState, useMemo } from 'react';
import {
  CircleDollarSign,
  FileText,
  CheckCircle2,
  Clock,
  CreditCard,
  Building2,
  Wallet,
  BarChart3,
  AlertCircle,
  ChevronRight,
  Receipt,
  Search,
  ArrowRight,
  PlusCircle,
  Calendar,
  User,
  Check,
  ShieldAlert,
  Sparkles,
  Percent,
  TrendingUp,
  Coins,
  History,
  Pill
} from 'lucide-react';

// ─── TYPES & INTERFACES ──────────────────────────────────────────────────────
type InpatientBillingState =
  | 'ACTIVE'               // Đang điều trị
  | 'DISCHARGE_PENDING'   // Chờ làm thủ tục xuất viện
  | 'BILLING_REVIEW'      // Đang duyệt chi phí
  | 'INSURANCE_REVIEW'    // Đang duyệt BHYT
  | 'FINALIZED'           // Đã chốt bảng kê
  | 'PAID'                // Đã quyết toán
  | 'RECONCILED'          // Đã đối soát
  | 'CLAIM_REJECTED'      // Từ chối BHYT
  | 'CLAIM_QUERIED'       // Nghi vấn BHYT
  | 'REFUND_REQUIRED';    // Yêu cầu hoàn tiền

interface FinancialEvent {
  timestamp: string;
  type: 'CLINICAL' | 'PAYMENT' | 'ADJUSTMENT' | 'INSURANCE' | 'SYSTEM';
  description: string;
  amount?: number;
  user: string;
}

interface InsuranceClaimDetails {
  claimId: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PARTIAL' | 'DENIED' | 'QUERY' | 'RECONCILED';
  eligibleAmount: number;
  approvedAmount: number;
  deniedAmount: number;
  denialReasonCode?: string;
  denialReasonText?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewerName?: string;
}

interface DepositRecord {
  id: string;
  timestamp: string;
  amount: number;
  type: 'DEPOSIT' | 'PAYMENT' | 'REFUND' | 'CREDIT_ADJUST' | 'DEBIT_ADJUST' | 'WRITE_OFF';
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'CREDIT_NOTE';
  reportedBy: string;
  notes?: string;
  referenceNo?: string;
}

interface InpatientBill {
  id: string;
  patientName: string;
  patientMRN: string;
  patientAge: number;
  patientGender: 'Nam' | 'Nữ' | 'Khác';
  admissionNo: string;
  encounterId: string;
  wardBed: string;
  admittedAt: string;
  dischargedAt: string | null;
  daysStayed: number;
  
  // Cost breakdown
  roomCharges: number;
  medicationCharges: number;
  procedureCharges: number;
  labImagingCharges: number;
  nursingCharges: number;
  professionalServiceCharges: number;
  consumableCharges: number;

  totalAmount: number;
  bhytApproved: number;
  patientCopay: number;
  outOfPocketExclusions: number;
  depositPaid: number;
  
  status: InpatientBillingState;
  insuranceCode: string | null;
  insuranceClaim: InsuranceClaimDetails | null;
  ledger: DepositRecord[];
  timeline: FinancialEvent[];
  projectedDischargeCost: number;
  aiInsights: {
    denialRiskPercent: number;
    denialRiskReason?: string;
    anomalyAlert?: string;
  };
}

// ─── CONFIGURATIONS ──────────────────────────────────────────────────────────
const STATE_CONFIG: Record<InpatientBillingState, { label: string; bg: string; text: string; border: string }> = {
  ACTIVE: { label: 'Đang điều trị', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  DISCHARGE_PENDING: { label: 'Chờ xuất viện', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  BILLING_REVIEW: { label: 'Duyệt chi phí', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  INSURANCE_REVIEW: { label: 'Giám định BHYT', bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  FINALIZED: { label: 'Đã chốt bảng kê', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  PAID: { label: 'Đã quyết toán', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  RECONCILED: { label: 'Đã đối soát', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  CLAIM_REJECTED: { label: 'BHYT từ chối', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  CLAIM_QUERIED: { label: 'BHYT nghi vấn', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  REFUND_REQUIRED: { label: 'Chờ hoàn tiền', bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-200' },
};

// ─── INITIAL MOCK DATA ───────────────────────────────────────────────────────
const INITIAL_BILLS: InpatientBill[] = [
  {
    id: 'bill-001',
    patientName: 'Nguyễn Văn Hoàng',
    patientMRN: 'PAT-001',
    patientAge: 62,
    patientGender: 'Nam',
    admissionNo: 'ADM-2026-0892',
    encounterId: 'ENC-2026-008',
    wardBed: 'ICU-BED-01',
    admittedAt: '2026-08-04T08:00:00Z',
    dischargedAt: null,
    daysStayed: 5,
    roomCharges: 5000000,
    medicationCharges: 6200000,
    procedureCharges: 2800000,
    labImagingCharges: 3500000,
    nursingCharges: 1800000,
    professionalServiceCharges: 1000000,
    consumableCharges: 0,
    totalAmount: 20300000,
    bhytApproved: 14800000,
    patientCopay: 3700000,
    outOfPocketExclusions: 1800000,
    depositPaid: 5000000,
    status: 'ACTIVE',
    insuranceCode: 'BHYT-HA-123456',
    insuranceClaim: {
      claimId: 'CLM-2026-9042',
      status: 'SUBMITTED',
      eligibleAmount: 18500000,
      approvedAmount: 0,
      deniedAmount: 0,
      submittedAt: '2026-08-08T16:00:00Z',
    },
    ledger: [
      {
        id: 'led-001',
        timestamp: '2026-08-04T08:30:00Z',
        amount: 5000000,
        type: 'DEPOSIT',
        method: 'CASH',
        reportedBy: 'KTV. Lê Thị Hà',
        notes: 'Tiền tạm ứng nhập viện điều trị ICU.',
      },
    ],
    timeline: [
      { timestamp: '2026-08-04T08:00:00Z', type: 'SYSTEM', description: 'Tạo hồ sơ bệnh án nội trú & Phân giường ICU-BED-01.', user: 'Hệ thống' },
      { timestamp: '2026-08-04T08:30:00Z', type: 'PAYMENT', description: 'Đã thu tiền tạm ứng nhập viện +5,000,000 ₫.', amount: 5000000, user: 'KTV. Lê Thị Hà' },
      { timestamp: '2026-08-04T10:22:00Z', type: 'CLINICAL', description: 'Thực hiện y lệnh xét nghiệm khí máu & công thức máu (+450,000 ₫).', amount: 4500000, user: 'KTV. Trần Đức Trung' },
      { timestamp: '2026-08-05T11:05:00Z', type: 'CLINICAL', description: 'Chụp CT ngực không cản quang (+1,800,000 ₫).', amount: 1800000, user: 'BS. Lê Minh' },
      { timestamp: '2026-08-06T14:15:00Z', type: 'CLINICAL', description: 'Cấp phát thuốc kháng sinh Meropenem từ kho dược (+1,200,000 ₫).', amount: 1200000, user: 'DS. Trần Văn Sơn' },
      { timestamp: '2026-08-08T16:00:00Z', type: 'INSURANCE', description: 'Xác minh quyền lợi bảo hiểm BHYT 80% (Mã: BHYT-HA-123456). Khởi tạo hồ sơ giám định CLM-2026-9042.', user: 'KTV. Nguyễn Lan' },
    ],
    projectedDischargeCost: 26800000,
    aiInsights: {
      denialRiskPercent: 12,
      denialRiskReason: 'Chỉ định kháng sinh Meropenem có nguy cơ bị từ chối 12% do thiếu đính kèm biên bản hội chẩn nhóm kháng sinh dự phòng.',
      anomalyAlert: 'Chi phí thuốc của ICU-01 cao hơn 31% so với trung bình nhóm bệnh nhiễm khuẩn huyết tương tự.',
    },
  },
  {
    id: 'bill-002',
    patientName: 'Lê Thị Hương',
    patientMRN: 'PAT-002',
    patientAge: 45,
    patientGender: 'Nữ',
    admissionNo: 'ADM-2026-0887',
    encounterId: 'ENC-2026-009',
    wardBed: 'NGOAI-BED-03',
    admittedAt: '2026-08-01T10:00:00Z',
    dischargedAt: '2026-08-07T14:00:00Z',
    daysStayed: 6,
    roomCharges: 3600000,
    medicationCharges: 1800000,
    procedureCharges: 12000000,
    labImagingCharges: 900000,
    nursingCharges: 1200000,
    professionalServiceCharges: 0,
    consumableCharges: 0,
    totalAmount: 19500000,
    bhytApproved: 15600000,
    patientCopay: 3900000,
    outOfPocketExclusions: 0,
    depositPaid: 3900000,
    status: 'PAID',
    insuranceCode: 'BHYT-HCM-789012',
    insuranceClaim: {
      claimId: 'CLM-2026-7811',
      status: 'APPROVED',
      eligibleAmount: 19500000,
      approvedAmount: 15600000,
      deniedAmount: 0,
      submittedAt: '2026-08-07T09:00:00Z',
      reviewedAt: '2026-08-07T10:30:00Z',
      reviewerName: 'Giám định viên Nguyễn Huy Hoàng',
    },
    ledger: [
      {
        id: 'led-002',
        timestamp: '2026-08-01T10:15:00Z',
        amount: 2000000,
        type: 'DEPOSIT',
        method: 'TRANSFER',
        reportedBy: 'KTV. Lê Thị Hà',
      },
      {
        id: 'led-003',
        timestamp: '2026-08-07T13:45:00Z',
        amount: 1900000,
        type: 'PAYMENT',
        method: 'CARD',
        reportedBy: 'KTV. Lê Thị Hà',
        notes: 'Thanh toán viện phí còn lại lúc xuất viện.',
      },
    ],
    timeline: [
      { timestamp: '2026-08-01T10:00:00Z', type: 'SYSTEM', description: 'Tạo hồ sơ bệnh án nội trú khoa Ngoại & Phân giường NGOAI-BED-03.', user: 'Hệ thống' },
      { timestamp: '2026-08-01T10:15:00Z', type: 'PAYMENT', description: 'Thu tạm ứng nhập viện chuyển khoản +2,000,000 ₫.', amount: 2000000, user: 'KTV. Lê Thị Hà' },
      { timestamp: '2026-08-02T09:00:00Z', type: 'CLINICAL', description: 'Thực hiện phẫu thuật nội soi ổ bụng (+12,000,000 ₫).', amount: 12000000, user: 'BS. Nguyễn Văn An' },
      { timestamp: '2026-08-07T09:00:00Z', type: 'INSURANCE', description: 'Gửi hồ sơ giám định BHYT CLM-2026-7811.', user: 'KTV. Nguyễn Lan' },
      { timestamp: '2026-08-07T10:30:00Z', type: 'INSURANCE', description: 'BHYT phê duyệt thanh toán chi trả +15,600,000 ₫.', amount: 15600000, user: 'BHYT Portal' },
      { timestamp: '2026-08-07T13:45:00Z', type: 'PAYMENT', description: 'Thu tiền mặt thanh toán còn lại sau trừ tạm ứng +1,900,000 ₫. Quyết toán hồ sơ.', amount: 1900000, user: 'KTV. Lê Thị Hà' },
    ],
    projectedDischargeCost: 19500000,
    aiInsights: {
      denialRiskPercent: 0,
    },
  },
  {
    id: 'bill-003',
    patientName: 'Trần Đức Mạnh',
    patientMRN: 'PAT-003',
    patientAge: 58,
    patientGender: 'Nam',
    admissionNo: 'ADM-2026-0901',
    encounterId: 'ENC-2026-010',
    wardBed: 'NOI-BED-07',
    admittedAt: '2026-08-06T14:30:00Z',
    dischargedAt: null,
    daysStayed: 2,
    roomCharges: 1200000,
    medicationCharges: 650000,
    procedureCharges: 0,
    labImagingCharges: 1450000,
    nursingCharges: 600000,
    professionalServiceCharges: 0,
    consumableCharges: 0,
    totalAmount: 3900000,
    bhytApproved: 0,
    patientCopay: 3900000,
    outOfPocketExclusions: 0,
    depositPaid: 2000000,
    status: 'ACTIVE',
    insuranceCode: null,
    insuranceClaim: null,
    ledger: [
      {
        id: 'led-004',
        timestamp: '2026-08-06T15:00:00Z',
        amount: 2000000,
        type: 'DEPOSIT',
        method: 'CASH',
        reportedBy: 'KTV. Lê Thị Hà',
        notes: 'Tạm ứng tự túc nhập viện khoa Nội.',
      },
    ],
    timeline: [
      { timestamp: '2026-08-06T14:30:00Z', type: 'SYSTEM', description: 'Tạo hồ sơ bệnh án nội trú khoa Nội & Phân giường NOI-BED-07.', user: 'Hệ thống' },
      { timestamp: '2026-08-06T15:00:00Z', type: 'PAYMENT', description: 'Thu tạm ứng nhập viện tự túc +2,000,000 ₫.', amount: 2000000, user: 'KTV. Lê Thị Hà' },
    ],
    projectedDischargeCost: 6500000,
    aiInsights: {
      denialRiskPercent: 0,
    },
  },
];

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

export default function HospitalBillingPage() {
  const [activeTab, setActiveTab] = useState<'inpatient' | 'stats'>('inpatient');
  const [selected, setSelected] = useState<string | null>(null);
  const [bills, setBills] = useState<InpatientBill[]>(INITIAL_BILLS);
  
  // Right Workspace active sub-tab
  const [workspaceTab, setWorkspaceTab] = useState<'breakdown' | 'insurance' | 'payments' | 'timeline' | 'ai'>('breakdown');
  
  // Payment Form States
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payType, setPayType] = useState<'DEPOSIT' | 'PAYMENT' | 'REFUND' | 'WRITE_OFF'>('DEPOSIT');
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [payNotes, setPayNotes] = useState<string>('');

  const [searchTerm, setSearchTerm] = useState('');

  // Selected patient bill object
  const selectedBill = useMemo(() => bills.find((b) => b.id === selected), [bills, selected]);

  // Calculations for KPI numbers (hospital-wide)
  const totalRevenue = useMemo(() => bills.reduce((s, b) => s + b.totalAmount, 0), [bills]);
  const bhytTotal = useMemo(() => bills.reduce((s, b) => s + b.bhytApproved, 0), [bills]);
  const activeAdmissions = useMemo(() => bills.filter((b) => b.status === 'ACTIVE').length, [bills]);
  const totalOutstanding = useMemo(() => {
    return bills.reduce((s, b) => {
      const patientResponsibility = b.patientCopay + b.outOfPocketExclusions;
      const unpaid = patientResponsibility - b.depositPaid;
      return unpaid > 0 ? s + unpaid : s;
    }, 0);
  }, [bills]);

  // Filter bills list
  const filteredBills = useMemo(() => {
    return bills.filter((b) =>
      b.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.admissionNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.patientMRN.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [bills, searchTerm]);

  // Handle billing state transition
  const handleTransitionState = (billId: string, nextState: InpatientBillingState) => {
    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== billId) return b;
        
        const event: FinancialEvent = {
          timestamp: new Date().toISOString(),
          type: 'SYSTEM',
          description: `Chuyển trạng thái hồ sơ từ [${STATE_CONFIG[b.status].label}] sang [${STATE_CONFIG[nextState].label}].`,
          user: 'KTV. Lê Thị Hà',
        };

        return {
          ...b,
          status: nextState,
          timeline: [...b.timeline, event],
        };
      })
    );
  };

  // Handle adding payment ledger entry
  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBill || payAmount <= 0) return;

    const newRecord: DepositRecord = {
      id: `led-${Date.now()}`,
      timestamp: new Date().toISOString(),
      amount: payAmount,
      type: payType,
      method: payMethod,
      reportedBy: 'KTV. Lê Thị Hà',
      notes: payNotes,
    };

    setBills((prev) =>
      prev.map((b) => {
        if (b.id !== selectedBill.id) return b;

        const newLedger = [...b.ledger, newRecord];
        const newDeposits = newLedger
          .filter((l) => l.type === 'DEPOSIT' || l.type === 'PAYMENT')
          .reduce((acc, curr) => acc + curr.amount, 0);

        const event: FinancialEvent = {
          timestamp: new Date().toISOString(),
          type: 'PAYMENT',
          description: `Đăng ký giao dịch [${payType}] bằng [${payMethod}] số tiền ${fmt(payAmount)}.${payNotes ? ` Ghi chú: ${payNotes}` : ''}`,
          amount: payAmount,
          user: 'KTV. Lê Thị Hà',
        };

        return {
          ...b,
          ledger: newLedger,
          depositPaid: newDeposits,
          timeline: [...b.timeline, event],
        };
      })
    );

    // Reset Form
    setPayAmount(0);
    setPayNotes('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-950 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden border border-indigo-500/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-indigo-400 mb-1">
              <CircleDollarSign className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Bella Hospital • Inpatient Revenue & Insurance Management
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white !text-white">
              Viện Phí Nội Trú & Thanh Toán
            </h1>
            <p className="text-indigo-200/80 text-sm mt-1 max-w-xl leading-relaxed">
              Hệ thống kiểm duyệt viện phí, tự động ghi nhận dịch vụ từ luồng lâm sàng, quản lý hồ sơ giám định BHYT và đối soát số dư tiền tạm ứng.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 shrink-0 w-full md:w-auto">
            <div className="text-center bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 hover:border-indigo-500/30 transition-all duration-300">
              <div className="text-2xl font-black text-indigo-300">{fmt(totalRevenue)}</div>
              <div className="text-[10px] text-indigo-200/70 font-bold uppercase tracking-wider mt-1">Tổng viện phí</div>
            </div>
            <div className="text-center bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 hover:border-emerald-500/30 transition-all duration-300">
              <div className="text-2xl font-black text-emerald-400">{fmt(bhytTotal)}</div>
              <div className="text-[10px] text-emerald-200/70 font-bold uppercase tracking-wider mt-1">BHYT Được Duyệt</div>
            </div>
            <div className="text-center bg-white/5 backdrop-blur-md rounded-xl p-3 border border-white/10 hover:border-amber-500/30 transition-all duration-300">
              <div className="text-2xl font-black text-amber-400">{fmt(totalOutstanding)}</div>
              <div className="text-[10px] text-amber-200/70 font-bold uppercase tracking-wider mt-1">Còn Phải Thu</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {[
          { key: 'inpatient', label: 'Hồ Sơ Viện Phí Nội Trú', icon: FileText },
          { key: 'stats', label: 'Doanh Thu & Analytics BHYT', icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`py-3 px-5 text-sm font-bold flex items-center space-x-2 border-b-2 transition-all duration-200 ${
              activeTab === key
                ? 'border-indigo-600 text-indigo-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'inpatient' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* CỘT 1: DANH SÁCH BỆNH NHÂN NỘI TRÚ (Left Panel) */}
          <div className="lg:col-span-1 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo Tên, MRN, Số Admission..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 w-full border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600 bg-white"
              />
            </div>

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {filteredBills.map((bill) => {
                const cfg = STATE_CONFIG[bill.status];
                const patientResponsibility = bill.patientCopay + bill.outOfPocketExclusions;
                const unpaid = patientResponsibility - bill.depositPaid;
                const isDischarged = bill.dischargedAt !== null;

                return (
                  <button
                    key={bill.id}
                    onClick={() => {
                      setSelected(bill.id === selected ? null : bill.id);
                      setWorkspaceTab('breakdown');
                    }}
                    className={`w-full text-left bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-2 ${
                      selected === bill.id ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-extrabold text-slate-900 text-sm block">{bill.patientName}</span>
                        <span className="text-[10px] text-slate-400 font-bold tracking-tight">
                          {bill.admissionNo} · Bed: {bill.wardBed}
                        </span>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-0.5 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                      <div>MRN: <strong className="text-slate-700">{bill.patientMRN}</strong></div>
                      <div>Ngày ở: <strong className="text-slate-700">{bill.daysStayed} ngày</strong> {isDischarged && `(Đã xuất viện)`}</div>
                      <div>Bảo hiểm: <strong className="text-slate-700">{bill.insuranceCode ? `BHYT (${bill.insuranceCode})` : 'Tự túc'}</strong></div>
                    </div>

                    <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-2">
                      <span className="text-slate-400 font-medium">Tổng viện phí:</span>
                      <span className="font-black text-indigo-700">{fmt(bill.totalAmount)}</span>
                    </div>

                    {unpaid > 0 ? (
                      <div className="text-[10px] bg-amber-50 text-amber-700 font-bold px-2 py-1 rounded border border-amber-100 flex justify-between">
                        <span>Còn phải thu:</span>
                        <span>{fmt(unpaid)}</span>
                      </div>
                    ) : unpaid < 0 ? (
                      <div className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-1 rounded border border-emerald-100 flex justify-between">
                        <span>Hoàn tiền dư:</span>
                        <span>{fmt(Math.abs(unpaid))}</span>
                      </div>
                    ) : (
                      <div className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-1 rounded text-center">
                        ✓ Đã thanh toán đầy đủ
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CỘT 2 & 3: FINANCIAL CLINICAL WORKSPACE (Right Panel) */}
          <div className="lg:col-span-2">
            {selectedBill ? (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[550px]">
                
                {/* Workspace Header */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-950 px-5 py-4 border-b border-slate-800 flex justify-between items-center text-white">
                  <div>
                    <h3 className="font-extrabold text-slate-100 text-md">{selectedBill.patientName}</h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      MRN: {selectedBill.patientMRN} · Admission: {selectedBill.admissionNo} · Bed: {selectedBill.wardBed}
                    </p>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-1 rounded border ${STATE_CONFIG[selectedBill.status].bg} ${STATE_CONFIG[selectedBill.status].text} ${STATE_CONFIG[selectedBill.status].border}`}>
                    {STATE_CONFIG[selectedBill.status].label}
                  </span>
                </div>

                {/* Financial Summary Strip */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-4 bg-slate-50 border-b border-slate-200 text-center text-xs font-bold">
                  <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
                    <div className="text-slate-400 text-[10px] mb-0.5">Tổng chi phí</div>
                    <div className="text-slate-900 font-black">{fmt(selectedBill.totalAmount)}</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
                    <div className="text-emerald-600 text-[10px] mb-0.5">BHYT Được Duyệt</div>
                    <div className="text-emerald-700 font-black">{fmt(selectedBill.bhytApproved)}</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
                    <div className="text-indigo-600 text-[10px] mb-0.5">BN cùng chi trả</div>
                    <div className="text-indigo-800 font-black">
                      {fmt(selectedBill.patientCopay + selectedBill.outOfPocketExclusions)}
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm">
                    <div className="text-slate-400 text-[10px] mb-0.5">Đã tạm ứng</div>
                    <div className="text-slate-800 font-black">{fmt(selectedBill.depositPaid)}</div>
                  </div>
                  <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-sm col-span-2 md:col-span-1">
                    {selectedBill.patientCopay + selectedBill.outOfPocketExclusions - selectedBill.depositPaid >= 0 ? (
                      <>
                        <div className="text-rose-600 text-[10px] mb-0.5">Còn phải thu</div>
                        <div className="text-rose-700 font-black">
                          {fmt(selectedBill.patientCopay + selectedBill.outOfPocketExclusions - selectedBill.depositPaid)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-emerald-600 text-[10px] mb-0.5">Cần hoàn trả</div>
                        <div className="text-emerald-700 font-black">
                          {fmt(Math.abs(selectedBill.patientCopay + selectedBill.outOfPocketExclusions - selectedBill.depositPaid))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Workspace sub-tabs */}
                <div className="flex border-b border-slate-100 bg-white">
                  {[
                    { key: 'breakdown', label: 'Bảng Kê Chi Tiết', icon: Receipt },
                    { key: 'insurance', label: 'Giám Định BHYT', icon: ShieldAlert },
                    { key: 'payments', label: 'Tạm Ứng & Điều Chỉnh', icon: Wallet },
                    { key: 'timeline', label: 'Financial Timeline', icon: Clock },
                    { key: 'ai', label: 'Bella Financial AI', icon: Sparkles },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setWorkspaceTab(tab.key as typeof workspaceTab)}
                      className={`flex-1 py-3 px-2 text-center text-xs font-bold border-b-2 flex items-center justify-center space-x-1.5 transition-all ${
                        workspaceTab === tab.key
                          ? 'border-indigo-600 text-indigo-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden md:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>

                {/* Workspace Tab Content */}
                <div className="p-5 flex-1 overflow-y-auto max-h-[50vh]">
                  
                  {/* TAB 1: BẢNG KÊ CHI TIẾT */}
                  {workspaceTab === 'breakdown' && (
                    <div className="space-y-4">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                        <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-2">Chi tiết viện phí lâm sàng phát sinh</h4>
                        {[
                          { label: `Tiền giường bệnh (${selectedBill.daysStayed} ngày)`, amount: selectedBill.roomCharges, icon: Building2 },
                          { label: 'Thuốc & Vật tư y tế nội trú', amount: selectedBill.medicationCharges, icon: Pill },
                          { label: 'Phẫu thuật & Thủ thuật', amount: selectedBill.procedureCharges, icon: FileText },
                          { label: 'Xét nghiệm & Hình ảnh y khoa', amount: selectedBill.labImagingCharges, icon: BarChart3 },
                          { label: 'Chăm sóc & Phí điều dưỡng', amount: selectedBill.nursingCharges, icon: Wallet },
                          { label: 'Công khám & Professional Services', amount: selectedBill.professionalServiceCharges, icon: User },
                        ].map(({ label, amount, icon: Icon }) => (
                          <div key={label} className="flex justify-between items-center text-xs">
                            <div className="flex items-center space-x-2 text-slate-600">
                              <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{label}</span>
                            </div>
                            <span className="font-bold text-slate-800">{fmt(amount)}</span>
                          </div>
                        ))}
                        <div className="pt-2 border-t border-slate-200 flex justify-between font-extrabold text-slate-900 text-xs">
                          <span>TỔNG VIỆN PHÍ PHÁT SINH</span>
                          <span className="text-indigo-700">{fmt(selectedBill.totalAmount)}</span>
                        </div>
                      </div>

                      {/* Daily Cost Accruals & Forecast */}
                      <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-4 space-y-2 text-xs">
                        <h4 className="font-bold text-indigo-900 flex items-center space-x-1">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Dự phóng viện phí & Accruals</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-4 mt-2">
                          <div>
                            <span className="text-slate-500">Số ngày nằm viện:</span>
                            <span className="font-bold text-slate-800 ml-1">{selectedBill.daysStayed} ngày</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Chi phí trung bình:</span>
                            <span className="font-bold text-slate-800 ml-1">{fmt(selectedBill.totalAmount / selectedBill.daysStayed)} / ngày</span>
                          </div>
                          <div className="col-span-2 pt-1.5 border-t border-indigo-100 flex justify-between items-center">
                            <span className="text-slate-600 font-medium">Dự phòng tổng tiền xuất viện:</span>
                            <strong className="text-indigo-700 text-sm">{fmt(selectedBill.projectedDischargeCost)}</strong>
                          </div>
                        </div>
                      </div>

                      {/* State transitions actions */}
                      <div className="border-t border-slate-200 pt-4 flex flex-wrap gap-2 justify-end">
                        {selectedBill.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleTransitionState(selectedBill.id, 'DISCHARGE_PENDING')}
                            className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow"
                          >
                            Làm thủ tục xuất viện (Discharge)
                          </button>
                        )}
                        {selectedBill.status === 'DISCHARGE_PENDING' && (
                          <button
                            onClick={() => handleTransitionState(selectedBill.id, 'BILLING_REVIEW')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow"
                          >
                            Gửi kiểm duyệt viện phí (Billing Review)
                          </button>
                        )}
                        {selectedBill.status === 'BILLING_REVIEW' && (
                          <button
                            onClick={() => handleTransitionState(selectedBill.id, 'INSURANCE_REVIEW')}
                            className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow"
                          >
                            Chuyển cổng giám định BHYT (Insurance Review)
                          </button>
                        )}
                        {selectedBill.status === 'INSURANCE_REVIEW' && (
                          <button
                            onClick={() => handleTransitionState(selectedBill.id, 'FINALIZED')}
                            className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow"
                          >
                            Chốt bảng kê tài chính (Finalize)
                          </button>
                        )}
                        {selectedBill.status === 'FINALIZED' && (
                          <button
                            onClick={() => handleTransitionState(selectedBill.id, 'PAID')}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow"
                          >
                            Thanh toán & Quyết toán (Paid)
                          </button>
                        )}
                        {selectedBill.status === 'PAID' && (
                          <button
                            onClick={() => handleTransitionState(selectedBill.id, 'RECONCILED')}
                            className="bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow"
                          >
                            Đối soát BHYT hoàn tất (Reconciled)
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 2: CỔNG GIÁM ĐỊNH BHYT */}
                  {workspaceTab === 'insurance' && (
                    <div className="space-y-4">
                      {selectedBill.insuranceClaim ? (
                        <div className="space-y-4 text-xs">
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between items-center font-mono">
                              <strong>Mã hồ sơ giám định:</strong>
                              <span className="bg-slate-200 text-slate-800 font-bold px-2 py-0.5 rounded">
                                {selectedBill.insuranceClaim.claimId}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span>Trạng thái cổng BHYT:</span>
                              <span className="font-bold text-slate-700">
                                {selectedBill.insuranceClaim.status}
                              </span>
                            </div>
                            <div className="pt-2 border-t border-slate-200 space-y-1.5">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500">Chi phí đề nghị BHYT:</span>
                                <span className="font-bold">{fmt(selectedBill.insuranceClaim.eligibleAmount)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-emerald-600">BHYT phê duyệt:</span>
                                <strong className="text-emerald-700">{fmt(selectedBill.insuranceClaim.approvedAmount)}</strong>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-rose-600">BHYT từ chối (Denial):</span>
                                <strong className="text-rose-700">{fmt(selectedBill.insuranceClaim.deniedAmount)}</strong>
                              </div>
                            </div>
                          </div>

                          {selectedBill.insuranceClaim.status === 'SUBMITTED' && (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  const reason = prompt('Nhập lý do từ chối:');
                                  if (reason) {
                                    setBills((prev) =>
                                      prev.map((b) => {
                                        if (b.id !== selectedBill.id || !b.insuranceClaim) return b;
                                        return {
                                          ...b,
                                          insuranceClaim: {
                                            ...b.insuranceClaim,
                                            status: 'DENIED',
                                            deniedAmount: b.insuranceClaim.eligibleAmount,
                                            denialReasonText: reason,
                                            reviewerName: 'Giám định viên BHYT',
                                            reviewedAt: new Date().toISOString(),
                                          },
                                          timeline: [
                                            ...b.timeline,
                                            {
                                              timestamp: new Date().toISOString(),
                                              type: 'INSURANCE',
                                              description: `Hồ sơ BHYT bị từ chối phê duyệt. Lý do: ${reason}`,
                                              amount: b.insuranceClaim.eligibleAmount,
                                              user: 'BHYT Portal',
                                            },
                                          ],
                                        };
                                      })
                                    );
                                  }
                                }}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all"
                              >
                                Từ chối claim (Deny)
                              </button>
                              <button
                                onClick={() => {
                                  setBills((prev) =>
                                    prev.map((b) => {
                                      if (b.id !== selectedBill.id || !b.insuranceClaim) return b;
                                      const approved = b.insuranceClaim.eligibleAmount;
                                      return {
                                        ...b,
                                        bhytApproved: approved,
                                        patientCopay: (b.totalAmount - approved) * 0.8, // recalculate
                                        insuranceClaim: {
                                          ...b.insuranceClaim,
                                          status: 'APPROVED',
                                          approvedAmount: approved,
                                          reviewerName: 'Giám định viên BHYT',
                                          reviewedAt: new Date().toISOString(),
                                        },
                                        timeline: [
                                          ...b.timeline,
                                          {
                                            timestamp: new Date().toISOString(),
                                            type: 'INSURANCE',
                                            description: `Phê duyệt BHYT thành công số tiền ${fmt(approved)} ₫.`,
                                            amount: approved,
                                            user: 'BHYT Portal',
                                          },
                                        ],
                                      };
                                    })
                                  );
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all"
                              >
                                Duyệt y lệnh BHYT (Approve)
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-400 text-xs">
                          Bệnh nhân này tự chi trả toàn bộ viện phí (Tự túc). Không có hồ sơ bảo hiểm y tế.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: TẠM ỨNG & ĐIỀU CHỈNH LEDGER */}
                  {workspaceTab === 'payments' && (
                    <div className="space-y-4">
                      {/* Form nộp tiền */}
                      <form onSubmit={handleAddPayment} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                        <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-1">
                          <PlusCircle className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Đăng ký giao dịch tài chính</span>
                        </h4>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Số tiền:</label>
                            <input
                              type="number"
                              value={payAmount}
                              onChange={(e) => setPayAmount(parseInt(e.target.value) || 0)}
                              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-center focus:ring-2 focus:ring-indigo-600"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Loại giao dịch:</label>
                            <select
                              value={payType}
                              onChange={(e) => setPayType(e.target.value as typeof payType)}
                              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-600"
                            >
                              <option value="DEPOSIT">Tạm ứng (Deposit)</option>
                              <option value="PAYMENT">Thanh toán (Payment)</option>
                              <option value="REFUND">Hoàn tiền (Refund)</option>
                              <option value="WRITE_OFF">Xóa nợ (Write-off)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Phương thức:</label>
                            <select
                              value={payMethod}
                              onChange={(e) => setPayMethod(e.target.value as typeof payMethod)}
                              className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-indigo-600"
                            >
                              <option value="CASH">Tiền mặt (Cash)</option>
                              <option value="CARD">Quẹt thẻ (Card)</option>
                              <option value="TRANSFER">Chuyển khoản (Transfer)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Ghi chú:</label>
                            <input
                              type="text"
                              value={payNotes}
                              onChange={(e) => setPayNotes(e.target.value)}
                              placeholder="Nhập ghi chú nộp..."
                              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs focus:ring-2 focus:ring-indigo-600"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={payAmount <= 0}
                          className={`w-full py-2 rounded-xl text-xs font-bold shadow-md transition-all ${
                            payAmount > 0
                              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          Xác nhận đăng ký giao dịch
                        </button>
                      </form>

                      {/* Ledger History List */}
                      <div className="space-y-2">
                        <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider">
                          Sổ phụ giao dịch (Payment Ledger Logs)
                        </h4>
                        <div className="border border-slate-100 rounded-lg overflow-hidden">
                          <table className="w-full text-left text-[11px] font-mono">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-1.5 text-slate-600">Loại</th>
                                <th className="px-3 py-1.5 text-slate-600">Số tiền</th>
                                <th className="px-3 py-1.5 text-slate-600">Hình thức</th>
                                <th className="px-3 py-1.5 text-slate-600">Giao dịch viên</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {selectedBill.ledger.map((r) => (
                                <tr key={r.id}>
                                  <td className="px-3 py-1.5 font-bold text-slate-700">{r.type}</td>
                                  <td className="px-3 py-1.5 font-extrabold text-indigo-700">{fmt(r.amount)}</td>
                                  <td className="px-3 py-1.5">{r.method}</td>
                                  <td className="px-3 py-1.5 text-slate-500">{r.reportedBy}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 4: FINANCIAL CLINICAL TIMELINE */}
                  {workspaceTab === 'timeline' && (
                    <div className="space-y-4">
                      <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center space-x-1">
                        <History className="w-3.5 h-3.5 text-slate-600" />
                        <span>Nhật ký tài chính chi tiết (Clinical-to-Financial Events)</span>
                      </h4>

                      <div className="relative border-l border-slate-200 pl-4 space-y-4 font-mono text-[11px]">
                        {selectedBill.timeline.map((evt, idx) => (
                          <div key={idx} className="relative">
                            <div className="absolute -left-[21px] mt-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white" />
                            <div className="flex justify-between font-bold text-slate-800">
                              <span>[{evt.type}] {evt.description}</span>
                              <span className="text-slate-400">{new Date(evt.timestamp).toLocaleTimeString('vi-VN')}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Hành động bởi: {evt.user} {evt.amount && `· Biến động: +${fmt(evt.amount)}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: BELLA FINANCIAL AI INSIGHTS */}
                  {workspaceTab === 'ai' && (
                    <div className="space-y-4">
                      <div className="bg-purple-950/10 border border-purple-500/20 rounded-xl p-4 space-y-3">
                        <div className="flex items-center space-x-2 text-purple-900 text-xs font-black">
                          <Sparkles className="w-4 h-4 text-purple-700 animate-pulse" />
                          <span>Bella Financial AI Copilot</span>
                        </div>
                        
                        {selectedBill.aiInsights.denialRiskPercent > 0 ? (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-slate-700">
                              <span>Rủi ro từ chối claim BHYT:</span>
                              <span className="text-purple-700 font-extrabold">{selectedBill.aiInsights.denialRiskPercent}%</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-purple-600 h-full rounded-full transition-all"
                                style={{ width: `${selectedBill.aiInsights.denialRiskPercent}%` }}
                              />
                            </div>
                            {selectedBill.aiInsights.denialRiskReason && (
                              <p className="text-[10.5px] text-purple-800 bg-purple-50 border border-purple-200 p-2.5 rounded-lg leading-relaxed">
                                <strong>Khuyến nghị từ AI:</strong> {selectedBill.aiInsights.denialRiskReason}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg font-bold">
                            ✓ AI không phát hiện rủi ro thanh toán bảo hiểm nào đối với hồ sơ này.
                          </div>
                        )}

                        {selectedBill.aiInsights.anomalyAlert && (
                          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg font-bold">
                            ⚠️ <strong>Cảnh báo dị thường chi phí:</strong> {selectedBill.aiInsights.anomalyAlert}
                          </div>
                        )}
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
                      <CircleDollarSign className="w-4.5 h-4.5 text-indigo-600" />
                      <span>Tổng quan Nghiệp vụ Viện phí Hôm nay</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Chọn hồ sơ bệnh nhân ở danh sách bên trái hoặc quản lý các công việc tài chính tồn đọng dưới đây.</p>
                  </div>

                  {/* Operational stats grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
                      <div className="text-xs font-bold text-slate-400">Hồ sơ chờ chốt viện phí</div>
                      <div className="text-2xl font-black text-slate-800">3 hồ sơ</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1">
                      <div className="text-xs font-bold text-slate-400">Số dư nợ quá hạn</div>
                      <div className="text-2xl font-black text-rose-700">18,400,000 ₫</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-1 col-span-2">
                      <div className="text-xs font-bold text-slate-400">Claims BHYT nghi vấn chờ sửa đổi</div>
                      <div className="text-2xl font-black text-amber-600">2 claims</div>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                    <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Checklist Vận hành Viện phí</h4>
                    <div className="space-y-2.5 text-xs text-slate-600 font-bold">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="line-through text-slate-400">Chạy đối soát tự động BHYT cổng 1A</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-slate-300 shrink-0" />
                        <span>Xử lý 2 hồ sơ đề nghị xuất viện chưa duyệt chi phí</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-slate-300 shrink-0" />
                        <span>Ký duyệt biên bản hội chẩn thuốc ICU</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center text-slate-400 text-xs py-4 border-t border-slate-200">
                  <User className="w-8 h-8 mx-auto mb-1 opacity-30 text-indigo-500" />
                  <span>Hãy chọn một hồ sơ để tiến hành quyết toán hoặc nộp tiền.</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: TOTAL REVENUE & INSURANCE ANALYTICS (Hospital-wide Dashboard) */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Doanh số viện phí phát sinh', value: fmt(totalRevenue), icon: CircleDollarSign, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
              { label: 'BHYT được chấp nhận chi trả', value: fmt(bhytTotal), icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
              { label: 'Doanh thu thu tiền mặt từ BN', value: fmt(totalRevenue - bhytTotal), icon: Wallet, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
              { label: 'Hồ sơ đang điều trị', value: `${activeAdmissions} bệnh nhân`, icon: Clock, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={`rounded-xl border p-5 shadow-sm transition-all hover:shadow-md ${bg}`}>
                <Icon className={`w-6 h-6 mb-2 ${color} shrink-0`} />
                <div className={`text-xl font-black ${color}`}>{value}</div>
                <div className="text-xs text-slate-600 mt-1">{label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Contribution by Department */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 lg:col-span-2">
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center space-x-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <span>Doanh thu viện phí theo Khoa phòng</span>
              </h3>
              
              <div className="space-y-3.5 text-xs text-slate-600 font-bold">
                {[
                  { name: 'Khoa Ngoại chấn thương (Surgery)', value: 12000000, max: 20000000, percent: 60 },
                  { name: 'Khoa Hồi sức tích cực (ICU)', value: 9800000, max: 20000000, percent: 49 },
                  { name: 'Trung tâm chẩn đoán hình ảnh (Imaging)', value: 4400000, max: 20000000, percent: 22 },
                  { name: 'Khoa Nội tổng hợp (Medicine)', value: 3100000, max: 20000000, percent: 15 },
                  { name: 'Khoa Xét nghiệm (Laboratory)', value: 2100000, max: 20000000, percent: 10 },
                ].map((dept) => (
                  <div key={dept.name} className="space-y-1">
                    <div className="flex justify-between">
                      <span>{dept.name}</span>
                      <span className="text-slate-800 font-black">{fmt(dept.value)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full"
                        style={{ width: `${dept.percent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payer Breakdown & Claim Denials */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider flex items-center space-x-1.5">
                <Percent className="w-4 h-4 text-emerald-600" />
                <span>Cơ cấu nguồn thu chi trả (Payer Breakdown)</span>
              </h3>

              <div className="space-y-4 text-xs font-bold text-slate-600">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>BHYT thanh toán (68%)</span>
                    <span>{fmt(bhytTotal)}</span>
                  </div>
                  <div className="flex justify-between text-indigo-700">
                    <span>Bệnh nhân chi trả (32%)</span>
                    <span>{fmt(totalRevenue - bhytTotal)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <h4 className="font-extrabold text-slate-800 text-[11px] uppercase tracking-wider flex items-center space-x-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>Rủi ro từ chối claim BHYT</span>
                  </h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span>Claim BHYT bị từ chối:</span>
                      <strong className="text-rose-700">0 ₫</strong>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span>Tỷ lệ từ chối bình quân:</span>
                      <strong className="text-slate-700">1.8%</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
