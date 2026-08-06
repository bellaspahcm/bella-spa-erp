'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Users, PlusCircle, CheckCircle, RefreshCw, AlertTriangle, ShieldCheck, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/user-context';
import { useTenantContext } from '@/core/hooks/useTenantContext';

import { ClinicalPipeline, type EncounterItem } from './ClinicalPipeline';
import { OdontogramTwin, type ToothData, type ToothStatus } from '@/modules/bella-healthcare/components/OdontogramTwin';
import { AiClinicalPanel } from '@/modules/bella-healthcare/components/AiClinicalPanel';

import { eventBus } from '@/platform/messaging/event-bus/event-bus';

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

  // Persistent initial setup
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check localStorage first for persisted encounters & patients
      let loadedEncounters: EncounterItem[] | null = null;
      let loadedPatients: PatientRecord[] | null = null;

      if (typeof window !== 'undefined') {
        const savedEnc = localStorage.getItem('bella_healthcare_encounters');
        const savedPat = localStorage.getItem('bella_healthcare_patients');
        if (savedEnc) {
          try {
            loadedEncounters = JSON.parse(savedEnc);
          } catch (e) {
            console.error('Failed to parse saved encounters', e);
          }
        }
        if (savedPat) {
          try {
            loadedPatients = JSON.parse(savedPat);
          } catch (e) {
            console.error('Failed to parse saved patients', e);
          }
        }
      }

      // Simulate slight network request for smooth UX
      await new Promise((resolve) => setTimeout(resolve, 400));

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

      const finalPatients = loadedPatients || mockPatients;
      const finalEncounters = loadedEncounters || mockEncounters;

      setPatients(finalPatients);
      setEncounters(finalEncounters);

      if (typeof window !== 'undefined') {
        if (!loadedPatients) localStorage.setItem('bella_healthcare_patients', JSON.stringify(mockPatients));
        if (!loadedEncounters) localStorage.setItem('bella_healthcare_encounters', JSON.stringify(mockEncounters));
      }

      // Select first patient & encounter by default
      if (finalPatients.length > 0) setSelectedPatientId(finalPatients[0].id);
      if (finalEncounters.length > 0) setSelectedEncounterId(finalEncounters[0].id);

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
    toast.success('Dữ liệu phòng khám đã đồng bộ thành công');
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

  // Update tooth status on selected patient's odontogram & persist to localStorage & EventBus
  const handleUpdateToothStatus = (toothNumber: string, status: ToothStatus, notes?: string) => {
    if (!selectedPatientId) return;

    setPatients((prev) => {
      const updated = prev.map((p) => {
        if (p.id === selectedPatientId) {
          const updatedToothData = {
            ...p.toothData,
            [toothNumber]: { status, notes },
          };
          return { ...p, toothData: updatedToothData };
        }
        return p;
      });
      if (typeof window !== 'undefined') {
        localStorage.setItem('bella_healthcare_patients', JSON.stringify(updated));
      }
      return updated;
    });

    // Publish telemetry event to platform EventBus
    eventBus.publish({
      id: `evt-tooth-${Date.now()}`,
      name: 'odontogram.tooth_updated',
      timestamp: new Date().toISOString(),
      tenantId: tenantContext?.tenantId || undefined,
      payload: {
        patientId: selectedPatientId,
        toothNumber,
        status,
        notes,
      },
    });

    toast.success(`Cập nhật răng #${toothNumber} trạng thái: ${status}`);
  };

  // Move patient step in Clinical Pipeline & persist to localStorage & EventBus
  const handleUpdateEncounterStatus = (id: string, newStatus: EncounterItem['status']) => {
    setEncounters((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e));
      if (typeof window !== 'undefined') {
        localStorage.setItem('bella_healthcare_encounters', JSON.stringify(updated));
      }
      return updated;
    });

    // Publish transition event to platform EventBus
    eventBus.publish({
      id: `evt-enc-${Date.now()}`,
      name: 'encounter.status_changed',
      timestamp: new Date().toISOString(),
      tenantId: tenantContext?.tenantId || undefined,
      payload: {
        encounterId: id,
        newStatus,
      },
    });

    const statusLabels: Record<EncounterItem['status'], string> = {
      planned: 'Lên lịch hẹn',
      arrived: 'Phòng chờ (Queue)',
      in_progress: 'Đang điều trị',
      finished: 'Đã hoàn tất',
    };
    toast.success(`Đã di chuyển lượt khám sang: ${statusLabels[newStatus] || newStatus}`);
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
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Ambient background mesh glow effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Executive Header section */}
      <div className="relative p-6 md:p-7 rounded-[28px] hc-glass-card hc-glass-card-hover flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-200/90 dark:border-slate-800/90 shadow-xl">
        <div className="flex items-center gap-5">
          {/* Doctor Monogram Avatar with Ring */}
          <div className="relative group">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 text-white font-extrabold text-xl shadow-lg shadow-teal-500/25 ring-4 ring-teal-500/20 dark:ring-teal-500/30">
              {monogram}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="hc-pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white dark:border-slate-950"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                Vận hành Thời gian thực
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                Lâm sàng Digital Twin
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Bác sĩ lâm sàng: <span className="text-teal-600 dark:text-teal-400 font-black">{user?.full_name || 'Lê Minh'}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Trung tâm điều hành y tế <span className="font-bold text-slate-700 dark:text-slate-200">{tenantContext?.tenantName || 'Bella Healthcare Clinic'}</span>
            </p>
          </div>
        </div>

        {/* Header Action Toolbar */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">Trạng thái hệ thống</span>
            <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Đồng bộ 100%
            </span>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs shadow-md shadow-slate-900/10 transition-all active:scale-95 disabled:opacity-50"
            title="Đồng bộ dữ liệu phòng khám"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-400' : ''}`} />
            <span>{isRefreshing ? 'Đang đồng bộ...' : 'Làm mới'}</span>
          </button>
        </div>
      </div>

      {/* Analytical Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            label: 'Lên lịch hẹn',
            value: String(encounters.filter((e) => e.status === 'planned').length),
            trend: 'Tổng lượt hẹn',
            icon: Activity,
            color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-800/60',
          },
          {
            label: 'Đang điều trị',
            value: String(encounters.filter((e) => e.status === 'in_progress').length),
            trend: `${encounters.filter((e) => e.status === 'in_progress').length} ca ghế chính`,
            icon: Users,
            color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40 border-teal-200/60 dark:border-teal-800/60',
          },
          {
            label: 'Hoàn tất hôm nay',
            value: String(encounters.filter((e) => e.status === 'finished').length),
            trend: 'Đã khám xong',
            icon: CheckCircle,
            color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/60 dark:border-emerald-800/60',
          },
          {
            label: 'Phòng chờ (Queue)',
            value: String(encounters.filter((e) => e.status === 'arrived').length),
            trend: 'Bệnh nhân đã đến',
            icon: Heart,
            color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200/60 dark:border-amber-800/60',
          },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div
              key={i}
              className="relative p-5 rounded-[22px] hc-glass-card hc-glass-card-hover flex items-center justify-between border border-slate-200/80 dark:border-slate-800/80 group"
            >
              <div className="space-y-1 text-left">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-bold block tracking-wide">{stat.label}</span>
                <span className="text-3xl font-black tracking-tight text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {stat.value}
                </span>
                <span className="inline-block text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 mt-1">
                  {stat.trend}
                </span>
              </div>

              <div className={`p-3.5 rounded-2xl border shadow-sm ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                <Icon className="w-6 h-6" />
              </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
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

