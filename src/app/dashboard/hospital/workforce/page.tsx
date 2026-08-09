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
  Clock,
  BarChart3,
  PieChart,
  CalendarDays,
  Search,
  Filter,
  ChevronDown,
  GraduationCap,
  Award,
  Activity,
  AlertTriangle,
  Briefcase
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

const ROLE_CFG: Record<ClinicalRole, { label: string; labelVN: string; icon: React.ElementType; color: string; bg: string; border: string; textDark: string }> = {
  doctor:        { label: 'Physician',      labelVN: 'Bác sĩ',            icon: Stethoscope, color: 'text-blue-600',   bg: 'bg-blue-50/50',   border: 'border-blue-200',   textDark: 'text-blue-900' },
  specialist:    { label: 'Specialist',     labelVN: 'Chuyên khoa',        icon: Stethoscope, color: 'text-indigo-600', bg: 'bg-indigo-50/50', border: 'border-indigo-200', textDark: 'text-indigo-900' },
  head_nurse:    { label: 'Head Nurse',     labelVN: 'Điều dưỡng trưởng',  icon: HeartPulse,  color: 'text-rose-600',   bg: 'bg-rose-50/50',   border: 'border-rose-200',   textDark: 'text-rose-900' },
  nurse:         { label: 'Nurse',          labelVN: 'Điều dưỡng',         icon: HeartPulse,  color: 'text-pink-600',   bg: 'bg-pink-50/50',   border: 'border-pink-200',   textDark: 'text-pink-900' },
  pharmacist:    { label: 'Pharmacist',     labelVN: 'Dược sĩ',            icon: Pill,        color: 'text-emerald-600',bg: 'bg-emerald-50/50', border: 'border-emerald-200', textDark: 'text-emerald-900' },
  lab_tech:      { label: 'Lab Technician', labelVN: 'KTV Xét nghiệm',     icon: FlaskConical,color: 'text-violet-600', bg: 'bg-violet-50/50', border: 'border-violet-200', textDark: 'text-violet-900' },
  radiologist:   { label: 'Radiologist',    labelVN: 'KTV CĐHA',           icon: Scan,        color: 'text-sky-600',    bg: 'bg-sky-50/50',    border: 'border-sky-200',    textDark: 'text-sky-900' },
  icu_specialist:{ label: 'ICU Specialist', labelVN: 'BS Hồi sức',         icon: HeartPulse,  color: 'text-orange-600', bg: 'bg-orange-50/50', border: 'border-orange-200', textDark: 'text-orange-900' },
  admin_staff:   { label: 'Admin Staff',    labelVN: 'Nhân viên hành chính',icon: UserCheck,   color: 'text-slate-600',  bg: 'bg-slate-50/50',  border: 'border-slate-200',  textDark: 'text-slate-900' },
};

const SHIFT_CFG: Record<ShiftType, { label: string; labelShort: string; color: string; border: string; bgGradient: string }> = {
  morning:   { label: 'Ca sáng (07:00–15:00)',  labelShort: 'Ca Sáng',  color: 'text-amber-800 bg-amber-50 border-amber-200', bgGradient: 'from-amber-50 to-amber-100/30' },
  afternoon: { label: 'Ca chiều (13:00–21:00)', labelShort: 'Ca Chiều', color: 'text-blue-800 bg-blue-50 border-blue-200',     bgGradient: 'from-blue-50 to-blue-100/30' },
  night:     { label: 'Ca đêm (21:00–07:00)',   labelShort: 'Ca Đêm',   color: 'text-violet-800 bg-violet-50 border-violet-200', bgGradient: 'from-violet-50 to-violet-100/30' },
  on_call:   { label: 'Trực phòng / Dự phòng',  labelShort: 'Trực Phòng',color: 'text-rose-800 bg-rose-50 border-rose-200', bgGradient: 'from-rose-50 to-rose-100/30' },
};

const STATUS_CFG: Record<StaffStatus, { label: string; color: string; dot: string; bg: string }> = {
  active:   { label: 'Đang trực',   color: 'text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', bg: 'bg-emerald-50' },
  on_leave: { label: 'Nghỉ phép',   color: 'text-amber-800 border-amber-200',   dot: 'bg-amber-500', bg: 'bg-amber-50' },
  on_call:  { label: 'Trực phòng',  color: 'text-rose-800 border-rose-200',    dot: 'bg-rose-500 animate-pulse', bg: 'bg-rose-50' },
  off_duty: { label: 'Ngoài ca',    color: 'text-slate-500 border-slate-200',   dot: 'bg-slate-400', bg: 'bg-slate-50' },
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

// Helper to get initials
function getInitials(name: string): string {
  const parts = name.split(' ');
  const last = parts[parts.length - 1];
  const first = parts[parts.length - 2] || parts[0];
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
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
    <div className="p-4 md:p-6 max-w-[1440px] mx-auto space-y-6">

      {/* ── Header: bright layout ── */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-indigo-50/50 rounded-2xl p-6 text-slate-800 shadow-md border border-slate-200/80 relative overflow-hidden">
        {/* Glowing backdrop elements */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                Bella General Hospital · HR Workforce Command
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight font-serif text-slate-900" style={{ color: '#0f172a' }}>
              Quản Lý Nhân Sự Lâm Sàng
            </h1>
            <p className="text-[12px] text-slate-500 mt-1 font-semibold">
              Giám sát ca trực của Bác sĩ · Điều dưỡng · Dược sĩ lâm sàng · Kỹ thuật viên LIS/PACS và đội ngũ Hành chính
            </p>
          </div>

          {/* Top KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            {[
              { value: activeCount, label: 'Đang trực', color: 'text-emerald-600', bg: 'bg-emerald-50/60 border-emerald-200' },
              { value: onLeaveCount, label: 'Nghỉ phép', color: 'text-amber-600', bg: 'bg-amber-50/60 border-amber-200' },
              { value: HOSPITAL_STAFF.length, label: 'Tổng NS', color: 'text-indigo-600', bg: 'bg-indigo-50/40 border-indigo-200' },
              { value: totalLoad, label: 'BN Đang Quản Lý', color: 'text-rose-600', bg: 'bg-rose-50/60 border-rose-200' }
            ].map(({ value, label, color, bg }) => (
              <div key={label} className={`text-center ${bg} border rounded-xl px-4.5 py-3.5 shadow-sm hover:scale-[1.02] hover:shadow-md transition-all duration-150`}>
                <div className={`text-2xl font-black ${color}`}>{value}</div>
                <div className="text-[9px] text-slate-500 font-extrabold uppercase mt-1 tracking-wider">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2-Col: Clinical Role Distribution & Dept breakdown ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Clinical Role Distribution */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">Phân Bố Vai Trò Lâm Sàng</h2>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              {roleSummary.sort((a, b) => b.count - a.count).map(({ role, count }) => {
                const cfg = ROLE_CFG[role];
                const Icon = cfg.icon;
                const total = HOSPITAL_STAFF.length;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={role} className={`border rounded-xl p-3.5 flex items-start gap-3.5 transition-all hover:scale-[1.01] hover:shadow-sm ${cfg.bg} ${cfg.border}`}>
                    <div className="p-2.5 rounded-lg bg-white shadow-sm border border-slate-100/50 shrink-0">
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[10px] font-black uppercase tracking-wide ${cfg.color}`}>{cfg.labelVN}</div>
                      <div className="text-2xl font-black text-slate-900 mt-0.5">{count}</div>
                      <div className="text-[9px] text-slate-500 font-bold">{pct}% tổng nhân sự</div>
                      {/* mini progress bar */}
                      <div className="h-1 bg-slate-200/80 rounded-full mt-2 overflow-hidden">
                        <div className={`h-full rounded-full bg-current ${cfg.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Department Allocation */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">Phân Bố Theo Khoa Lâm Sàng</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {deptSummary.sort((a, b) => b.count - a.count).map(({ dept, count }) => {
              const pct = Math.round((count / HOSPITAL_STAFF.length) * 100);
              return (
                <div key={dept} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/40 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 truncate">{dept}</div>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden w-full max-w-[200px]">
                      <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base font-black text-slate-900">{count}</span>
                    <span className="text-[9px] text-slate-400 font-bold block">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Staff Directory Table with Avatars ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        
        {/* Search & Filter Operations */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-indigo-600" />
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Danh Sách Nhân Sự ({filtered.length}/{HOSPITAL_STAFF.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên, khoa phòng..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/50 w-full sm:w-56 transition-all"
              />
            </div>

            {/* Role filter */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as ClinicalRole | 'all')}
                className="pl-8 pr-8 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/50 appearance-none bg-white font-semibold text-slate-700 cursor-pointer"
              >
                <option value="all">Tất cả vai trò</option>
                {(Object.keys(ROLE_CFG) as ClinicalRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_CFG[r].labelVN}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>

            {/* Status filter */}
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as StaffStatus | 'all')}
                className="px-3.5 pr-8 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/50 appearance-none bg-white font-semibold text-slate-700 cursor-pointer"
              >
                <option value="all">Tất cả trạng thái</option>
                {(Object.keys(STATUS_CFG) as StaffStatus[]).map((s) => (
                  <option key={s} value={s}>{STATUS_CFG[s].label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Staff Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <th className="px-5 py-3.5 text-left">Nhân viên</th>
                <th className="px-3 py-3.5 text-left">Vai trò</th>
                <th className="px-3 py-3.5 text-left">Khoa / Phòng</th>
                <th className="px-3 py-3.5 text-left">Ca trực</th>
                <th className="px-3 py-3.5 text-center">Trạng thái</th>
                <th className="px-3 py-3.5 text-center">BN quản lý</th>
                <th className="px-3 py-3.5 text-left">Chứng chỉ</th>
                <th className="px-5 py-3.5 text-right">Thâm niên</th>
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
                    {/* Name + Avatar + Qualification */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {/* Letter Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-sm ${
                          staff.role === 'icu_specialist' || staff.role === 'doctor' || staff.role === 'specialist' ? 'bg-blue-600' :
                          staff.role === 'head_nurse' || staff.role === 'nurse' ? 'bg-rose-500' : 'bg-teal-600'
                        }`}>
                          {getInitials(staff.name)}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-sm">{staff.name}</div>
                          <div className="text-[10px] text-slate-500 font-semibold mt-0.5 flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                            {staff.qualifications}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="px-3 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${roleCfg.bg} ${roleCfg.border} ${roleCfg.color}`}>
                        <RoleIcon className="w-3.5 h-3.5 shrink-0" />
                        {roleCfg.labelVN}
                      </span>
                    </td>
                    {/* Department */}
                    <td className="px-3 py-3.5 text-slate-700 font-bold">{staff.department}</td>
                    {/* Shift */}
                    <td className="px-3 py-3.5">
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${shiftCfg.color}`}>
                        {shiftCfg.labelShort}
                      </span>
                    </td>
                    {/* Status */}
                    <td className="px-3 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${statusCfg.bg} ${statusCfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                        {statusCfg.label}
                      </span>
                    </td>
                    {/* Patient Load */}
                    <td className="px-3 py-3.5 text-center">
                      {staff.patientLoad > 0 ? (
                        <div className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-rose-50 border border-rose-100 text-rose-800 font-black text-xs">
                          {staff.patientLoad}
                        </div>
                      ) : (
                        <span className="text-slate-300 font-bold">—</span>
                      )}
                    </td>
                    {/* Certifications */}
                    <td className="px-3 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {staff.certifications.map((cert) => (
                          <span key={cert} className="text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Award className="w-2.5 h-2.5 text-indigo-500" />
                            {cert}
                          </span>
                        ))}
                        {staff.certifications.length === 0 && (
                          <span className="text-slate-300 font-bold">—</span>
                        )}
                      </div>
                    </td>
                    {/* Years */}
                    <td className="px-5 py-3.5 text-right text-slate-700 font-bold">
                      <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 text-xs">
                        {staff.yearsOfService} năm
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-xs font-bold bg-slate-50/50">
              Không tìm thấy nhân sự phù hợp với điều kiện tìm kiếm.
            </div>
          )}
        </div>
      </div>

      {/* ── Shift Coverage Overview Board ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <CalendarDays className="w-4.5 h-4.5 text-indigo-600" />
          <h2 className="text-xs font-black text-slate-800 uppercase tracking-wider">Bố Trí Ca Trực Hiện Tại</h2>
          <span className="ml-auto text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold">
            {new Date().toLocaleDateString('vi-VN')}
          </span>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {(['morning', 'afternoon', 'night', 'on_call'] as ShiftType[]).map((shift) => {
            const staff = HOSPITAL_STAFF.filter((s) => s.shift === shift && (s.status === 'active' || s.status === 'on_call'));
            const cfg = SHIFT_CFG[shift];
            return (
              <div key={shift} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col bg-white">
                {/* Board header */}
                <div className={`px-4 py-3 bg-gradient-to-r ${cfg.bgGradient} border-b border-slate-200`}>
                  <div className="text-[10px] font-black uppercase text-slate-800 tracking-wider">{cfg.labelShort}</div>
                  <div className="text-2xl font-black text-slate-900 mt-1 flex items-baseline gap-1">
                    {staff.length}
                    <span className="text-[10px] font-semibold text-slate-400">nhân sự</span>
                  </div>
                </div>
                {/* List */}
                <div className="divide-y divide-slate-100 flex-1">
                  {staff.slice(0, 4).map((s) => {
                    const roleCfg = ROLE_CFG[s.role];
                    const RoleIcon = roleCfg.icon;
                    return (
                      <div key={s.id} className="px-3.5 py-2.5 flex items-center gap-2 hover:bg-slate-50/40 transition-colors">
                        <span className={`p-1 rounded-md border ${roleCfg.bg} ${roleCfg.border} shrink-0`}>
                          <RoleIcon className={`w-3 h-3 ${roleCfg.color}`} />
                        </span>
                        <span className="text-[11px] text-slate-800 font-bold truncate flex-1">{s.name.split('.').pop()?.trim()}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      </div>
                    );
                  })}
                  {staff.length > 4 && (
                    <div className="px-3.5 py-2 text-[10px] text-slate-400 font-semibold italic text-center bg-slate-50/20">
                      + {staff.length - 4} nhân sự khác
                    </div>
                  )}
                  {staff.length === 0 && (
                    <div className="p-8 text-center text-slate-500 italic font-semibold text-[10px]">
                      Không có nhân sự trực
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Law 9 compliance notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-4 text-[11px] text-slate-500 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-extrabold text-slate-700 uppercase tracking-wide text-[10px]">Bella constitution compliance notice</div>
          <p className="leading-relaxed">
            <strong>Law 9 — Zero Regression:</strong> Trang này được cách ly hoàn toàn khỏi phân hệ Thẩm mỹ viện (beauty_spa).
            Tất cả dữ liệu lâm sàng, vai trò y tế và lịch trực được cấu hình khép kín trong tenant <code className="font-mono bg-slate-200 px-1 py-0.2 rounded text-[10px] text-slate-800">bella_hospital</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
