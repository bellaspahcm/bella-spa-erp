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
    doctorName: 'BS. Lê Minh',
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
      {encounter.vitalSigns && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-rose-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Dấu hiệu sinh tồn</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {encounter.vitalSigns.bloodPressure && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Huyết áp</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{encounter.vitalSigns.bloodPressure}</p>
                <p className="text-xs text-slate-500">mmHg</p>
              </div>
            )}
            {encounter.vitalSigns.heartRate && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Nhịp tim</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{encounter.vitalSigns.heartRate}</p>
                <p className="text-xs text-slate-500">lần/phút</p>
              </div>
            )}
            {encounter.vitalSigns.temperature && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Nhiệt độ</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{encounter.vitalSigns.temperature}</p>
                <p className="text-xs text-slate-500">°C</p>
              </div>
            )}
            {encounter.vitalSigns.weight && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">Cân nặng</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{encounter.vitalSigns.weight}</p>
                <p className="text-xs text-slate-500">kg</p>
              </div>
            )}
          </div>
        </div>
      )}

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
              P - Plan (Kế hoạch điều trị)
            </label>
            {isEditing ? (
              <textarea
                value={editedPlan}
                onChange={(e) => setEditedPlan(e.target.value)}
                className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-white focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                rows={3}
              />
            ) : (
              <p className="text-sm text-slate-700 dark:text-slate-300 p-3 rounded-xl bg-slate-50 dark:bg-slate-900">
                {encounter.plan || 'Chưa có thông tin'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Diagnoses */}
      {encounter.diagnoses && encounter.diagnoses.length > 0 && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Chẩn đoán</h2>
          </div>
          <div className="space-y-2">
            {encounter.diagnoses.map((diagnosis, idx) => (
              <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30">
                <CheckCircle className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-300">{diagnosis}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Procedures */}
      {encounter.procedures && encounter.procedures.length > 0 && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Thủ thuật / Dịch vụ</h2>
          </div>
          <div className="space-y-2">
            {encounter.procedures.map((procedure, idx) => (
              <div key={idx} className="flex items-center gap-2 p-3 rounded-xl bg-teal-50 dark:bg-teal-950/20 border border-teal-100 dark:border-teal-900/30">
                <CheckCircle className="w-4 h-4 text-teal-600" />
                <p className="text-sm font-semibold text-teal-900 dark:text-teal-300">{procedure}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medications */}
      {encounter.medications && encounter.medications.length > 0 && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Đơn thuốc</h2>
          </div>
          <div className="space-y-3">
            {encounter.medications.map((med, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/30">
                <p className="text-sm font-bold text-purple-900 dark:text-purple-300 mb-1">{med.name}</p>
                <p className="text-xs text-purple-700 dark:text-purple-400">
                  <span className="font-semibold">Liều dùng:</span> {med.dosage}
                </p>
                <p className="text-xs text-purple-700 dark:text-purple-400">
                  <span className="font-semibold">Cách dùng:</span> {med.frequency}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {encounter.notes && (
        <div className="p-6 rounded-[24px] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-amber-900 dark:text-amber-300">Ghi chú quan trọng</h2>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-400">{encounter.notes}</p>
        </div>
      )}
    </div>
  );
}
