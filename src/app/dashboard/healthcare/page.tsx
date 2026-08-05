'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Users, PlusCircle, CheckCircle, RefreshCw, AlertTriangle, ShieldCheck, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/user-context';
import { useTenantContext } from '@/core/hooks/useTenantContext';

import { ClinicalPipeline, type EncounterItem } from './ClinicalPipeline';
import { OdontogramTwin, type ToothData, type ToothStatus } from '@/modules/bella-healthcare/components/OdontogramTwin';
import { AiClinicalPanel } from '@/modules/bella-healthcare/components/AiClinicalPanel';

// Simple types for client view
interface PatientRecord {
  readonly id: string;
  readonly name: string;
  readonly gender: 'male' | 'female' | 'other';
  readonly dob: string;
  readonly allergies: string[];
  readonly toothData: Record<string, ToothData>;
}

export default function HealthcareDashboardPage() {
  const { user } = useUser();
  const tenantContext = useTenantContext();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Core business states
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [encounters, setEncounters] = useState<EncounterItem[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);

  // Selected tooth
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);

  // Mock initial setup to show premium dynamic state immediately
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Simulate network request
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockPatients: PatientRecord[] = [
        {
          id: 'pat-01',
          name: 'Nguyễn Văn Hùng',
          gender: 'male',
          dob: '1995-10-12',
          allergies: ['penicillin'],
          toothData: {
            '16': { status: 'decayed', notes: 'Sâu mặt nhai lớn' },
            '36': { status: 'implanted', notes: 'Đã cắm Implant Nobel 2025' },
            '46': { status: 'missing', notes: 'Mất răng đã nhổ' },
          },
        },
        {
          id: 'pat-02',
          name: 'Lê Thị Mai',
          gender: 'female',
          dob: '2001-04-20',
          allergies: [],
          toothData: {
            '11': { status: 'crowned', notes: 'Bọc răng sứ thẩm mỹ Cercon' },
            '21': { status: 'crowned', notes: 'Bọc răng sứ thẩm mỹ Cercon' },
          },
        },
        {
          id: 'pat-03',
          name: 'Trần Minh Hoàng',
          gender: 'male',
          dob: '1988-08-15',
          allergies: ['aspirin'],
          toothData: {},
        },
      ];

      const mockEncounters: EncounterItem[] = [
        {
          id: 'enc-01',
          patientName: 'Nguyễn Văn Hùng',
          doctorName: 'Lê Minh',
          status: 'in_progress',
          chiefComplaint: 'Đau răng hàm trái',
          queueNumber: 102,
        },
        {
          id: 'enc-02',
          patientName: 'Lê Thị Mai',
          doctorName: 'Trần Thảo',
          status: 'arrived',
          chiefComplaint: 'Tái khám bọc sứ',
          queueNumber: 103,
        },
        {
          id: 'enc-03',
          patientName: 'Trần Minh Hoàng',
          doctorName: 'Lê Minh',
          status: 'planned',
          chiefComplaint: 'Nhổ răng khôn #38',
          scheduledAt: '2026-08-05T14:30:00Z',
        },
      ];

      setPatients(mockPatients);
      setEncounters(mockEncounters);
      
      // Select first patient & encounter by default
      setSelectedPatientId(mockPatients[0].id);
      setSelectedEncounterId(mockEncounters[0].id);

    } catch (err) {
      setError('Lỗi tải dữ liệu phòng khám');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadInitialData();
    setIsRefreshing(false);
    toast.success('Dữ liệu phòng khám đã đồng bộ');
  };

  // Find selected patient full info
  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || null;

  // Handle select encounter and automatically sync selected patient
  const handleSelectEncounter = (id: string) => {
    setSelectedEncounterId(id);
    const encounter = encounters.find((e) => e.id === id);
    if (encounter) {
      const patient = patients.find((p) => p.name === encounter.patientName);
      if (patient) {
        setSelectedPatientId(patient.id);
        setSelectedTooth(null); // clear tooth selection on patient switch
      }
    }
  };

  // Handle clinical safety check rule inference
  const handleRunClinicalCheck = async (allergies: string[], drugs: string[]) => {
    // Calling Platform Knowledge Engine evaluate rules API
    // We simulate the exact logic returned by public.evaluateRules
    await new Promise((resolve) => setTimeout(resolve, 600));

    const containsPenicillin = allergies.includes('penicillin');
    const prescribingAmoxicillin = drugs.includes('J01CA04') || drugs.includes('J01CR02');

    if (containsPenicillin && prescribingAmoxicillin) {
      return {
        triggered: true,
        warnings: [],
        blockers: ['Bệnh nhân dị ứng với kháng sinh nhóm Penicillin. Augmentin/Amoxicillin chống chỉ định tuyệt đối! Vui lòng chọn kháng sinh thay thế (ví dụ: Clindamycin).'],
      };
    }

    return {
      triggered: false,
      warnings: [],
      blockers: [],
    };
  };

  // Update tooth status on selected patient's odontogram
  const handleUpdateToothStatus = (toothNumber: string, status: ToothStatus, notes?: string) => {
    if (!selectedPatientId) return;

    setPatients((prev) =>
      prev.map((p) => {
        if (p.id === selectedPatientId) {
          const updatedToothData = {
            ...p.toothData,
            [toothNumber]: { status, notes },
          };
          return { ...p, toothData: updatedToothData };
        }
        return p;
      })
    );

    toast.success(`Cập nhật răng #${toothNumber} trạng thái: ${status}`);
  };

  // Move patient step in Clinical Pipeline
  const handleUpdateEncounterStatus = (id: string, newStatus: EncounterItem['status']) => {
    setEncounters((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
    );
    toast.info(`Di chuyển trạng thái khám: ${newStatus}`);
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6 animate-pulse">
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-40 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    );
  }

  const monogram = user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'BS';

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(20,184,166,0.12),0_4px_12px_-2px_rgba(20,184,166,0.06)] hover:-translate-y-0.5 transition-all duration-300">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 font-bold text-lg border border-teal-500/20 shadow-sm">
            {monogram}
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Bác sĩ lâm sàng: <span className="text-teal-600 font-extrabold">{user?.full_name || 'Lê Minh'}</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Trung tâm điều hành y tế <span className="font-semibold text-slate-700 dark:text-slate-200">{tenantContext?.tenantName || 'Bella Healthcare'}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center justify-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-300 transition-all active:scale-95 disabled:opacity-50"
            title="Đồng bộ dữ liệu phòng khám"
          >
            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-teal-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Analytical Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Hẹn hôm nay', value: '18', icon: Activity, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/20' },
          { label: 'Đang điều trị', value: '4', icon: Users, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/20' },
          { label: 'Hoàn tất hôm nay', value: '12', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20' },
          { label: 'Doanh thu phòng khám', value: '18.4M', icon: Heart, color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/20' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="relative overflow-hidden p-5 rounded-[20px] bg-gradient-to-br from-white to-teal-50/10 dark:from-slate-950 dark:to-slate-900/40 border border-slate-200 dark:border-slate-800/80 shadow-[0_4px_12px_-1px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.3)] hover:shadow-[0_16px_36px_-4px_rgba(20,184,166,0.12),0_4px_12px_-2px_rgba(20,184,166,0.06)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-[3px] before:bg-gradient-to-r before:from-teal-400 before:to-emerald-500"
            >
              <div className="space-y-1 text-left">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-bold block">{stat.label}</span>
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{stat.value}</span>
              </div>
              <span className={`p-3 rounded-xl ${stat.color}`}>
                <Icon className="w-5 h-5" />
              </span>
            </div>
          );
        })}
      </div>

      {/* Panel 1: Clinical Pipeline (Spans full width for clarity) */}
      <ClinicalPipeline
        encounters={encounters}
        onUpdateStatus={handleUpdateEncounterStatus}
        onSelectPatient={(pName) => {
          const pat = patients.find((p) => p.name === pName);
          if (pat) setSelectedPatientId(pat.id);
        }}
        selectedEncounterId={selectedEncounterId}
        onSelectEncounter={handleSelectEncounter}
      />

      {/* Digital Twin Panels: 2-column layout (Odontogram Twin & AI Safety Check Panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel 2: Odontogram Twin (Spans 2 columns) */}
        <div className="lg:col-span-2">
          <OdontogramTwin
            toothData={selectedPatient?.toothData || {}}
            selectedTooth={selectedTooth}
            onSelectTooth={setSelectedTooth}
            onUpdateToothStatus={handleUpdateToothStatus}
          />
        </div>

        {/* Panel 3: AI Clinical Decision & SOAP Assistant (Spans 1 column) */}
        <div>
          <AiClinicalPanel
            patientName={selectedPatient?.name || 'Chưa chọn'}
            patientAllergies={selectedPatient?.allergies || []}
            onRunClinicalCheck={handleRunClinicalCheck}
          />
        </div>
      </div>
    </div>
  );
}
