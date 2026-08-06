'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Users, CheckCircle, RefreshCw, ShieldCheck, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { useUser } from '@/lib/user-context';
import { useTenantContext } from '@/core/hooks/useTenantContext';

import { ClinicalPipeline, type EncounterItem } from './ClinicalPipeline';
import { OdontogramTwin, type ToothData, type ToothStatus } from '@/modules/bella-healthcare/components/OdontogramTwin';
import { AiClinicalPanel } from '@/modules/bella-healthcare/components/AiClinicalPanel';
import { PatientContextHeader } from './PatientContextHeader';
import { ClinicalTimeline } from './ClinicalTimeline';
import { EventStreamViewer } from './EventStreamViewer';
import { ChairManagementPanel } from './ChairManagementPanel';
import { CarePathTracker } from './CarePathTracker';
import { AiCooCommandCenter } from './AiCooCommandCenter';

import { eventBus } from '@/platform/messaging/event-bus/event-bus';
import type {
  PatientInfo,
  DoctorInfo,
  ChairInfo,
  TimelineStep,
  DomainEventStreamItem,
  CarePathStep,
  AiCooAction,
  ResourceUtilization,
} from '@/modules/bella-healthcare/types/encounter-aggregate';

export default function HealthcareDashboardPage() {
  const { user } = useUser();
  const tenantContext = useTenantContext();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Core business states
  const [patients, setPatients] = useState<PatientInfo[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [encounters, setEncounters] = useState<EncounterItem[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);

  // Selected tooth
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);

  // Enterprise State
  const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>([
    { id: 'ts-1', time: '09:00', title: 'Lên lịch hẹn', actor: 'Bệnh nhân (App)', status: 'completed', durationMinutes: 5 },
    { id: 'ts-2', time: '09:28', title: 'Check-in Tiếp đón', actor: 'Lễ tân (Mai)', status: 'completed', durationMinutes: 28, isBottleneck: true },
    { id: 'ts-3', time: '09:35', title: 'Chụp X-Ray 3D', actor: 'KTV. Hoàng', status: 'completed', durationMinutes: 7 },
    { id: 'ts-4', time: '09:45', title: 'Khám lâm sàng', actor: 'BS. Lê Minh', status: 'current', durationMinutes: 10 },
    { id: 'ts-5', time: '10:05', title: 'Điều trị chính', actor: 'BS. Lê Minh', status: 'pending' },
    { id: 'ts-6', time: '10:50', title: 'Thanh toán & Đơn thuốc', actor: 'Thu ngân', status: 'pending' },
    { id: 'ts-7', time: '11:00', title: 'Hoàn tất lượt khám', actor: 'Hệ thống', status: 'pending' },
  ]);

  const [eventStreamLog, setEventStreamLog] = useState<DomainEventStreamItem[]>([
    { id: 'evt-1', eventName: 'appointment.created', timestamp: '09:00:12', description: 'Lịch hẹn được tạo thành công cho BN Nguyễn Văn Hùng', actor: 'Patient Portal', category: 'encounter' },
    { id: 'evt-2', eventName: 'encounter.patient_arrived', timestamp: '09:28:45', description: 'Bệnh nhân check-in tại quầy tiếp đón (Stt: #102)', actor: 'Receptionist Mai', category: 'encounter' },
    { id: 'evt-3', eventName: 'resource.doctor_assigned', timestamp: '09:30:10', description: 'Chỉ định BS. Lê Minh phụ trách lượt khám #EC202600124', actor: 'Queue Manager', category: 'resource' },
    { id: 'evt-4', eventName: 'odontogram.tooth_updated', timestamp: '09:46:18', description: 'Cập nhật tình trạng răng #36 (Deep Caries - Sâu ngà sâu)', actor: 'BS. Lê Minh', category: 'clinical' },
    { id: 'evt-5', eventName: 'prescription.created', timestamp: '09:48:02', description: 'Kê đơn thuốc y khoa Clindamycin 300mg', actor: 'BS. Lê Minh', category: 'prescription' },
  ]);

  const [chairsMatrix, setChairsMatrix] = useState<ChairInfo[]>([
    { id: 'ch-1', code: 'Ghế #01', zone: 'Khu A - Ghế chính', status: 'occupied', currentPatientName: 'Nguyễn Văn Hùng', currentDoctorName: 'BS. Lê Minh', estimatedMinutesRemaining: 15 },
    { id: 'ch-2', code: 'Ghế #02', zone: 'Khu A - Ghế chính', status: 'available' },
    { id: 'ch-3', code: 'Ghế #03', zone: 'Khu B - Ghế vệ sinh', status: 'sanitizing' },
    { id: 'ch-4', code: 'Ghế #04', zone: 'Khu B - Phục hình', status: 'occupied', currentPatientName: 'Lê Thị Mai', currentDoctorName: 'BS. Trần Thảo', estimatedMinutesRemaining: 30 },
  ]);

  const resourceMetrics: ResourceUtilization = {
    chairOccupancyRate: 82,
    doctorOccupancyRate: 91,
    avgWaitTimeMinutes: 12,
    totalEncountersToday: 18,
  };

  const carePathSteps: CarePathStep[] = [
    { stepNumber: 1, title: 'Consultation', subtitle: 'Tư vấn & Khám thám sát', status: 'completed', date: '2026-08-01' },
    { stepNumber: 2, title: 'CBCT Scan', subtitle: 'Chụp phim 3D CT ConeBeam', status: 'completed', date: '2026-08-03' },
    { stepNumber: 3, title: 'Implant Surgery', subtitle: 'Phẫu thuật cấy trụ Nobel', status: 'in_progress', date: 'Hôm nay' },
    { stepNumber: 4, title: 'Healing', subtitle: 'Tích hợp xương (3-6 tháng)', status: 'pending' },
    { stepNumber: 5, title: 'Abutment', subtitle: 'Lắp khớp nối Abutment', status: 'pending' },
    { stepNumber: 6, title: 'Crown', subtitle: 'Phục hình răng sứ Cercon', status: 'pending' },
    { stepNumber: 7, title: 'Recall', subtitle: 'Tái khám định kỳ 6 tháng', status: 'pending' },
  ];

  const aiCooActions: AiCooAction[] = [
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
      title: '⚡ SLA Alert — Thời gian chờ vượt ngưỡng',
      description: 'Bệnh nhân Lê Thị Mai đã ở phòng chờ >22 phút. Đề xuất phát thông báo ưu tiên cho BS. Trần Thảo.',
      actionLabel: 'Thông báo Bác sĩ',
      actionType: 'alert_doctor',
    },
  ];

  // Persistent initial setup
  const loadInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let loadedEncounters: EncounterItem[] | null = null;
      let loadedPatients: PatientInfo[] | null = null;

      if (typeof window !== 'undefined') {
        const savedEnc = localStorage.getItem('bella_healthcare_encounters');
        const savedPat = localStorage.getItem('bella_healthcare_patients');
        if (savedEnc) {
          try { loadedEncounters = JSON.parse(savedEnc); } catch (e) {}
        }
        if (savedPat) {
          try { loadedPatients = JSON.parse(savedPat); } catch (e) {}
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
        { id: 'enc-03', patientName: 'Trần Minh Hoàng', doctorName: 'Lê Minh', status: 'planned', chiefComplaint: 'Nhổ răng khôn #38', scheduledAt: '2026-08-05T14:30:00Z' },
      ];

      const finalPatients = loadedPatients || mockPatients;
      const finalEncounters = loadedEncounters || mockEncounters;

      setPatients(finalPatients);
      setEncounters(finalEncounters);

      if (typeof window !== 'undefined') {
        if (!loadedPatients) localStorage.setItem('bella_healthcare_patients', JSON.stringify(mockPatients));
        if (!loadedEncounters) localStorage.setItem('bella_healthcare_encounters', JSON.stringify(mockEncounters));
      }

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

  const selectedPatient = patients.find((p) => p.id === selectedPatientId) || patients[0] || null;

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
    return { triggered: false, warnings: [], blockers: [] };
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

    const newEvt: DomainEventStreamItem = {
      id: `evt-${Date.now()}`,
      eventName: 'odontogram.tooth_updated',
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      description: `Cập nhật răng #${toothNumber} (${status})`,
      actor: user?.full_name || 'BS. Lê Minh',
      category: 'clinical',
    };
    setEventStreamLog((prev) => [newEvt, ...prev]);

    eventBus.publish({
      id: newEvt.id,
      name: newEvt.eventName,
      timestamp: new Date().toISOString(),
      payload: { patientId: selectedPatientId, toothNumber, status },
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
      arrived: 'Phòng chờ (Queue)',
      in_progress: 'Đang điều trị',
      finished: 'Đã hoàn tất',
    };

    const newEvt: DomainEventStreamItem = {
      id: `evt-${Date.now()}`,
      eventName: 'encounter.status_changed',
      timestamp: new Date().toLocaleTimeString('vi-VN'),
      description: `Di chuyển lượt khám sang: ${statusLabels[newStatus] || newStatus}`,
      actor: user?.full_name || 'Bác sĩ/Tiếp đón',
      category: 'encounter',
    };
    setEventStreamLog((prev) => [newEvt, ...prev]);

    eventBus.publish({
      id: newEvt.id,
      name: newEvt.eventName,
      timestamp: new Date().toISOString(),
      payload: { encounterId: id, newStatus },
    });

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

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Ambient background mesh glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Layer 1: Enterprise Patient Context Header */}
      {selectedPatient && (
        <PatientContextHeader
          patient={selectedPatient}
          doctor={{ id: 'doc-1', name: user?.full_name || 'BS. Lê Minh', title: 'Nha sĩ Trưởng' }}
          chair={{ id: 'ch-1', code: 'Ghế #01', zone: 'Khu A - Ghế chính', status: 'occupied' }}
          aggregateCode="#EC202600124"
          allPatients={patients}
          onSelectPatient={setSelectedPatientId}
        />
      )}

      {/* Layer 2: AI COO Executive Command Center & Suggested Actions */}
      <AiCooCommandCenter
        actions={aiCooActions}
        onExecuteAction={(actId) => {
          toast.success(`⚡ AI COO đã kích hoạt xử lý gợi ý #${actId}`);
        }}
      />

      {/* Layer 3: Chair & Resource Management Panel */}
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
      <ClinicalTimeline steps={timelineSteps} />

      {/* Layer 7: Care Path & Specialty Journey Tracker */}
      <CarePathTracker steps={carePathSteps} />

      {/* Layer 8: Odontogram Twin & AI Clinical Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        <div className="lg:col-span-2">
          <OdontogramTwin
            toothData={selectedPatient?.toothData || {}}
            selectedTooth={selectedTooth}
            onSelectTooth={setSelectedTooth}
            onUpdateToothStatus={handleUpdateToothStatus}
          />
        </div>

        <div>
          <AiClinicalPanel
            patientName={selectedPatient?.name || 'Chưa chọn'}
            patientAllergies={selectedPatient?.allergies || []}
            onRunClinicalCheck={handleRunClinicalCheck}
          />
        </div>
      </div>

      {/* Layer 9: Real-time Event Stream Viewer */}
      <EventStreamViewer
        events={eventStreamLog}
        onSimulateEvent={() => {
          const simulated: DomainEventStreamItem = {
            id: `evt-${Date.now()}`,
            eventName: 'telemetry.vital_signs_recorded',
            timestamp: new Date().toLocaleTimeString('vi-VN'),
            description: `Ghi nhận sinh hiệu huyết áp 120/80 mmHg cho BN ${selectedPatient?.name}`,
            actor: 'System Sensor',
            category: 'clinical',
          };
          setEventStreamLog((prev) => [simulated, ...prev]);
          toast.info('⚡ Đã giả lập bắn Domain Event tới EventBus');
        }}
      />
    </div>
  );
}
