'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ArrowLeft, 
  Users, 
  User, 
  Calendar, 
  Phone, 
  Shield, 
  CreditCard,
  Heart,
  Activity,
  ClipboardList,
  Edit,
  Save,
  MapPin,
  Mail,
  FileText,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface PatientDetail {
  readonly id: string;
  readonly name: string;
  readonly gender: 'male' | 'female' | 'other';
  readonly dob: string;
  readonly bhyt?: string;
  readonly cccd?: string;
  readonly phone: string;
  readonly email?: string;
  readonly address?: string;
  readonly bloodType?: string;
  readonly allergies?: string[];
  readonly chronicDiseases?: string[];
  readonly emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  readonly relationships: Array<{
    readonly targetName: string;
    readonly type: string;
  }>;
  readonly encounters?: number;
  readonly lastVisit?: string;
}

export default function PatientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const patientId = params.id as string;

  // Mock data - trong production sẽ fetch từ API
  const [patient, setPatient] = useState<PatientDetail>({
    id: patientId,
    name: 'Nguyễn Văn Hùng',
    gender: 'male',
    dob: '1995-10-12',
    bhyt: 'GD4797921800124',
    cccd: '037095000214',
    phone: '0912345678',
    email: 'hungnv@email.com',
    address: '123 Đường Lê Lợi, Phường 4, Quận Gò Vấp, TP.HCM',
    bloodType: 'O+',
    allergies: ['Penicillin', 'Hải sản'],
    chronicDiseases: ['Cao huyết áp'],
    emergencyContact: {
      name: 'Nguyễn Thị Mai',
      phone: '0987654321',
      relationship: 'Vợ',
    },
    relationships: [
      { targetName: 'Nguyễn Văn A', type: 'Con trai' },
      { targetName: 'Nguyễn Thị B', type: 'Con gái' },
    ],
    encounters: 12,
    lastVisit: '2026-07-20',
  });

  const [isEditing, setIsEditing] = useState(false);

  const getGenderLabel = (gender: string) => {
    switch (gender) {
      case 'male': return 'Nam';
      case 'female': return 'Nữ';
      default: return 'Khác';
    }
  };

  const calculateAge = (dob: string) => {
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
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
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
          >
            {isEditing ? (
              <>
                <Save className="w-4 h-4" />
                Lưu thay đổi
              </>
            ) : (
              <>
                <Edit className="w-4 h-4" />
                Chỉnh sửa
              </>
            )}
          </button>
        </div>
      </div>

      {/* Patient Basic Info Card */}
      <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)]">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center text-2xl font-bold border-2 border-teal-500/20">
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">
                {patient.name}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                {getGenderLabel(patient.gender)} · {calculateAge(patient.dob)} tuổi · Sinh {patient.dob}
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <ClipboardList className="w-3.5 h-3.5" />
                  {patient.encounters || 0} lượt khám
                </span>
                {patient.lastVisit && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    Khám gần nhất: {patient.lastVisit}
                  </span>
                )}
              </div>
            </div>
          </div>

          <span className="px-3 py-1 text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 rounded-lg">
            ĐANG HOẠT ĐỘNG
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <Phone className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Số điện thoại</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{patient.phone}</p>
            </div>
          </div>

          {patient.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Email</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{patient.email}</p>
              </div>
            </div>
          )}

          {patient.bhyt && (
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-teal-600" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Mã BHYT</p>
                <p className="text-sm font-bold text-teal-600 font-mono">{patient.bhyt}</p>
              </div>
            </div>
          )}

          {patient.cccd && (
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Mã CCCD</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white font-mono">{patient.cccd}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Address */}
      {patient.address && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-5 h-5 text-slate-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Địa chỉ liên hệ</h2>
          </div>
          <p className="text-sm text-slate-700 dark:text-slate-300">{patient.address}</p>
        </div>
      )}

      {/* Emergency Contact */}
      {patient.emergencyContact && (
        <div className="p-6 rounded-[24px] bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-amber-900 dark:text-amber-300">Liên hệ khẩn cấp</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-1">Họ tên</p>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">{patient.emergencyContact.name}</p>
            </div>
            <div>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-1">Số điện thoại</p>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">{patient.emergencyContact.phone}</p>
            </div>
            <div>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-1">Mối quan hệ</p>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">{patient.emergencyContact.relationship}</p>
            </div>
          </div>
        </div>
      )}

      {/* Medical Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Blood Type */}
        {patient.bloodType && (
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-rose-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Nhóm máu</h2>
            </div>
            <p className="text-3xl font-bold text-rose-600">{patient.bloodType}</p>
          </div>
        )}

        {/* Relationships */}
        {patient.relationships.length > 0 && (
          <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Quan hệ gia đình</h2>
            </div>
            <div className="space-y-2">
              {patient.relationships.map((rel, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">{rel.targetName}</span>
                  <span className="text-xs text-blue-700 dark:text-blue-400 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 rounded">{rel.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Allergies */}
      {patient.allergies && patient.allergies.length > 0 && (
        <div className="p-6 rounded-[24px] bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h2 className="text-base font-bold text-red-900 dark:text-red-300">Dị ứng</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {patient.allergies.map((allergy, idx) => (
              <span key={idx} className="px-3 py-1 text-sm font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg">
                {allergy}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Chronic Diseases */}
      {patient.chronicDiseases && patient.chronicDiseases.length > 0 && (
        <div className="p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Heart className="w-5 h-5 text-purple-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Bệnh mãn tính</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {patient.chronicDiseases.map((disease, idx) => (
              <span key={idx} className="px-3 py-1 text-sm font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border border-purple-100 dark:border-purple-900/30 rounded-lg">
                {disease}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(`/dashboard/healthcare/encounters?patient=${patient.id}`)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-950 text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all"
        >
          <ClipboardList className="w-4 h-4" />
          Xem lịch sử khám bệnh
        </button>

        <button
          onClick={() => router.push(`/dashboard/healthcare/encounters/new?patient=${patient.id}`)}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
        >
          <FileText className="w-4 h-4" />
          Tạo lượt khám mới
        </button>
      </div>
    </div>
  );
}
