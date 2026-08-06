import React from 'react';
import { User, Clipboard, Heart, Award } from 'lucide-react';
import { ClinicalContextType } from './ClinicalContext';

export default function PatientBanner({ context }: { context: ClinicalContextType }) {
  const { patient, doctor } = context;

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 border border-teal-500/20 shadow-md text-white flex flex-wrap md:flex-nowrap justify-between items-center gap-4 text-left">
      <div className="flex items-center gap-3.5">
        <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20 shrink-0">
          <User className="w-6 h-6" />
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black tracking-tight">{patient.fullName}</h2>
            <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase">
              {patient.gender === 'female' ? 'Nữ' : 'Nam'}
            </span>
          </div>
          <p className="text-xs text-slate-300 font-medium">
            MRN: <span className="font-mono font-bold text-teal-400">{patient.recordNumber}</span> • Ngày sinh: {patient.dob}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-300">
        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white/5 border border-white/10">
          <Heart className="w-3.5 h-3.5 text-rose-500" />
          <span>Nhóm máu: <strong className="text-white">{patient.bloodType}</strong></span>
        </div>

        {patient.bhytCode && (
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white/5 border border-white/10">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>BHYT: <strong className="font-mono text-white">{patient.bhytCode}</strong> <span className="text-[10px] text-emerald-400">({patient.benefitRate}%)</span></span>
          </div>
        )}

        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-white/5 border border-white/10">
          <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
          <span>Bác sĩ phụ trách: <strong className="text-white">{doctor.name}</strong></span>
        </div>
      </div>
    </div>
  );
}
