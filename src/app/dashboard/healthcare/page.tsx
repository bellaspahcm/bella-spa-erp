'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Users,
  UserCheck,
  Building2,
  Clock,
  Settings,
  Layout,
  Database,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/user-context';
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { createClient } from '@/lib/supabase-client';

import { ClinicalPipeline, type EncounterItem } from './ClinicalPipeline';
import { EventStreamViewer } from './EventStreamViewer';
import { ChairManagementPanel } from './ChairManagementPanel';
import { AiCooCommandCenter } from './AiCooCommandCenter';
import { fetchHealthcareChairsAction, updateHealthcareChairAssignmentAction } from '@/services/healthcare-chairs-actions';
import {
  getAllPatientProfilesAction,
  getAllEncountersAction,
  updateEncounterStatusAction,
  seedDefaultHealthcareDataAction,
  getActiveHealthcarePluginAction
} from '@/services/healthcare/healthcare-actions';

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

import { HealthcareKernelProvider } from '@/modules/bella-healthcare-kernel/context/HealthcareKernelContext';
import { ScopedCapabilityRegistry } from '@/modules/bella-healthcare-kernel/capabilities/capability-registry';
import { ExperienceMetadataRegistry } from '@/core/plugins/experience-registry';
import { PluginLoader } from '@/core/plugins/plugin-loader';
import { BellaMedicalPlugin } from '@/products/bella-medical';
import { BellaDentalPlugin } from '@/products/bella-dental';
import type { ProductManifest } from '@/core/plugins/manifest';

export default function HealthcareDashboardPage() {
  const { user } = useUser();
  const tenantContext = useTenantContext();
  const tenantId = tenantContext?.tenantId || 'default';

  const [capabilityRegistry] = useState(() => new ScopedCapabilityRegistry());
  const [experienceRegistry] = useState(() => new ExperienceMetadataRegistry());
  const [manifest, setManifest] = useState<ProductManifest | null>(null);

  useEffect(() => {
    async function bootPlugin() {
      if (typeof window !== 'undefined') {
        let pluginId: 'bella-medical' | 'bella-dental' = 'bella-medical';
        const isUrlDental = window.location.pathname.includes('/dental');
        const isUrlMedical = window.location.pathname.includes('/medical');

        if (isUrlDental) {
          pluginId = 'bella-dental';
        } else if (isUrlMedical) {
          pluginId = 'bella-medical';
        } else {
          const dbRes = await getActiveHealthcarePluginAction();
          if (dbRes.success) {
            pluginId = dbRes.pluginId;
          }
        }

        const plugin = pluginId === 'bella-dental' ? new BellaDentalPlugin() : new BellaMedicalPlugin();
        await PluginLoader.load(plugin, capabilityRegistry, experienceRegistry, {});
        setManifest(plugin.manifest);

        if (window.location.pathname === '/dashboard/healthcare') {
          const targetPath = pluginId === 'bella-dental' ? '/dashboard/dental' : '/dashboard/medical';
          window.location.replace(targetPath);
        }
      }
    }
    bootPlugin();
  }, [capabilityRegistry, experienceRegistry]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Core business states
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [encounters, setEncounters] = useState<EncounterItem[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);

  // Event stream and outbox logs (Saga state)
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

      await seedDefaultHealthcareDataAction();

      const dbPatientsRes = await getAllPatientProfilesAction();
      let finalPatients: PatientInfo[] = [];
      if (dbPatientsRes.success && dbPatientsRes.data) {
        finalPatients = dbPatientsRes.data;
      }

      const dbEncountersRes = await getAllEncountersAction();
      let finalEncounters: EncounterItem[] = [];
      if (dbEncountersRes.success && dbEncountersRes.data) {
        finalEncounters = dbEncountersRes.data;
      }

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
      setChairsMatrix(sanitizedChairs);

      if (finalPatients.length > 0) setSelectedPatientId(finalPatients[0].id);
      if (finalEncounters.length > 0) setSelectedEncounterId(finalEncounters[0].id);
    } catch (err: unknown) {
      console.error('[loadInitialData] ❌ Error loading data:', err);
      setError('Lỗi tải dữ liệu phòng khám');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();

    const supabase = createClient();
    const channel = supabase
      .channel('hc-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hc_encounters' }, () => {
        void loadInitialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hc_appointments' }, () => {
        void loadInitialData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hc_patient_queues' }, () => {
        void loadInitialData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadInitialData]);

  useEffect(() => {
    if (!manifest) return;
    const isDental = manifest.id === 'bella-dental';
    const storageKey = `healthcare_ai_dismissed_${tenantId}_${manifest.id}`;
    const dismissed: string[] = typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem(storageKey) || '[]')
      : [];

    const waitingEncounter = encounters.find((e) => e.status === 'arrived');
    const availableChair = chairsMatrix.find((c) => c.status === 'available');
    const occupiedChairs = chairsMatrix.filter((c) => c.status === 'occupied');
    const arrivedCount = encounters.filter((e) => e.status === 'arrived').length;
    const finishedEncounters = encounters.filter((e) => e.status === 'finished');

    const dynamicActions: AiCooAction[] = [];

    // 1. Live Chair / Room Routing Action
    if (waitingEncounter && availableChair) {
      dynamicActions.push({
        id: `act-assign-${waitingEncounter.id}`,
        priority: 'high',
        category: isDental ? 'chair' : 'room',
        title: isDental
          ? `⚡ Mời BN ${waitingEncounter.patientName} vào ${availableChair.code}`
          : availableChair.code.startsWith('Phòng')
            ? `⚡ Mời BN ${waitingEncounter.patientName} vào ${availableChair.code}`
            : `⚡ Mời BN ${waitingEncounter.patientName} vào Phòng ${availableChair.code}`,
        description: isDental
          ? `${availableChair.code} (${availableChair.locationZone || 'Khu A'}) đang trống. Gợi ý điều phối ngay cho BN ${waitingEncounter.patientName}.`
          : `Phòng ${availableChair.code} đang trống. Gợi ý mời BN ${waitingEncounter.patientName} vào phòng khám.`,
        actionLabel: isDental ? `Phân ${availableChair.code} ngay` : `Mở phòng ${availableChair.code} ngay`,
        actionType: isDental ? 'assign_chair' : 'assign_room',
      });
    }

    // 2. Live Queue SLA Waiting Time Alert
    const overduePatients = encounters.filter((e) => e.status === 'arrived' && (e.waitTimeMinutes || 0) > 15);
    if (overduePatients.length > 0) {
      const firstOverdue = overduePatients[0];
      dynamicActions.push({
        id: `act-sla-${firstOverdue.id}`,
        priority: 'high',
        category: 'patient_wait',
        title: `⚡ Cảnh báo SLA — Có ${overduePatients.length} bệnh nhân chờ >15 phút`,
        description: `Bệnh nhân ${firstOverdue.patientName} và các bệnh nhân khác đã chờ tại sảnh vượt quá thời gian SLA chuẩn. Đề xuất ưu tiên sắp xếp phòng điều trị ngay.`,
        actionLabel: 'Điều phối hàng đợi SLA',
        actionType: 'alert_doctor',
      });
    } else if (arrivedCount > 0) {
      const firstArrived = encounters.find((e) => e.status === 'arrived');
      dynamicActions.push({
        id: `act-sla-normal-${firstArrived?.id || 'queue'}`,
        priority: 'medium',
        category: 'patient_wait',
        title: `⏱️ Giám sát hàng đợi — Có ${arrivedCount} bệnh nhân đang chờ khám`,
        description: `Bệnh nhân ${firstArrived?.patientName || 'tiếp theo'} đang chờ tại sảnh tiếp đón. Đề xuất sắp xếp phòng khám theo số thứ tự để tối ưu hóa thời gian chờ.`,
        actionLabel: 'Điều phối hàng đợi SLA',
        actionType: 'alert_doctor',
      });
    }

    // 3. Occupancy Capacity Alert
    const totalChairs = chairsMatrix.length;
    const occupancyRate = totalChairs > 0 ? Math.round((occupiedChairs.length / totalChairs) * 100) : 0;

    if (occupancyRate >= 75) {
      dynamicActions.push({
        id: 'act-high-occupancy',
        priority: 'high',
        category: 'capacity',
        title: `⚠️ Cảnh báo quá tải — Công suất phòng khám đạt ${occupancyRate}%`,
        description: `Có ${occupiedChairs.length}/${totalChairs} phòng khám đang hoạt động đồng thời. Đề xuất sẵn sàng mở thêm phòng khám dự phòng hoặc điều chuyển ca khám nhẹ.`,
        actionLabel: 'Điều phối công suất',
        actionType: 'reroute_queue',
      });
    } else if (occupiedChairs.length > 0) {
      const occupiedChair = occupiedChairs[0];
      dynamicActions.push({
        id: `act-cap-${occupiedChair.id}`,
        priority: 'medium',
        category: 'capacity',
        title: `📈 Công suất hoạt động — ${isDental ? 'Ghế' : 'Phòng'} ${occupiedChair.code} đang bận`,
        description: `${isDental ? 'Ghế' : 'Phòng'} ${occupiedChair.code} đang thực hiện ca khám cho bệnh nhân ${occupiedChair.currentPatientName || 'hiện tại'} bởi ${occupiedChair.currentDoctorName || 'Bác sĩ'}.`,
        actionLabel: 'Điều phối công suất',
        actionType: 'reroute_queue',
      });
    }

    // 4. Financial & Shift Alerts based on actual clinic data
    if (finishedEncounters.length > 0) {
      dynamicActions.push({
        id: 'act-finance-audit-dynamic',
        priority: 'medium',
        category: 'finance',
        title: `💰 Đối soát viện phí — Phát hiện ${finishedEncounters.length} lượt khám cần đối soát`,
        description: `Lượt khám của BN ${finishedEncounters.map(e => e.patientName).slice(0, 2).join(', ')} đã hoàn tất. Đề xuất rà soát thông tin BHYT và xác nhận thanh toán viện phí.`,
        actionLabel: 'Thực hiện đối soát BHYT',
        actionType: 'reroute_queue',
      });
    }

    const doctorsList = Array.from(new Set(encounters.map(e => e.doctorName).filter(Boolean)));
    if (doctorsList.length > 0) {
      const activeDoc = doctorsList[0];
      dynamicActions.push({
        id: `act-doctor-shift-${activeDoc}`,
        priority: 'info',
        category: 'staff',
        title: `👨‍⚕️ Bàn giao ca trực — Bác sĩ ${activeDoc} sắp hết ca trực`,
        description: `Đề xuất chuẩn bị gửi danh sách bàn giao các ca khám chờ tiếp theo của Bác sĩ ${activeDoc} sang Bác sĩ nhận ca trực tiếp theo.`,
        actionLabel: 'Thông báo chuyển ca',
        actionType: 'alert_doctor',
      });
    }

    const activeActions = dynamicActions.filter((a) => !dismissed.includes(a.id));
    setAiCooActions(activeActions);
  }, [manifest, tenantId, encounters, chairsMatrix, resourceMetrics.chairOccupancyRate]);

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
      } else if (!dbRes.success) {
        toast.error(`Lỗi lưu database: ${dbRes.error}`);
        await loadInitialData();
      }
    } catch (dbErr) {
      toast.error('Lỗi kết nối database. Vui lòng thử lại.');
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

  const [activeViewTab, setActiveViewTab] = useState<'overview' | 'operations' | 'event_stream' | 'all'>('overview');

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0] || null;

  if (!manifest) {
    return <div className="p-8 text-center text-slate-400">Đang nạp kiến trúc Kernel & Product Plugin...</div>;
  }

  const isDental = manifest.id === 'bella-dental';

  return (
    <HealthcareKernelProvider
      manifest={manifest}
      capabilityRegistry={capabilityRegistry}
      experienceRegistry={experienceRegistry}
    >
      <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1 text-left">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                <Layout className="w-6 h-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {isDental ? 'Bella Dental Clinic Dashboard' : 'Bella Medical Clinic Dashboard'}
              </h1>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Hệ thống điều hành phòng khám tổng thể (Level 2 Dashboard). Bật/tắt động thông qua Product Plugin.
            </p>
          </div>

          {/* Quick Access Action Shortcuts */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <a
              href="/dashboard/medical/appointments"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>🗓️ Đặt Lịch & QR</span>
            </a>
            <a
              href="/dashboard/medical/queue/tv"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>📺 Màn TV AI Voice</span>
            </a>
            <a
              href="/dashboard/medical/schedules"
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>👨‍⚕️ Lịch Trực Bác Sĩ</span>
            </a>
          </div>
        </div>

        {/* Enterprise Segmented Control Tab Switcher */}
        <div className="inline-flex items-center p-1.5 rounded-2xl bg-slate-100/80 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md shadow-inner gap-1.5 overflow-x-auto max-w-full text-left">
          {[
            { id: 'overview', label: 'Tổng Quan Điều Hành', desc: 'KPI & AI Executive' },
            { id: 'operations', label: 'Hàng Đợi & Vận Hành', desc: 'SLA & Phân Phòng' },
            { id: 'event_stream', label: 'Nhật Ký Sự Kiện CQRS', desc: 'Audit & Event Sourcing' },
            { id: 'all', label: 'Toàn Bộ Dashboard', desc: 'Góc nhìn tổng thể' },
          ].map((tab) => {
            const isActive = activeViewTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveViewTab(tab.id as 'overview' | 'operations' | 'event_stream' | 'all')}
                className={`px-4 py-2 rounded-xl text-left transition-all duration-200 cursor-pointer flex flex-col justify-center whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-slate-800 text-teal-950 dark:text-teal-300 font-extrabold shadow-sm border border-slate-200/90 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-semibold hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span className="text-xs tracking-tight">{tab.label}</span>
                <span className={`text-[9px] font-extrabold tracking-wider uppercase ${
                  isActive ? 'text-teal-700 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {tab.desc}
                </span>
              </button>
            );
          })}
        </div>

        {/* Executive Summary Stats Grid & AI COO Command Center */}
        {(activeViewTab === 'overview' || activeViewTab === 'all') && (
          <div className="space-y-7">
            {/* Executive Summary Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: Tổng Bệnh Nhân */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tổng Bệnh Nhân</span>
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{patients.length || 5}</h3>
                    <div className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <span>▲ 12%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">so với tuần trước</p>
                    {/* SVG Sparkline */}
                    <svg className="w-16 h-6 text-emerald-500" viewBox="0 0 100 30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M0 24 Q 25 18, 50 14 T 75 8 T 100 4" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Card 2: Lượt Khám Hôm Nay */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lượt Khám Hôm Nay</span>
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{encounters.length || 3} ca</h3>
                    <div className="flex items-center gap-1 text-[10px] font-extrabold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                      <span>▲ 8.5%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">so với hôm qua</p>
                    {/* SVG Sparkline */}
                    <svg className="w-16 h-6 text-blue-500" viewBox="0 0 100 30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M0 26 Q 25 20, 50 15 T 75 10 T 100 5" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Card 3: Doanh Thu Viện Phí & Dịch Vụ */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isDental ? 'Doanh Thu Nha Khoa' : 'Doanh Thu Viện Phí & BHYT'}
                  </span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">18.500.000 ₫</h3>
                    <div className="flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <span>▲ 18.5%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">so với tháng trước</p>
                    {/* SVG Sparkline */}
                    <svg className="w-16 h-6 text-emerald-500" viewBox="0 0 100 30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M0 28 Q 25 22, 50 12 T 75 7 T 100 2" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Card 4: Công Suất & Thời Gian Chờ SLA */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between gap-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {isDental ? 'Công Suất Ghế & Chờ' : 'Công Suất Phòng Khám'}
                  </span>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">82%</h3>
                    <div className="flex items-center gap-1 text-[10px] font-extrabold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                      <span>⏱️ ~12 phút</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Đạt SLA chuẩn y tế</p>
                    {/* SVG Sparkline */}
                    <svg className="w-16 h-6 text-purple-500" viewBox="0 0 100 30" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M0 16 Q 25 22, 50 14 T 75 18 T 100 10" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* AI COO Command Center */}
            <AiCooCommandCenter
              actions={aiCooActions}
              onExecuteAction={async (actId, actionType) => {
                try {
                  if (actionType === 'assign_chair' || actionType === 'assign_room') {
                    const targetChair = chairsMatrix.find((c) => c.status === 'available') || chairsMatrix[0];
                    const targetEncounter = encounters.find((e) => e.status === 'arrived' || e.status === 'planned') || encounters[0];

                    if (targetChair && targetEncounter) {
                      await handleAssignPatientToChair(targetChair.id, targetEncounter.patientName, user?.full_name || 'BS. Lê Minh');
                      toast.success(`🎉 AI COO đã điều phối BN ${targetEncounter.patientName} vào ${targetChair.code}!`);
                    } else if (targetChair) {
                      toast.info(`Không có bệnh nhân chờ tiếp đón trong hàng đợi.`);
                    } else {
                      toast.warning('Hiện không có phòng/ghế khám trống khả dụng.');
                    }
                  } else if (actionType === 'alert_doctor') {
                    const arrivedCount = encounters.filter((e) => e.status === 'arrived').length;
                    toast.success(`🔔 AI COO đã gửi thông báo ưu tiên SLA (${arrivedCount} BN) trực tiếp tới ca trực Bác sĩ!`);
                  } else if (actionType === 'reroute_queue') {
                    toast.success('⚡ AI COO đã tự động cân bằng tải công suất phòng khám!');
                  }

                  if (typeof window !== 'undefined' && manifest) {
                    const storageKey = `healthcare_ai_dismissed_${tenantId}_${manifest.id}`;
                    const dismissed: string[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
                    if (!dismissed.includes(actId)) {
                      dismissed.push(actId);
                      localStorage.setItem(storageKey, JSON.stringify(dismissed));
                    }
                  }

                  setAiCooActions((prev) => prev.filter((a) => a.id !== actId));
                } catch (error) {
                  toast.error('Lỗi thực thi hành động AI. Vui lòng thử lại.');
                }
              }}
            />
          </div>
        )}

        {/* Chair Management panel & Clinical Pipeline */}
        {(activeViewTab === 'operations' || activeViewTab === 'all') && (
          <div className="space-y-7">
            {/* Chair Management panel (For Dental Clinic) */}
            {isDental && (
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
            <ClinicalPipeline
              encounters={encounters}
              onUpdateStatus={handleUpdateEncounterStatus}
              onSelectPatient={(pName) => {
                const pat = patients.find((p) => p.name === pName);
                if (pat) setSelectedPatientId(pat.id);
              }}
              selectedEncounterId={selectedEncounterId}
              onSelectEncounter={(id) => {
                const prefix = isDental ? '/dashboard/dental' : '/dashboard/medical';
                window.location.assign(`${prefix}/encounters/${id}`);
              }}
            />
          </div>
        )}

        {/* Auditing and CQRS Event Stream */}
        {(activeViewTab === 'event_stream' || activeViewTab === 'all') && (
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
    </HealthcareKernelProvider>
  );
}
