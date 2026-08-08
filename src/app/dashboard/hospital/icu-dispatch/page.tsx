'use client';

import React, { useState } from 'react';
import {
  Activity,
  BedDouble,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Zap,
  Heart,
  BarChart3,
  Phone,
  UserCheck,
  RefreshCw,
} from 'lucide-react';

// ─── ICU Dispatch Types ───────────────────────────────────────────────────────
interface ICUBed {
  bedId: string;
  bedCode: string;
  patientName: string | null;
  encounterId: string | null;
  assignedNurse: string | null;
  assignedPhysician: string | null;
  admittedAt: string | null;
  diagnosis: string | null;
  severity: 'stable' | 'critical' | 'very_critical' | 'monitoring';
  ventilator: boolean;
  apacheScore: number | null;
  latestHR: number | null;
  latestSpO2: number | null;
  latestMap: number | null;
  status: 'occupied' | 'empty' | 'cleaning' | 'reserved';
}

interface ICUShiftStaff {
  id: string;
  name: string;
  role: 'physician' | 'nurse' | 'resident';
  shift: 'morning' | 'afternoon' | 'night';
  assignedBeds: string[];
  status: 'on_duty' | 'break' | 'off_duty';
}

interface TransferRequest {
  id: string;
  patientName: string;
  fromBed: string;
  toWard: string;
  requestedBy: string;
  reason: string;
  status: 'pending' | 'approved' | 'in_progress';
  requestedAt: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_ICU_BEDS: ICUBed[] = [
  {
    bedId: 'icu-01', bedCode: 'ICU-01',
    patientName: 'Nguyễn Văn Hoàng', encounterId: 'ENC-HOS-2026-0892',
    assignedNurse: 'ĐD. Lý Thu Hà', assignedPhysician: 'BS. Trần Văn Nam',
    admittedAt: '2026-08-03T08:00:00Z', diagnosis: 'ARDS — Suy hô hấp cấp',
    severity: 'critical', ventilator: true,
    apacheScore: 22, latestHR: 90, latestSpO2: 95, latestMap: 78,
    status: 'occupied',
  },
  {
    bedId: 'icu-02', bedCode: 'ICU-02',
    patientName: 'Trần Bá Dũng', encounterId: 'ENC-HOS-2026-0901',
    assignedNurse: 'ĐD. Nguyễn Văn Phong', assignedPhysician: 'BS. Trần Văn Nam',
    admittedAt: '2026-08-06T14:00:00Z', diagnosis: 'Nhồi máu cơ tim cấp STEMI',
    severity: 'very_critical', ventilator: false,
    apacheScore: 28, latestHR: 112, latestSpO2: 93, latestMap: 65,
    status: 'occupied',
  },
  {
    bedId: 'icu-03', bedCode: 'ICU-03',
    patientName: 'Phạm Thị Loan', encounterId: 'ENC-HOS-2026-0895',
    assignedNurse: 'ĐD. Lý Thu Hà', assignedPhysician: 'PGS.TS.BS Lê Minh Khoa',
    admittedAt: '2026-08-05T06:30:00Z', diagnosis: 'Nhiễm khuẩn huyết — Septic Shock',
    severity: 'very_critical', ventilator: true,
    apacheScore: 31, latestHR: 118, latestSpO2: 90, latestMap: 58,
    status: 'occupied',
  },
  {
    bedId: 'icu-04', bedCode: 'ICU-04',
    patientName: 'Lê Quốc Hùng', encounterId: 'ENC-HOS-2026-0889',
    assignedNurse: 'ĐD. Hoàng Minh Tuấn', assignedPhysician: 'PGS.TS.BS Lê Minh Khoa',
    admittedAt: '2026-08-07T18:00:00Z', diagnosis: 'Hậu phẫu tim hở — Van 2 lá',
    severity: 'monitoring', ventilator: false,
    apacheScore: 14, latestHR: 72, latestSpO2: 98, latestMap: 82,
    status: 'occupied',
  },
  {
    bedId: 'icu-05', bedCode: 'ICU-05',
    patientName: null, encounterId: null,
    assignedNurse: null, assignedPhysician: null,
    admittedAt: null, diagnosis: null,
    severity: 'stable', ventilator: false,
    apacheScore: null, latestHR: null, latestSpO2: null, latestMap: null,
    status: 'empty',
  },
  {
    bedId: 'icu-06', bedCode: 'ICU-06',
    patientName: null, encounterId: null,
    assignedNurse: null, assignedPhysician: null,
    admittedAt: null, diagnosis: null,
    severity: 'stable', ventilator: false,
    apacheScore: null, latestHR: null, latestSpO2: null, latestMap: null,
    status: 'cleaning',
  },
];

const MOCK_STAFF: ICUShiftStaff[] = [
  { id: 'st-01', name: 'PGS.TS.BS Lê Minh Khoa', role: 'physician', shift: 'morning', assignedBeds: ['ICU-03', 'ICU-04'], status: 'on_duty' },
  { id: 'st-02', name: 'BS. Trần Văn Nam',        role: 'physician', shift: 'morning', assignedBeds: ['ICU-01', 'ICU-02'], status: 'on_duty' },
  { id: 'st-03', name: 'BS. Nội trú Hùng',        role: 'resident',  shift: 'morning', assignedBeds: ['ICU-05', 'ICU-06'], status: 'on_duty' },
  { id: 'st-04', name: 'ĐD. Lý Thu Hà',           role: 'nurse',     shift: 'morning', assignedBeds: ['ICU-01', 'ICU-03'], status: 'on_duty' },
  { id: 'st-05', name: 'ĐD. Nguyễn Văn Phong',    role: 'nurse',     shift: 'morning', assignedBeds: ['ICU-02'],           status: 'break' },
  { id: 'st-06', name: 'ĐD. Hoàng Minh Tuấn',     role: 'nurse',     shift: 'morning', assignedBeds: ['ICU-04'],           status: 'on_duty' },
];

const MOCK_TRANSFERS: TransferRequest[] = [
  {
    id: 'tr-001', patientName: 'Lê Quốc Hùng', fromBed: 'ICU-04', toWard: 'Khoa Tim Mạch — Giường 08',
    requestedBy: 'PGS.TS.BS Lê Minh Khoa', reason: 'Hậu phẫu ổn định, đủ điều kiện chuyển khoa thường',
    status: 'approved', requestedAt: '2026-08-08T09:00:00Z',
  },
  {
    id: 'tr-002', patientName: 'Phạm Thị Loan', fromBed: 'Cấp cứu', toWard: 'ICU-05',
    requestedBy: 'BS. CK Cấp cứu', reason: 'Septic shock cần theo dõi tích cực ICU',
    status: 'pending', requestedAt: '2026-08-08T14:00:00Z',
  },
];

const SEVERITY_CONFIG = {
  very_critical: { label: 'Nguy kịch',     color: 'bg-rose-600 text-white',           ring: 'ring-rose-500' },
  critical:      { label: 'Nặng',          color: 'bg-orange-500 text-white',          ring: 'ring-orange-400' },
  monitoring:    { label: 'Theo dõi',      color: 'bg-amber-400 text-amber-900',       ring: 'ring-amber-400' },
  stable:        { label: 'Ổn định',       color: 'bg-emerald-100 text-emerald-800',   ring: 'ring-emerald-300' },
};

export default function ICUDispatchPage() {
  const [activeTab, setActiveTab] = useState<'beds' | 'staff' | 'transfer'>('beds');

  const occupiedBeds = MOCK_ICU_BEDS.filter((b) => b.status === 'occupied').length;
  const criticalCount = MOCK_ICU_BEDS.filter((b) => b.severity === 'very_critical' || b.severity === 'critical').length;
  const onVentilator = MOCK_ICU_BEDS.filter((b) => b.ventilator).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-rose-900 via-red-900 to-orange-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-rose-300 mb-1">
              <Activity className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Bella Hospital • ICU Command Center — Real-time Dispatch
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">Điều Phối Khoa Hồi Sức Tích Cực (ICU)</h1>
            <p className="text-rose-100 text-sm mt-1">
              Giám sát thời gian thực tình trạng bệnh nhân, phân công ca trực, quản lý chuyển khoa và cảnh báo nguy kịch.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center bg-white/10 rounded-xl px-3 py-3 border border-white/20">
              <div className="text-2xl font-black">{MOCK_ICU_BEDS.length}</div>
              <div className="text-[10px] text-white/70 font-semibold">Tổng giường ICU</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-3 py-3 border border-white/20">
              <div className="text-2xl font-black text-amber-300">{occupiedBeds}</div>
              <div className="text-[10px] text-amber-200/80 font-semibold">Đang có BN</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-3 py-3 border border-white/20">
              <div className="text-2xl font-black text-rose-300 animate-pulse">{criticalCount}</div>
              <div className="text-[10px] text-rose-200/80 font-semibold">Nặng/Nguy kịch</div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-3 py-3 border border-white/20">
              <div className="text-2xl font-black text-blue-300">{onVentilator}</div>
              <div className="text-[10px] text-blue-200/80 font-semibold">Thở máy</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {[
          { key: 'beds',     label: 'Sơ Đồ Giường ICU',       icon: BedDouble },
          { key: 'staff',    label: 'Nhân Sự Ca Trực',         icon: Users },
          { key: 'transfer', label: `Yêu Cầu Chuyển Khoa (${MOCK_TRANSFERS.length})`, icon: ArrowRight },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`py-3 px-5 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === key
                ? 'border-rose-600 text-rose-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ICU Bed Grid */}
      {activeTab === 'beds' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {MOCK_ICU_BEDS.map((bed) => {
            if (bed.status === 'empty' || bed.status === 'cleaning') {
              return (
                <div key={bed.bedId} className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center min-h-[160px] ${
                  bed.status === 'cleaning' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'
                }`}>
                  <BedDouble className={`w-8 h-8 mb-2 ${bed.status === 'cleaning' ? 'text-amber-400' : 'text-slate-300'}`} />
                  <div className="font-bold text-slate-600">{bed.bedCode}</div>
                  <div className="text-xs text-slate-400 mt-1">
                    {bed.status === 'cleaning' ? '🔄 Đang vệ sinh' : '✅ Sẵn sàng tiếp nhận'}
                  </div>
                </div>
              );
            }
            const sevCfg = SEVERITY_CONFIG[bed.severity];
            return (
              <div key={bed.bedId} className={`bg-white border-2 rounded-2xl shadow-md overflow-hidden ring-2 ${sevCfg.ring}`}>
                <div className={`px-4 py-2.5 flex justify-between items-center ${bed.severity === 'very_critical' ? 'bg-rose-600' : bed.severity === 'critical' ? 'bg-orange-500' : 'bg-amber-400'}`}>
                  <span className="font-black text-white text-sm">{bed.bedCode}</span>
                  <span className="text-[10px] font-black text-white/90 uppercase">{sevCfg.label}</span>
                </div>
                <div className="p-4 space-y-2.5">
                  <div>
                    <div className="font-bold text-slate-900">{bed.patientName}</div>
                    <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{bed.diagnosis}</div>
                  </div>
                  {/* Vitals */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-2">
                    <div className="text-center">
                      <div className="flex items-center justify-center space-x-0.5 text-rose-500 mb-0.5">
                        <Heart className="w-3 h-3" />
                      </div>
                      <div className={`text-sm font-black ${(bed.latestHR ?? 0) > 100 ? 'text-rose-700' : 'text-slate-800'}`}>{bed.latestHR}</div>
                      <div className="text-[9px] text-slate-400">HR/ph</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center text-blue-500 mb-0.5">
                        <Activity className="w-3 h-3" />
                      </div>
                      <div className={`text-sm font-black ${(bed.latestSpO2 ?? 100) < 95 ? 'text-rose-700' : 'text-slate-800'}`}>{bed.latestSpO2}%</div>
                      <div className="text-[9px] text-slate-400">SpO₂</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center text-purple-500 mb-0.5">
                        <BarChart3 className="w-3 h-3" />
                      </div>
                      <div className={`text-sm font-black ${(bed.latestMap ?? 70) < 65 ? 'text-rose-700' : 'text-slate-800'}`}>{bed.latestMap}</div>
                      <div className="text-[9px] text-slate-400">MAP mmHg</div>
                    </div>
                  </div>
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1">
                    {bed.ventilator && (
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full">🫁 Thở máy</span>
                    )}
                    {bed.apacheScore !== null && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${bed.apacheScore >= 25 ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                        APACHE {bed.apacheScore}
                      </span>
                    )}
                  </div>
                  {/* Staff */}
                  <div className="flex justify-between text-xs text-slate-500 border-t border-slate-100 pt-2">
                    <span>👨‍⚕️ {bed.assignedPhysician}</span>
                    <span>👩‍⚕️ {bed.assignedNurse}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Staff Schedule */}
      {activeTab === 'staff' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-bold text-slate-800 text-sm">Ca Trực Sáng — {new Date().toLocaleDateString('vi-VN')}</h3>
            <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded-full border border-emerald-200">
              Đang hoạt động
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {MOCK_STAFF.map((s) => (
              <div key={s.id} className="px-5 py-4 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs text-white ${s.role === 'physician' ? 'bg-blue-600' : s.role === 'resident' ? 'bg-purple-600' : 'bg-teal-600'}`}>
                    {s.role === 'physician' ? 'BS' : s.role === 'resident' ? 'NT' : 'ĐD'}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{s.name}</div>
                    <div className="text-xs text-slate-500">Giường: {s.assignedBeds.join(', ')}</div>
                  </div>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.status === 'on_duty' ? 'bg-emerald-100 text-emerald-700' : s.status === 'break' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                  {s.status === 'on_duty' ? '✅ Đang trực' : s.status === 'break' ? '☕ Nghỉ giải lao' : '🔴 Đã hết ca'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transfer Requests */}
      {activeTab === 'transfer' && (
        <div className="space-y-4">
          {MOCK_TRANSFERS.map((t) => (
            <div key={t.id} className={`bg-white border rounded-xl p-5 shadow-sm ${t.status === 'pending' ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'}`}>
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="font-bold text-slate-800">{t.patientName}</div>
                  <div className="flex items-center space-x-2 text-xs text-slate-600">
                    <span className="font-semibold">{t.fromBed}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className="font-semibold">{t.toWard}</span>
                  </div>
                  <div className="text-xs text-slate-500">Lý do: {t.reason}</div>
                  <div className="text-xs text-slate-400">Yêu cầu bởi: {t.requestedBy} · {new Date(t.requestedAt).toLocaleString('vi-VN')}</div>
                </div>
                {t.status === 'pending' ? (
                  <div className="flex space-x-2 shrink-0">
                    <button className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow transition-all">
                      ✅ Duyệt
                    </button>
                    <button className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-semibold transition-all">
                      ✗ Từ chối
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full border border-emerald-200 shrink-0">
                    ✅ Đã duyệt
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
