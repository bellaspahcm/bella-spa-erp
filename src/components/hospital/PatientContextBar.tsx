/**
 * PatientContextBar — Bella Hospital
 *
 * Architectural UX Invariant #1 (Phase B2):
 * "Mọi clinical workspace phải duy trì Patient Context xuyên suốt workflow."
 *
 * Dùng chung cho: MAR, Nursing Vitals, Care Pathway, LIS, PACS, ICU, EMR, Safety...
 * Khi chuyển EMR → Vitals → MAR → LIS → PACS: patient context KHÔNG được mất.
 */
'use client';

import React from 'react';
import { Bed, Building2, Calendar, ShieldAlert, ShieldCheck, Weight } from 'lucide-react';

export interface PatientContextData {
  name: string;
  gender: 'Nam' | 'Nữ' | 'Khác';
  age: number;
  mrn: string;
  bedCode: string;
  wardName: string;
  admitDay: number;
  allergies: string[];
  weight?: string;
  diagnosis?: string;
}

interface PatientContextBarProps {
  patient: PatientContextData;
  /** Optional label hiển thị workspace hiện tại, e.g. "MAR · Phiếu Thuốc" */
  workspace?: string;
  className?: string;
}

export function PatientContextBar({ patient, workspace, className = '' }: PatientContextBarProps) {
  const hasAllergies = patient.allergies.length > 0;
  const initials = patient.name
    .split(' ')
    .slice(-2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <div className={`bg-white border border-slate-200 rounded-xl px-5 py-3 shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Avatar + Name */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shadow shrink-0">
            {initials}
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm leading-tight">{patient.name}</div>
            <div className="text-[11px] text-slate-500 leading-tight">
              {patient.gender} · {patient.age}t · MRN: <span className="font-semibold text-indigo-600">{patient.mrn}</span>
            </div>
          </div>
        </div>

        {/* Clinical badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
            <Bed className="w-3 h-3" /> {patient.bedCode}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
            <Building2 className="w-3 h-3" /> {patient.wardName}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full">
            <Calendar className="w-3 h-3" /> Ngày {patient.admitDay}
          </span>
          {patient.weight && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
              <Weight className="w-3 h-3" /> {patient.weight}
            </span>
          )}

          {/* Allergy — most critical badge */}
          {hasAllergies ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded-full">
              <ShieldAlert className="w-3 h-3" />
              ⚠ Dị ứng: {patient.allergies.join(', ')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" />
              Không có dị ứng đã biết
            </span>
          )}
        </div>

        {/* Workspace label + Invariant label */}
        <div className="ml-auto flex flex-col items-end gap-0.5 shrink-0">
          {workspace && (
            <span className="text-[11px] font-semibold text-indigo-600">{workspace}</span>
          )}
          <span className="text-[10px] text-slate-300 italic">Persistent Patient Context</span>
        </div>
      </div>

      {/* Optional diagnosis */}
      {patient.diagnosis && (
        <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-600">Chẩn đoán:</span> {patient.diagnosis}
        </div>
      )}
    </div>
  );
}

/** Default patient for demo/mock — replace with real Encounter context */
export const BELLA_DEMO_PATIENT: PatientContextData = {
  name: 'Lê Thị Hương',
  gender: 'Nữ',
  age: 62,
  mrn: 'pat-001',
  bedCode: 'ICU-BED-01',
  wardName: 'Hồi sức Tích cực (ICU)',
  admitDay: 5,
  allergies: ['Penicillin', 'Sulfonamides'],
  weight: '58kg',
  diagnosis: 'Suy hô hấp cấp tiến triển — Theo dõi sau phẫu thuật',
};
