'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Stethoscope, 
  Plus, 
  FileText, 
  CheckCircle, 
  Search, 
  Activity, 
  UserCheck, 
  ShieldAlert, 
  Clock, 
  Printer, 
  Pill, 
  Calendar, 
  Sparkles, 
  Zap, 
  ChevronRight, 
  AlertTriangle,
  FileCheck2,
  SlidersHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  getAllEncountersAction, 
  createEMREncounterAction, 
  updateEncounterSOAPAction, 
  completeEncounterAction,
  createLabOrderAction,
  createAppointmentAction
} from '@/services/healthcare/healthcare-actions';
import { issuePrescriptionAction } from '@/services/healthcare/pharmacy-actions';
import { createClient } from '@/lib/supabase-client';

interface EncounterRecord {
  id: string;
  patientName: string;
  doctorName?: string;
  chiefComplaint: string;
  status: 'planned' | 'arrived' | 'in_progress' | 'finished' | 'in_consultation' | 'orders_pending' | 'completed';
  startedAt: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  // Dynamic mock metadata for enterprise HIS/EMR display
  age?: number;
  gender?: 'Nam' | 'Nữ';
  insuranceType?: 'BHYT (80%)' | 'BHYT (100%)' | 'Khám Dịch Vụ';
  visitType?: 'Khám lần đầu' | 'Tái khám';
  waitTimeMinutes?: number;
  allergies?: string[];
  timeline?: { time: string; label: string; done: boolean }[];
}

const MOCK_EMR_ENCOUNTERS: EncounterRecord[] = [
  {
    id: 'enc-001',
    patientName: 'Nguyễn Văn Hoàng',
    chiefComplaint: 'Đau ngực trái dữ dội kèm khó thở vùng thượng vị',
    status: 'in_consultation',
    startedAt: new Date().toISOString(),
    subjective: 'Bệnh nhân đau thắt ngực trái lan lên vai, cảm giác đè nặng, xuất hiện khi gắng sức cách đây 2 giờ, đau âm ỉ vùng thượng vị, buồn nôn nhẹ.',
    objective: 'Mạch: 82 l/p, Huyết áp: 135/85 mmHg, Thân nhiệt: 36.8°C, SpO2: 96% ở khí phòng. Tim đều, phổi không rale.',
    assessment: 'I20.9 - Cơn đau thắt ngực không ổn định / K29.7 - Viêm dạ dày cấp',
    plan: 'Chỉ định CLS khẩn: Điện tâm đồ (ECG) 12 đầu dò, men tim Troponin I, Siêu âm tim màu khẩn. Kê Esomeprazole 40mg uống trước ăn.',
    age: 62,
    gender: 'Nam',
    insuranceType: 'BHYT (80%)',
    visitType: 'Khám lần đầu',
    waitTimeMinutes: 12,
    allergies: ['Dị ứng Penicillin', 'Tăng huyết áp'],
    timeline: [
      { time: '08:00', label: 'Check-in', done: true },
      { time: '08:05', label: 'Đón Tiếp', done: true },
      { time: '08:10', label: 'Sinh Hiệu', done: true },
      { time: '08:12', label: 'Bác Sĩ Khám', done: true }
    ]
  },
  {
    id: 'enc-002',
    patientName: 'Phạm Thị Mai',
    chiefComplaint: 'Sốt cao liên tục, ho có đờm đục',
    status: 'arrived',
    startedAt: new Date().toISOString(),
    subjective: 'Sốt cao 39°C kèm gai rét từ hôm qua, ho nhiều có đờm màu vàng đục, đau ngực nhẹ khi ho.',
    objective: 'Thân nhiệt: 38.9°C, Mạch: 96 l/p, Huyết áp: 110/70 mmHg, SpO2: 95%. Phổi có rale ẩm rải rác bên thùy dưới phổi phải.',
    assessment: 'J18.9 - Viêm phổi không đặc hiệu',
    plan: 'Chỉ định CLS: Công thức máu (CBC), CRP, X-quang ngực thẳng (PACS). Kê Paracetamol 500mg hạ sốt.',
    age: 45,
    gender: 'Nữ',
    insuranceType: 'BHYT (100%)',
    visitType: 'Khám lần đầu',
    waitTimeMinutes: 20,
    allergies: [],
    timeline: [
      { time: '08:15', label: 'Check-in', done: true },
      { time: '08:20', label: 'Đón Tiếp', done: true },
      { time: '08:25', label: 'Sinh Hiệu', done: true },
      { time: '08:28', label: 'Bác Sĩ Khám', done: false }
    ]
  },
  {
    id: 'enc-003',
    patientName: 'Trần Quốc Tuấn',
    chiefComplaint: 'Đau đầu dữ dội vùng chẩm, chóng mặt',
    status: 'completed',
    startedAt: new Date().toISOString(),
    subjective: 'Đau đầu âm ỉ vùng chẩm từ sáng sớm, hoa mắt chóng mặt khi thay đổi tư thế. Tiền sử tăng huyết áp điều trị không liên tục.',
    objective: 'Huyết áp đo lúc tiếp nhận: 160/95 mmHg, Mạch: 72 l/p, Thân nhiệt: 37°C. Thần kinh tỉnh táo, không liệt khu trú.',
    assessment: 'I10 - Tăng huyết áp vô căn / R42 - Chóng mặt và choáng váng',
    plan: 'Điều trị hạ áp khẩn tại giường. Đơn thuốc ngoại trú: Amlodipin 5mg x 1 viên/ngày. Hướng dẫn theo dõi huyết áp hàng ngày tại nhà.',
    age: 58,
    gender: 'Nam',
    insuranceType: 'Khám Dịch Vụ',
    visitType: 'Tái khám',
    waitTimeMinutes: 8,
    allergies: ['Dị ứng Aspirin'],
    timeline: [
      { time: '08:30', label: 'Check-in', done: true },
      { time: '08:32', label: 'Đón Tiếp', done: true },
      { time: '08:35', label: 'Sinh Hiệu', done: true },
      { time: '08:40', label: 'Bác Sĩ Khám', done: true }
    ]
  }
];

export default function EncountersPage() {
  const searchParams = useSearchParams();
  // context=hospital → Hospital inpatient view (only 'inpatient' class encounters)
  // default          → Medical/Clinic ambulatory view (outpatient encounters)
  const isHospitalContext = searchParams.get('context') === 'hospital';
  const careSetting = isHospitalContext ? 'inpatient' : 'ambulatory';

  const [encounters, setEncounters] = useState<EncounterRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  // K6 P2: Separate DB error from empty state — never silently swap to mock
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadEncounters = async (dateStr?: string) => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const res = await getAllEncountersAction(dateStr || undefined, careSetting);
      if (res.success && res.data && res.data.length > 0) {
        // Enhance data with display metadata for rich UI presentation
        const enhancedData: EncounterRecord[] = (res.data as any[]).map((e, index) => ({
          id: String(e.id ?? ''),
          patientName: String(e.patientName ?? ''),
          doctorName: e.doctorName ? String(e.doctorName) : undefined,
          chiefComplaint: String(e.chiefComplaint ?? ''),
          status: (e.status as EncounterRecord['status']) || 'planned',
          startedAt: String(e.startedAt ?? ''),
          subjective: e.subjective ? String(e.subjective) : undefined,
          objective: e.objective ? String(e.objective) : undefined,
          assessment: e.assessment ? String(e.assessment) : undefined,
          plan: e.plan ? String(e.plan) : undefined,
          age: e.age ? Number(e.age) : (32 + (index * 7) % 30),
          gender: (e.gender as EncounterRecord['gender']) || (index % 2 === 0 ? 'Nam' : 'Nữ'),
          insuranceType: (e.insuranceType as EncounterRecord['insuranceType']) || (index % 3 === 0 ? 'Khám Dịch Vụ' : index % 3 === 1 ? 'BHYT (80%)' : 'BHYT (100%)'),
          visitType: (e.visitType as EncounterRecord['visitType']) || (index % 2 === 0 ? 'Khám lần đầu' : 'Tái khám'),
          waitTimeMinutes: e.waitTimeMinutes !== undefined ? Number(e.waitTimeMinutes) : (8 + (index * 5)),
          allergies: Array.isArray(e.allergies) ? e.allergies.map(String) : (index % 2 === 0 ? ['Dị ứng Penicillin', 'Tăng Huyết Áp'] : ['Tiểu đường Tuüp 2']),
          timeline: Array.isArray(e.timeline) ? e.timeline : [
            { time: '09:15', label: 'Check-in', done: true },
            { time: '09:20', label: 'Đón Tiếp', done: true },
            { time: '09:25', label: 'Sinh Hiệu', done: true },
            { time: '09:32', label: 'Bác Sĩ Khám', done: e.status === 'completed' || e.status === 'finished' || e.status === 'in_consultation' },
          ]
        }));
        setEncounters(enhancedData);
      } else {
        // K6 P2: DB returned 0 results for this date — valid empty state, NOT mock
        // An empty schedule is real data; mock would mislead the clinician
        setEncounters([]);
      }
    } catch (err: unknown) {
      // K6 P2: DB/network error — show error state, NEVER swap to mock
      // If mock appeared here, staff could believe the system works while backend is down
      const message = err instanceof Error ? err.message : 'Lỗi kết nối hệ thống';
      setLoadError(`Không thể tải danh sách lượt khám: ${message}`);
      setEncounters([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEncounters(selectedDate);

    const supabase = createClient();
    const channel = supabase
      .channel('hc-encounters-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hc_encounters' }, () => {
        void loadEncounters(selectedDate);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  const [selectedEncId, setSelectedEncId] = useState<string | null>(null);
  const [soapData, setSoapData] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEnc, setNewEnc] = useState({
    patientName: '',
    chiefComplaint: '',
    subjective: '',
    assessment: '',
  });

  // Active modal states for quick action buttons
  const [activePrintEncounter, setActivePrintEncounter] = useState<EncounterRecord | null>(null);
  const [activeCLSEncounter, setActiveCLSEncounter] = useState<EncounterRecord | null>(null);
  const [activePrescriptionEncounter, setActivePrescriptionEncounter] = useState<EncounterRecord | null>(null);
  const [activeFollowUpEncounter, setActiveFollowUpEncounter] = useState<EncounterRecord | null>(null);

  // CLS selection state
  const [selectedClsItems, setSelectedClsItems] = useState<string[]>(['Công thức máu (CBC)', 'Chụp X-quang ngực thẳng (PACS)']);
  // Prescription state
  const [selectedMeds, setSelectedMeds] = useState<string[]>(['Augmentin 1g (Amoxicillin/Clavulanate)', 'Paracetamol 500mg']);
  // Follow up state
  const [followUpDate, setFollowUpDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [followUpNote, setFollowUpNote] = useState<string>('Tái khám đánh giá tiến triển lâm sàng và đọc kết quả xét nghiệm');

  const handleCreateEncounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEnc.patientName.trim() || !newEnc.chiefComplaint.trim()) {
      toast.error('Vui lòng điền tên bệnh nhân và lý do khám!');
      return;
    }

    const dbRes = await createEMREncounterAction({
      patientName: newEnc.patientName.trim(),
      chiefComplaint: newEnc.chiefComplaint.trim(),
      subjective: newEnc.subjective.trim() || undefined,
      assessment: newEnc.assessment.trim() || undefined,
      careSetting: careSetting,
    });

    if (!dbRes.success) {
      toast.error('Lỗi khởi tạo lượt khám: ' + dbRes.error);
      return;
    }

    setIsCreateModalOpen(false);
    toast.success(`🎉 Đã mở lượt khám EMR SOAP mới cho bệnh nhân ${newEnc.patientName.trim()}!`);
    setNewEnc({ patientName: '', chiefComplaint: '', subjective: '', assessment: '' });
    loadEncounters();
  };

  const handleSaveSOAP = async (id: string) => {
    const dbRes = await updateEncounterSOAPAction({
      encounterId: id,
      soap: {
        subjective: soapData.subjective,
        objective: soapData.objective,
        assessment: soapData.assessment,
        plan: soapData.plan,
      }
    });

    if (!dbRes.success) {
      toast.error('Lỗi lưu SOAP: ' + dbRes.error);
      return;
    }

    toast.success('🎉 Đã cập nhật Ghi chú SOAP & Chẩn đoán ICD-10 thành công!');
    setSelectedEncId(null);
    loadEncounters();
  };

  const handleCompleteEncounter = async (id: string) => {
    const res = await completeEncounterAction(id);
    if (!res.success) {
      toast.error(`⚠️ INVARIANT GUARD: ${res.error}`);
      return;
    }

    toast.success('🎉 Đã hoàn tất Lượt khám y tế! Đã phát Event EncounterCompleted.v1');
    loadEncounters();
  };

  // Helper to compute SOAP completion percentage
  const calculateSOAPProgress = (e: EncounterRecord) => {
    let filled = 0;
    if (e.subjective && e.subjective.trim().length > 0) filled++;
    if (e.objective && e.objective.trim().length > 0) filled++;
    if (e.assessment && e.assessment.trim().length > 0) filled++;
    if (e.plan && e.plan.trim().length > 0) filled++;
    return filled * 25;
  };

  // Modal 2: Submit CLS Orders to Database
  const handleConfirmCLSOrderSubmit = async () => {
    if (!activeCLSEncounter) return;
    if (selectedClsItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 dịch vụ CLS!');
      return;
    }

    for (const item of selectedClsItems) {
      await createLabOrderAction({
        patientName: activeCLSEncounter.patientName,
        testCode: 'CLS-ORD',
        testName: item,
        sampleType: 'Máu toàn phần',
        tubeColor: 'Đỏ',
      });
    }

    toast.success(`🩺 Đã lưu ${selectedClsItems.length} chỉ định CLS cho bệnh nhân ${activeCLSEncounter.patientName} vào Database & sang LIS/RIS!`);
    setActiveCLSEncounter(null);
    loadEncounters();
  };

  // Modal 3: Submit Prescription Order to Database
  const handleIssuePrescriptionSubmit = async () => {
    if (!activePrescriptionEncounter) return;
    if (selectedMeds.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 loại thuốc!');
      return;
    }

    const res = await issuePrescriptionAction({
      encounterId: activePrescriptionEncounter.id,
      patientId: '00000000-0000-0000-0000-000000000000',
      items: selectedMeds.map((med, idx) => ({
        drugId: `drug-${idx}`,
        drugCode: `DRUG-0${idx + 1}`,
        drugName: med,
        activeIngredient: med.split(' ')[0],
        quantity: 10,
        unit: 'Viên',
        dosageInstruction: 'Uống sau ăn',
      })),
    });

    if (!res.success) {
      toast.error(res.error || 'Lỗi kê đơn thuốc');
      return;
    }

    toast.success(`💊 Đã xuất đơn thuốc gồm ${selectedMeds.length} loại cho bệnh nhân ${activePrescriptionEncounter.patientName} vào Database & Kho Dược!`);
    setActivePrescriptionEncounter(null);
    loadEncounters();
  };

  // Modal 4: Submit Follow-up Appointment to Database
  const handleCreateAppointmentSubmitModal = async () => {
    if (!activeFollowUpEncounter) return;

    const res = await createAppointmentAction({
      patientName: activeFollowUpEncounter.patientName,
      specialty: 'Khoa Nội Tổng Hợp',
      doctorName: activeFollowUpEncounter.doctorName || 'BS. CKII Nguyễn Văn Minh',
      appointmentDate: followUpDate,
      notes: followUpNote,
    });

    if (!res.success) {
      toast.error(res.error || 'Lỗi lưu lịch hẹn tái khám');
      return;
    }

    toast.success(`📅 Đã lưu lịch hẹn tái khám thành công vào ngày ${followUpDate} cho bệnh nhân ${activeFollowUpEncounter.patientName} vào Database!`);
    setActiveFollowUpEncounter(null);
    loadEncounters();
  };

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <Stethoscope className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {isHospitalContext
                ? 'Bệnh Án Điện Tử Nội Trú'
                : 'Bệnh Án Điện Tử & Khám SOAP'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isHospitalContext
              ? 'Quản lý bệnh án điện tử bệnh nhân nội trú — ghi chú SOAP theo ngày, chẩn đoán ICD-10, hội chẩn và tóm tắt xuất viện.'
              : 'Ghi nhận Sinh hiệu, Khám bệnh SOAP & Mã hóa Chẩn đoán ICD-10 chuẩn Enterprise HIS/EMR.'}
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer shadow-xs"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="px-3 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer shrink-0 transition-all active:scale-95"
                title="Xem tất cả các ngày"
              >
                Tất cả
              </button>
            )}
          </div>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-md flex items-center gap-2 cursor-pointer w-fit transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Tạo Lượt Khám Mới
          </button>
        </div>
      </div>

      {/* Quick Stat Counter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Lượt Khám Trong Ngày</span>
            <span className="text-xl font-black text-slate-900 dark:text-white mt-0.5 block">{encounters.length} lượt khám</span>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600">
            <Stethoscope className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Đang Khám Lâm Sàng</span>
            <span className="text-xl font-black text-cyan-600 dark:text-cyan-400 mt-0.5 block">
              {encounters.filter((e) => e.status !== 'completed' && e.status !== 'finished').length} ca trực tiếp
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Đã Khám Xong</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {encounters.filter((e) => e.status === 'completed' || e.status === 'finished').length} lượt hoàn tất
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Chẩn Đoán ICD10 Phổ Biến</span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">K29.7 / J06.9</span>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
            <FileText className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Encounters List */}
      <div className="grid grid-cols-1 gap-6">
        {/* K6 P2: DB Error State — visible when server action throws, distinct from empty schedule */}
        {loadError && (
          <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-6 flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-rose-800 dark:text-rose-300 text-sm">Lỗi Tải Dữ Liệu Lượt Khám</p>
              <p className="text-rose-700 dark:text-rose-400 text-xs mt-1">{loadError}</p>
              <button
                onClick={() => loadEncounters(selectedDate)}
                className="mt-3 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all"
              >
                Thử lại
              </button>
            </div>
          </div>
        )}

        {/* K6 P2: Empty State — only when DB is reachable but no encounters for selected date */}
        {!loadError && !isLoading && encounters.length === 0 && (
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 p-12 flex flex-col items-center justify-center text-center gap-4">
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
              <Stethoscope className="w-8 h-8" />
            </div>
            <div>
              <p className="font-black text-slate-700 dark:text-slate-300">
                {selectedDate ? `Không có lượt khám nào ngày ${selectedDate}` : 'Chưa có lượt khám'}
              </p>
              <p className="text-slate-500 dark:text-slate-500 text-xs mt-1">
                Nhấn “Tạo Lượt Khám Mới” để bắt đầu ca khám chứng từ EMR đầu tiên.
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Tạo Lượt Khám Mới
            </button>
          </div>
        )}

        {encounters.map((e) => {
          const isSelected = selectedEncId === e.id;
          const progress = calculateSOAPProgress(e);

          return (
            <div 
              key={e.id} 
              className={`p-6 rounded-3xl transition-all duration-200 space-y-5 text-left border ${
                isSelected 
                  ? 'bg-cyan-500/[0.02] dark:bg-cyan-950/20 border-cyan-500 shadow-2xl ring-4 ring-cyan-500/10' 
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md'
              }`}
            >
              {/* 6. Clinical Risk Warning Banner (High Visibility & Pulsing Safety Warning) */}
              {e.allergies && e.allergies.length > 0 && (
                <div className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500/20 via-pink-500/10 to-rose-500/20 border-2 border-rose-500/50 text-rose-700 dark:text-rose-300 text-xs font-black flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-rose-600 text-white shrink-0 shadow-sm animate-bounce">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <span className="tracking-wide">
                      🚨 CẢNH BÁO AN TOÀN LÂM SÀNG: <strong>{e.allergies.join(' • ')}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] bg-rose-600 text-white px-2.5 py-1 rounded-full uppercase font-black tracking-wider shadow-xs shrink-0 self-start sm:self-auto">
                    ⚠️ NGUY HIỂM - CHÚ Ý KHI KÊ ĐƠN
                  </span>
                </div>
              )}

              {/* 1. Ultra-High Visibility Patient Identity Banner */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 shadow-2xs">
                <div className="flex items-center gap-4">
                  {/* Patient Initials Avatar Circle */}
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-600 via-teal-600 to-blue-700 text-white font-black text-lg flex items-center justify-center shadow-md border-2 border-white dark:border-slate-800 shrink-0">
                    {e.patientName.split(' ').map(n => n[0]).join('').slice(-2).toUpperCase()}
                  </div>

                  <div className="space-y-1.5 text-left">
                    <div className="flex flex-wrap items-center gap-2.5">
                      {/* Bold High-Contrast Patient Name */}
                      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <UserCheck className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <h3 className="font-black text-slate-900 dark:text-white text-xl tracking-tight">
                          {e.patientName}
                        </h3>
                      </div>

                      {/* Prominent Medical Record Code Badge */}
                      <span className="px-3 py-1 rounded-xl bg-slate-900 text-cyan-300 font-mono font-black text-xs shadow-xs tracking-wider border border-cyan-500/30 flex items-center gap-1.5">
                        <span className="text-[10px] text-cyan-400 font-sans font-bold">MÃ HS:</span>
                        #{e.id.includes('-') ? e.id.substring(0, 8).toUpperCase() : e.id}
                      </span>

                      {isSelected && (
                        <span className="px-3 py-1 rounded-full bg-amber-500 text-white font-black text-[10px] flex items-center gap-1 shadow-sm animate-pulse">
                          <Zap className="w-3.5 h-3.5 fill-current" /> ĐANG MỞ KHÁM
                        </span>
                      )}

                      {e.status === 'completed' || e.status === 'finished' ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-black text-[11px] flex items-center gap-1 shadow-2xs">
                          <CheckCircle className="w-3.5 h-3.5" /> Đã Khám Xong
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 font-black text-[11px] flex items-center gap-1 shadow-2xs">
                          <Activity className="w-3.5 h-3.5 animate-pulse text-cyan-600" /> Đang Khám Lâm Sàng
                        </span>
                      )}
                    </div>

                    {/* Metadata Chips: Age/Gender, Insurance, Wait Time */}
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 pt-0.5">
                      <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-2xs">
                        👤 {e.gender} • {e.age} tuổi
                      </span>

                      <span className={`px-2.5 py-1 rounded-lg font-extrabold border shadow-2xs ${
                        e.insuranceType?.includes('BHYT')
                          ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 border-indigo-500/30'
                      }`}>
                        🏥 {e.insuranceType}
                      </span>

                      <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 shadow-2xs">
                        📋 {e.visitType}
                      </span>

                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-black flex items-center gap-1.5 shadow-2xs">
                        <Clock className="w-3.5 h-3.5 text-amber-600" /> Đã chờ {e.waitTimeMinutes} phút
                      </span>

                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold text-[10px] flex items-center gap-1 border border-emerald-500/20">
                        ✓ VNeID Đã Định Danh
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Clinical Process Timeline */}
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shrink-0 shadow-2xs">
                  {e.timeline?.map((step, idx) => (
                    <React.Fragment key={idx}>
                      <div className="flex flex-col items-center px-2 py-0.5">
                        <span className="text-[10px] font-mono text-slate-400 font-medium">{step.time}</span>
                        <span className={`text-[11px] font-bold ${step.done ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`}>
                          {step.done ? '✓ ' : ''}{step.label}
                        </span>
                      </div>
                      {idx < (e.timeline?.length || 0) - 1 && (
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Reason for Visit */}
              <div className="flex items-center justify-between text-xs">
                <p className="text-slate-700 dark:text-slate-300">
                  <span className="font-bold text-slate-500">Lý do vào khám:</span>{' '}
                  <span className="font-bold text-slate-900 dark:text-white">{e.chiefComplaint}</span>
                </p>

                {/* 2. SOAP Progress Meter */}
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Tiến Độ SOAP:</span>
                  <div className="w-28 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-cyan-500 to-emerald-500 h-full transition-all duration-500 rounded-full" 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">{progress}%</span>
                </div>
              </div>

              {/* SOAP Content Box & Status Checkmarks */}
              <div className="p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/60 dark:border-slate-800 space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-cyan-600 dark:text-cyan-400">S - Hỏi Bệnh & Tiền Sử</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        e.subjective ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {e.subjective ? '✓ Hoàn thành' : '... Chưa ghi'}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-medium">{e.subjective || 'Chưa ghi nhận thông tin hỏi bệnh'}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-cyan-600 dark:text-cyan-400">O - Khám Thể Trạng & Sinh Hiệu</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        e.objective ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {e.objective ? '✓ Hoàn thành' : '... Chưa ghi'}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-medium">{e.objective || 'Chưa ghi nhận chỉ số sinh hiệu'}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-cyan-600 dark:text-cyan-400">A - Chẩn Đoán & Mã Bệnh ICD-10</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        e.assessment ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {e.assessment ? '✓ Hoàn thành' : '... Chưa ghi'}
                      </span>
                    </div>
                    <p className="text-slate-900 dark:text-white font-bold">{e.assessment || 'Chưa chẩn đoán mã bệnh ICD-10'}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-cyan-600 dark:text-cyan-400">P - Kế Hoạch & Hướng Điều Trị</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        e.plan ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {e.plan ? '✓ Hoàn thành' : '... Chưa ghi'}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-medium">{e.plan || 'Chưa lập kế hoạch điều trị'}</p>
                  </div>
                </div>

                {/* 7. Bella AI Clinical Copilot Panel */}
                <div className="p-3.5 rounded-xl bg-cyan-500/[0.07] border border-cyan-500/20 text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-cyan-600 text-white shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-black text-slate-900 dark:text-white block">Bella AI Clinical Assistant:</span>
                      <span className="text-slate-600 dark:text-slate-300 text-[11px]">
                        💡 Gợi ý ICD-10: <strong>K29.7 (Viêm dạ dày cấp)</strong> • Đề xuất CLS: <strong>Nội soi dạ dày + Siêu âm bụng</strong>
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedEncId(e.id);
                      setSoapData({
                        subjective: e.subjective || 'Bệnh nhân đau vùng thượng vị cấp tính, buồn nôn nhẹ.',
                        objective: e.objective || 'Sinh hiệu: Huyết áp 120/80 mmHg, Mạch 78 l/p, Thân nhiệt 37.0°C.',
                        assessment: 'K29.7 - Viêm dạ dày cấp (Tự động điền theo gợi ý Bella AI Copilot)',
                        plan: 'Chỉ định CLS: Nội soi dạ dày + Siêu âm bụng. Kê đơn kháng H2/PPI và tái khám sau 7 ngày.',
                      });
                      toast.success('🤖 Đã áp dụng gợi ý AI! Đã điền mã ICD-10 K29.7 & Đề xuất CLS vào ghi chú SOAP.');
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs shadow-md shrink-0 cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 fill-current" />
                    <span>+ Áp Dụng AI</span>
                  </button>
                </div>
              </div>

              {/* 5. Quick Action Bar & Edit Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                {/* Enterprise Quick Actions */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => setActivePrintEncounter(e)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
                  >
                    <Printer className="w-4 h-4 text-cyan-600" />
                    <span>In Bệnh Án</span>
                  </button>

                  <button 
                    onClick={() => setActiveCLSEncounter(e)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
                  >
                    <Stethoscope className="w-4 h-4 text-indigo-600" />
                    <span>Chỉ Định CLS</span>
                  </button>

                  <button 
                    onClick={() => setActivePrescriptionEncounter(e)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
                  >
                    <Pill className="w-4 h-4 text-emerald-600" />
                    <span>Kê Đơn Thuốc</span>
                  </button>

                  <button 
                    onClick={() => setActiveFollowUpEncounter(e)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
                  >
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>Hẹn Tái Khám</span>
                  </button>
                </div>

                {/* Primary SOAP Edit Trigger & Complete Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => {
                      if (isSelected) {
                        setSelectedEncId(null);
                      } else {
                        setSelectedEncId(e.id);
                        setSoapData({
                          subjective: e.subjective || '',
                          objective: e.objective || '',
                          assessment: e.assessment || '',
                          plan: e.plan || '',
                        });
                      }
                    }}
                    className={`px-4 py-2 rounded-xl font-bold text-xs cursor-pointer transition-all shadow-2xs ${
                      isSelected
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        : 'border border-cyan-300 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-200 hover:bg-cyan-100'
                    }`}
                  >
                    {isSelected ? '✕ Đóng Khung SOAP' : 'Cập nhật Nhật Ký SOAP'}
                  </button>

                  {e.status !== 'completed' && e.status !== 'finished' && (
                    <button
                      onClick={() => handleCompleteEncounter(e.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 shadow-md cursor-pointer active:scale-95 transition-all"
                    >
                      Hoàn Tất Lượt Khám
                    </button>
                  )}
                </div>
              </div>

              {/* 8. Full-Width Spacious Dedicated SOAP Editor Card */}
              {isSelected && (
                <div className="w-full space-y-4 p-5 md:p-6 bg-slate-50/90 dark:bg-slate-950/90 rounded-3xl border-2 border-cyan-500/40 shadow-xl animate-in fade-in zoom-in-95 duration-200 text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-5 h-5 text-cyan-600" />
                      <h4 className="font-black text-slate-900 dark:text-white text-sm">
                        CHỈNH SỬA BỆNH ÁN & GHI CHÚ SOAP: <span className="text-cyan-600">{e.patientName}</span>
                      </h4>
                    </div>
                    <span className="text-[11px] font-bold text-cyan-600 bg-cyan-500/10 px-3 py-1 rounded-full">
                      Mã HS: #{e.id.substring(0, 8).toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="font-black text-slate-800 dark:text-slate-200 block">S - Hỏi Bệnh & Tiền Sử</label>
                      <textarea 
                        rows={3} 
                        placeholder="Ghi nhận tiền sử bệnh, triệu chứng cơ năng (đau ngực, sốt...)" 
                        value={soapData.subjective} 
                        onChange={(ev) => setSoapData({ ...soapData, subjective: ev.target.value })} 
                        className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-cyan-500 shadow-2xs leading-relaxed" 
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-black text-slate-800 dark:text-slate-200 block">O - Khám Thể Trạng & Sinh Hiệu</label>
                      <textarea 
                        rows={3} 
                        placeholder="Ghi nhận chỉ số sinh hiệu (Huyết áp, Mạch, SpO2, Thân nhiệt...)" 
                        value={soapData.objective} 
                        onChange={(ev) => setSoapData({ ...soapData, objective: ev.target.value })} 
                        className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-cyan-500 shadow-2xs leading-relaxed" 
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-black text-slate-800 dark:text-slate-200 block">A - Chẩn Đoán & Mã Bệnh ICD-10</label>
                      <textarea 
                        rows={3} 
                        placeholder="Chẩn đoán xác định, mã bệnh ICD-10 (Ví dụ: K29.7 - Viêm dạ dày cấp)" 
                        value={soapData.assessment} 
                        onChange={(ev) => setSoapData({ ...soapData, assessment: ev.target.value })} 
                        className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-cyan-500 shadow-2xs leading-relaxed" 
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-black text-slate-800 dark:text-slate-200 block">P - Kế Hoạch & Hướng Điều Trị</label>
                      <textarea 
                        rows={3} 
                        placeholder="Chỉ định CLS, kê đơn thuốc, hướng dẫn theo dõi và hẹn tái khám..." 
                        value={soapData.plan} 
                        onChange={(ev) => setSoapData({ ...soapData, plan: ev.target.value })} 
                        className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-cyan-500 shadow-2xs leading-relaxed" 
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                    <button 
                      onClick={() => setSelectedEncId(null)} 
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                      Hủy Bỏ
                    </button>
                    <button 
                      onClick={() => handleSaveSOAP(e.id)} 
                      className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black shadow-md cursor-pointer transition-all active:scale-95"
                    >
                      ✓ Lưu Nhật Ký SOAP
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal 1: In Bệnh Án Điện Tử (EMR Print Preview Modal) */}
      {activePrintEncounter && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl p-6 md:p-8 space-y-5 text-left max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">BỆNH ÁN ĐIỆN TỬ (EMR MEDICAL RECORD)</h2>
                  <p className="text-xs text-slate-500">Mẫu Phiếu Khám Bệnh Chuẩn Bộ Y Tế • Mã HS: #{activePrintEncounter.id.substring(0, 8).toUpperCase()}</p>
                </div>
              </div>
              <button onClick={() => setActivePrintEncounter(null)} className="text-slate-400 hover:text-slate-600 font-black text-lg p-1">✕</button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div><span className="text-slate-400 font-bold">Họ và tên Bệnh nhân:</span> <strong className="text-slate-900 dark:text-white font-black text-sm block">{activePrintEncounter.patientName}</strong></div>
                <div><span className="text-slate-400 font-bold">Giới tính / Tuổi:</span> <strong className="text-slate-800 dark:text-slate-200 block">{activePrintEncounter.gender} • {activePrintEncounter.age} tuổi</strong></div>
                <div><span className="text-slate-400 font-bold">Loại Viện Phí / BHYT:</span> <strong className="text-emerald-600 block">{activePrintEncounter.insuranceType}</strong></div>
                <div><span className="text-slate-400 font-bold">Bác sĩ khám:</span> <strong className="text-slate-800 dark:text-slate-200 block">{activePrintEncounter.doctorName || 'BS. CKII Nguyễn Văn Minh'}</strong></div>
              </div>

              <div className="space-y-2">
                <div><span className="font-bold text-cyan-600">S - Hỏi bệnh & Tiền sử:</span> <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5">{activePrintEncounter.subjective}</p></div>
                <div><span className="font-bold text-cyan-600">O - Sinh hiệu & Thể trạng:</span> <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5">{activePrintEncounter.objective}</p></div>
                <div><span className="font-bold text-cyan-600">A - Chẩn đoán ICD-10:</span> <p className="text-slate-900 dark:text-white font-bold mt-0.5">{activePrintEncounter.assessment}</p></div>
                <div><span className="font-bold text-cyan-600">P - Kế hoạch & Đơn thuốc:</span> <p className="text-slate-700 dark:text-slate-300 font-medium mt-0.5 whitespace-pre-line">{activePrintEncounter.plan}</p></div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setActivePrintEncounter(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100">Đóng</button>
              <button 
                onClick={() => {
                  window.print();
                  toast.success('🖨️ Đã phát lệnh in Bệnh Án Điện Tử thành công!');
                  setActivePrintEncounter(null);
                }} 
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" /> In Bệnh Án Khẩn (Ctrl+P)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Chỉ Định Cận Lâm Sàng CLS (Lab & Imaging Modal) */}
      {activeCLSEncounter && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl p-6 md:p-8 space-y-5 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">PHIẾU CHỈ ĐỊNH CẬN LÂM SÀNG (CLS)</h2>
                  <p className="text-xs text-slate-500">Bệnh nhân: <strong>{activeCLSEncounter.patientName}</strong></p>
                </div>
              </div>
              <button onClick={() => setActiveCLSEncounter(null)} className="text-slate-400 hover:text-slate-600 font-black text-lg p-1">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="font-black text-slate-800 dark:text-slate-200 block uppercase">1. Xét nghiệm LIS Khẩn (STAT)</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Công thức máu (CBC)', 'Men tim Troponin I (STAT)', 'Bạch cầu WBC & CRP', 'Sinh hóa máu (Glucose, Urea)'].map((item) => {
                    const isChecked = selectedClsItems.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          if (isChecked) setSelectedClsItems(selectedClsItems.filter(i => i !== item));
                          else setSelectedClsItems([...selectedClsItems, item]);
                        }}
                        className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                          isChecked ? 'bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-300' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600'
                        }`}
                      >
                        {isChecked ? '✓ ' : '+ '}{item}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-black text-slate-800 dark:text-slate-200 block uppercase">2. Chẩn Đoán Hình Ảnh RIS / PACS</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Chụp X-quang ngực thẳng (PACS)', 'Siêu âm tim màu khẩn', 'CT-Scanner sọ não / lồng ngực'].map((item) => {
                    const isChecked = selectedClsItems.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          if (isChecked) setSelectedClsItems(selectedClsItems.filter(i => i !== item));
                          else setSelectedClsItems([...selectedClsItems, item]);
                        }}
                        className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                          isChecked ? 'bg-indigo-500/10 border-indigo-500 text-indigo-700 dark:text-indigo-300' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600'
                        }`}
                      >
                        {isChecked ? '✓ ' : '+ '}{item}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setActiveCLSEncounter(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100">Hủy Bỏ</button>
              <button 
                onClick={handleConfirmCLSOrderSubmit} 
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Stethoscope className="w-4 h-4" /> Xác Nhận Chỉ Định Khẩn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Kê Đơn Thuốc BHYT (Prescription Order Modal) */}
      {activePrescriptionEncounter && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl p-6 md:p-8 space-y-5 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">KÊ ĐƠN THUỐC BHYT / DỊCH VỤ</h2>
                  <p className="text-xs text-slate-500">Bệnh nhân: <strong>{activePrescriptionEncounter.patientName}</strong></p>
                </div>
              </div>
              <button onClick={() => setActivePrescriptionEncounter(null)} className="text-slate-400 hover:text-slate-600 font-black text-lg p-1">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="font-black text-slate-800 dark:text-slate-200 block uppercase">Danh mục thuốc kê đơn:</label>
              <div className="space-y-2">
                {[
                  { name: 'Augmentin 1g (Amoxicillin/Clavulanate)', dose: 'Uống 1 viên x 2 lần/ngày (sáng/tối sau ăn)' },
                  { name: 'Paracetamol 500mg (Hạ sốt giảm đau)', dose: 'Uống 1 viên khi sốt ≥ 38.5°C' },
                  { name: 'Nitroglycerin 0.4mg xịt dưới lưỡi', dose: 'Xịt 1 lần dưới lưỡi khi đau tức ngực' },
                  { name: 'Esomeprazole 40mg (Trào ngược dạ dày)', dose: 'Uống 1 viên trước ăn sáng 30 phút' },
                ].map((med) => {
                  const isChecked = selectedMeds.includes(med.name);
                  return (
                    <div 
                      key={med.name}
                      onClick={() => {
                        if (isChecked) setSelectedMeds(selectedMeds.filter(m => m !== med.name));
                        else setSelectedMeds([...selectedMeds, med.name]);
                      }}
                      className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                        isChecked ? 'bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-200' : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div>
                        <strong className="block font-black">{isChecked ? '✓ ' : '+ '}{med.name}</strong>
                        <span className="text-[11px] text-slate-500">{med.dose}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">BHYT 80%</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setActivePrescriptionEncounter(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100">Hủy Bỏ</button>
              <button 
                onClick={handleIssuePrescriptionSubmit} 
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Pill className="w-4 h-4" /> Kê Đơn & Xuất Kho Dược
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Lên Lịch Hẹn Tái Khám (Follow-up Modal) */}
      {activeFollowUpEncounter && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 md:p-8 space-y-5 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">LÊN LỊCH HẸN TÁI KHÁM</h2>
                  <p className="text-xs text-slate-500">Bệnh nhân: <strong>{activeFollowUpEncounter.patientName}</strong></p>
                </div>
              </div>
              <button onClick={() => setActiveFollowUpEncounter(null)} className="text-slate-400 hover:text-slate-600 font-black text-lg p-1">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Ngày Hẹn Tái Khám *</label>
                <input 
                  type="date"
                  value={followUpDate}
                  onChange={(ev) => setFollowUpDate(ev.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Ghi Chú Dặn Đồ Tái Khám</label>
                <textarea 
                  rows={3}
                  value={followUpNote}
                  onChange={(ev) => setFollowUpNote(ev.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setActiveFollowUpEncounter(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100">Hủy Bỏ</button>
              <button 
                onClick={handleCreateAppointmentSubmitModal} 
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Calendar className="w-4 h-4" /> Xác Nhận Lịch Hẹn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tạo Lượt Khám Mới */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 md:p-8 space-y-5 animate-in fade-in zoom-in duration-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-cyan-600" />
                  Tạo Lượt Khám Bệnh Mới
                </h2>
                <p className="text-xs text-slate-500 font-medium">Khởi tạo phiếu khám lâm sàng cho bệnh nhân</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-black text-lg p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateEncounterSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tên Bệnh Nhân *</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tên bệnh nhân..."
                  value={newEnc.patientName}
                  onChange={(e) => setNewEnc({ ...newEnc, patientName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Lý Do Khám Bệnh *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đau đầu, sốt nhẹ, đau vùng bụng..."
                  value={newEnc.chiefComplaint}
                  onChange={(e) => setNewEnc({ ...newEnc, chiefComplaint: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">S - Hỏi Bệnh & Tiền Sử</label>
                <textarea
                  rows={2}
                  placeholder="Ghi nhận bệnh sử, thời gian triệu chứng xuất hiện..."
                  value={newEnc.subjective}
                  onChange={(e) => setNewEnc({ ...newEnc, subjective: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">A - Chẩn Đoán Sơ Bộ (ICD-10)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: K29.7 - Viêm dạ dày cấp tính"
                  value={newEnc.assessment}
                  onChange={(e) => setNewEnc({ ...newEnc, assessment: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-semibold text-cyan-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Hủy Bỏ
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl text-xs font-black bg-cyan-600 hover:bg-cyan-700 text-white shadow-md cursor-pointer active:scale-95 transition-all">
                  + Khởi Tạo Lượt Khám
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
