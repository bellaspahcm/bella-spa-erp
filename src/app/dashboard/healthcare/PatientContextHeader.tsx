'use client';

import React from 'react';
import { User, AlertTriangle, ShieldAlert, Stethoscope, Armchair, Hash, Calendar, HeartPulse, ChevronDown } from 'lucide-react';
import type { PatientInfo, DoctorInfo, ChairInfo } from '@/modules/bella-healthcare/types/encounter-aggregate';

export interface PatientContextHeaderProps {
  readonly patient: PatientInfo;
  readonly doctor?: DoctorInfo;
  readonly chair?: ChairInfo;
  readonly aggregateCode: string;
  readonly allPatients: PatientInfo[];
  readonly onSelectPatient: (patientId: string) => void;
}

export function PatientContextHeader({
  patient,
  doctor,
  chair,
  aggregateCode,
  allPatients,
  onSelectPatient,
}: PatientContextHeaderProps) {
  const patientInitials = patient.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const hasAllergies = patient.allergies && patient.allergies.length > 0;

  return (
    <div className="relative p-5 rounded-[26px] bg-gradient-to-r from-slate-900 via-slate-850 to-slate-950 text-white shadow-2xl border border-slate-800/90 backdrop-blur-md overflow-hidden">
      {/* Decorative ambient background accents */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        {/* Left Side: Active Patient Selector & Main Bio */}
        <div className="flex items-center gap-4.5">
          {/* Avatar Ring */}
          <div className="relative shrink-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 font-black text-lg flex items-center justify-center shadow-lg shadow-teal-500/20 ring-4 ring-white/10">
              {patientInitials}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-950"></span>
            </span>
          </div>

          {/* Patient Details & Selector Dropdown */}
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              {/* Patient Dropdown Selector */}
              <div className="relative inline-block group">
                <select
                  value={patient.id}
                  onChange={(e) => onSelectPatient(e.target.value)}
                  className="bg-slate-800/80 hover:bg-slate-800 text-white font-black text-lg pr-8 pl-3 py-1 rounded-xl border border-slate-700/80 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition-all"
                >
                  {allPatients.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white font-bold text-xs py-2">
                      {p.name} ({p.recordNumber})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-white transition-colors" />
              </div>

              <span className="px-2.5 py-0.5 rounded-lg bg-teal-500/20 text-teal-300 font-mono text-[11px] font-bold border border-teal-500/30">
                {patient.recordNumber}
              </span>
            </div>

            {/* Demographics & Blood Type */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 font-medium">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {patient.gender === 'male' ? 'Nam' : patient.gender === 'female' ? 'Nữ' : 'Khác'} • {patient.age} tuổi ({patient.dob})
              </span>
              {patient.bloodType && (
                <span className="px-2 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold text-[10px] border border-rose-500/30 flex items-center gap-1">
                  <HeartPulse className="w-3 h-3 text-rose-400" />
                  Nhóm máu {patient.bloodType}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Clinical Safety Alert Badge */}
        <div className="flex items-center gap-2">
          {hasAllergies ? (
            <div className="px-4 py-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 flex items-center gap-3 shadow-inner">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 animate-bounce" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-rose-300">Cảnh báo Lâm sàng (Allergies)</p>
                <p className="text-xs font-bold text-white">
                  Dị ứng: <span className="underline decoration-rose-400 underline-offset-2">{patient.allergies.join(', ')}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-2 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Không có tiền sử dị ứng
            </div>
          )}
        </div>

        {/* Right Side: Doctor, Chair & Aggregate Code Badge */}
        <div className="flex flex-wrap items-center gap-3 shrink-0 pt-3 xl:pt-0 border-t xl:border-t-0 border-slate-800">
          {/* Doctor Badge */}
          <div className="px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-teal-400" />
            <div className="text-left">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Bác sĩ phụ trách</span>
              <span className="text-xs font-bold text-white leading-tight">{doctor?.name || 'BS. Chưa chỉ định'}</span>
            </div>
          </div>

          {/* Chair Badge */}
          <div className="px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center gap-2">
            <Armchair className="w-4 h-4 text-amber-400" />
            <div className="text-left">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Ghế điều trị</span>
              <span className="text-xs font-bold text-white leading-tight">{chair?.code || 'Ghế #03 (Khu A)'}</span>
            </div>
          </div>

          {/* Aggregate Code Badge */}
          <div className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500/20 to-emerald-500/20 border border-teal-500/40 text-teal-300 flex items-center gap-2">
            <Hash className="w-4 h-4 text-teal-400" />
            <div className="text-left">
              <span className="text-[9px] font-black uppercase text-teal-400 block">Encounter Aggregate</span>
              <span className="text-xs font-mono font-bold text-white leading-tight">{aggregateCode}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
