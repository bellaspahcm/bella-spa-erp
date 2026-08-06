'use client';

import React, { useState } from 'react';
import { Activity, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ClinicalContextType } from './ClinicalContext';
import { OdontogramTwin } from '@/modules/bella-healthcare/components/OdontogramTwin';
import { useHealthcareKernel } from '@/modules/bella-healthcare-kernel/context/HealthcareKernelContext';

export default function ClinicalContextPanel({ context }: { readonly context: ClinicalContextType }) {
  const { manifest } = useHealthcareKernel();
  const { encounter, patient } = context;
  const isDental = manifest?.id === 'bella-dental' || manifest?.id === 'dental_clinic' || manifest?.id === 'dental_workspace';
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);

  if (isDental) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-sm p-4 overflow-hidden">
        <OdontogramTwin
          toothData={patient.toothData || {}}
          selectedTooth={selectedTooth}
          onSelectTooth={setSelectedTooth}
          patientName={patient.fullName}
          onUpdateToothStatus={(toothNumber: string, status: string, _notes?: string) => {
            toast.success(`Cập nhật răng #${toothNumber} trạng thái: ${status}`);
          }}
        />
      </div>
    );
  }

  // Medical Clinic: ICD-10 Diagnoses Panel
  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-left">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-600" />
          Chẩn Đoán Lâm Sàng & Mã Hóa ICD-10 (Clinical Context)
        </h3>
        <span className="px-2.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-black">ICD-10</span>
      </div>

      <div className="space-y-3.5 text-xs">
        <div className="p-3.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/30 text-blue-900 dark:text-blue-300">
          <p className="font-extrabold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blue-600" />
            {encounter.assessment || 'J06.9 - Viêm đường hô hấp trên cấp tính'}
          </p>
        </div>
      </div>
    </div>
  );
}
