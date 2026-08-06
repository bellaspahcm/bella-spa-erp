'use client';

import React from 'react';
import { User, ShieldAlert, Stethoscope, Armchair, Hash, HeartPulse } from 'lucide-react';
import type { PatientInfo, DoctorInfo, ChairInfo } from '@/modules/bella-healthcare/contexts/shared/domain-models';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

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

  const formatDob = (dobString?: string) => {
    if (!dobString) return '';
    const parts = dobString.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return dobString;
  };

  const getDisplayAge = () => {
    if (patient.age !== undefined && patient.age !== null && typeof patient.age === 'number' && patient.age > 0) {
      return patient.age;
    }
    if (!patient.dob) return 0;
    const birthDate = new Date(patient.dob);
    if (isNaN(birthDate.getTime())) return 0;
    const today = new Date();
    let computedAge = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      computedAge--;
    }
    return computedAge;
  };

  return (
    <div className="relative p-5 rounded-[26px] bg-white text-slate-900 shadow-md border border-slate-200/80">
      {/* Subtle soft decorative glows */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left Side: Active Patient Selector & Main Bio */}
        <div className="flex items-center gap-4.5 shrink-0">
          {/* Avatar Ring */}
          <div className="relative shrink-0">
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-slate-950 font-black text-lg flex items-center justify-center shadow-md ring-4 ring-slate-100">
              {patientInitials}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white"></span>
            </span>
          </div>

          {/* Patient Details & Selector Dropdown */}
          <div className="space-y-1 text-left">
            <div className="flex items-center gap-3">
              <PremiumSelect
                options={allPatients.map((p) => ({
                  value: p.id,
                  label: `${p.name}${p.recordNumber ? ` (${p.recordNumber})` : ''}`,
                }))}
                value={patient.id}
                onChange={onSelectPatient}
                placeholder="Chọn bệnh nhân..."
                buttonClassName="bg-slate-100 hover:bg-slate-200 text-slate-900 font-extrabold text-base px-3 py-1.5 rounded-xl border border-slate-200 transition-all hover:shadow-xs active:scale-[0.98] h-10 w-full"
                className="w-56"
              />

              <span className="px-2.5 py-0.5 rounded-lg bg-teal-50 text-teal-700 font-mono text-[11px] font-bold border border-teal-200/60">
                {patient.recordNumber}
              </span>
            </div>

            {/* Demographics & Blood Type */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-semibold">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" />
                {patient.gender === 'male' ? 'Nam' : patient.gender === 'female' ? 'Nữ' : 'Khác'} • {getDisplayAge()} tuổi ({formatDob(patient.dob)})
              </span>
              {patient.bloodType && (
                <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 font-bold text-[10px] border border-rose-200 flex items-center gap-1">
                  <HeartPulse className="w-3 h-3 text-rose-600" />
                  Nhóm máu {patient.bloodType}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Middle: Clinical Safety Alert Badge */}
        <div className="flex-1 flex justify-start lg:justify-center">
          {hasAllergies ? (
            <div className="px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3 shadow-xs">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 animate-bounce" />
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-wider text-rose-600">Cảnh báo Lâm sàng (Dị ứng)</p>
                <p className="text-xs font-bold text-rose-950">
                  Dị ứng: <span className="underline decoration-rose-500 underline-offset-2">{patient.allergies.join(', ')}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="px-3.5 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-2 text-xs font-bold shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Không có tiền sử dị ứng
            </div>
          )}
        </div>

        {/* Right Side: Structured Encounter Grid (Doctor, Chair & Aggregate Code) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-4 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800/60 lg:pl-6 shrink-0">
          {/* Doctor Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 flex items-center justify-center">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Bác sĩ phụ trách</span>
              <span className="text-xs font-extrabold text-slate-900 leading-tight">{doctor?.name || 'BS. Chưa chỉ định'}</span>
            </div>
          </div>

          {/* Chair Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Armchair className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Ghế điều trị</span>
              <span className="text-xs font-extrabold text-slate-900 leading-tight">{chair?.code || 'Chưa xếp ghế'}</span>
            </div>
          </div>

          {/* Aggregate Code Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Hash className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="text-[9px] font-bold text-slate-400 uppercase block">Mã ca khám</span>
              <span className="text-xs font-mono font-extrabold text-slate-900 leading-tight">{aggregateCode}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
