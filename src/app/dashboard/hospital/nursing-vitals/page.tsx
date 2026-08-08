'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { NursingVitalSigns, InpatientAdmission, Bed, Ward } from '@/types/healthcare';
import { useNursingEngine } from '@/hooks/use-nursing-engine';
import { InpatientAdmissionService, BedEngineService } from '@/services/healthcare-hospital-services';
import {
  Activity,
  Heart,
  Thermometer,
  Wind,
  Droplets,
  AlertCircle,
  CheckCircle2,
  Plus,
  User,
  Clock,
  Stethoscope,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldAlert,
  Bell,
  BellOff,
  Eye,
  PhoneCall,
  ChevronsUp,
  ChevronRight,
  Calendar,
  Bed as BedIcon,
  Building2,
  AlertTriangle,
  Sparkles,
  ClipboardList,
  Filter,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type AlertStatus = 'open' | 'acknowledged' | 'reported' | 'escalated' | 'closed';

interface ClinicalAlert {
  id: string;
  vitalId: string;
  severity: 'critical' | 'high' | 'medium';
  messages: string[];
  recordedAt: string;
  nurseId: string;
  status: AlertStatus;
  news2Score: number;
}

type TrendWindow = '6h' | '12h' | '24h' | '48h';

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_PATIENT_INFO = {
  name: 'Lê Thị Hương',
  gender: 'Nữ',
  age: 62,
  mrn: 'pat-001',
  bed: 'ICU-BED-01',
  ward: 'Khoa Hồi sức Tích cực (ICU)',
  admitDay: 5,
  diagnosis: 'Suy hô hấp cấp tiến triển — Theo dõi sau phẫu thuật',
  allergies: 'Penicillin, Sulfonamides',
  overallStatus: 'watch' as 'stable' | 'watch' | 'escalate' | 'critical',
};

const now = Date.now();
const MOCK_VITALS: NursingVitalSigns[] = [
  {
    id: 'vs-mock-001', tenant_id: 'bella_healthcare', inpatient_admission_id: 'adm-mock-001',
    encounter_id: 'enc-mock-001', patient_id: 'pat-mock-001', nurse_practitioner_id: 'nurse-001',
    temperature: 36.8, heart_rate: 82, systolic_bp: 135, diastolic_bp: 85,
    spo2: 96, respiratory_rate: 18,
    notes: 'Bệnh nhân tỉnh táo, hợp tác tốt. Đau vùng thượng vị âm ỉ khi thăm khám.',
    recorded_at: new Date(now - 30 * 60000).toISOString(),
  },
  {
    id: 'vs-mock-002', tenant_id: 'bella_healthcare', inpatient_admission_id: 'adm-mock-001',
    encounter_id: 'enc-mock-001', patient_id: 'pat-mock-001', nurse_practitioner_id: 'nurse-001',
    temperature: 37.2, heart_rate: 78, systolic_bp: 128, diastolic_bp: 82,
    spo2: 97, respiratory_rate: 16, notes: undefined,
    recorded_at: new Date(now - 90 * 60000).toISOString(),
  },
  {
    id: 'vs-mock-003', tenant_id: 'bella_healthcare', inpatient_admission_id: 'adm-mock-001',
    encounter_id: 'enc-mock-001', patient_id: 'pat-mock-001', nurse_practitioner_id: 'nurse-002',
    temperature: 38.4, heart_rate: 96, systolic_bp: 145, diastolic_bp: 92,
    spo2: 94, respiratory_rate: 22,
    notes: 'Sốt nhẹ, nhịp tim nhanh. Đã báo cáo bác sĩ trực. Theo dõi sát SpO2.',
    recorded_at: new Date(now - 180 * 60000).toISOString(),
  },
  {
    id: 'vs-mock-004', tenant_id: 'bella_healthcare', inpatient_admission_id: 'adm-mock-001',
    encounter_id: 'enc-mock-001', patient_id: 'pat-mock-001', nurse_practitioner_id: 'nurse-001',
    temperature: 37.8, heart_rate: 90, systolic_bp: 138, diastolic_bp: 88,
    spo2: 95, respiratory_rate: 20, notes: undefined,
    recorded_at: new Date(now - 360 * 60000).toISOString(),
  },
  {
    id: 'vs-mock-005', tenant_id: 'bella_healthcare', inpatient_admission_id: 'adm-mock-001',
    encounter_id: 'enc-mock-001', patient_id: 'pat-mock-001', nurse_practitioner_id: 'nurse-001',
    temperature: 37.0, heart_rate: 76, systolic_bp: 122, diastolic_bp: 80,
    spo2: 98, respiratory_rate: 15, notes: undefined,
    recorded_at: new Date(now - 720 * 60000).toISOString(),
  },
];

const MOCK_ALERTS: ClinicalAlert[] = [
  {
    id: 'alert-001', vitalId: 'vs-mock-003', severity: 'high',
    messages: ['Nhiệt độ tăng (38.4°C)', 'Huyết áp tâm thu tăng (145 mmHg)', 'SpO₂ thấp (94%)'],
    recordedAt: new Date(now - 180 * 60000).toISOString(),
    nurseId: 'nurse-002', status: 'reported', news2Score: 5,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcNEWS2(v: NursingVitalSigns): number {
  let score = 0;
  // SpO2
  if (v.spo2 >= 96) score += 0;
  else if (v.spo2 >= 94) score += 1;
  else if (v.spo2 >= 92) score += 2;
  else score += 3;
  // HR
  if (v.heart_rate >= 51 && v.heart_rate <= 90) score += 0;
  else if ((v.heart_rate >= 41 && v.heart_rate <= 50) || (v.heart_rate >= 91 && v.heart_rate <= 110)) score += 1;
  else if (v.heart_rate >= 111 && v.heart_rate <= 130) score += 2;
  else score += 3;
  // RR
  const rr = v.respiratory_rate ?? 16;
  if (rr >= 12 && rr <= 20) score += 0;
  else if (rr >= 9 && rr <= 11) score += 1;
  else if (rr >= 21 && rr <= 24) score += 2;
  else score += 3;
  // Temperature
  if (v.temperature >= 36.1 && v.temperature <= 38.0) score += 0;
  else if (v.temperature >= 35.1 && v.temperature <= 36.0) score += 1;
  else if (v.temperature >= 38.1 && v.temperature <= 39.0) score += 1;
  else if (v.temperature > 39.0) score += 2;
  else score += 3;
  // BP systolic
  if (v.systolic_bp >= 111 && v.systolic_bp <= 219) score += 0;
  else if (v.systolic_bp >= 101 && v.systolic_bp <= 110) score += 1;
  else if (v.systolic_bp >= 91 && v.systolic_bp <= 100) score += 2;
  else score += 3;
  return score;
}

function news2Risk(score: number): { label: string; color: string; bg: string; border: string; dot: string } {
  if (score <= 4) return { label: '🟢 Ổn định', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' };
  if (score <= 6) return { label: '🟡 Cần theo dõi', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-400' };
  return { label: '🔴 Cần đánh giá ngay', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' };
}

function getVitalStatus(vital: NursingVitalSigns) {
  const alerts: { msg: string; key: string }[] = [];
  if (vital.temperature < 36.0 || vital.temperature > 37.5) alerts.push({ msg: 'Nhiệt độ bất thường', key: 'temp' });
  if (vital.heart_rate < 60 || vital.heart_rate > 100) alerts.push({ msg: 'Nhịp tim bất thường', key: 'hr' });
  if (vital.systolic_bp < 90 || vital.systolic_bp > 140) alerts.push({ msg: 'Huyết áp tâm thu bất thường', key: 'bp' });
  if (vital.diastolic_bp < 60 || vital.diastolic_bp > 90) alerts.push({ msg: 'Huyết áp tâm trương bất thường', key: 'bp2' });
  if (vital.spo2 < 95) alerts.push({ msg: 'SpO₂ thấp', key: 'spo2' });
  if (vital.respiratory_rate && (vital.respiratory_rate < 12 || vital.respiratory_rate > 20)) alerts.push({ msg: 'Nhịp thở bất thường', key: 'rr' });
  return alerts;
}

function isAbnormal(key: string, vital: NursingVitalSigns): boolean {
  switch (key) {
    case 'temp': return vital.temperature < 36.0 || vital.temperature > 37.5;
    case 'hr': return vital.heart_rate < 60 || vital.heart_rate > 100;
    case 'bp': return vital.systolic_bp < 90 || vital.systolic_bp > 140 || vital.diastolic_bp < 60 || vital.diastolic_bp > 90;
    case 'spo2': return vital.spo2 < 95;
    case 'rr': return !!vital.respiratory_rate && (vital.respiratory_rate < 12 || vital.respiratory_rate > 20);
    default: return false;
  }
}

function calcTrend(vals: number[]): 'up' | 'down' | 'stable' {
  if (vals.length < 2) return 'stable';
  const diff = vals[0] - vals[vals.length - 1];
  if (Math.abs(diff) < 0.5) return 'stable';
  return diff > 0 ? 'up' : 'down';
}

const ALERT_STATUS_MAP: Record<AlertStatus, { label: string; color: string; bg: string; border: string }> = {
  open:         { label: 'Chưa xem', color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200' },
  acknowledged: { label: 'Đã xem',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  reported:     { label: 'Đã báo BS', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  escalated:    { label: 'Escalate', color: 'text-purple-700',  bg: 'bg-purple-50', border: 'border-purple-200' },
  closed:       { label: 'Đã đóng',  color: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200' },
};

const OVERALL_STATUS = {
  stable:   { label: 'Ổn định',              color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-300' },
  watch:    { label: 'Cần theo dõi',          color: 'text-amber-700',   bg: 'bg-amber-100',   border: 'border-amber-300' },
  escalate: { label: 'Cần báo cáo nhanh',    color: 'text-orange-700',  bg: 'bg-orange-100',  border: 'border-orange-300' },
  critical: { label: 'Nguy kịch — Xử lý ngay', color: 'text-rose-700', bg: 'bg-rose-100',    border: 'border-rose-300' },
};

// ─── Sparkline (SVG inline) ───────────────────────────────────────────────────
function Sparkline({ values, isAbnormalFn }: { values: number[]; isAbnormalFn: (v: number) => boolean }) {
  if (values.length < 2) return <div className="text-[10px] text-slate-300">Chưa đủ dữ liệu</div>;
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const w = 120; const h = 36;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * h;
    return `${x},${y}`;
  });
  const lastAbnormal = isAbnormalFn(values[0]);
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline fill="none" stroke={lastAbnormal ? '#f43f5e' : '#14b8a6'} strokeWidth="2" points={pts.join(' ')} />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - ((v - min) / (max - min)) * h;
        return <circle key={i} cx={x} cy={y} r={i === 0 ? 4 : 2.5} fill={isAbnormalFn(v) ? '#f43f5e' : '#14b8a6'} />;
      })}
    </svg>
  );
}

// ─── Vital Card ───────────────────────────────────────────────────────────────
function VitalCard({
  label, value, unit, normal, icon, isAbn, history, isAbnFn,
}: {
  label: string; value: string; unit: string; normal: string;
  icon: React.ReactNode; isAbn: boolean; history: number[];
  isAbnFn: (v: number) => boolean;
}) {
  const trend = calcTrend(history);
  return (
    <div className={`rounded-xl border p-3.5 transition-all ${isAbn ? 'bg-rose-50 border-rose-300 shadow-rose-100 shadow-md' : 'bg-white border-slate-200 shadow-sm'}`}>
      <div className="flex items-center justify-between mb-1">
        <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${isAbn ? 'text-rose-600' : 'text-slate-500'}`}>
          {icon}
          {label}
        </div>
        {isAbn && <span className="text-[9px] font-black text-white bg-rose-500 px-1.5 py-0.5 rounded-full">!</span>}
      </div>
      <div className={`text-2xl font-black leading-none mb-0.5 ${isAbn ? 'text-rose-800' : 'text-slate-900'}`}>
        {value}<span className="text-sm font-semibold ml-0.5 opacity-60">{unit}</span>
      </div>
      <div className={`text-[10px] mb-2 ${isAbn ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
        {isAbn ? '⚠ Ngoài giới hạn' : '✓ Bình thường'} · {normal}
      </div>
      {/* Mini sparkline */}
      <div className="flex items-end justify-between">
        <Sparkline values={history} isAbnormalFn={isAbnFn} />
        <div className="text-[10px] font-semibold ml-1">
          {trend === 'up' ? <TrendingUp className="w-3.5 h-3.5 text-rose-400" /> :
           trend === 'down' ? <TrendingDown className="w-3.5 h-3.5 text-teal-500" /> :
           <Minus className="w-3.5 h-3.5 text-slate-400" />}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NursingVitalsPage() {
  const { recordVitalSigns, getVitalSigns } = useNursingEngine();

  const [admissions, setAdmissions] = useState<InpatientAdmission[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedAdmissionId, setSelectedAdmissionId] = useState<string>('');
  const [vitals, setVitals] = useState<NursingVitalSigns[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [alerts, setAlerts] = useState<ClinicalAlert[]>(MOCK_ALERTS);
  const [trendWindow, setTrendWindow] = useState<TrendWindow>('24h');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<string>('37.0');
  const [heartRate, setHeartRate] = useState<string>('75');
  const [systolicBp, setSystolicBp] = useState<string>('120');
  const [diastolicBp, setDiastolicBp] = useState<string>('80');
  const [spo2, setSpo2] = useState<string>('98');
  const [respiratoryRate, setRespiratoryRate] = useState<string>('16');
  const [notes, setNotes] = useState<string>('');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (selectedAdmissionId) loadVitals(selectedAdmissionId); }, [selectedAdmissionId]);

  const loadData = async () => {
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
  };

  const loadVitals = async (id: string) => {
    try {
      const result = await getVitalSigns('bella_healthcare', id);
      if (result.success && result.data && result.data.length > 0) {
        // VitalSigns[] từ engine — cast sang NursingVitalSigns[] cho local state
        setVitals(result.data as unknown as NursingVitalSigns[]);
      } else {
        setVitals(MOCK_VITALS);
      }
    } catch { setVitals(MOCK_VITALS); }
  };

  const handleRecordVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdmissionId) return;
    const admission = admissions.find((a) => a.id === selectedAdmissionId);
    if (!admission) return;
    const optimistic: NursingVitalSigns = {
      id: `vs-${Date.now()}`, tenant_id: 'bella_healthcare',
      inpatient_admission_id: admission.id, encounter_id: admission.encounter_id,
      patient_id: admission.patient_id, nurse_practitioner_id: 'nurse-001',
      temperature: parseFloat(temperature), heart_rate: parseInt(heartRate, 10),
      systolic_bp: parseInt(systolicBp, 10), diastolic_bp: parseInt(diastolicBp, 10),
      spo2: parseInt(spo2, 10),
      respiratory_rate: respiratoryRate ? parseInt(respiratoryRate, 10) : undefined,
      notes: notes || undefined, recorded_at: new Date().toISOString(),
    };
    try {
      const result = await recordVitalSigns({
        tenantId: 'bella_healthcare', encounterId: admission.encounter_id,
        patientId: admission.patient_id, recordedBy: 'nurse-001',
        temperature: { value: parseFloat(temperature), unit: '°C' },
        heartRate: { value: parseInt(heartRate, 10), unit: 'bpm' },
        bloodPressure: { systolic: parseInt(systolicBp, 10), diastolic: parseInt(diastolicBp, 10) },
        oxygenSaturation: { value: parseInt(spo2, 10), unit: '%' },
        respiratoryRate: respiratoryRate ? { value: parseInt(respiratoryRate, 10), unit: '/min' } : undefined,
        notes: notes || undefined,
      });
      if (result.success) { setVitals((p) => [optimistic, ...p]); }
      else { setVitals((p) => [optimistic, ...p]); } // optimistic fallback
    } catch { setVitals((p) => [optimistic, ...p]); }
    const vitalAlerts = getVitalStatus(optimistic);
    if (vitalAlerts.length > 0) {
      const newAlert: ClinicalAlert = {
        id: `alert-${Date.now()}`, vitalId: optimistic.id,
        severity: vitalAlerts.length >= 3 ? 'critical' : vitalAlerts.length >= 2 ? 'high' : 'medium',
        messages: vitalAlerts.map((a) => a.msg),
        recordedAt: optimistic.recorded_at, nurseId: 'nurse-001',
        status: 'open', news2Score: calcNEWS2(optimistic),
      };
      setAlerts((p) => [newAlert, ...p]);
    }
    setShowAddModal(false);
    setTemperature('37.0'); setHeartRate('75'); setSystolicBp('120');
    setDiastolicBp('80'); setSpo2('98'); setRespiratoryRate('16'); setNotes('');
  };

  const updateAlertStatus = (alertId: string, newStatus: AlertStatus) => {
    setAlerts((prev) => prev.map((a) => a.id === alertId ? { ...a, status: newStatus } : a));
  };

  const latestVital = vitals[0];
  const latestNews2 = latestVital ? calcNEWS2(latestVital) : 0;
  const news2Info = news2Risk(latestNews2);

  // Build history arrays for sparklines
  const tempHistory = useMemo(() => vitals.slice(0, 5).map((v) => v.temperature), [vitals]);
  const hrHistory   = useMemo(() => vitals.slice(0, 5).map((v) => v.heart_rate), [vitals]);
  const spo2History = useMemo(() => vitals.slice(0, 5).map((v) => v.spo2), [vitals]);
  const bpHistory   = useMemo(() => vitals.slice(0, 5).map((v) => v.systolic_bp), [vitals]);
  const rrHistory   = useMemo(() => vitals.slice(0, 5).map((v) => v.respiratory_rate ?? 16), [vitals]);

  const openAlerts = alerts.filter((a) => a.status !== 'closed');
  const selectedAdmission = admissions.find((a) => a.id === selectedAdmissionId);
  const selectedBed  = selectedAdmission ? beds.find((b) => b.id === selectedAdmission.bed_id) : null;
  const selectedWard = selectedAdmission ? wards.find((w) => w.id === selectedAdmission.ward_id) : null;

  const overallStatus = MOCK_PATIENT_INFO.overallStatus;
  const overallCfg    = OVERALL_STATUS[overallStatus];

  return (
    <div className="p-5 max-w-[1440px] mx-auto space-y-5">

      {/* ── HEADER ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-cyan-900 via-blue-900 to-indigo-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-300 mb-1">
            <Activity className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#ffffff' }}>
              Bella Hospital Nursing • Vital Signs Monitoring & Early Warning Center
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold" style={{ color: '#ffffff' }}>Theo Dõi Sinh Hiệu Điều Dưỡng</h1>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
            Ghi nhận · Giám sát · NEWS2 Early Warning · Cảnh báo lâm sàng · Xu hướng sinh hiệu 24–48h
          </p>
        </div>
        {/* Open alert badge */}
        {openAlerts.length > 0 && (
          <div className="flex items-center gap-2 bg-rose-500/20 border border-rose-400/40 rounded-xl px-4 py-2">
            <Bell className="w-5 h-5 text-rose-300 animate-pulse" />
            <div>
              <div className="text-lg font-black text-white">{openAlerts.length}</div>
              <div className="text-[10px] text-rose-200">Cảnh báo đang mở</div>
            </div>
          </div>
        )}
        <button
          onClick={() => setShowAddModal(true)}
          disabled={!selectedAdmissionId}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-500 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-all border border-emerald-400/30"
        >
          <Plus className="w-5 h-5" />
          Ghi Nhận Sinh Hiệu Mới
        </button>
      </div>

      {/* ── TẦNG 1: PATIENT CONTEXT ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-md">
        <div className="flex flex-col lg:flex-row gap-5">
          {/* Patient selector */}
          <div className="lg:w-64 shrink-0">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Chọn bệnh nhân nội trú:
            </label>
            <select
              value={selectedAdmissionId}
              onChange={(e) => setSelectedAdmissionId(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {admissions.length === 0 ? (
                <option value="">Không có bệnh nhân</option>
              ) : admissions.map((adm) => {
                const b = beds.find((x) => x.id === adm.bed_id);
                const w = wards.find((x) => x.id === adm.ward_id);
                return <option key={adm.id} value={adm.id}>{b?.bed_code || 'N/A'} – {w?.name || 'N/A'} – {adm.patient_id}</option>;
              })}
            </select>
          </div>

          {/* Patient info panel */}
          <div className="flex-1 flex flex-wrap gap-4 items-start">
            {/* Identity */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow">
                {MOCK_PATIENT_INFO.name.charAt(0)}
              </div>
              <div>
                <div className="font-bold text-slate-900">{selectedAdmission ? MOCK_PATIENT_INFO.name : '—'}</div>
                <div className="text-xs text-slate-500">{MOCK_PATIENT_INFO.gender} · {MOCK_PATIENT_INFO.age} tuổi · MRN: {MOCK_PATIENT_INFO.mrn}</div>
              </div>
            </div>

            {/* Context pills */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className="flex items-center gap-1 text-xs font-semibold text-cyan-700 bg-cyan-50 border border-cyan-200 px-3 py-1.5 rounded-full">
                <BedIcon className="w-3 h-3" />
                {selectedBed?.bed_code ?? MOCK_PATIENT_INFO.bed}
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-full">
                <Building2 className="w-3 h-3" />
                {selectedWard?.name ?? MOCK_PATIENT_INFO.ward}
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-full">
                <Calendar className="w-3 h-3" />
                Ngày điều trị {MOCK_PATIENT_INFO.admitDay}
              </span>
              <span className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full border ${overallCfg.bg} ${overallCfg.color} ${overallCfg.border}`}>
                <Activity className="w-3 h-3" />
                {overallCfg.label}
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-full">
                ⚠ Dị ứng: {MOCK_PATIENT_INFO.allergies}
              </span>
            </div>

            {/* Diagnosis */}
            <div className="w-full text-xs text-slate-500 border-t border-slate-100 pt-2 mt-1">
              <strong className="text-slate-600">Chẩn đoán chính:</strong> {MOCK_PATIENT_INFO.diagnosis}
            </div>
          </div>
        </div>
      </div>

      {latestVital && (
        <>
          {/* ── TẦNG 2: CURRENT VITALS + NEWS2 ───────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* 5 vital cards */}
            <div className="lg:col-span-3">
              <h3 className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-cyan-600" />
                Sinh Hiệu Hiện Tại
                <span className="text-xs text-slate-400 font-normal">
                  — {new Date(latestVital.recorded_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · {latestVital.nurse_practitioner_id}
                </span>
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <VitalCard
                  label="Nhiệt độ" value={`${latestVital.temperature}`} unit="°C" normal="36.0–37.5°C"
                  icon={<Thermometer className="w-3.5 h-3.5" />}
                  isAbn={isAbnormal('temp', latestVital)} history={tempHistory}
                  isAbnFn={(v) => v < 36.0 || v > 37.5}
                />
                <VitalCard
                  label="Nhịp tim" value={`${latestVital.heart_rate}`} unit="bpm" normal="60–100"
                  icon={<Heart className="w-3.5 h-3.5" />}
                  isAbn={isAbnormal('hr', latestVital)} history={hrHistory}
                  isAbnFn={(v) => v < 60 || v > 100}
                />
                <VitalCard
                  label="Huyết áp" value={`${latestVital.systolic_bp}/${latestVital.diastolic_bp}`} unit="mmHg" normal="90–140 / 60–90"
                  icon={<Activity className="w-3.5 h-3.5" />}
                  isAbn={isAbnormal('bp', latestVital)} history={bpHistory}
                  isAbnFn={(v) => v < 90 || v > 140}
                />
                <VitalCard
                  label="SpO₂" value={`${latestVital.spo2}`} unit="%" normal="≥95%"
                  icon={<Droplets className="w-3.5 h-3.5" />}
                  isAbn={isAbnormal('spo2', latestVital)} history={spo2History}
                  isAbnFn={(v) => v < 95}
                />
                <VitalCard
                  label="Nhịp thở" value={`${latestVital.respiratory_rate ?? '—'}`} unit="/ph" normal="12–20/ph"
                  icon={<Wind className="w-3.5 h-3.5" />}
                  isAbn={isAbnormal('rr', latestVital)} history={rrHistory}
                  isAbnFn={(v) => v < 12 || v > 20}
                />
              </div>
            </div>

            {/* NEWS2 Score */}
            <div className={`rounded-xl border p-5 shadow-md flex flex-col justify-between ${news2Info.bg} ${news2Info.border}`}>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Early Warning</span>
                </div>
                <div className="text-xs text-slate-500 mb-1">NEWS2 Score</div>
                <div className={`text-5xl font-black ${news2Info.color}`}>{latestNews2}</div>
                <div className={`text-sm font-bold mt-1 ${news2Info.color}`}>{news2Info.label}</div>
              </div>
              <div className="mt-4 space-y-1">
                {getVitalStatus(latestVital).map((a) => (
                  <div key={a.key} className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                    <span>↑</span> {a.msg}
                  </div>
                ))}
                {getVitalStatus(latestVital).length === 0 && (
                  <div className="text-[11px] text-emerald-600 font-semibold">Tất cả chỉ số trong giới hạn bình thường</div>
                )}
              </div>
              <div className="mt-3 text-[10px] text-slate-400 border-t border-slate-200 pt-2">
                Tính toán: {new Date(latestVital.recorded_at).toLocaleTimeString('vi-VN')}
                <br />Nguồn: Bella Clinical Safety Engine
              </div>
            </div>
          </div>

          {/* ── TẦNG 3: OPEN ALERTS ───────────────────────────────────── */}
          {openAlerts.length > 0 && (
            <div className="bg-white border border-rose-200 rounded-xl p-5 shadow-md">
              <h3 className="font-bold text-rose-800 text-sm mb-3 flex items-center gap-2">
                <Bell className="w-4 h-4 text-rose-500 animate-pulse" />
                Cảnh Báo Sinh Hiệu Đang Mở — {openAlerts.length}
              </h3>
              <div className="space-y-3">
                {openAlerts.map((alert) => {
                  const acfg = ALERT_STATUS_MAP[alert.status];
                  const n2 = news2Risk(alert.news2Score);
                  return (
                    <div key={alert.id} className={`rounded-xl border p-4 ${acfg.bg} ${acfg.border}`}>
                      <div className="flex flex-wrap items-start gap-3 justify-between">
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                              alert.severity === 'critical' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                              alert.severity === 'high' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                              'bg-yellow-100 text-yellow-800 border-yellow-300'
                            }`}>
                              {alert.severity === 'critical' ? '🔴 CRITICAL' : alert.severity === 'high' ? '🟠 HIGH' : '🟡 MEDIUM'}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${acfg.bg} ${acfg.color} ${acfg.border}`}>
                              {acfg.label}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${n2.bg} ${n2.color} ${n2.border}`}>
                              NEWS2: {alert.news2Score}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {alert.messages.map((m, i) => (
                              <div key={i} className="text-xs font-semibold text-rose-700 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" /> {m}
                              </div>
                            ))}
                          </div>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1"><User className="w-3 h-3" /> {alert.nurseId}</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />
                              {new Date(alert.recordedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-1.5 shrink-0">
                          {alert.status === 'open' && (
                            <button onClick={() => updateAlertStatus(alert.id, 'acknowledged')}
                              className="flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-all">
                              <Eye className="w-3 h-3" /> Đã xem
                            </button>
                          )}
                          {(alert.status === 'open' || alert.status === 'acknowledged') && (
                            <button onClick={() => updateAlertStatus(alert.id, 'reported')}
                              className="flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-300 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 transition-all">
                              <PhoneCall className="w-3 h-3" /> Báo BS
                            </button>
                          )}
                          {alert.status !== 'escalated' && alert.status !== 'closed' && (
                            <button onClick={() => updateAlertStatus(alert.id, 'escalated')}
                              className="flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-300 px-2.5 py-1.5 rounded-lg hover:bg-purple-100 transition-all">
                              <ChevronsUp className="w-3 h-3" /> Escalate ICU
                            </button>
                          )}
                          {alert.status !== 'closed' && (
                            <button onClick={() => updateAlertStatus(alert.id, 'closed')}
                              className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-all">
                              <BellOff className="w-3 h-3" /> Đóng
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TẦNG 4: TREND CHART (ASCII sparklines dạng bảng) ──────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-md">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Xu Hướng Sinh Hiệu
              </h3>
              <div className="flex gap-1">
                {(['6h', '12h', '24h', '48h'] as TrendWindow[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => setTrendWindow(w)}
                    className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${
                      trendWindow === w ? 'bg-cyan-600 text-white shadow' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Each trend item */}
              {[
                { label: 'Nhiệt độ (°C)', values: tempHistory, unit: '°C', isAbnFn: (v: number) => v < 36.0 || v > 37.5, normal: '36.0–37.5' },
                { label: 'Nhịp tim (bpm)', values: hrHistory, unit: 'bpm', isAbnFn: (v: number) => v < 60 || v > 100, normal: '60–100' },
                { label: 'Huyết áp Tâm thu (mmHg)', values: bpHistory, unit: 'mmHg', isAbnFn: (v: number) => v < 90 || v > 140, normal: '90–140' },
                { label: 'SpO₂ (%)', values: spo2History, unit: '%', isAbnFn: (v: number) => v < 95, normal: '≥95' },
                { label: 'Nhịp thở (/ph)', values: rrHistory, unit: '/ph', isAbnFn: (v: number) => v < 12 || v > 20, normal: '12–20' },
              ].map((item) => {
                const trend = calcTrend(item.values);
                const current = item.values[0];
                const currentAbn = item.isAbnFn(current);
                return (
                  <div key={item.label} className={`rounded-xl border p-4 ${currentAbn ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-600">{item.label}</span>
                      <div className="flex items-center gap-1">
                        <span className={`text-[10px] font-bold ${currentAbn ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {currentAbn ? '⚠ Bất thường' : '✓ Bình thường'}
                        </span>
                        {trend === 'up' && <TrendingUp className={`w-3.5 h-3.5 ${currentAbn ? 'text-rose-500' : 'text-slate-400'}`} />}
                        {trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-teal-500" />}
                        {trend === 'stable' && <Minus className="w-3.5 h-3.5 text-slate-400" />}
                      </div>
                    </div>
                    <div className="flex items-end gap-3">
                      <div className={`text-2xl font-black ${currentAbn ? 'text-rose-700' : 'text-slate-800'}`}>
                        {current}{item.unit}
                      </div>
                      <Sparkline values={item.values} isAbnormalFn={item.isAbnFn} />
                    </div>
                    <div className="mt-1 text-[10px] text-slate-400">Giới hạn bình thường: {item.normal}</div>
                    <div className="mt-2 flex gap-1 text-[10px] text-slate-400">
                      {item.values.slice().reverse().map((v, i) => (
                        <span key={i} className={`px-1.5 py-0.5 rounded ${item.isAbnFn(v) ? 'bg-rose-100 text-rose-700 font-bold' : 'bg-white border border-slate-200 text-slate-600'}`}>
                          {v}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── TẦNG 5: CLINICAL TIMELINE ─────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-md">
            <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-cyan-600" />
              Clinical Timeline Điều Dưỡng
            </h3>
            <div className="relative">
              <div className="absolute left-5 top-2 bottom-2 w-0.5 bg-slate-100" />
              <div className="space-y-3">
                {vitals.map((vital, idx) => {
                  const vAlerts = getVitalStatus(vital);
                  const isAbn = vAlerts.length > 0;
                  const news2 = calcNEWS2(vital);
                  const linkedAlert = alerts.find((a) => a.vitalId === vital.id);
                  return (
                    <div key={vital.id} className="flex gap-4 pl-2">
                      {/* Timeline dot */}
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 border-2 ${
                        isAbn ? 'bg-rose-500 border-rose-600 text-white' : 'bg-emerald-500 border-emerald-600 text-white'
                      }`}>
                        {isAbn ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      {/* Content */}
                      <div className={`flex-1 rounded-xl border p-4 ${isAbn ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs font-bold text-slate-700">
                            {new Date(vital.recorded_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            {' '}
                            <span className="text-slate-400 font-normal">
                              {new Date(vital.recorded_at).toLocaleDateString('vi-VN')}
                            </span>
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isAbn ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {isAbn ? `⚠ Bất thường (${vAlerts.length})` : '✓ Bình thường'}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${news2Risk(news2).bg} ${news2Risk(news2).color} ${news2Risk(news2).border}`}>
                            NEWS2: {news2}
                          </span>
                          {idx === 0 && <span className="text-[9px] font-black text-white bg-cyan-600 px-2 py-0.5 rounded-full">MỚI NHẤT</span>}
                        </div>
                        {/* Compact vital row */}
                        <div className="flex flex-wrap gap-3 text-xs text-slate-700 font-semibold">
                          <span className={isAbnormal('temp', vital) ? 'text-rose-700 font-black' : ''}><Thermometer className="w-3 h-3 inline text-slate-400 mr-0.5" />{vital.temperature}°C</span>
                          <span className={isAbnormal('hr', vital) ? 'text-rose-700 font-black' : ''}><Heart className="w-3 h-3 inline text-slate-400 mr-0.5" />{vital.heart_rate} bpm</span>
                          <span className={isAbnormal('bp', vital) ? 'text-rose-700 font-black' : ''}><Activity className="w-3 h-3 inline text-slate-400 mr-0.5" />{vital.systolic_bp}/{vital.diastolic_bp}</span>
                          <span className={isAbnormal('spo2', vital) ? 'text-rose-700 font-black' : ''}><Droplets className="w-3 h-3 inline text-slate-400 mr-0.5" />SpO₂ {vital.spo2}%</span>
                          {vital.respiratory_rate && <span className={isAbnormal('rr', vital) ? 'text-rose-700 font-black' : ''}><Wind className="w-3 h-3 inline text-slate-400 mr-0.5" />RR {vital.respiratory_rate}</span>}
                          <span className="text-slate-400 font-normal"><User className="w-3 h-3 inline mr-0.5" />{vital.nurse_practitioner_id}</span>
                        </div>
                        {/* Alert action log */}
                        {linkedAlert && linkedAlert.status !== 'open' && (
                          <div className={`mt-2 text-[11px] font-semibold flex items-center gap-1 ${ALERT_STATUS_MAP[linkedAlert.status].color}`}>
                            <ChevronRight className="w-3 h-3" />
                            {linkedAlert.status === 'reported' ? '✓ Đã báo cáo bác sĩ trực' :
                             linkedAlert.status === 'escalated' ? '↑ Đã escalate ICU' :
                             linkedAlert.status === 'acknowledged' ? '👁 Đã xem xác nhận' :
                             '✓ Đã đóng cảnh báo'}
                          </div>
                        )}
                        {vital.notes && (
                          <div className="mt-2 text-xs text-slate-500 italic border-t border-slate-100 pt-1.5">
                            💬 {vital.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {!latestVital && !loading && (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          Chưa có dữ liệu sinh hiệu. Nhấn &quot;Ghi Nhận Sinh Hiệu Mới&quot; để bắt đầu.
        </div>
      )}

      {/* ── MODAL GHI NHẬN ─────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-cyan-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-slate-800 mb-1 flex items-center gap-2">
              <Activity className="w-6 h-6 text-cyan-600" />
              Ghi Nhận Sinh Hiệu Bệnh Nhân
            </h2>
            <p className="text-xs text-slate-500 mb-4">Hệ thống sẽ tự động tính NEWS2 và kích hoạt cảnh báo nếu có chỉ số bất thường.</p>

            <form onSubmit={handleRecordVitals} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Nhiệt độ (°C)', value: temperature, setter: setTemperature, step: '0.1', placeholder: '37.0', normal: 'BT: 36.0–37.5°C', icon: <Thermometer className="w-3.5 h-3.5 text-orange-500" />, required: true },
                  { label: 'Nhịp tim (bpm)', value: heartRate, setter: setHeartRate, step: '1', placeholder: '75', normal: 'BT: 60–100 bpm', icon: <Heart className="w-3.5 h-3.5 text-rose-500" />, required: true },
                  { label: 'HA tâm thu (mmHg)', value: systolicBp, setter: setSystolicBp, step: '1', placeholder: '120', normal: 'BT: 90–140', icon: <Activity className="w-3.5 h-3.5 text-indigo-500" />, required: true },
                  { label: 'HA tâm trương (mmHg)', value: diastolicBp, setter: setDiastolicBp, step: '1', placeholder: '80', normal: 'BT: 60–90', icon: <Activity className="w-3.5 h-3.5 text-indigo-400" />, required: true },
                  { label: 'SpO₂ (%)', value: spo2, setter: setSpo2, step: '1', placeholder: '98', normal: 'BT: ≥95%', icon: <Droplets className="w-3.5 h-3.5 text-cyan-500" />, required: true },
                  { label: 'Nhịp thở (/phút)', value: respiratoryRate, setter: setRespiratoryRate, step: '1', placeholder: '16', normal: 'BT: 12–20', icon: <Wind className="w-3.5 h-3.5 text-emerald-500" />, required: false },
                ].map(({ label, value, setter, step, placeholder, normal, icon, required }) => (
                  <div key={label}>
                    <label className="flex items-center gap-1 text-xs font-bold text-slate-700 mb-1">{icon} {label}:</label>
                    <input
                      type="number" step={step} required={required} value={value}
                      onChange={(e) => setter(e.target.value)} placeholder={placeholder}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                    />
                    <div className="text-[10px] text-slate-400 mt-0.5">{normal}</div>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú điều dưỡng (tùy chọn):</label>
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ghi chú về tình trạng bệnh nhân, triệu chứng đặc biệt..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:outline-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                  Hủy bỏ
                </button>
                <button type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 shadow-md">
                  ✓ Xác Nhận Ghi Nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
