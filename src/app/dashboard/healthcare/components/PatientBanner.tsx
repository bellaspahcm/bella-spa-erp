import React from 'react';
import { User, Clipboard, Heart, Award, ShieldCheck } from 'lucide-react';
import { ClinicalContextType } from './ClinicalContext';

export default function PatientBanner({ context }: { context: ClinicalContextType }) {
  const { patient, doctor } = context;

  const initials = patient.fullName.split(' ').map(n => n[0]).join('').slice(-2).toUpperCase();

  return (
    <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-950 via-slate-900 to-cyan-950 border-2 border-teal-500/40 shadow-xl text-white flex flex-wrap md:flex-nowrap justify-between items-center gap-5 text-left">
      <div className="flex items-center gap-4">
        {/* Bold Patient Avatar Monogram */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-600 text-white font-black text-xl flex items-center justify-center border-2 border-white/30 shadow-md shrink-0">
          {initials}
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white drop-shadow-sm">
              {patient.fullName}
            </h2>
            <span className="px-2.5 py-0.5 text-[10px] font-black rounded-lg bg-teal-400/20 text-teal-300 border border-teal-400/40 uppercase tracking-wide">
              {patient.gender === 'female' ? 'Nữ' : 'Nam'}
            </span>
            <span className="px-2 py-0.5 text-[9px] font-black rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> VNeID Đã Xác Thực
            </span>
          </div>

          <p className="text-xs text-slate-300 font-bold flex items-center gap-2">
            <span>Mã Hồ Sơ (MRN): <strong className="font-mono text-sm text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-md border border-cyan-500/30">#{patient.recordNumber}</strong></span>
            <span>•</span>
            <span>Ngày sinh: <strong className="text-white">{patient.dob}</strong></span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-200">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md shadow-2xs">
          <Heart className="w-4 h-4 text-rose-400 fill-rose-500/20" />
          <span>Nhóm máu: <strong className="text-white font-black">{patient.bloodType}</strong></span>
        </div>

        {patient.bhytCode && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 backdrop-blur-md text-emerald-200 shadow-2xs">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>Thẻ BHYT: <strong className="font-mono text-white tracking-wide">{patient.bhytCode}</strong> <span className="text-[10px] font-black text-emerald-300 bg-emerald-950 px-1.5 py-0.5 rounded">({patient.benefitRate}%)</span></span>
          </div>
        )}

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md shadow-2xs">
          <Clipboard className="w-4 h-4 text-cyan-300" />
          <span>BS Phụ Trách: <strong className="text-white">{doctor.name}</strong></span>
        </div>
      </div>
    </div>
  );
}
