'use client';

/**
 * Bella General Hospital — Workforce Management
 * 
 * Hospital-specific HR module. Roles: doctor, nurse, head_nurse,
 * pharmacist, lab_tech, radiologist, icu_specialist, admin_staff.
 *
 * ⚠ LAW 9 COMPLIANCE: This page is ISOLATED from beauty_spa & babycare tenants.
 * It does NOT share data with /dashboard/hr/workforce (SPA module).
 * All data is scoped to bella_hospital tenant with hospital clinical roles.
 */

import React, { useState } from 'react';
import {
  Users,
  Stethoscope,
  HeartPulse,
  FlaskConical,
  Scan,
  Pill,
  ShieldCheck,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Clock,
  BarChart3,
  PieChart,
  CalendarDays,
  Search,
  Filter,
  ChevronDown,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type ClinicalRole =
  | 'doctor'
  | 'specialist'
  | 'head_nurse'
  | 'nurse'
  | 'pharmacist'
  | 'lab_tech'
  | 'radiologist'
  | 'icu_specialist'
  | 'admin_staff';

type ShiftType = 'morning' | 'afternoon' | 'night' | 'on_call';
type StaffStatus = 'active' | 'on_leave' | 'on_call' | 'off_duty';

interface HospitalStaff {
  id: string;
  name: string;
  role: ClinicalRole;
  department: string;
  shift: ShiftType;
  status: StaffStatus;
  yearsOfService: number;
  qualifications: string;
  patientLoad: number;       // Current patients assigned
  certifications: string[];
}

// ─── Role Config ───────────────────────────────────────────────────────────────

const ROLE_CFG: Record<ClinicalRole, { label: string; labelVN: string; icon: React.ElementType; color: string; bg: string }> = {
  doctor:        { label: 'Physician',      labelVN: 'Bác sĩ',            icon: Stethoscope, color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  specialist:    { label: 'Specialist',     labelVN: 'Chuyên khoa',        icon: Stethoscope, color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  head_nurse:    { label: 'Head Nurse',     labelVN: 'Điều dưỡng trưởng',  icon: HeartPulse,  color: 'text-rose-700',   bg: 'bg-rose-50 border-rose-200' },
  nurse:         { label: 'Nurse',          labelVN: 'Điều dưỡng',         icon: HeartPulse,  color: 'text-pink-700',   bg: 'bg-pink-50 border-pink-200' },
  pharmacist:    { label: 'Pharmacist',     labelVN: 'Dược sĩ',            icon: Pill,        color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200' },
  lab_tech:      { label: 'Lab Technician', labelVN: 'KTV Xét nghiệm',     icon: FlaskConical,color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  radiologist:   { label: 'Radiologist',    labelVN: 'KTV CĐHA',           icon: Scan,        color: 'text-sky-700',    bg: 'bg-sky-50 border-sky-200' },
  icu_specialist:{ label: 'ICU Specialist', labelVN: 'BS Hồi sức',         icon: HeartPulse,  color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  admin_staff:   { label: 'Admin Staff',    labelVN: 'Nhân viên hành chính',icon: UserCheck,   color: 'text-slate-700',  bg: 'bg-slate-50 border-slate-200' },
};

const SHIFT_CFG: Record<ShiftType, { label: string; color: string }> = {
  morning:   { label: 'Ca sáng (07:00–15:00)',  color: 'text-amber-700 bg-amber-50' },
  afternoon: { label: 'Ca chiều (13:00–21:00)', color: 'text-blue-700 bg-blue-50' },
  night:     { label: 'Ca đêm (21:00–07:00)',   color: 'text-violet-700 bg-violet-50' },
  on_call:   { label: 'Trực phòng',             color: 'text-rose-700 bg-rose-50' },
};

const STATUS_CFG: Record<StaffStatus, { label: string; color: string; dot: string }> = {
  active:   { label: 'Đang trực',   color: 'text-emerald-700', dot: 'bg-emerald-500' },
  on_leave: { label: 'Nghỉ phép',   color: 'text-amber-700',   dot: 'bg-amber-500' },
  on_call:  { label: 'Trực phòng',  color: 'text-rose-700',    dot: 'bg-rose-500 animate-pulse' },
  off_duty: { label: 'Ngoài ca',    color: 'text-slate-500',   dot: 'bg-slate-300' },
};

// ─── Mock Staff Data (Hospital Clinical Roles) ─────────────────────────────────
const HOSPITAL_STAFF: HospitalStaff[] = [
  { id: 'staff-001', name: 'PGS.TS. Lê Minh Khoa',     role: 'icu_specialist', department: 'Hồi sức tích cực (ICU)', shift: 'on_call',   status: 'on_call',  yearsOfService: 18, qualifications: 'Chuyên khoa II Hồi sức', patientLoad: 4, certifications: ['ACLS', 'ATLS', 'FCCS'] },
  { id: 'staff-002', name: 'TS. Nguyễn Thu Hương',      role: 'specialist',    department: 'Nội khoa tổng hợp',      shift: 'morning',   status: 'active',   yearsOfService: 12, qualifications: 'Thạc sĩ Y khoa', patientLoad: 8, certifications: ['ACLS'] },
  { id: 'staff-003', name: 'BS. Trần Bá Long',          role: 'doctor',        department: 'Ngoại khoa',             shift: 'morning',   status: 'active',   yearsOfService: 7,  qualifications: 'Bác sĩ Đa khoa', patientLoad: 6, certifications: ['ATLS'] },
  { id: 'staff-004', name: 'ĐD. Trưởng Nguyễn Lan Anh', role: 'head_nurse',   department: 'Hồi sức tích cực (ICU)', shift: 'morning',   status: 'active',   yearsOfService: 14, qualifications: 'Cử nhân Điều dưỡng', patientLoad: 6, certifications: ['ACLS', 'BLS'] },
  { id: 'staff-005', name: 'ĐD. Phạm Thị Bình',        role: 'nurse',         department: 'Nội khoa tổng hợp',      shift: 'morning',   status: 'active',   yearsOfService: 5,  qualifications: 'Cử nhân Điều dưỡng', patientLoad: 4, certifications: ['BLS'] },
  { id: 'staff-006', name: 'ĐD. Lê Quang Vinh',        role: 'nurse',         department: 'Hồi sức tích cực (ICU)', shift: 'night',     status: 'active',   yearsOfService: 3,  qualifications: 'Cử nhân Điều dưỡng', patientLoad: 2, certifications: ['BLS', 'ACLS'] },
  { id: 'staff-007', name: 'ĐD. Hoàng Minh Tuấn',      role: 'nurse',         department: 'Ngoại khoa',             shift: 'afternoon', status: 'active',   yearsOfService: 6,  qualifications: 'Cử nhân Điều dưỡng', patientLoad: 5, certifications: ['BLS'] },
  { id: 'staff-008', name: 'DS. Vũ Thị Thảo',          role: 'pharmacist',    department: 'Dược bệnh viện',         shift: 'morning',   status: 'active',   yearsOfService: 9,  qualifications: 'Dược sĩ ĐH', patientLoad: 0, certifications: ['Clinical Pharmacy'] },
  { id: 'staff-009', name: 'KTV. Bùi Văn Hà',          role: 'lab_tech',      department: 'Xét nghiệm (LIS)',       shift: 'morning',   status: 'active',   yearsOfService: 4,  qualifications: 'KTV XN Y học', patientLoad: 0, certifications: ['ISO 15189'] },
  { id: 'staff-010', name: 'KTV. Đỗ Thị Phương',       role: 'radiologist',   department: 'CĐHA & PACS',            shift: 'morning',   status: 'on_leave', yearsOfService: 6,  qualifications: 'KTV CĐHA', patientLoad: 0, certifications: ['PACS Operator'] },
  { id: 'staff-011', name: 'BS. Nguyễn Vân Khánh',     role: 'doctor',        department: 'Nội khoa tổng hợp',      shift: 'afternoon', status: 'active',   yearsOfService: 4,  qualifications: 'Bác sĩ ĐK', patientLoad: 7, certifications: [] },
  { id: 'staff-012', name: 'NV. Trần Minh Châu',       role: 'admin_staff',   department: 'Hành chính - Tiếp đón',  shift: 'morning',   status: 'active',   yearsOfService: 2,  qualifications: 'Cử nhân Quản trị', patientLoad: 0, certifications: [] },
];

// ─── Aggregate stats ───────────────────────────────────────────────────────────
function buildRoleSummary(staff: HospitalStaff[]) {
  const map = new Map<ClinicalRole, number>();
  staff.forEach((s) => map.set(s.role, (map.get(s.role) ?? 0) + 1));
  return Array.from(map.entries()).map(([role, count]) => ({ role, count }));
}

function buildDeptSummary(staff: HospitalStaff[]) {
  const map = new Map<string, number>();
  staff.forEach((s) => map.set(s.department, (map.get(s.department) ?? 0) + 1));
  return Array.from(map.entries()).map(([dept, count]) => ({ dept, count }));
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function HospitalWorkforcePage() {
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<ClinicalRole | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<StaffStatus | 'all'>('all');

  const filtered = HOSPITAL_STAFF.filter((s) => {
    const matchSearch =
      search === '' ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.department.toLowerCase().includes(search.toLowerCase());
    const matchRole   = filterRole === 'all' || s.role === filterRole;
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const roleSummary = buildRoleSummary(HOSPITAL_STAFF);
  const deptSummary = buildDeptSummary(HOSPITAL_STAFF);
  const activeCount = HOSPITAL_STAFF.filter((s) => s.status === 'active' || s.status === 'on_call').length;
  const onLeaveCount = HOSPITAL_STAFF.filter((s) => s.status === 'on_leave').length;
  const totalLoad = HOSPITAL_STAFF.reduce((sum, s) => sum + s.patientLoad, 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="bg-slate-950 text-white rounded-2xl px-6 py-4 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              Bella General Hospital · HR Module
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black">Quản Lý Nhân Sự Bệnh Viện</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Bác sĩ · Điều dưỡng · Dược sĩ · KTV Xét nghiệm · KTV CĐHA · Hành chính
          </p>
        </div>
        {/* Top KPIs */}
        <div className="flex gap-2 flex-wrap shrink-0">
          <div className="bg-emerald-900/40 border border-emerald-800 rounded-xl px-4 py-2 text-center">
            <div className="text-xl font-black text-emerald-300">{activeCount}</div>
            <div className="text-[9px] text-emerald-500 font-bold uppercase">Đang trực</div>
          </div>
          <div className="bg-amber-900/30 border border-amber-800 rounded-xl px-4 py-2 text-center">
            <div className="text-xl font-black text-amber-300">{onLeaveCount}</div>
            <div className="text-[9px] text-amber-500 font-bold uppercase">Nghỉ phép</div>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-center">
            <div className="text-xl font-black text-slate-300">{HOSPITAL_STAFF.length}</div>
            <div className="text-[9px] text-slate-500 font-bold uppercase">Tổng NS</div>
          </div>
          <div className="bg-rose-900/30 border border-rose-800 rounded-xl px-4 py-2 text-center">
            <div className="text-xl font-black text-rose-300">{totalLoad}</div>
            <div className="text-[9px] text-rose-500 font-bold uppercase">BN đang quản lý</div>
          </div>
        </div>
      </div>

      {/* ── 2-Col: Charts left, Dept right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Role Distribution */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-black text-slate-700 uppercase">Phân Bố Vai Trò Lâm Sàng</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {roleSummary.sort((a, b) => b.count - a.count).map(({ role, count }) => {
                const cfg = ROLE_CFG[role];
                const Icon = cfg.icon;
                const total = HOSPITAL_STAFF.length;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={role} className={`border rounded-xl p-3 flex items-start gap-3 ${cfg.bg}`}>
                    <div className={`p-2 rounded-lg bg-white/70`}>
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="min-w-0">
                      <div className={`text-[10px] font-black uppercase ${cfg.color}`}>{cfg.labelVN}</div>
                      <div className="text-2xl font-black text-slate-900">{count}</div>
                      <div className="text-[9px] text-slate-400 font-semibold">{pct}% tổng NS</div>
                      {/* mini bar */}
                      <div className="h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                        <div className={`h-full rounded-full bg-current ${cfg.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Department Summary */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-black text-slate-700 uppercase">Phân Bổ Theo Khoa</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {deptSummary.sort((a, b) => b.count - a.count).map(({ dept, count }) => {
              const pct = Math.round((count / HOSPITAL_STAFF.length) * 100);
              return (
                <div key={dept} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-700 truncate">{dept}</div>
                    <div className="h-1 bg-slate-100 rounded-full mt-1 overflow-hidden w-28">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-sm font-black text-slate-900 shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Staff Directory ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase">
            <Users className="w-4 h-4 text-indigo-600" />
            Danh Sách Nhân Sự ({filtered.length}/{HOSPITAL_STAFF.length})
          </div>
          <div className="flex-1" />
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, khoa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 w-44"
            />
          </div>
          {/* Role filter */}
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as ClinicalRole | 'all')}
              className="pl-7 pr-6 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 appearance-none bg-white"
            >
              <option value="all">Tất cả vai trò</option>
              {(Object.keys(ROLE_CFG) as ClinicalRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_CFG[r].labelVN}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>
          {/* Status filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StaffStatus | 'all')}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-400 appearance-none bg-white"
            >
              <option value="all">Tất cả trạng thái</option>
              {(Object.keys(STATUS_CFG) as StaffStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_CFG[s].label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Staff Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <th className="px-5 py-3 text-left">Nhân viên</th>
                <th className="px-3 py-3 text-left">Vai trò</th>
                <th className="px-3 py-3 text-left">Khoa / Phòng</th>
                <th className="px-3 py-3 text-left">Ca trực</th>
                <th className="px-3 py-3 text-center">Trạng thái</th>
                <th className="px-3 py-3 text-center">BN quản lý</th>
                <th className="px-3 py-3 text-left">Chứng chỉ</th>
                <th className="px-3 py-3 text-right">Thâm niên</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((staff) => {
                const roleCfg = ROLE_CFG[staff.role];
                const RoleIcon = roleCfg.icon;
                const statusCfg = STATUS_CFG[staff.status];
                const shiftCfg = SHIFT_CFG[staff.shift];
                return (
                  <tr key={staff.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Name + Qualification */}
                    <td className="px-5 py-3">
                      <div className="font-extrabold text-slate-900">{staff.name}</div>
                      <div className="text-[10px] text-slate-400">{staff.qualifications}</div>
                    </td>
                    {/* Role */}
                    <td className="px-3 py-3">
                      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold ${roleCfg.bg} ${roleCfg.color}`}>
                        <RoleIcon className="w-3 h-3" />
                        {roleCfg.labelVN}
                      </div>
                    </td>
                    {/* Department */}
                    <td className="px-3 py-3 text-slate-600 font-semibold">{staff.department}</td>
                    {/* Shift */}
                    <td className="px-3 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${shiftCfg.color}`}>
                        {shiftCfg.label}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-3 py-3 text-center">
                      <div className={`inline-flex items-center gap-1.5 text-[10px] font-bold ${statusCfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                        {statusCfg.label}
                      </div>
                    </td>
                    {/* Patient Load */}
                    <td className="px-3 py-3 text-center">
                      {staff.patientLoad > 0 ? (
                        <span className="font-black text-slate-800">{staff.patientLoad}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    {/* Certifications */}
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {staff.certifications.slice(0, 2).map((cert) => (
                          <span key={cert} className="text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-full">
                            {cert}
                          </span>
                        ))}
                        {staff.certifications.length > 2 && (
                          <span className="text-[9px] text-slate-400">+{staff.certifications.length - 2}</span>
                        )}
                      </div>
                    </td>
                    {/* Years */}
                    <td className="px-5 py-3 text-right text-slate-500 font-semibold">
                      {staff.yearsOfService} năm
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xs font-semibold">
              Không tìm thấy nhân sự phù hợp với điều kiện lọc.
            </div>
          )}
        </div>
      </div>

      {/* ── Shift Coverage Overview ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-indigo-600" />
          <h2 className="text-xs font-black text-slate-700 uppercase">Bố Trí Ca Trực Hiện Tại</h2>
          <span className="ml-auto text-[9px] text-slate-400">08/08/2026</span>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['morning', 'afternoon', 'night', 'on_call'] as ShiftType[]).map((shift) => {
            const staff = HOSPITAL_STAFF.filter((s) => s.shift === shift && (s.status === 'active' || s.status === 'on_call'));
            const cfg = SHIFT_CFG[shift];
            return (
              <div key={shift} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className={`px-3 py-2 ${cfg.color} border-b border-slate-200`}>
                  <div className="text-[10px] font-black uppercase">{cfg.label}</div>
                  <div className="text-lg font-black">{staff.length} người</div>
                </div>
                <div className="divide-y divide-slate-100">
                  {staff.slice(0, 4).map((s) => {
                    const roleCfg = ROLE_CFG[s.role];
                    return (
                      <div key={s.id} className="px-3 py-1.5 flex items-center gap-1.5">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${roleCfg.bg} ${roleCfg.color}`}>
                          {roleCfg.label.slice(0, 3).toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-700 font-semibold truncate">{s.name.split('.').pop()?.trim()}</span>
                      </div>
                    );
                  })}
                  {staff.length > 4 && (
                    <div className="px-3 py-1.5 text-[10px] text-slate-400">+{staff.length - 4} khác</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Law 9 compliance notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[10px] text-slate-400 flex items-start gap-2">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
        <span>
          <strong>Law 9 — Zero Regression:</strong> Trang này chỉ hiển thị nhân sự bệnh viện (Bác sĩ, Điều dưỡng, KTV...).
          Dữ liệu hoàn toàn tách biệt khỏi module HR của beauty_spa (KTV, ktv_lead).
          Route: <code className="font-mono">/dashboard/hospital/workforce</code>
        </span>
      </div>
    </div>
  );
}
