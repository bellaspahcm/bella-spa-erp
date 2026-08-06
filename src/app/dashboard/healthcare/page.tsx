'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Users, 
  CheckCircle, 
  Heart, 
  Layout, 
  UserCheck, 
  Building2, 
  Clock, 
  AlertTriangle, 
  Settings,
  ShieldCheck,
  ChevronRight,
  Database
} from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/user-context';
import { useTenantContext } from '@/core/hooks/useTenantContext';

import { ClinicalPipeline, type EncounterItem } from './ClinicalPipeline';
import { EventStreamViewer } from './EventStreamViewer';
import { ChairManagementPanel } from './ChairManagementPanel';
import { AiCooCommandCenter } from './AiCooCommandCenter';
import { fetchHealthcareChairsAction, updateHealthcareChairAssignmentAction } from '@/services/healthcare-chairs-actions';
import { 
  getAllPatientProfilesAction, 
  getAllEncountersAction, 
  updateEncounterStatusAction, 
  seedDefaultHealthcareDataAction 
} from '@/services/healthcare/healthcare-actions';

import { eventBus } from '@/platform/messaging/event-bus/event-bus';
import { EncounterSaga } from '@/modules/bella-healthcare/contexts/shared/EncounterSaga';
import { aiRegistry } from '@/modules/bella-healthcare/contexts/shared/AiEngineRegistry';
import type {
  PatientInfo,
  ChairInfo,
  DomainEventStreamItem,
  AiCooAction,
  ResourceUtilization,
  DomainEvent,
} from '@/modules/bella-healthcare/contexts/shared/domain-models';

import { MedicalClinicManifest, DentalClinicManifest, ProductManifest } from './components/clinical-manifest';
import { WidgetRegistry, DashboardWidget } from './components/clinical-registry';

export default function HealthcareDashboardPage() {
  const { user, userRole } = useUser();
  const tenantContext = useTenantContext();

  // Load manifest dynamically based on URL path (Purity Rule: No product hardcoding)
  const [manifest, setManifest] = useState<ProductManifest>(MedicalClinicManifest);
  const [selectedPersona, setSelectedPersona] = useState<string>('manager'); // manager, doctor, receptionist, admin

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDental = window.location.pathname.includes('/dental');
      setManifest(isDental ? DentalClinicManifest : MedicalClinicManifest);
      
      if (window.location.pathname === '/dashboard/healthcare') {
        window.location.replace('/dashboard/medical');
      }
    }
  }, []);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Core business states
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [encounters, setEncounters] = useState<EncounterItem[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);

  // Event stream and outbox logs (Saga state)
  const [eventsList, setEventsList] = useState<DomainEvent[]>([]);
  const [eventStreamLog, setEventStreamLog] = useState<DomainEventStreamItem[]>([
    { id: 'evt-1', eventName: 'Scheduling.Appointment.Created.v1', timestamp: '09:00:12', description: 'Lịch hẹn được tạo thành công cho BN Nguyễn Văn Hùng', actor: 'Patient Portal', category: 'encounter' },
    { id: 'evt-2', eventName: 'Encounter.Patient.Arrived.v1', timestamp: '09:28:45', description: 'Bệnh nhân check-in tại quầy tiếp đón (Stt: #102)', actor: 'Receptionist Mai', category: 'encounter' },
    { id: 'evt-3', eventName: 'Resource.DoctorAssigned.v1', timestamp: '09:30:10', description: 'Chỉ định BS. Lê Minh phụ trách lượt khám #EC202600124', actor: 'Queue Manager', category: 'resource' },
  ]);

  const [chairsMatrix, setChairsMatrix] = useState<ChairInfo[]>([]);

  const [resourceMetrics] = useState<ResourceUtilization>({
    chairOccupancyRate: 82,
    doctorOccupancyRate: 91,
    avgWaitTimeMinutes: 12,
    totalEncountersToday: 18,
  });

  const [aiCooActions, setAiCooActions] = useState<AiCooAction[]>([]);

  // Persistent initial setup
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Trigger Autoseeding if database has no customers/patients yet
      await seedDefaultHealthcareDataAction();

      // 2. Fetch Patients from Supabase Database
      const dbPatientsRes = await getAllPatientProfilesAction();
      let finalPatients: PatientInfo[] = [];
      if (dbPatientsRes.success && dbPatientsRes.data) {
        finalPatients = dbPatientsRes.data;
      }

      // 3. Fetch Encounters from Supabase Database
      const dbEncountersRes = await getAllEncountersAction();
      let finalEncounters: EncounterItem[] = [];
      if (dbEncountersRes.success && dbEncountersRes.data) {
        finalEncounters = dbEncountersRes.data;
      }

      // 4. Fetch Chairs from Supabase Database (booking_resources table)
      const dbChairsRes = await fetchHealthcareChairsAction();
      let finalChairs: ChairInfo[] = [];
      if (dbChairsRes.success && dbChairsRes.data) {
        finalChairs = dbChairsRes.data as ChairInfo[];
      }

      const seenPatients = new Set<string>();
      const sanitizedChairs = finalChairs.map((c) => {
        if (c.currentPatientName) {
          if (seenPatients.has(c.currentPatientName)) {
            return {
              ...c,
              status: 'available' as const,
              currentPatientName: undefined,
              currentDoctorName: undefined,
              estimatedMinutesRemaining: undefined,
            };
          }
          seenPatients.add(c.currentPatientName);
        }
        return c;
      });

      setPatients(finalPatients);
      setEncounters(finalEncounters);
      setChairsMatrix(sanitizedChairs); // Always use database data (empty array if no data)

      if (finalPatients.length > 0) setSelectedPatientId(finalPatients[0].id);
      if (finalEncounters.length > 0) setSelectedEncounterId(finalEncounters[0].id);
      
      console.log('[loadInitialData] ✅ Loaded chairs from database:', sanitizedChairs.length, 'chairs');
    } catch (err) {
      console.error('[loadInitialData] ❌ Error loading data:', err);
      setError('Lỗi tải dữ liệu phòng khám');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // SLA Capacity warning & AI COO Suggestions dynamically matching the active manifest context
  useEffect(() => {
    const isDental = manifest.id === 'dental_clinic';
    const initActions: AiCooAction[] = [
      {
        id: 'act-1',
        priority: 'high',
        category: 'chair',
        title: isDental ? '⚡ Phân ghế khám trống' : '⚡ Phân phòng khám trống',
        description: isDental 
          ? 'Ghế #02 (Khu A) đang trống. Gợi ý mời bệnh nhân Nguyễn Văn Hùng (Queue #102) vào vị trí ghế.'
          : 'Phòng khám #02 (Khu A) đang trống. Gợi ý mời bệnh nhân Nguyễn Văn Hùng (Queue #102) vào phòng khám.',
        actionLabel: isDental ? 'Phân ghế #02 ngay' : 'Phân phòng #02 ngay',
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

    const forecasted = aiRegistry.prediction.forecastUtilization(resourceMetrics.chairOccupancyRate);
    if (forecasted.warningText) {
      const warningText = isDental 
        ? forecasted.warningText 
        : forecasted.warningText.replace(/ghế/g, 'phòng khám').replace(/Ghế/g, 'Phòng khám');

      initActions.unshift({
        id: 'act-prediction',
        priority: 'medium',
        category: 'capacity',
        title: '📈 AI Dự báo: Dự báo công suất quá tải',
        description: warningText || '',
        actionLabel: 'Giãn lịch hẹn',
        actionType: 'reroute_queue',
      });
    }

    setAiCooActions(initActions);
  }, [manifest, resourceMetrics.chairOccupancyRate]);

  const handleUpdateEncounterStatus = async (id: string, newStatus: EncounterItem['status']) => {
    const dbRes = await updateEncounterStatusAction(id, newStatus);
    if (!dbRes.success) {
      toast.error('Lỗi lưu trạng thái lượt khám: ' + dbRes.error);
      return;
    }

    setEncounters((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
    );

    const statusLabels: Record<EncounterItem['status'], string> = {
      planned: 'Lên lịch hẹn',
      arrived: 'Phòng chờ tiếp đón',
      in_progress: 'Đang điều trị',
      finished: 'Đã hoàn tất',
    };

    toast.success(`Đã di chuyển lượt khám sang: ${statusLabels[newStatus] || newStatus}`);
  };

  const handleAssignPatientToChair = async (targetChairId: string, patientName: string, doctorName?: string) => {
    let oldChairCode: string | null = null;

    setChairsMatrix((prev) => {
      const freedMatrix = prev.map((c) => {
        if (c.currentPatientName === patientName && c.id !== targetChairId) {
          oldChairCode = c.code;
          return {
            ...c,
            status: 'available' as const,
            currentPatientName: undefined,
            currentDoctorName: undefined,
            estimatedMinutesRemaining: undefined,
          };
        }
        return c;
      });

      return freedMatrix.map((c) =>
        c.id === targetChairId
          ? {
              ...c,
              status: 'occupied' as const,
              currentPatientName: patientName,
              currentDoctorName: doctorName || user?.full_name || 'BS. Lê Minh',
              estimatedMinutesRemaining: 25,
            }
          : c
      );
    });

    setEncounters((prev) =>
      prev.map((e) =>
        e.patientName === patientName
          ? { ...e, status: 'in_progress' as const, doctorName: doctorName || e.doctorName || 'BS. Lê Minh' }
          : e
      )
    );

    try {
      const dbRes = await updateHealthcareChairAssignmentAction(targetChairId, patientName, doctorName);
      if (dbRes.success && dbRes.data.length > 0) {
        setChairsMatrix(dbRes.data);
        console.log('[handleAssignPatientToChair] ✅ Database updated successfully:', dbRes.data);
      } else if (!dbRes.success) {
        console.error('[handleAssignPatientToChair] ❌ Database update failed:', dbRes.error);
        toast.error(`Lỗi lưu database: ${dbRes.error}`);
        // Rollback UI changes on database error
        await loadInitialData();
      }
    } catch (dbErr) {
      console.error('[handleAssignPatientToChair] ❌ Supabase persistence error:', dbErr);
      toast.error('Lỗi kết nối database. Vui lòng thử lại.');
      // Rollback UI changes on exception
      await loadInitialData();
    }

    const targetChair = chairsMatrix.find((c) => c.id === targetChairId);
    const targetCode = targetChair ? targetChair.code : targetChairId;

    if (oldChairCode) {
      toast.info(`🔄 Đã chuyển bệnh nhân ${patientName} từ ${oldChairCode} sang ${targetCode}`);
    } else {
      toast.success(`🎉 Đã phân ${targetCode} cho bệnh nhân ${patientName} thành công!`);
    }
  };

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0] || null;

  // Resolve enabled widgets based on Persona / Role
  const getEnabledWidgetsForPersona = () => {
    const baseWidgets = manifest.dashboard.widgets;
    switch (selectedPersona) {
      case 'doctor':
        return baseWidgets.filter((w) => ['clinic_summary_stats', 'queue_realtime_monitor', 'clinical_pipeline_summary'].includes(w));
      case 'receptionist':
        return baseWidgets.filter((w) => ['queue_realtime_monitor', 'facility_status_map'].includes(w));
      case 'manager':
        return baseWidgets.filter((w) => ['clinic_summary_stats', 'queue_realtime_monitor', 'facility_status_map', 'ai_coo_command_center'].includes(w));
      case 'admin':
      default:
        return baseWidgets;
    }
  };

  const enabledWidgets = getEnabledWidgetsForPersona();

  // Widget 1: Operational Stats Bar
  const renderSummaryStats = () => (
    <div key="clinic_summary_stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
      {[
        { label: 'Lượt khám hôm nay', value: '145 ca', trend: 'Tăng 12% so với hôm qua', icon: Activity, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40 border-teal-200' },
        { label: 'Bệnh nhân chờ khám', value: '28 ca', trend: 'SLA chờ trung bình: 15p', icon: Users, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-200' },
        { label: 'Phòng khám hoạt động', value: '12 phòng', trend: 'Đầy công suất 90%', icon: Building2, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 border-blue-200' },
        { label: 'Bác sĩ trực lâm sàng', value: '6 bác sĩ', trend: 'Hoạt động liên tục', icon: UserCheck, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200' },
        { label: 'Thời gian chờ TB', value: '95 phút', trend: 'Cảnh báo SLA đỏ', icon: Clock, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-200' },
      ].map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div key={idx} className="p-5 rounded-[22px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-teal-500/50 transition-all">
            <div className="space-y-1 text-left">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-wider block">{stat.label}</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">{stat.value}</span>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mt-1">{stat.trend}</span>
            </div>
            <div className={`p-3 rounded-2xl border ${stat.color} group-hover:scale-105 transition-transform duration-300`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );

  // Widget 2: Realtime Queue Monitor
  const renderQueueMonitor = () => {
    const isDental = manifest.id === 'dental_clinic';
    const doctors = isDental
      ? [
          { name: 'BS. Lê Minh', specialty: 'Nha khoa Tổng quát', room: 'Phòng Ghế 01' },
          { name: 'BS. Trần Thảo', specialty: 'Chỉnh nha & Thẩm mỹ', room: 'Phòng Ghế 02' },
          { name: 'BS. Phạm Hải', specialty: 'Phẫu thuật trong miệng', room: 'Phòng Ghế 03' },
        ]
      : [
          { name: 'BS. Lê Minh', specialty: 'Nội Tổng Quát', room: 'Phòng 101' },
          { name: 'BS. Trần Thảo', specialty: 'Sản phụ khoa / Mẹ & Bé', room: 'Phòng 102' },
          { name: 'BS. Phạm Hải', specialty: 'Tai Mũi Họng', room: 'Phòng 103' },
        ];

    const queues = doctors.map((doc) => {
      // Find current active patient (in_progress) for this doctor
      const currentEncounter = encounters.find(
        (e) => e.status === 'in_progress' && (e.doctorName === doc.name || e.doctorName === doc.name.replace('BS. ', ''))
      );
      
      // Find waiting patients (arrived) for this doctor
      const waitingEncounters = encounters.filter(
        (e) => e.status === 'arrived' && (e.doctorName === doc.name || e.doctorName === doc.name.replace('BS. ', ''))
      );

      return {
        room: doc.room,
        doctor: doc.name,
        specialty: doc.specialty,
        current: currentEncounter
          ? { name: currentEncounter.patientName, queue: currentEncounter.queueNumber }
          : null,
        waiting: waitingEncounters.map((we) => ({
          name: we.patientName,
          queue: we.queueNumber,
        })),
      };
    });

    const unassignedWaiting = encounters.filter(
      (e) => e.status === 'arrived' && !e.doctorName
    );

    return (
      <div key="queue_realtime_monitor" className="p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 text-left">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse shrink-0" />
            Hàng Đợi Phòng Khám Realtime (Workflow Queue)
          </h3>
          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
            Realtime SLA
          </span>
        </div>
        
        <div className="space-y-4">
          {queues.map((q, idx) => (
            <div key={idx} className="p-4.5 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 space-y-3">
              <div className="flex justify-between items-center text-xs font-black text-slate-800 dark:text-slate-200">
                <span className="text-teal-600 dark:text-teal-400 flex items-center gap-1.5 font-extrabold">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
                  {q.room} — {q.doctor} ({q.specialty})
                </span>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 dark:bg-slate-800/50 px-2 py-0.5 rounded-full">
                  Chờ: {q.waiting.length} ca
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Current patient card */}
                <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-400 flex flex-col justify-between">
                  <span className="text-[9px] font-black uppercase text-teal-600 tracking-wider">Đang khám</span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="font-extrabold text-slate-950 dark:text-white truncate">
                      {q.current ? q.current.name : '—'}
                    </span>
                    {q.current && (
                      <span className="text-[10px] font-black bg-teal-600 text-white px-1.5 py-0.2 rounded-md shadow-sm shrink-0">
                        BN {String(q.current.queue).padStart(3, '0')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Waiting queue list */}
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex flex-col justify-between">
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Hàng chờ</span>
                  <div className="mt-1 font-extrabold text-slate-950 dark:text-white truncate flex items-center gap-1.5 flex-wrap">
                    {q.waiting.length > 0 ? (
                      q.waiting.map((we, wIdx) => (
                        <span key={wIdx} className="inline-flex items-center gap-1">
                          {wIdx > 0 && <span className="text-slate-400 font-normal">➔</span>}
                          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md text-[10px] font-black">
                            BN {String(we.queue).padStart(3, '0')}
                          </span>
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 font-normal italic text-[11px]">Trống hàng chờ</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {unassignedWaiting.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-2">
              <div className="flex justify-between items-center text-xs font-black text-amber-800 dark:text-amber-400">
                <span>🎫 Bệnh nhân mới tiếp đón - Chờ phân phòng</span>
                <span className="text-[10px] bg-amber-500/15 text-amber-700 px-2 py-0.5 rounded-full font-extrabold">
                  {unassignedWaiting.length} ca
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {unassignedWaiting.map((we) => (
                  <span
                    key={we.id}
                    className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-amber-500/20 text-slate-850 dark:text-slate-200 rounded-xl text-[10px] font-black shadow-sm flex items-center gap-1.5"
                  >
                    <span>{we.patientName}</span>
                    <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded font-black text-[9px]">
                      BN {String(we.queueNumber).padStart(3, '0')}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Widget 3: Facility Status Map
  const renderFacilityMap = () => (
    <div key="facility_status_map" className="p-6 rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-left">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-500" />
          Sơ Đồ Phòng Máy & Thiết Bị (Facility Status)
        </h3>
        <span className="text-[10px] font-extrabold text-teal-600 dark:text-teal-400">100% Online</span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        {[
          { name: 'Phòng Cấp Cứu 101', status: 'Đang khám', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
          { name: 'Phòng Siêu Âm 102', status: 'Trống', color: 'bg-slate-100 text-slate-600 dark:bg-slate-950 border-slate-200' },
          { name: 'Xét nghiệm LIS', status: 'Đang chạy 6 mẫu', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
          { name: 'Phòng X-Ray PACS', status: 'Đang chụp', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' }
        ].map((f, idx) => (
          <div key={idx} className={`p-3 rounded-2xl border ${f.color} flex flex-col justify-between space-y-2`}>
            <span className="font-bold block">{f.name}</span>
            <span className="text-[10px] font-extrabold uppercase tracking-wide">{f.status}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Ambient background mesh glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Persona Selector Banner */}
      <div className="relative p-5 rounded-[28px] bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-teal-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <h2 className="text-sm font-black !text-white flex items-center gap-2 tracking-tight">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse shrink-0" />
            Mô phỏng Giao diện theo Vai trò (Persona Dashboard Strategy)
          </h2>
          <p className="text-[11px] !text-slate-300 font-medium">
            Lựa chọn vai trò để hệ thống tự động lọc các Widgets phù hợp từ Dashboard Manifest.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {[
            { role: 'manager', label: '📊 Manager (Quản lý)' },
            { role: 'doctor', label: '🩺 Bác sĩ (Doctor)' },
            { role: 'receptionist', label: '🎫 Tiếp đón (Reception)' },
            { role: 'admin', label: '👑 Admin (Tổng quản)' },
          ].map((item) => (
            <button
              key={item.role}
              onClick={() => setSelectedPersona(item.role)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black border transition-all duration-200 cursor-pointer ${
                selectedPersona === item.role
                  ? 'bg-white text-slate-950 border-white shadow-lg scale-105'
                  : 'bg-white/10 !text-white border-white/20 hover:bg-white/20'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              <Layout className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {manifest.id === 'dental_clinic' ? 'Bella Dental Clinic Dashboard' : 'Bella Medical Clinic Dashboard'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Hệ thống điều hành phòng khám tổng thể (Level 2 Dashboard). Bật/tắt động thông qua Manifest.
          </p>
        </div>
        <button
          onClick={() => {
            const path = manifest.id === 'dental_clinic' ? '/dashboard/medical' : '/dashboard/dental';
            window.location.replace(path);
          }}
          className="px-4 py-2.5 rounded-xl text-xs font-black bg-teal-600 text-white hover:bg-teal-700 shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
        >
          <Settings className="w-4 h-4" />
          Chuyển Chuyên Khoa: {manifest.id === 'dental_clinic' ? 'Y tế Đa khoa' : 'Nha khoa'}
        </button>
      </div>

      {/* Render Statistics Widget if enabled */}
      {enabledWidgets.includes('clinic_summary_stats') && renderSummaryStats()}

      {/* AI alerts and recommendations */}
      {enabledWidgets.includes('ai_coo_command_center') && (
        <AiCooCommandCenter
          actions={aiCooActions}
          onExecuteAction={async (actId, actionType) => {
            try {
              if (actionType === 'assign_chair_and_alert' || actionType === 'assign_chair') {
                // Phân bệnh nhân vào ghế/phòng
                await handleAssignPatientToChair('ch-2', 'Trần Minh Hoàng', user?.full_name || 'BS. Lê Minh');
                toast.success('🔔 Đã phân Ghế #02 cho BN Trần Minh Hoàng!');
                
                // TODO: Persist AI action log to database
                // await createAiActionLogAction(actId, actionType, 'success', { chairId: 'ch-2', patientName: 'Trần Minh Hoàng' });
              } else if (actionType === 'alert_doctor') {
                // TODO: Send real notification to doctor via database
                // await sendDoctorAlertAction({ doctorId: 'bs-tran-thao', priority: 'high', message: 'Patient waiting >22 mins' });
                toast.success('🔔 Đã gửi thông báo ưu tiên đặc biệt đến BS. Lê Minh.');
              } else if (actionType === 'reroute_queue') {
                // TODO: Reschedule appointments in database
                // await rescheduleAppointmentsAction({ reason: 'overcapacity', targetDate: tomorrow });
                toast.success('⏰ Đã đề xuất giãn lịch hẹn cho ngày mai. Chờ xác nhận từ lễ tân.');
              }
              
              // Remove action from UI after execution
              setAiCooActions((prev) => prev.filter((a) => a.id !== actId));
            } catch (error) {
              console.error('[AI COO Action] Error:', error);
              toast.error('Lỗi thực thi hành động AI. Vui lòng thử lại.');
            }
          }}
        />
      )}

      {/* Split grid for queue monitor and facility map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {enabledWidgets.includes('queue_realtime_monitor') && (
          <div className="lg:col-span-2">
            {renderQueueMonitor()}
          </div>
        )}
        {enabledWidgets.includes('facility_status_map') && (
          <div>
            {renderFacilityMap()}
          </div>
        )}
      </div>

      {/* Chair Management panel (For Dental Clinic) */}
      {manifest.id === 'dental_clinic' && enabledWidgets.includes('chair_management_grid') && (
        <ChairManagementPanel
          chairs={chairsMatrix}
          metrics={resourceMetrics}
          isMedicalClinic={false}
          onAssignChair={(chairId) => {
            if (selectedPatient?.name) {
              handleAssignPatientToChair(chairId, selectedPatient.name);
            } else {
              toast.warning('Vui lòng chọn bệnh nhân trước khi xếp ghế.');
            }
          }}
        />
      )}

      {/* Clinical Pipeline / Encounters list */}
      {enabledWidgets.includes('clinical_pipeline_summary') && (
        <ClinicalPipeline
          encounters={encounters}
          onUpdateStatus={handleUpdateEncounterStatus}
          onSelectPatient={(pName) => {
            const pat = patients.find((p) => p.name === pName);
            if (pat) setSelectedPatientId(pat.id);
          }}
          selectedEncounterId={selectedEncounterId}
          onSelectEncounter={(id) => {
            // Navigate directly to EMR clinical workspace for detailed exam
            const prefix = manifest.id === 'dental_clinic' ? '/dashboard/dental' : '/dashboard/medical';
            window.location.assign(`${prefix}/encounters/${id}`);
          }}
        />
      )}

      {/* Auditing and Dev Tools */}
      {enabledWidgets.includes('it_auditing_tools') && (
        <div className="border border-slate-200/80 dark:border-slate-800 rounded-[28px] bg-white dark:bg-slate-900 overflow-hidden shadow-sm text-left">
          <div className="px-6 py-4 flex items-center justify-between bg-slate-50 dark:bg-slate-950 font-extrabold text-sm text-slate-800 dark:text-slate-200">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-500" />
              <span>Nhật ký Sự kiện Event Sourcing & CQRS Projections</span>
            </div>
            <span className="text-[10px] font-bold bg-indigo-500/10 text-indigo-600 px-2 py-0.5 rounded-full">IT Admin Audit</span>
          </div>
          <div className="p-6 border-t border-slate-100 dark:border-slate-800">
            <EventStreamViewer
              events={eventStreamLog}
              outbox={EncounterSaga.getInstance().getOutbox()}
              activeSagasCount={1}
              onSimulateEvent={() => {
                const simulatedLog: DomainEventStreamItem = {
                  id: `evt-${Date.now()}`,
                  eventName: 'Encounter.Patient.Arrived.v1',
                  timestamp: new Date().toLocaleTimeString('vi-VN'),
                  description: `Bệnh nhân check-in tại quầy tiếp đón`,
                  actor: 'System Sensor',
                  category: 'encounter',
                };
                setEventStreamLog((prev) => [simulatedLog, ...prev]);
                toast.info('⚡ Đã giả lập bắn Domain Event tới EventBus & Outbox');
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
