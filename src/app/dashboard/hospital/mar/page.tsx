'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { MARItemSummary } from '@/platform/healthcare/engines/nursing-engine/contracts/mar-reader.interface';
import type { InpatientAdmission, Bed, Ward } from '@/types/healthcare';
import { useNursingEngine } from '@/products/bella-hospital/hooks/use-nursing-engine';
import { InpatientAdmissionService, BedEngineService, MARService } from '@/services/healthcare-hospital-services';
import type { CreateMARInput } from '@/services/healthcare-hospital-services';

import { PatientContextBar, BELLA_DEMO_PATIENT } from '@/components/hospital/PatientContextBar';
import {
  Pill,
  Clock,
  CheckCircle2,
  XCircle,
  PauseCircle,
  AlertCircle,
  Plus,
  User,
  Calendar,
  Syringe,
  ClipboardCheck,
  ShieldCheck,
  ShieldAlert,
  ScanLine,
  AlertTriangle,
  ChevronRight,
  Stethoscope,
  RefreshCw,
  Timer,
  FileWarning,
  BadgeCheck,
  Activity,
  Building2,
  Bed as BedIcon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ExtendedMARStatus = MARItemSummary['status'] | 'due' | 'overdue';

// ExtendedMAR adds UI-only display fields on top of the DB-backed MARItemSummary
interface ExtendedMAR extends MARItemSummary {
  frequency?: string;
  prescriber?: string;
  start_date?: string;
  end_date?: string;
  refusal_reason?: string;
  hold_reason?: string;
  hold_until?: string;
  held_by?: string;
}

// ─── Patient Context ──────────────────────────────────────────────────────────
const PATIENT_INFO = {
  name: 'Lê Thị Hương',
  gender: 'Nữ',
  age: 62,
  mrn: 'pat-001',
  dob: '22/09/1962',
  bed: 'ICU-BED-01',
  ward: 'Hồi sức Tích cực (ICU)',
  admitDay: 5,
  diagnosis: 'Suy hô hấp cấp tiến triển — Theo dõi sau phẫu thuật',
  allergies: ['Penicillin', 'Sulfonamides'],
  weight: '58kg',
};

// ─── Mock Data (dead code — kept as reference only, not used at runtime)
// MOCK_MAR removed — H1.4: loadMAR reads from hc_medication_administration_records


const REFUSAL_REASONS = [
  'Bệnh nhân từ chối',
  'Bệnh nhân buồn nôn / nôn',
  'Bệnh nhân không nuốt được',
  'Bệnh nhân đang NPO (nhịn ăn)',
  'Bác sĩ yêu cầu giữ lại',
  'Bệnh nhân đang ngủ (không đánh thức)',
  'Khác',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getExtendedStatus(mar: ExtendedMAR): ExtendedMARStatus {
  if (mar.status !== 'scheduled') return mar.status as ExtendedMARStatus;
  const diff = Date.now() - new Date(mar.scheduledTime).getTime();
  if (diff > 30 * 60000) return 'overdue';
  if (diff > 0) return 'due';
  return 'scheduled';
}

function overdueMinutes(mar: ExtendedMAR): number {
  return Math.floor((Date.now() - new Date(mar.scheduledTime).getTime()) / 60000);
}

const STATUS_CONFIG: Record<ExtendedMARStatus, { label: string; color: string; bg: string; border: string; dot: string; icon: React.ReactNode }> = {
  scheduled:    { label: 'Đã lên lịch',     color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',    dot: 'bg-blue-500',    icon: <Clock className="w-3.5 h-3.5" /> },
  due:          { label: 'Đến giờ thực hiện', color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-300',   dot: 'bg-amber-500',   icon: <Timer className="w-3.5 h-3.5" /> },
  overdue:      { label: 'Quá hạn',          color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-300',    dot: 'bg-rose-500',    icon: <AlertCircle className="w-3.5 h-3.5" /> },
  administered: { label: 'Đã thực hiện',    color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  refused:      { label: 'Từ chối',          color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200',    dot: 'bg-rose-500',    icon: <XCircle className="w-3.5 h-3.5" /> },
  held:         { label: 'Tạm ngưng',        color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',   dot: 'bg-amber-500',   icon: <PauseCircle className="w-3.5 h-3.5" /> },
  missed:       { label: 'Bỏ lỡ liều',       color: 'text-slate-600',   bg: 'bg-slate-50',   border: 'border-slate-200',   dot: 'bg-slate-400',   icon: <FileWarning className="w-3.5 h-3.5" /> },
  cancelled:    { label: 'Đã hủy',           color: 'text-slate-500',   bg: 'bg-slate-50',   border: 'border-slate-200',   dot: 'bg-slate-300',   icon: <XCircle className="w-3.5 h-3.5" /> },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Components ───────────────────────────────────────────────────────────────
function AllergyAlert({ allergies }: { allergies: string[] }) {
  const hasAllergies = allergies.length > 0;
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
      hasAllergies ? 'bg-rose-50 border-rose-300 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
    }`}>
      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
      {hasAllergies ? (
        <span>⚠ Dị ứng: {allergies.join(', ')}</span>
      ) : (
        <span>🟢 Không có dị ứng đã biết</span>
      )}
    </div>
  );
}

function MARSummaryCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-center shadow-sm ${color}`}>
      <div className="text-2xl font-black">{count}</div>
      <div className="text-[11px] font-semibold mt-0.5 opacity-80">{label}</div>
    </div>
  );
}

// ─── Five Rights Safety Check Modal ──────────────────────────────────────────
function FiveRightsModal({
  mar, patientName, allergies, onConfirm, onCancel,
}: {
  mar: MARItemSummary; patientName: string; allergies: string[];
  onConfirm: (notes: string) => void; onCancel: () => void;
}) {
  const [checked, setChecked] = useState([false, false, false, false, false]);
  const [notes, setNotes] = useState('');
  const [scanned, setScanned] = useState(false);
  const allChecked = checked.every(Boolean);

  const drugHasAllergy = allergies.some((a) =>
    mar.drugName.toLowerCase().includes(a.toLowerCase())
  );

  const rights = [
    { label: 'Đúng người bệnh', detail: patientName },
    { label: 'Đúng thuốc', detail: mar.drugName },
    { label: 'Đúng liều', detail: mar.dosage },
    { label: 'Đúng đường dùng', detail: mar.route },
    { label: 'Đúng thời gian', detail: formatTime(mar.scheduledTime) },
  ];

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-700 to-cyan-700 px-6 py-4">
          <div className="flex items-center gap-2 text-teal-200 text-xs font-bold mb-1">
            <ShieldCheck className="w-4 h-4" />
            XÁC NHẬN THỰC HIỆN THUỐC — 5 QUYỀN AN TOÀN
          </div>
          <div className="text-white font-black text-lg">{mar.drugName}</div>
          <div className="text-teal-200 text-sm">{patientName} · {PATIENT_INFO.bed}</div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Allergy alert */}
          {drugHasAllergy && (
            <div className="flex items-center gap-2 bg-rose-100 border border-rose-400 rounded-xl p-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
              <div>
                <div className="text-xs font-black text-rose-800">🔴 ALLERGY ALERT</div>
                <div className="text-xs text-rose-700">Bệnh nhân có dị ứng với: {allergies.join(', ')}</div>
              </div>
            </div>
          )}

          {/* Barcode scan */}
          <button
            onClick={() => setScanned(true)}
            className={`w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
              scanned ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-slate-50 border-slate-300 text-slate-600 hover:border-cyan-400 hover:bg-cyan-50'
            }`}
          >
            <ScanLine className="w-4 h-4" />
            {scanned ? '✓ Đã quét mã vạch thuốc' : '📷 Quét mã vạch thuốc (tuỳ chọn)'}
          </button>

          {/* 5 Rights checklist */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Kiểm tra 5 quyền:</div>
            {rights.map((r, i) => (
              <button
                key={i}
                onClick={() => setChecked((prev) => prev.map((v, idx) => idx === i ? !v : v))}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-all ${
                  checked[i] ? 'bg-teal-50 border-teal-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  checked[i] ? 'bg-teal-500 border-teal-600' : 'border-slate-300'
                }`}>
                  {checked[i] && <BadgeCheck className="w-3 h-3 text-white" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-700">{r.label}</div>
                  <div className="text-[11px] text-slate-500">{r.detail}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Ghi chú thực hiện (tuỳ chọn):</label>
            <textarea
              rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Truyền chậm, không có phản ứng phụ..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
            />
          </div>

          {/* Practitioner */}
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <User className="w-3 h-3" /> Người thực hiện: <strong className="text-slate-700">nurse-001</strong>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onCancel}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
              Hủy
            </button>
            <button
              onClick={() => allChecked && onConfirm(notes)}
              disabled={!allChecked}
              className={`flex-1 px-4 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                allChecked
                  ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Xác Nhận Thực Hiện
            </button>
          </div>
          {!allChecked && (
            <p className="text-[11px] text-center text-slate-400">Cần xác nhận đủ 5 quyền để tiếp tục</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Refusal Modal ────────────────────────────────────────────────────────────
function RefusalModal({ mar, onConfirm, onCancel }: {
  mar: MARItemSummary;
  onConfirm: (reason: string, notes: string) => void;
  onCancel: () => void;
}) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const toggleReason = (r: string) => setSelectedReasons((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-rose-200">
        <div className="bg-gradient-to-r from-rose-700 to-rose-600 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center gap-2 text-rose-200 text-xs font-bold mb-1">
            <XCircle className="w-4 h-4" /> GHI NHẬN TỪ CHỐI THUỐC
          </div>
          <div className="text-white font-black text-lg">{mar.drugName}</div>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">Lý do từ chối:</div>
          <div className="space-y-1.5">
            {REFUSAL_REASONS.map((r) => (
              <button key={r} onClick={() => toggleReason(r)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs text-left transition-all ${
                  selectedReasons.includes(r) ? 'bg-rose-50 border-rose-300 font-semibold text-rose-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                }`}>
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${selectedReasons.includes(r) ? 'bg-rose-500 border-rose-600' : 'border-slate-300'}`}>
                  {selectedReasons.includes(r) && <span className="text-white text-[10px] font-black">✓</span>}
                </div>
                {r}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">Ghi chú thêm:</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Chi tiết bổ sung..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-rose-400 focus:outline-none" />
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">Hủy</button>
            <button
              onClick={() => selectedReasons.length > 0 && onConfirm(selectedReasons.join('; '), notes)}
              disabled={selectedReasons.length === 0}
              className={`flex-1 px-4 py-2 text-sm font-bold rounded-xl transition-all ${selectedReasons.length > 0 ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}>
              Xác nhận Từ chối
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAR Card ─────────────────────────────────────────────────────────────────
function MARCard({
  mar, onAdminister, onRefuse,
}: {
  mar: MARItemSummary;
  onAdminister: (mar: MARItemSummary) => void;
  onRefuse: (mar: MARItemSummary) => void;
}) {
  const m = mar as ExtendedMAR; // safe cast: ExtendedMAR extends MARItemSummary
  const extStatus = getExtendedStatus(m);
  const scfg = STATUS_CONFIG[extStatus];
  const overdue = extStatus === 'overdue' ? overdueMinutes(m) : 0;
  const isActionable = extStatus === 'scheduled' || extStatus === 'due' || extStatus === 'overdue';

  return (
    <div className={`bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-all ${
      extStatus === 'overdue' ? 'border-rose-300 bg-rose-50/30' :
      extStatus === 'due' ? 'border-amber-300 bg-amber-50/20' :
      extStatus === 'administered' ? 'border-emerald-200' :
      'border-slate-200'
    }`}>
      {/* Row 1: Drug name + Status badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Pill className={`w-4 h-4 shrink-0 ${
            extStatus === 'administered' ? 'text-emerald-500' :
            extStatus === 'refused' ? 'text-rose-500' :
            extStatus === 'held' ? 'text-amber-500' :
            extStatus === 'overdue' ? 'text-rose-500' :
            'text-slate-500'
          }`} />
          <span className="font-bold text-slate-900 text-sm">{m.drugName}</span>
          {overdue > 0 && (
            <span className="text-[10px] font-black text-white bg-rose-500 px-2 py-0.5 rounded-full">
              ⏰ Quá hạn {overdue}ph
            </span>
          )}
        </div>
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${scfg.bg} ${scfg.color} ${scfg.border}`}>
          {scfg.icon}
          {scfg.label}
        </div>
      </div>

      {/* Row 2: Compact clinical details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Syringe className="w-3 h-3 text-slate-400 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-400 font-medium">Liều</div>
            <div className="font-bold">{m.dosage}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Activity className="w-3 h-3 text-slate-400 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-400 font-medium">Đường dùng</div>
            <div className="font-bold">{m.route}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <RefreshCw className="w-3 h-3 text-slate-400 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-400 font-medium">Tần suất</div>
            <div className="font-bold">{m.frequency ?? '—'}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Stethoscope className="w-3 h-3 text-slate-400 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-400 font-medium">Bác sĩ chỉ định</div>
            <div className="font-bold truncate max-w-[120px]" title={m.prescriber}>{m.prescriber ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* Row 3: Schedule + date range */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 mb-3 pb-3 border-b border-slate-100">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Lên lịch: <strong className="text-slate-700">{formatTime(m.scheduledTime)}</strong></span>
        {m.start_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {m.start_date}{m.end_date ? ` → ${m.end_date}` : ''}</span>}
        {m.administeredTime && (
          <span className="flex items-center gap-1 text-emerald-600 font-semibold">
            <CheckCircle2 className="w-3 h-3" /> Thực hiện: {formatTime(m.administeredTime)} bởi {m.administeredByNurseId}
          </span>
        )}
      </div>

      {/* Exception detail */}
      {m.status === 'refused' && m.refusal_reason && (
        <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs">
          <div className="font-bold text-rose-700 mb-1 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Lý do từ chối:</div>
          <div className="text-rose-600">{m.refusal_reason}</div>
          {m.notes && <div className="text-slate-500 mt-1 italic">{m.notes}</div>}
        </div>
      )}

      {m.status === 'held' && (
        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs">
          <div className="font-bold text-amber-700 mb-1 flex items-center gap-1"><PauseCircle className="w-3.5 h-3.5" /> Lý do tạm ngưng:</div>
          <div className="text-amber-700">{m.hold_reason}</div>
          {m.hold_until && <div className="text-slate-500 mt-1">Giữ đến: <strong>{m.hold_until}</strong> · Theo y lệnh: <strong>{m.held_by}</strong></div>}
        </div>
      )}

      {m.status === 'missed' && m.notes && (
        <div className="mb-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <div className="font-bold text-slate-600 mb-1 flex items-center gap-1"><FileWarning className="w-3.5 h-3.5" /> Ghi chú:</div>
          <div className="text-slate-500 italic">{m.notes}</div>
        </div>
      )}

      {m.notes && m.status === 'administered' && (
        <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700 italic">
          💬 {m.notes}
        </div>
      )}

      {/* Action buttons */}
      {isActionable && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onAdminister(mar)}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Xác nhận thực hiện
          </button>
          <button
            onClick={() => onAdminister(mar)}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-cyan-50 text-slate-600 hover:text-cyan-700 border hover:border-cyan-300 text-xs font-semibold px-3 py-2 rounded-lg transition-all"
          >
            <ScanLine className="w-3.5 h-3.5" />
            Scan
          </button>
          <button
            onClick={() => onRefuse(mar)}
            className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 border border-rose-200 hover:border-rose-300 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-rose-50 transition-all"
          >
            <XCircle className="w-3.5 h-3.5" />
            Từ chối
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function MARPage() {
  const { getMARByAdmission, recordAdministration } = useNursingEngine();

  const [admissions, setAdmissions] = useState<InpatientAdmission[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string>('');
  const [marRecords, setMarRecords] = useState<MARItemSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [fiveRightsMAR, setFiveRightsMAR] = useState<MARItemSummary | null>(null);
  const [refusalMAR, setRefusalMAR] = useState<MARItemSummary | null>(null);

  // Add order modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState('Uống sau ăn');
  const [frequency, setFrequency] = useState('q8h');
  const [prescriber, setPrescriber] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const [admData, bedsData, wardsData] = await Promise.all([
        InpatientAdmissionService.getInpatientAdmissions('bella_healthcare'),
        BedEngineService.getHospitalBeds('bella_healthcare'),
        BedEngineService.getHospitalWards('bella_healthcare'),
      ]);
      const active = admData.filter((a) => a.status === 'admitted');
      setAdmissions(active); setBeds(bedsData); setWards(wardsData);
      if (active.length > 0) setSelectedAdmissionId(active[0].id);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (selectedAdmissionId) loadMAR(selectedAdmissionId); }, [selectedAdmissionId]);

  async function loadMAR(id: string) {
    try {
      const result = await getMARByAdmission('c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d', id);
      if (result.success && result.data) {
        setMarRecords(result.data);
      } else {
        // Surface DB error — no MOCK_MAR fallback
        console.error('[H1.4 MAR] getMARByAdmission failed:', result.error?.message);
        setMarRecords([]);
      }
    } catch (err) {
      console.error('[H1.4 MAR] loadMAR error:', err instanceof Error ? err.message : err);
      setMarRecords([]);
    }
  }

  const handleAdministerConfirm = async (notes: string) => {
    if (!fiveRightsMAR) return;
    const admission = admissions.find((a) => a.id === selectedAdmissionId);
    if (!admission) return;

    try {
      const result = await recordAdministration({
        tenantId: 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d',
        admissionId: admission.id,
        encounterId: fiveRightsMAR.encounterId || admission.encounter_id || '',
        patientId: fiveRightsMAR.prescriptionItemId || admission.patient_id || '',
        prescriptionItemId: fiveRightsMAR.prescriptionItemId,
        drugName: fiveRightsMAR.drugName,
        dosage: fiveRightsMAR.dosage,
        route: fiveRightsMAR.route,
        scheduledTime: fiveRightsMAR.scheduledTime,
        administeredBy: 'a0000000-0000-0000-0000-000000000001',
        notes: notes || undefined,
      });
      if (result.success) {
        // Reload from DB — not optimistic patch
        await loadMAR(selectedAdmissionId);
      } else {
        console.error('[H1.4 MAR] recordAdministration failed:', result.error?.message);
        alert(`Lỗi ghi thực hiện thuốc: ${result.error?.message || 'Lỗi không xác định'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      console.error('[H1.4 MAR] handleAdministerConfirm error:', msg);
      alert(`Lỗi ghi thực hiện thuốc: ${msg}`);
    }
    setFiveRightsMAR(null);
  };

  const handleRefusalConfirm = (reason: string, notes: string) => {
    if (!refusalMAR) return;
    // Refusal: update local state (no 'refused' DB status path in H1.4 scope)
    setMarRecords((prev) => prev.map((m) =>
      m.id === refusalMAR.id
        ? { ...m, status: 'refused' as MARItemSummary['status'], notes: `${reason}${notes ? ' | ' + notes : ''}` }
        : m
    ));
    setRefusalMAR(null);
  };

  // H1.7: routes through MARService.createMAR() — canonical service path
  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmissionId) return;
    const admission = admissions.find((a) => a.id === selectedAdmissionId);
    if (!admission) return;

    const scheduledISO = scheduledDate && scheduledTime
      ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString()
      : new Date().toISOString();

    try {
      const input: CreateMARInput = {
        tenantId: 'bella_healthcare', // H1-wide placeholder — replace when auth integration complete
        inpatientAdmissionId: admission.id,
        prescriptionItemId: crypto.randomUUID(), // no FK — free UUID until prescription engine integrated
        drugName,
        dosage,
        route,
        scheduledTime: scheduledISO,
      };
      await MARService.createMAR(input);
      await loadMAR(selectedAdmissionId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      console.error('[H1.4 MAR] handleAddOrder error:', msg);
      alert(`Lỗi thêm y lệnh: ${msg}`);
    }

    setShowAddModal(false);
    setDrugName(''); setDosage(''); setRoute('Uống sau ăn'); setFrequency('q8h'); setPrescriber(''); setScheduledDate(''); setScheduledTime('');
  };


  // Computed stats
  const stats = useMemo(() => {
    const ext = marRecords.map((m) => ({ ...m, _es: getExtendedStatus(m as ExtendedMAR) }));
    return {
      scheduled: ext.filter((m) => m._es === 'scheduled' || m._es === 'due').length,
      due: ext.filter((m) => m._es === 'due').length,
      administered: ext.filter((m) => m._es === 'administered').length,
      refused: ext.filter((m) => m._es === 'refused').length,
      held: ext.filter((m) => m._es === 'held').length,
      overdue: ext.filter((m) => m._es === 'overdue').length,
      missed: ext.filter((m) => m._es === 'missed').length,
    };
  }, [marRecords]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups = new Map<string, MARItemSummary[]>();
    const sorted = [...marRecords].sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime());
    for (const m of sorted) {
      const d = formatDate(m.scheduledTime);
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(m);
    }
    return groups;
  }, [marRecords]);

  const selectedAdmission = admissions.find((a) => a.id === selectedAdmissionId);
  const selectedBed = selectedAdmission ? beds.find((b) => b.id === selectedAdmission.bed_id) : null;
  const selectedWard = selectedAdmission ? wards.find((w) => w.id === selectedAdmission.ward_id) : null;

  const patientContextData = useMemo(() => {
    if (!selectedAdmission) return BELLA_DEMO_PATIENT;
    return {
      name: selectedAdmission.patient_id === 'pat-001' || selectedAdmission.patient_id === 'pat-mock-001' ? 'Lê Thị Hương' : selectedAdmission.patient_id,
      gender: 'Nữ' as const,
      age: 62,
      mrn: selectedAdmission.patient_id,
      bedCode: selectedBed?.bed_code ?? 'Chưa xếp giường',
      wardName: selectedWard?.name ?? 'Chưa xếp khoa',
      admitDay: 5,
      allergies: ['Penicillin', 'Sulfonamides'],
      weight: '58kg',
      diagnosis: 'Suy hô hấp cấp tiến triển — Theo dõi sau phẫu thuật',
    };
  }, [selectedAdmission, selectedBed, selectedWard]);

  return (
    <div className="p-5 max-w-[1440px] mx-auto space-y-5">

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-violet-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 mb-1">
            <ClipboardCheck className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#ffffff' }}>
              Bella Hospital Nursing • MAR Management System
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#ffffff' }}>Phiếu Thực Hiện Y Lệnh Thuốc (MAR)</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Medication Administration Record · 5 Rights Safety Check · Audit Trail · Quản lý ngoại lệ
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddModal(true)} disabled={!selectedAdmissionId}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all">
            <Plus className="w-4 h-4" /> Thêm Y Lệnh
          </button>
        </div>
      </div>

      {/* ── TẦNG 1: PATIENT CONTEXT ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-md">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
          {/* Patient selector */}
          <div className="lg:w-72 shrink-0">
            <label className="text-xs font-bold text-slate-600 mb-1.5 block">Chọn bệnh nhân nội trú:</label>
            <select value={selectedAdmissionId} onChange={(e) => setSelectedAdmissionId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {admissions.length === 0 ? (
                <option value="">Không có bệnh nhân</option>
              ) : admissions.map((adm) => {
                const b = beds.find((x) => x.id === adm.bed_id);
                const w = wards.find((x) => x.id === adm.ward_id);
                return <option key={adm.id} value={adm.id}>{b?.bed_code} – {w?.name} – {adm.patient_id}</option>;
              })}
            </select>
          </div>

          {/* Patient info via unified PatientContextBar */}
          <div className="flex-1">
            <PatientContextBar patient={patientContextData} workspace="MAR · Phiếu Thực Hiện Y Lệnh Thuốc" />
          </div>
        </div>
      </div>

      {/* ── TẦNG 2: SUMMARY CARDS ──────────────────────────────────── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <MARSummaryCard label="Đã lên lịch" count={stats.scheduled} color="bg-blue-50 border border-blue-200 text-blue-800" />
        <MARSummaryCard label="Đã thực hiện" count={stats.administered} color="bg-emerald-50 border border-emerald-200 text-emerald-800" />
        <MARSummaryCard label="Từ chối" count={stats.refused} color={`${stats.refused > 0 ? 'bg-rose-50 border border-rose-300 text-rose-800' : 'bg-slate-50 border border-slate-200 text-slate-600'}`} />
        <MARSummaryCard label="Tạm ngưng" count={stats.held} color={`${stats.held > 0 ? 'bg-amber-50 border border-amber-300 text-amber-800' : 'bg-slate-50 border border-slate-200 text-slate-600'}`} />
        <MARSummaryCard label="Bỏ lỡ liều" count={stats.missed} color={`${stats.missed > 0 ? 'bg-slate-100 border border-slate-300 text-slate-700' : 'bg-slate-50 border border-slate-200 text-slate-600'}`} />
        <MARSummaryCard label="Quá hạn" count={stats.overdue} color={`${stats.overdue > 0 ? 'bg-rose-100 border-2 border-rose-400 text-rose-900' : 'bg-slate-50 border border-slate-200 text-slate-600'}`} />
      </div>

      {/* ── TẦNG 3: MAR TIMELINE ───────────────────────────────────── */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">Đang tải dữ liệu MAR...</div>
      ) : marRecords.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          Chưa có y lệnh thuốc nào. Nhấn &quot;Thêm Y Lệnh&quot; để bắt đầu.
        </div>
      ) : (
        <div className="space-y-5">
          {[...groupedByDate.entries()].map(([date, records]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-slate-700 text-sm">{date}</span>
                <span className="text-xs text-slate-400">({records.length} y lệnh)</span>
                <div className="flex-1 h-px bg-slate-100" />
              </div>
              <div className="space-y-3">
                {records.map((mar) => (
                  <MARCard key={mar.id} mar={mar}
                    onAdminister={(m) => setFiveRightsMAR(m)}
                    onRefuse={(m) => setRefusalMAR(m)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── EXCEPTIONS SUMMARY ─────────────────────────────────────── */}
      {(stats.refused > 0 || stats.held > 0 || stats.overdue > 0 || stats.missed > 0) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Ngoại lệ & Cảnh báo cần xử lý
          </h3>
          <div className="space-y-2">
            {stats.overdue > 0 && (
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                🔴 {stats.overdue} y lệnh QUÁN HẠN — cần thực hiện ngay
              </div>
            )}
            {stats.refused > 0 && (
              <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg">
                <XCircle className="w-4 h-4" />
                {stats.refused} y lệnh bị từ chối — đã ghi lý do
              </div>
            )}
            {stats.held > 0 && (
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                <PauseCircle className="w-4 h-4" />
                {stats.held} y lệnh tạm ngưng — theo y lệnh bác sĩ
              </div>
            )}
            {stats.missed > 0 && (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                <FileWarning className="w-4 h-4" />
                {stats.missed} liều bị bỏ lỡ — cần đánh giá và ghi chú
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODALS ─────────────────────────────────────────────────── */}
      {fiveRightsMAR && (
        <FiveRightsModal
          mar={fiveRightsMAR} patientName={PATIENT_INFO.name} allergies={PATIENT_INFO.allergies}
          onConfirm={handleAdministerConfirm} onCancel={() => setFiveRightsMAR(null)}
        />
      )}
      {refusalMAR && (
        <RefusalModal mar={refusalMAR} onConfirm={handleRefusalConfirm} onCancel={() => setRefusalMAR(null)} />
      )}

      {/* ── ADD ORDER MODAL ─────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-indigo-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-800 mb-1 flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" /> Thêm Y Lệnh Thuốc
            </h2>
            <p className="text-xs text-slate-400 mb-4">Chú ý: Y lệnh thuốc nên được tạo từ EMR/CPOE. Chức năng này dành cho điều chỉnh khẩn.</p>
            <form onSubmit={handleAddOrder} className="space-y-3">
              {[
                { label: 'Tên thuốc', value: drugName, setter: setDrugName, placeholder: 'VD: Paracetamol 1g IV', required: true },
                { label: 'Liều dùng', value: dosage, setter: setDosage, placeholder: 'VD: 1g', required: true },
                { label: 'Tần suất', value: frequency, setter: setFrequency, placeholder: 'VD: q8h, q12h, PRN', required: false },
                { label: 'Bác sĩ chỉ định', value: prescriber, setter: setPrescriber, placeholder: 'VD: BS.CKII Phạm Quốc Việt', required: false },
              ].map(({ label, value, setter, placeholder, required }) => (
                <div key={label}>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{label}:</label>
                  <input type="text" required={required} value={value} onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Đường dùng:</label>
                <select value={route} onChange={(e) => setRoute(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                  {['Uống sau ăn', 'Truyền tĩnh mạch (IV)', 'Tiêm tĩnh mạch (IV push)', 'Tiêm dưới da (SC)', 'Tiêm bắp (IM)', 'Đặt dưới lưỡi (SL)'].map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ngày lên lịch:</label>
                  <input type="date" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Giờ thực hiện:</label>
                  <input type="time" required value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200">
                  Hủy
                </button>
                <button type="submit"
                  className="flex-1 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-md">
                  Thêm Y Lệnh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
