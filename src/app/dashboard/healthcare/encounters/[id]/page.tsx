'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  ClipboardList, 
  User, 
  Calendar, 
  Clock, 
  FileText, 
  Activity,
  Heart,
  Pill,
  Stethoscope,
  AlertCircle,
  CheckCircle,
  Edit,
  Trash2,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

interface EncounterDetail {
  readonly id: string;
  readonly patientName: string;
  readonly patientId: string;
  readonly doctorName: string;
  readonly doctorId: string;
  readonly status: 'planned' | 'arrived' | 'in_progress' | 'finished';
  readonly chiefComplaint: string;
  readonly queueNumber?: number;
  readonly scheduledAt?: string;
  readonly arrivedAt?: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  readonly subjective?: string;
  readonly objective?: string;
  readonly assessment?: string;
  readonly plan?: string;
  readonly diagnoses?: string[];
  readonly procedures?: string[];
  readonly medications?: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
  readonly vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    weight?: number;
  };
  readonly notes?: string;
}

export default function EncounterDetailPage() {
  const router = useRouter();
  const params = useParams();
  const encounterId = params.id as string;

  // Mock data - trong production sẽ fetch từ API
  const [encounter, setEncounter] = useState<EncounterDetail>({
    id: encounterId,
    patientName: 'Nguyễn Văn Hùng',
    patientId: 'pat-01',
    doctorName: 'Lê Minh',
    doctorId: 'doc-01',
    status: 'in_progress',
    chiefComplaint: 'Đau răng hàm trái, sưng nướu',
    queueNumber: 102,
    arrivedAt: '2026-08-05T09:15:00',
    startedAt: '2026-08-05T09:30:00',
    subjective: 'Bệnh nhân than phiền đau nhức răng hàm dưới bên trái khoảng 3 ngày, đau tăng khi ăn nhai. Có sưng nướu, chảy máu nhẹ khi đánh răng.',
    objective: 'Khám lâm sàng: Răng #36 sâu sâu độ 2, nướu quanh răng sưng đỏ. Không có áp xe.',
    assessment: 'Sâu răng #36, viêm nướu',
    plan: 'Trám răng composite, tư vấn vệ sinh răng miệng',
    diagnoses: ['Sâu răng #36', 'Viêm nướu'],
    procedures: ['Trám composite răng #36', 'Làm sạch cao răng'],
    medications: [
      { name: 'Amoxicillin 500mg', dosage: '1 viên', frequency: 'Uống 3 lần/ngày sau ăn, 5 ngày' },
      { name: 'Ibuprofen 400mg', dosage: '1 viên', frequency: 'Khi đau' },
    ],
    vitalSigns: {
      bloodPressure: '120/80',
      heartRate: 72,
      temperature: 36.5,
      weight: 68,
    },
    notes: 'Hẹn tái khám sau 1 tuần để kiểm tra vết trám',
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editedSubjective, setEditedSubjective] = useState(encounter.subjective || '');
  const [editedObjective, setEditedObjective] = useState(encounter.objective || '');
  const [editedAssessment, setEditedAssessment] = useState(encounter.assessment || '');
  const [editedPlan, setEditedPlan] = useState(encounter.plan || '');

  // Notes & Vitals fast editing state
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState(encounter.notes || '');

  const [isEditingVitals, setIsEditingVitals] = useState(false);
  const [editedBp, setEditedBp] = useState(encounter.vitalSigns?.bloodPressure || '120/80');
  const [editedHr, setEditedHr] = useState(String(encounter.vitalSigns?.heartRate || 72));
  const [editedTemp, setEditedTemp] = useState(String(encounter.vitalSigns?.temperature || 36.5));
  const [editedWeight, setEditedWeight] = useState(String(encounter.vitalSigns?.weight || 68));

  const getStatusBadge = (status: EncounterDetail['status']) => {
    switch (status) {
      case 'planned':
        return (
          <span className="px-3 py-1 text-xs font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 border border-blue-100 rounded-lg inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            LÊN LỊCH HẸN
          </span>
        );
      case 'arrived':
        return (
          <span className="px-3 py-1 text-xs font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 rounded-lg inline-flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            PHÒNG CHỜ
          </span>
        );
      case 'in_progress':
        return (
          <span className="px-3 py-1 text-xs font-bold bg-teal-50 text-teal-600 dark:bg-teal-950/20 dark:text-teal-400 border border-teal-100 rounded-lg inline-flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            ĐANG ĐIỀU TRỊ
          </span>
        );
      case 'finished':
        return (
          <span className="px-3 py-1 text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 rounded-lg inline-flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            ĐÃ HOÀN TẤT
          </span>
        );
    }
  };

  const handleSaveSOAP = () => {
    setEncounter({
      ...encounter,
      subjective: editedSubjective,
      objective: editedObjective,
      assessment: editedAssessment,
      plan: editedPlan,
    });
    setIsEditing(false);
    toast.success('✅ Đã lưu thông tin SOAP Note');
  };

  const handleCompleteEncounter = () => {
    setEncounter({
      ...encounter,
      status: 'finished',
      finishedAt: new Date().toISOString(),
    });
    toast.success('✅ Đã hoàn tất lượt khám bệnh');
  };

  // Medication Prescription modal states
  const [showMedModal, setShowMedModal] = useState(false);
  const [editingMedIndex, setEditingMedIndex] = useState<number | null>(null);
  const [medName, setMedName] = useState('');
  const [customMedName, setCustomMedName] = useState('');
  const [medDosage, setMedDosage] = useState('1 viên / lần');
  const [medFrequency, setMedFrequency] = useState('Uống 3 lần/ngày sau ăn, dùng 5 ngày');

  const commonMedications = [
    { value: 'Amoxicillin 500mg', label: 'Amoxicillin 500mg (Kháng sinh phổ rộng)' },
    { value: 'Augmentin 625mg', label: 'Augmentin 625mg (Amoxicillin + Clavulanate)' },
    { value: 'Ibuprofen 400mg', label: 'Ibuprofen 400mg (Giảm đau, chống viêm)' },
    { value: 'Paracetamol 500mg', label: 'Paracetamol 500mg (Giảm đau, hạ sốt)' },
    { value: 'Clindamycin 300mg', label: 'Clindamycin 300mg (Kháng sinh thay thế)' },
    { value: 'Metronidazole 250mg', label: 'Metronidazole 250mg (Kháng khuẩn nướu/răng)' },
    { value: 'Prednisolone 5mg', label: 'Prednisolone 5mg (Chống viêm sưng cấp)' },
    { value: 'Spidifen 400mg', label: 'Spidifen 400mg (Giảm đau răng cấp tính)' },
    { value: 'custom', label: '✍️ Nhập tên thuốc khác...' },
  ];

  const handleOpenAddMedModal = () => {
    setEditingMedIndex(null);
    setMedName('Amoxicillin 500mg');
    setCustomMedName('');
    setMedDosage('1 viên / lần');
    setMedFrequency('Uống 3 lần/ngày sau ăn, dùng 5 ngày');
    setShowMedModal(true);
  };

  const handleOpenEditMedModal = (index: number) => {
    const med = encounter.medications?.[index];
    if (!med) return;
    setEditingMedIndex(index);
    const matchedOption = commonMedications.find(m => m.value === med.name);
    if (matchedOption) {
      setMedName(med.name);
      setCustomMedName('');
    } else {
      setMedName('custom');
      setCustomMedName(med.name);
    }
    setMedDosage(med.dosage);
    setMedFrequency(med.frequency);
    setShowMedModal(true);
  };

  const handleSaveMedication = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = medName === 'custom' ? customMedName.trim() : medName;
    if (!finalName) {
      toast.error('Vui lòng chọn hoặc nhập tên thuốc');
      return;
    }
    if (!medDosage.trim() || !medFrequency.trim()) {
      toast.error('Vui lòng nhập đầy đủ liều dùng và cách dùng');
      return;
    }

    const newMed = {
      name: finalName,
      dosage: medDosage,
      frequency: medFrequency,
    };

    const currentMeds = encounter.medications || [];
    let updatedMeds: Array<{ name: string; dosage: string; frequency: string }>;

    if (editingMedIndex !== null) {
      updatedMeds = currentMeds.map((m, idx) => (idx === editingMedIndex ? newMed : m));
      toast.success('🎉 Đã cập nhật thông tin thuốc trong đơn');
    } else {
      updatedMeds = [...currentMeds, newMed];
      toast.success('🎉 Đã thêm thuốc mới vào đơn thuốc của bệnh nhân');
    }

    setEncounter({ ...encounter, medications: updatedMeds });
    setShowMedModal(false);
  };

  const handleDeleteMedication = (index: number) => {
    const currentMeds = encounter.medications || [];
    const medToDelete = currentMeds[index];
    const updatedMeds = currentMeds.filter((_, idx) => idx !== index);
    setEncounter({ ...encounter, medications: updatedMeds });
    toast.info(`Đã xóa thuốc ${medToDelete?.name || ''} khỏi đơn`);
  };

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>

        <div className="flex items-center gap-3">
          {encounter.status !== 'finished' && (
            <button
              onClick={handleCompleteEncounter}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              Hoàn tất khám bệnh
            </button>
          )}
        </div>
      </div>

      {/* Patient & Encounter Info Card */}
      <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)]">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ClipboardList className="w-6 h-6 text-teal-600" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                Chi tiết lượt khám #{encounter.queueNumber || 'N/A'}
              </h1>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Mã lượt khám: <span className="font-mono font-semibold">{encounter.id}</span>
            </p>
          </div>
          {getStatusBadge(encounter.status)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-0.5">Bệnh nhân</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{encounter.patientName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">ID: {encounter.patientId}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Stethoscope className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-0.5">Bác sĩ phụ trách</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{encounter.doctorName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">ID: {encounter.doctorId}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Thời gian</p>
                {encounter.scheduledAt && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Hẹn:</span> {new Date(encounter.scheduledAt).toLocaleString('vi-VN')}
                  </p>
                )}
                {encounter.arrivedAt && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Đến:</span> {new Date(encounter.arrivedAt).toLocaleString('vi-VN')}
                  </p>
                )}
                {encounter.startedAt && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Bắt đầu:</span> {new Date(encounter.startedAt).toLocaleString('vi-VN')}
                  </p>
                )}
                {encounter.finishedAt && (
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Kết thúc:</span> {new Date(encounter.finishedAt).toLocaleString('vi-VN')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-slate-400 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-0.5">Lý do khám</p>
                <p className="text-sm text-slate-900 dark:text-white">{encounter.chiefComplaint}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Vital Signs */}
      <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-rose-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Dấu hiệu sinh tồn</h2>
          </div>
          <button
            onClick={() => {
              if (isEditingVitals) {
                setEncounter({
                  ...encounter,
                  vitalSigns: {
                    bloodPressure: editedBp,
                    heartRate: Number(editedHr) || 72,
                    temperature: Number(editedTemp) || 36.5,
                    weight: Number(editedWeight) || 68,
                  },
                });
                setIsEditingVitals(false);
                toast.success('🎉 Đã cập nhật chỉ số sinh hiệu');
              } else {
                setIsEditingVitals(true);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 font-bold text-xs rounded-xl transition-all"
          >
            {isEditingVitals ? <Save className="w-3.5 h-3.5" /> : <Edit className="w-3.5 h-3.5" />}
            <span>{isEditingVitals ? 'Lưu sinh hiệu' : 'Sửa sinh hiệu'}</span>
          </button>
        </div>

        {isEditingVitals ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-rose-700 uppercase">Huyết áp (mmHg)</label>
              <input
                type="text"
                value={editedBp}
                onChange={(e) => setEditedBp(e.target.value)}
                placeholder="120/80"
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-rose-200 outline-none focus:border-rose-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-rose-700 uppercase">Nhịp tim (lần/phút)</label>
              <input
                type="number"
                value={editedHr}
                onChange={(e) => setEditedHr(e.target.value)}
                placeholder="72"
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-rose-200 outline-none focus:border-rose-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-rose-700 uppercase">Nhiệt độ (°C)</label>
              <input
                type="number"
                step="0.1"
                value={editedTemp}
                onChange={(e) => setEditedTemp(e.target.value)}
                placeholder="36.5"
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-rose-200 outline-none focus:border-rose-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-rose-700 uppercase">Cân nặng (kg)</label>
              <input
                type="number"
                step="0.5"
                value={editedWeight}
                onChange={(e) => setEditedWeight(e.target.value)}
                placeholder="68"
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-rose-200 outline-none focus:border-rose-500"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Huyết áp</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{encounter.vitalSigns?.bloodPressure || '120/80'}</p>
              <p className="text-xs text-slate-500">mmHg</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Nhịp tim</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{encounter.vitalSigns?.heartRate || 72}</p>
              <p className="text-xs text-slate-500">lần/phút</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Nhiệt độ</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{encounter.vitalSigns?.temperature || 36.5}</p>
              <p className="text-xs text-slate-500">°C</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Cân nặng</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{encounter.vitalSigns?.weight || 68}</p>
              <p className="text-xs text-slate-500">kg</p>
            </div>
          </div>
        )}
      </div>

      {/* SOAP Note */}
      <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">SOAP Note</h2>
          </div>
          <button
            onClick={() => (isEditing ? handleSaveSOAP() : setIsEditing(true))}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 transition-colors"
          >
            {isEditing ? (
              <>
                <Save className="w-4 h-4" />
                Lưu SOAP
              </>
            ) : (
              <>
                <Edit className="w-4 h-4" />
                Chỉnh sửa
              </>
            )}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
              S - Subjective (Triệu chứng chủ quan)
            </label>
            {isEditing ? (
              <textarea
                value={editedSubjective}
                onChange={(e) => setEditedSubjective(e.target.value)}
                className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                rows={3}
              />
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-300 p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                {encounter.subjective || 'Chưa có thông tin'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
              O - Objective (Khám lâm sàng)
            </label>
            {isEditing ? (
              <textarea
                value={editedObjective}
                onChange={(e) => setEditedObjective(e.target.value)}
                className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                rows={3}
              />
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-300 p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                {encounter.objective || 'Chưa có thông tin'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
              A - Assessment (Chẩn đoán)
            </label>
            {isEditing ? (
              <textarea
                value={editedAssessment}
                onChange={(e) => setEditedAssessment(e.target.value)}
                className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                rows={2}
              />
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-300 p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                {encounter.assessment || 'Chưa có thông tin'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
              P - Plan (Kế hoạch điều trị & Kê đơn)
            </label>
            {isEditing ? (
              <textarea
                value={editedPlan}
                onChange={(e) => setEditedPlan(e.target.value)}
                className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                rows={3}
              />
            ) : (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 space-y-2">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {encounter.plan || 'Chưa có thông tin'}
                </p>
                <button
                  onClick={handleOpenAddMedModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all"
                >
                  <Pill className="w-3.5 h-3.5" />
                  Kê đơn thuốc ngay
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Diagnoses */}
      <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Chẩn đoán</h2>
            {encounter.diagnoses && encounter.diagnoses.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-black bg-blue-100 text-blue-700 rounded-full">
                {encounter.diagnoses.length}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              const input = prompt('Nhập tên chẩn đoán mới (VD: Viêm tủy răng #46):');
              if (input && input.trim()) {
                const updated = [...(encounter.diagnoses || []), input.trim()];
                setEncounter({ ...encounter, diagnoses: updated });
                toast.success('🎉 Đã thêm chẩn đoán mới');
              }
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-400 font-bold text-xs rounded-xl transition-all"
          >
            + Thêm chẩn đoán
          </button>
        </div>
        {encounter.diagnoses && encounter.diagnoses.length > 0 ? (
          <div className="space-y-2">
            {encounter.diagnoses.map((diagnosis, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                  <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">{diagnosis}</p>
                </div>
                <button
                  onClick={() => {
                    const updated = encounter.diagnoses?.filter((_, i) => i !== idx);
                    setEncounter({ ...encounter, diagnoses: updated });
                    toast.info('Đã xóa chẩn đoán');
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                  title="Xóa chẩn đoán"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa có chẩn đoán nào. Bấm nút "+ Thêm chẩn đoán" ở trên để bổ sung.</p>
        )}
      </div>

      {/* Procedures */}
      <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Thủ thuật / Dịch vụ</h2>
            {encounter.procedures && encounter.procedures.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-black bg-teal-100 text-teal-700 rounded-full">
                {encounter.procedures.length}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              const input = prompt('Nhập thủ thuật/dịch vụ mới (VD: Cấy ghép trụ Implant Nobel):');
              if (input && input.trim()) {
                const updated = [...(encounter.procedures || []), input.trim()];
                setEncounter({ ...encounter, procedures: updated });
                toast.success('🎉 Đã thêm thủ thuật mới');
              }
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-teal-50 text-teal-600 hover:bg-teal-100 dark:bg-teal-950/30 dark:text-teal-400 font-bold text-xs rounded-xl transition-all"
          >
            + Thêm thủ thuật
          </button>
        </div>
        {encounter.procedures && encounter.procedures.length > 0 ? (
          <div className="space-y-2">
            {encounter.procedures.map((procedure, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/30">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
                  <p className="text-sm font-semibold text-teal-900 dark:text-teal-300">{procedure}</p>
                </div>
                <button
                  onClick={() => {
                    const updated = encounter.procedures?.filter((_, i) => i !== idx);
                    setEncounter({ ...encounter, procedures: updated });
                    toast.info('Đã xóa thủ thuật');
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                  title="Xóa thủ thuật"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Chưa có thủ thuật nào. Bấm nút "+ Thêm thủ thuật" ở trên để bổ sung.</p>
        )}
      </div>

      {/* Medications (Prescription Section with Add/Edit/Delete Controls) */}
      <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Đơn thuốc</h2>
            {encounter.medications && encounter.medications.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-black bg-purple-100 text-purple-700 rounded-full">
                {encounter.medications.length} loại
              </span>
            )}
          </div>
          <button
            onClick={handleOpenAddMedModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95"
          >
            <Pill className="w-3.5 h-3.5" />
            <span>+ Kê đơn thuốc mới</span>
          </button>
        </div>

        {encounter.medications && encounter.medications.length > 0 ? (
          <div className="space-y-3">
            {encounter.medications.map((med, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-purple-50/80 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30 flex items-start justify-between gap-4 transition-all hover:border-purple-300">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-purple-900 dark:text-purple-300 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                    {med.name}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-400">
                    <span className="font-semibold text-purple-900 dark:text-purple-300">Liều dùng:</span> {med.dosage}
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-400">
                    <span className="font-semibold text-purple-900 dark:text-purple-300">Cách dùng:</span> {med.frequency}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOpenEditMedModal(idx)}
                    className="p-2 text-slate-500 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-xl transition-all"
                    title="Sửa thông tin thuốc"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteMedication(idx)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all"
                    title="Xóa thuốc khỏi đơn"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 border border-dashed border-purple-200 dark:border-purple-900/40 rounded-2xl text-center space-y-3 bg-purple-50/30 dark:bg-purple-950/10">
            <Pill className="w-8 h-8 text-purple-400 mx-auto" />
            <p className="text-xs font-bold text-purple-900 dark:text-purple-300">Chưa có đơn thuốc nào được kê cho lượt khám này.</p>
            <button
              onClick={handleOpenAddMedModal}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all"
            >
              + Kê đơn thuốc cho bệnh nhân
            </button>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="p-6 rounded-[24px] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-amber-900 dark:text-amber-300">Ghi chú quan trọng</h2>
          </div>
          <button
            onClick={() => {
              if (isEditingNotes) {
                setEncounter({ ...encounter, notes: editedNotes });
                setIsEditingNotes(false);
                toast.success('🎉 Đã cập nhật ghi chú quan trọng');
              } else {
                setIsEditingNotes(true);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-amber-800 hover:text-amber-900 dark:text-amber-300 bg-amber-100/70 hover:bg-amber-200/70 dark:bg-amber-900/40 rounded-xl transition-all"
          >
            {isEditingNotes ? <Save className="w-3.5 h-3.5" /> : <Edit className="w-3.5 h-3.5" />}
            <span>{isEditingNotes ? 'Lưu ghi chú' : 'Chỉnh sửa'}</span>
          </button>
        </div>
        {isEditingNotes ? (
          <div className="space-y-3">
            <textarea
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              rows={2}
              placeholder="Nhập ghi chú quan trọng hoặc dặn dò bệnh nhân..."
              className="w-full p-3 text-sm font-bold text-slate-800 dark:text-white rounded-xl border border-amber-300 bg-white dark:bg-slate-900 outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        ) : (
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
            {encounter.notes || 'Chưa có ghi chú quan trọng. Bấm "Chỉnh sửa" ở trên để bổ sung.'}
          </p>
        )}
      </div>

      {/* Prescription Form Modal */}
      {showMedModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] p-6 md:p-8 max-w-lg w-full shadow-2xl space-y-6 relative animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center font-black">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingMedIndex !== null ? 'Chỉnh sửa thuốc trong đơn' : 'Kê đơn thuốc y khoa'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bệnh nhân: <span className="font-bold text-slate-700 dark:text-slate-300">{encounter.patientName}</span>
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveMedication} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                  Tên thuốc & Hàm lượng
                </label>
                <PremiumSelect
                  value={medName}
                  onChange={(val) => setMedName(val)}
                  options={commonMedications}
                  placeholder="Chọn thuốc có sẵn hoặc nhập khác"
                />

                {medName === 'custom' && (
                  <input
                    type="text"
                    required
                    value={customMedName}
                    onChange={(e) => setCustomMedName(e.target.value)}
                    placeholder="Nhập tên thuốc & hàm lượng cụ thể (VD: Clauclam 625mg)"
                    className="w-full mt-2 px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white font-bold outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                  Liều dùng
                </label>
                <input
                  type="text"
                  required
                  value={medDosage}
                  onChange={(e) => setMedDosage(e.target.value)}
                  placeholder="VD: 1 viên / lần"
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white font-bold outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                  Cách dùng & Tần suất
                </label>
                <textarea
                  required
                  rows={2}
                  value={medFrequency}
                  onChange={(e) => setMedFrequency(e.target.value)}
                  placeholder="VD: Uống 3 lần/ngày sau ăn, dùng liên tục trong 5 ngày"
                  className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-white font-bold outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMedModal(false)}
                  className="px-5 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-purple-500/20 transition-all active:scale-95"
                >
                  {editingMedIndex !== null ? 'Lưu thay đổi' : '+ Kê vào đơn thuốc'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
