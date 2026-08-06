'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Users, CheckCircle, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/user-context';
import { useTenantContext } from '@/core/hooks/useTenantContext';

import { ClinicalPipeline, type EncounterItem } from './ClinicalPipeline';
import { OdontogramTwin, type ToothStatus } from '@/modules/bella-healthcare/components/OdontogramTwin';
import { AiClinicalPanel } from '@/modules/bella-healthcare/components/AiClinicalPanel';
import { PatientContextHeader } from './PatientContextHeader';
import { ClinicalTimeline } from './ClinicalTimeline';
import { EventStreamViewer } from './EventStreamViewer';
import { ChairManagementPanel } from './ChairManagementPanel';
import { CarePathTracker } from './CarePathTracker';
import { AiCooCommandCenter } from './AiCooCommandCenter';

import { eventBus } from '@/platform/messaging/event-bus/event-bus';
import { EncounterSaga } from '@/modules/bella-healthcare/contexts/shared/EncounterSaga';
import { aiRegistry } from '@/modules/bella-healthcare/contexts/shared/AiEngineRegistry';
import { TimelineProjectionService } from '@/modules/bella-healthcare/contexts/shared/ReadModelRepository';
import type {
  PatientInfo,
  ChairInfo,
  DomainEventStreamItem,
  CarePathStep,
  AiCooAction,
  ResourceUtilization,
  DomainEvent,
} from '@/modules/bella-healthcare/contexts/shared/domain-models';

export default function HealthcareDashboardPage() {
  const { user, userRole } = useUser();
  const tenantContext = useTenantContext();
  const [simulatedRole, setSimulatedRole] = useState<string | null>(null);

  const [_isLoading, setIsLoading] = useState<boolean>(true);
  const [_isRefreshing, _setIsRefreshing] = useState<boolean>(false);
  const [_error, setError] = useState<string | null>(null);

  // Core business states
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [encounters, setEncounters] = useState<EncounterItem[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);

  // Selected tooth
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);

  // Toggle state for IT admin auditing tools
  const [showDevTools, setShowDevTools] = useState<boolean>(false);

  // Event stream and outbox logs (Saga state)
  const [eventsList, setEventsList] = useState<DomainEvent[]>([]);
  const [eventStreamLog, setEventStreamLog] = useState<DomainEventStreamItem[]>([
    { id: 'evt-1', eventName: 'Scheduling.Appointment.Created.v1', timestamp: '09:00:12', description: 'Lịch hẹn được tạo thành công cho BN Nguyễn Văn Hùng', actor: 'Patient Portal', category: 'encounter' },
    { id: 'evt-2', eventName: 'Encounter.Patient.Arrived.v1', timestamp: '09:28:45', description: 'Bệnh nhân check-in tại quầy tiếp đón (Stt: #102)', actor: 'Receptionist Mai', category: 'encounter' },
    { id: 'evt-3', eventName: 'Resource.DoctorAssigned.v1', timestamp: '09:30:10', description: 'Chỉ định BS. Lê Minh phụ trách lượt khám #EC202600124', actor: 'Queue Manager', category: 'resource' },
    { id: 'evt-4', eventName: 'Clinical.Tooth.Updated.v1', timestamp: '09:46:18', description: 'Cập nhật tình trạng răng #36 (Deep Caries - Sâu ngà sâu)', actor: 'BS. Lê Minh', category: 'clinical' },
    { id: 'evt-5', eventName: 'Pharmacy.Prescription.Created.v1', timestamp: '09:48:02', description: 'Kê đơn thuốc y khoa Clindamycin 300mg', actor: 'BS. Lê Minh', category: 'prescription' },
  ]);

  const [chairsMatrix, setChairsMatrix] = useState<ChairInfo[]>([
    { id: 'ch-1', code: 'Ghế #01', zone: 'Khu A - Ghế chính', status: 'occupied', currentPatientName: 'Nguyễn Văn Hùng', currentDoctorName: 'BS. Lê Minh', estimatedMinutesRemaining: 15 },
    { id: 'ch-2', code: 'Ghế #02', zone: 'Khu A - Ghế chính', status: 'available' },
    { id: 'ch-3', code: 'Ghế #03', zone: 'Khu B - Phục hình', status: 'sanitizing' },
    { id: 'ch-4', code: 'Ghế #04', zone: 'Khu B - Phục hình', status: 'occupied', currentPatientName: 'Lê Thị Mai', currentDoctorName: 'BS. Trần Thảo', estimatedMinutesRemaining: 30 },
  ]);

  const [resourceMetrics, _setResourceMetrics] = useState<ResourceUtilization>({
    chairOccupancyRate: 82,
    doctorOccupancyRate: 91,
    avgWaitTimeMinutes: 12,
    totalEncountersToday: 18,
  });

  const carePathSteps: CarePathStep[] = [
    { stepNumber: 1, title: 'Consultation', subtitle: 'Tư vấn & Khám thám sát', status: 'completed', date: '2026-08-01' },
    { stepNumber: 2, title: 'CBCT Scan', subtitle: 'Chụp phim 3D CT ConeBeam', status: 'completed', date: '2026-08-03' },
    { stepNumber: 3, title: 'Implant Surgery', subtitle: 'Phẫu thuật cấy trụ Nobel', status: 'in_progress', date: 'Hôm nay' },
    { stepNumber: 4, title: 'Healing', subtitle: 'Tích hợp xương (3-6 tháng)', status: 'pending' },
    { stepNumber: 5, title: 'Abutment', subtitle: 'Lắp khớp nối Abutment', status: 'pending' },
    { stepNumber: 6, title: 'Crown', subtitle: 'Phục hình răng sứ Cercon', status: 'pending' },
    { stepNumber: 7, title: 'Recall', subtitle: 'Tái khám định kỳ 6 tháng', status: 'pending' },
  ];

  const [aiCooActions, setAiCooActions] = useState<AiCooAction[]>([
    {
      id: 'act-1',
      priority: 'high',
      category: 'chair',
      title: '⚡ Phân ghế khám trống',
      description: 'Ghế #02 (Khu A) đang trống. Gợi ý mời bệnh nhân Nguyễn Văn Hùng (Queue #102) vào vị trí ghế.',
      actionLabel: 'Phân ghế #02 ngay',
      actionType: 'assign_chair',
    },
    {
      id: 'act-2',
      priority: 'high',
      category: 'patient_wait',
      title: '⚡ Cảnh báo SLA — Thời gian chờ vượt ngưỡng',
      description: 'Bệnh nhân Lê Thị Mai đã ở phòng chờ >22 phút. Đề xuất phát thông báo ưu tiên cho BS. Trần Thảo.',
      actionLabel: 'Thông báo Bác sĩ',
      actionType: 'alert_doctor',
    },
  ]);

  // Persistent initial setup
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let loadedEncounters: EncounterItem[] | null = null;
      let loadedPatients: PatientInfo[] | null = null;
      let loadedChairs: ChairInfo[] | null = null;
      let loadedActions: AiCooAction[] | null = null;

      if (typeof window !== 'undefined') {
        const savedEnc = localStorage.getItem('bella_healthcare_encounters');
        const savedPat = localStorage.getItem('bella_healthcare_patients');
        const savedChairs = localStorage.getItem('bella_healthcare_chairs');
        const savedActions = localStorage.getItem('bella_healthcare_ai_actions');
        if (savedEnc) {
          try { loadedEncounters = JSON.parse(savedEnc); } catch (_e) {}
        }
        if (savedPat) {
          try { loadedPatients = JSON.parse(savedPat); } catch (_e) {}
        }
        if (savedChairs) {
          try { loadedChairs = JSON.parse(savedChairs); } catch (_e) {}
        }
        if (savedActions) {
          try { loadedActions = JSON.parse(savedActions); } catch (_e) {}
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 300));

      const mockPatients: PatientInfo[] = [
        {
          id: 'pat-01',
          recordNumber: 'BN000124',
          name: 'Nguyễn Văn Hùng',
          gender: 'male',
          dob: '1995-10-12',
          age: 31,
          bloodType: 'O+',
          allergies: ['penicillin'],
          phone: '0908 123 456',
          toothData: {
            '16': { status: 'decayed', notes: 'Sâu mặt nhai lớn' },
            '36': { status: 'implanted', notes: 'Đã cắm Implant Nobel 2025' },
            '46': { status: 'missing', notes: 'Mất răng đã nhổ' },
          },
        },
        {
          id: 'pat-02',
          recordNumber: 'BN000567',
          name: 'Lê Thị Mai',
          gender: 'female',
          dob: '2001-04-20',
          age: 25,
          bloodType: 'A+',
          allergies: [],
          phone: '0912 345 678',
          toothData: {
            '11': { status: 'crowned', notes: 'Bọc răng sứ thẩm mỹ Cercon' },
            '21': { status: 'crowned', notes: 'Bọc răng sứ thẩm mỹ Cercon' },
          },
        },
        {
          id: 'pat-03',
          recordNumber: 'BN000890',
          name: 'Trần Minh Hoàng',
          gender: 'male',
          dob: '1988-08-15',
          age: 38,
          allergies: ['aspirin'],
          toothData: {},
        },
      ];

      const mockEncounters: EncounterItem[] = [
        { id: 'enc-01', patientName: 'Nguyễn Văn Hùng', doctorName: 'Lê Minh', status: 'in_progress', chiefComplaint: 'Đau răng hàm trái', queueNumber: 102 },
        { id: 'enc-02', patientName: 'Lê Thị Mai', doctorName: 'Trần Thảo', status: 'arrived', chiefComplaint: 'Tái khám bọc sứ', queueNumber: 103 },
        { id: 'enc-03', patientName: 'Trần Minh Hoàng', doctorName: 'Lê Minh', status: 'planned', chiefComplaint: 'Nhổ răng khôn #38', queueNumber: 104, scheduledAt: '2026-08-05T14:30:00Z' },
      ];

      const mockChairs: ChairInfo[] = [
        { id: 'ch-1', code: 'Ghế #01', zone: 'Khu A - Ghế chính', status: 'occupied', currentPatientName: 'Nguyễn Văn Hùng', currentDoctorName: 'BS. Lê Minh', estimatedMinutesRemaining: 15 },
        { id: 'ch-2', code: 'Ghế #02', zone: 'Khu A - Ghế chính', status: 'available' },
        { id: 'ch-3', code: 'Ghế #03', zone: 'Khu B - Phục hình', status: 'sanitizing' },
        { id: 'ch-4', code: 'Ghế #04', zone: 'Khu B - Phục hình', status: 'occupied', currentPatientName: 'Lê Thị Mai', currentDoctorName: 'BS. Trần Thảo', estimatedMinutesRemaining: 30 },
      ];

      const mockActions: AiCooAction[] = [
        {
          id: 'act-1',
          priority: 'high',
          category: 'chair',
          title: '⚡ Phân ghế khám trống',
          description: 'Ghế #02 (Khu A) đang trống. Gợi ý mời bệnh nhân Nguyễn Văn Hùng (Queue #102) vào vị trí ghế.',
          actionLabel: 'Phân ghế #02 ngay',
          actionType: 'assign_chair',
        },
        {
          id: 'act-2',
          priority: 'high',
          category: 'patient_wait',
          title: '⚡ Cảnh báo SLA — Thời gian chờ vượt ngưỡng',
          description: 'Bệnh nhân Lê Thị Mai đã ở phòng chờ >22 phút. Đề xuất phát thông báo ưu tiên cho BS. Trần Thảo.',
          actionLabel: 'Thông báo Bác sĩ',
          actionType: 'alert_doctor',
        },
      ];

      const finalPatients = loadedPatients || mockPatients;
      const finalEncounters = loadedEncounters || mockEncounters;
      const finalChairs = loadedChairs || mockChairs;
      const finalActions = loadedActions || mockActions;

      setPatients(finalPatients);
      setEncounters(finalEncounters);
      setChairsMatrix(finalChairs);
      setAiCooActions(finalActions);

      if (typeof window !== 'undefined') {
        if (!loadedPatients) localStorage.setItem('bella_healthcare_patients', JSON.stringify(mockPatients));
        if (!loadedEncounters) localStorage.setItem('bella_healthcare_encounters', JSON.stringify(mockEncounters));
        if (!loadedChairs) localStorage.setItem('bella_healthcare_chairs', JSON.stringify(mockChairs));
        if (!loadedActions) localStorage.setItem('bella_healthcare_ai_actions', JSON.stringify(mockActions));
      }

      if (finalPatients.length > 0) setSelectedPatientId(finalPatients[0].id);
      if (finalEncounters.length > 0) setSelectedEncounterId(finalEncounters[0].id);
    } catch (_err) {
      setError('Lỗi tải dữ liệu phòng khám');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Run dynamic capacity forecasting using AI Prediction Engine
  useEffect(() => {
    const forecasted = aiRegistry.prediction.forecastUtilization(resourceMetrics.chairOccupancyRate);
    if (forecasted.warningText) {
      setAiCooActions((prev) => {
        if (prev.some((a) => a.id === 'act-prediction')) {
          return prev;
        }
        return [
          {
            id: 'act-prediction',
            priority: 'medium',
            category: 'capacity',
            title: '📈 AI Dự báo: Dự báo công suất quá tải',
            description: forecasted.warningText || '',
            actionLabel: 'Giãn lịch hẹn',
            actionType: 'reroute_queue',
          },
          ...prev,
        ];
      });
    } else {
      setAiCooActions((prev) => prev.filter((a) => a.id !== 'act-prediction'));
    }
  }, [resourceMetrics.chairOccupancyRate]);

  // Synchronize active encounter when patient is changed via top dropdown (Hybrid Reactivity)
  useEffect(() => {
    if (!selectedPatientId) return;
    const patient = patients.find((p) => p.id === selectedPatientId);
    if (patient) {
      const associatedEnc = encounters.find((e) => e.patientName === patient.name);
      if (associatedEnc && selectedEncounterId !== associatedEnc.id) {
        setSelectedEncounterId(associatedEnc.id);
      }
    }
  }, [selectedPatientId, patients, encounters, selectedEncounterId]);

  // Persist chairsMatrix and aiCooActions to localStorage on any state changes
  useEffect(() => {
    if (chairsMatrix.length > 0 && typeof window !== 'undefined') {
      localStorage.setItem('bella_healthcare_chairs', JSON.stringify(chairsMatrix));
    }
  }, [chairsMatrix]);

  useEffect(() => {
    if (aiCooActions.length > 0 && typeof window !== 'undefined') {
      localStorage.setItem('bella_healthcare_ai_actions', JSON.stringify(aiCooActions));
    }
  }, [aiCooActions]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0] || null;

  // Dynamically project active doctor, active chair, and aggregate code for selected patient
  const activeEncounter = selectedPatient
    ? encounters.find((e) => e.patientName === selectedPatient.name)
    : null;
  const activeChair = selectedPatient
    ? chairsMatrix.find((c) => c.currentPatientName === selectedPatient.name)
    : null;
  const displayDoctor = activeEncounter?.doctorName
    ? { id: 'doc-1', name: `BS. ${activeEncounter.doctorName}`, title: 'Bác sĩ điều trị' }
    : { id: 'doc-unassigned', name: 'BS. Chưa chỉ định', title: 'Nha sĩ' };
  const displayChair = activeChair
    ? { id: activeChair.id, code: activeChair.code, zone: activeChair.zone, status: activeChair.status }
    : { id: 'ch-none', code: 'Chưa xếp ghế', zone: 'Phòng tiếp đón', status: 'available' as const };
  const displayAggregateCode = activeEncounter
    ? `#EC202600${activeEncounter.queueNumber || '104'}`
    : '#EC202600000';

  // RBAC Permission Helpers
  const activeRole = simulatedRole || userRole || 'admin';
  const isAdmin = activeRole === 'admin';
  const isDoctor = activeRole === 'doctor' || activeRole === 'ktv_lead';
  const isAccountant = activeRole === 'accountant';
  const isNurse = activeRole === 'nurse' || activeRole === 'ktv';

  const handleSelectEncounter = (id: string) => {
    setSelectedEncounterId(id);
    const encounter = encounters.find((e) => e.id === id);
    if (encounter) {
      const patient = patients.find((p) => p.name === encounter.patientName);
      if (patient) {
        setSelectedPatientId(patient.id);
        setSelectedTooth(null);
      }
    }
  };

  const handleRunClinicalCheck = async (allergies: string[], drugs: string[]) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Delegate to safety engine
    return aiRegistry.safety.evaluatePrescriptionSafety(allergies, drugs);
  };

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

    // Create event using standardized naming contract and versioning
    const domainEvt: DomainEvent = {
      metadata: {
        eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        aggregateId: selectedPatientId,
        aggregateType: 'Patient',
        eventName: 'Clinical.Tooth.Updated.v1',
        tenantId: tenantContext?.tenantId || 'default',
        userId: user?.id,
        correlationId: `corr-${Date.now()}`,
        schemaVersion: 'v1',
        occurredAt: new Date().toISOString(),
      },
      payload: { toothNumber, status, notes },
    };

    // Route event through Saga Process Manager
    EncounterSaga.getInstance().handleEvent(domainEvt);
    setEventsList((prev) => [domainEvt, ...prev]);

    // Update operational log view
    const newStreamItem: DomainEventStreamItem = {
      id: domainEvt.metadata.eventId,
      eventName: domainEvt.metadata.eventName,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      description: `Cập nhật răng #${toothNumber} trạng thái: ${status}`,
      actor: user?.full_name || 'BS. Lê Minh',
      category: 'clinical',
    };
    setEventStreamLog((prev) => [newStreamItem, ...prev]);

    // Emit globally over platform EIP event bus
    eventBus.publish({
      id: domainEvt.metadata.eventId,
      name: domainEvt.metadata.eventName,
      timestamp: domainEvt.metadata.occurredAt,
      payload: domainEvt.payload,
    });

    toast.success(`Cập nhật răng #${toothNumber} trạng thái: ${status}`);
  };

  const handleUpdateEncounterStatus = (id: string, newStatus: EncounterItem['status']) => {
    setEncounters((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e));
      if (typeof window !== 'undefined') {
        localStorage.setItem('bella_healthcare_encounters', JSON.stringify(updated));
      }
      return updated;
    });

    const statusLabels: Record<EncounterItem['status'], string> = {
      planned: 'Lên lịch hẹn',
      arrived: 'Phòng chờ tiếp đón',
      in_progress: 'Đang điều trị',
      finished: 'Đã hoàn tất',
    };

    // Create event using standardized naming contract and versioning
    const domainEvt: DomainEvent = {
      metadata: {
        eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        aggregateId: id,
        aggregateType: 'Encounter',
        eventName: newStatus === 'finished' ? 'Encounter.Finished.v2' : 'Encounter.Patient.Arrived.v1',
        tenantId: tenantContext?.tenantId || 'default',
        userId: user?.id,
        correlationId: `corr-${Date.now()}`,
        schemaVersion: newStatus === 'finished' ? 'v2' : 'v1',
        occurredAt: new Date().toISOString(),
      },
      payload: { encounterId: id, newStatus },
    };

    // Route event through Saga Process Manager
    EncounterSaga.getInstance().handleEvent(domainEvt);
    setEventsList((prev) => [domainEvt, ...prev]);

    // Update operational log view
    const newStreamItem: DomainEventStreamItem = {
      id: domainEvt.metadata.eventId,
      eventName: domainEvt.metadata.eventName,
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      description: `Di chuyển lượt khám sang: ${statusLabels[newStatus] || newStatus}`,
      actor: user?.full_name || 'Bác sĩ/Tiếp đón',
      category: 'encounter',
    };
    setEventStreamLog((prev) => [newStreamItem, ...prev]);

    // Emit globally over platform EIP event bus
    eventBus.publish({
      id: domainEvt.metadata.eventId,
      name: domainEvt.metadata.eventName,
      timestamp: domainEvt.metadata.occurredAt,
      payload: domainEvt.payload,
    });

    toast.success(`Đã di chuyển lượt khám sang: ${statusLabels[newStatus] || newStatus}`);
  };

  // Dynamically project clinical timeline steps from the versioned Event Sourcing stream
  const dynamicTimelineSteps = TimelineProjectionService.projectTimeline(eventsList);

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Ambient background mesh glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Role Simulator Banner (For Dev/Test demonstration) */}
      <div className="relative p-4 rounded-3xl bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg border border-slate-800">
        <div className="space-y-1 text-left">
          <h2 className="text-sm font-black flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            Mô phỏng Phân quyền Lâm sàng & Vận hành (RBAC)
          </h2>
          <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
            Giao diện sẽ tự động điều chỉnh hiển thị và các quyền thao tác (Đọc/Ghi, y lệnh, kê đơn) dựa trên vai trò đang chọn.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {[
            { role: 'admin', label: '👑 Admin (Tổng quản)' },
            { role: 'doctor', label: '🩺 Bác sĩ (Doctor)' },
            { role: 'accountant', label: '📊 Kế toán (Accountant)' },
            { role: 'nurse', label: '💊 Điều dưỡng (Nurse)' },
          ].map((item) => {
            const isActive = activeRole === item.role;
            return (
              <button
                key={item.role}
                onClick={() => setSimulatedRole(item.role)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-slate-950 border-white shadow-md scale-105'
                    : 'bg-transparent text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Layer 1: Enterprise Patient Context Header */}
      {selectedPatient && (
        <PatientContextHeader
          patient={selectedPatient}
          doctor={displayDoctor}
          chair={displayChair}
          aggregateCode={displayAggregateCode}
          allPatients={patients}
          onSelectPatient={setSelectedPatientId}
        />
      )}

      {isAdmin && (
        <AiCooCommandCenter
          actions={aiCooActions}
          onExecuteAction={(actId, actionType) => {
            if (actionType === 'assign_chair') {
              setChairsMatrix((prev) =>
                prev.map((c) =>
                  c.id === 'ch-2'
                    ? {
                        ...c,
                        status: 'occupied',
                        currentPatientName: 'Nguyễn Văn Hùng',
                        currentDoctorName: user?.full_name || 'BS. Lê Minh',
                        estimatedMinutesRemaining: 30,
                      }
                    : c
                )
              );
              toast.success('🎉 Đã tự động phân Ghế #02 cho bệnh nhân Nguyễn Văn Hùng thành công!');
            } else if (actionType === 'alert_doctor') {
              toast.success('🔔 Đã gửi thông báo ưu tiên đặc biệt đến thiết bị của BS. Trần Thảo về ca chờ của BN Lê Thị Mai.');
            } else if (actionType === 'reroute_queue') {
              toast.success('🔄 AI COO đã điều phối giãn ca khám: Dịch chuyển 2 ca điều trị lúc 13:00 sang khung giờ trống lúc 14:30.');
            }

            // Remove the executed suggestion from the UI list
            setAiCooActions((prev) => prev.filter((a) => a.id !== actId));
          }}
        />
      )}

      {/* Layer 3: Chair & Resource Management Panel */}
      {(isAdmin || isDoctor || isNurse) && (
        <ChairManagementPanel
          chairs={chairsMatrix}
          metrics={resourceMetrics}
          onAssignChair={(chairId) => {
            setChairsMatrix((prev) =>
              prev.map((c) =>
                c.id === chairId
                  ? { ...c, status: 'occupied', currentPatientName: selectedPatient?.name, currentDoctorName: user?.full_name || 'BS. Lê Minh', estimatedMinutesRemaining: 25 }
                  : c
              )
            );
            toast.success(`🎉 Đã phân ghế ${chairId} cho bệnh nhân ${selectedPatient?.name}`);
          }}
        />
      )}

      {/* Layer 4: Analytical Quick Stats */}
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
            label: 'Phòng chờ tiếp đón',
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

      {/* Layer 5: Clinical Pipeline */}
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

      {/* Layer 6: Clinical Timeline & SLA Bottleneck Monitor */}
      {(isAdmin || isDoctor) && <ClinicalTimeline steps={dynamicTimelineSteps} />}

      {/* Layer 7: Care Path & Specialty Journey Tracker */}
      {(isAdmin || isDoctor) && (
        <CarePathTracker
          title={`Lộ trình Điều trị Implant Chuyên sâu (Phác đồ: ${selectedPatient?.name || 'Bệnh nhân'})`}
          steps={carePathSteps}
        />
      )}

      {/* Layer 8: Odontogram Twin & AI Clinical Panel */}
      {(isAdmin || isDoctor) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
          <div className="lg:col-span-2">
            <OdontogramTwin
              toothData={selectedPatient?.toothData || {}}
              selectedTooth={selectedTooth}
              onSelectTooth={setSelectedTooth}
              onUpdateToothStatus={isAdmin || isDoctor ? handleUpdateToothStatus : undefined}
              patientName={selectedPatient?.name}
            />
          </div>

          <div>
            <AiClinicalPanel
              patientName={selectedPatient?.name || 'Chưa chọn'}
              patientAllergies={selectedPatient?.allergies || []}
              onRunClinicalCheck={handleRunClinicalCheck}
              isReadOnly={!(isAdmin || isDoctor)}
            />
          </div>
        </div>
      )}

      {/* Layer 9: Collapsible IT Admin & Event Auditing Tools */}
      {isAdmin && (
        <div className="border border-slate-200/80 rounded-[28px] bg-white overflow-hidden shadow-sm">
          <button
            onClick={() => setShowDevTools(!showDevTools)}
            className="w-full px-6 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors font-extrabold text-sm text-slate-800 focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <span>🛠️ Công cụ Kiểm toán & Nhật ký Sự kiện (IT Admin & Debug)</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                Outbox & Saga
              </span>
            </div>
            <span className="text-slate-500 font-bold text-xs">{showDevTools ? 'Ẩn bảng điều khiển ▲' : 'Hiện bảng điều khiển ▼'}</span>
          </button>

          {showDevTools && (
            <div className="p-6 border-t border-slate-200/80">
              <EventStreamViewer
                events={eventStreamLog}
                outbox={EncounterSaga.getInstance().getOutbox()}
                activeSagasCount={1}
                onSimulateEvent={() => {
                  const simulated: DomainEvent = {
                    metadata: {
                      eventId: `evt-${Date.now()}`,
                      aggregateId: selectedPatient?.id || 'pat-01',
                      aggregateType: 'Encounter',
                      eventName: 'Encounter.Patient.Arrived.v1',
                      tenantId: 'default',
                      correlationId: `corr-${Date.now()}`,
                      schemaVersion: 'v1',
                      occurredAt: new Date().toISOString(),
                    },
                    payload: { arrivedAt: new Date().toISOString() },
                  };
                  EncounterSaga.getInstance().handleEvent(simulated);
                  setEventsList((prev) => [simulated, ...prev]);

                  const simulatedLog: DomainEventStreamItem = {
                    id: simulated.metadata.eventId,
                    eventName: simulated.metadata.eventName,
                    timestamp: new Date().toLocaleTimeString('vi-VN'),
                    description: `Ghi nhận bệnh nhân check-in tại quầy tiếp đón`,
                    actor: 'System Sensor',
                    category: 'encounter',
                  };
                  setEventStreamLog((prev) => [simulatedLog, ...prev]);
                  toast.info('⚡ Đã giả lập bắn Domain Event tới EventBus & Outbox');
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
