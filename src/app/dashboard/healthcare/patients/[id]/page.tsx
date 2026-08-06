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

  // Patient detail state
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

  // Edit mode & draft form state
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<PatientDetail>(patient);

  // Sync draft form data when entering edit mode
  const handleStartEdit = () => {
    setFormData(patient);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setFormData(patient);
    setIsEditing(false);
    toast.info('Đã hủy bỏ chỉnh sửa');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    setPatient(formData);
    setIsEditing(false);
    toast.success('🎉 Cập nhật hồ sơ bệnh nhân thành công!');
  };

  const getGenderLabel = (gender: string) => {
    switch (gender) {
      case 'male': return 'Nam';
      case 'female': return 'Nữ';
      default: return 'Khác';
    }
  };

  const calculateAge = (dob: string) => {
    if (!dob) return 0;
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Mock patient medical history records — Bella Medical Clinic internal medicine context
  const medicalHistoryRecords = [
    {
      id: 'enc-101',
      date: '2026-07-20',
      doctor: 'BS. Lê Minh',
      diagnosis: 'J18.9 — Viêm phổi cộng đồng (Community-Acquired Pneumonia)',
      treatment: 'Xét nghiệm CBC + CRP. Kê đơn Azithromycin 500mg/ngày. Theo dõi SpO2.',
      status: 'finished',
    },
    {
      id: 'enc-088',
      date: '2026-06-10',
      doctor: 'BS. Trần Thảo',
      diagnosis: 'I10 — Tăng huyết áp nguyên phát mức độ II',
      treatment: 'Điều chỉnh liều Amlodipine 10mg. Đo HA theo dõi 3 lần/ngày.',
      status: 'finished',
    },
    {
      id: 'enc-045',
      date: '2026-04-05',
      doctor: 'BS. Lê Minh',
      diagnosis: 'E11.9 — Đái tháo đường type 2 — Kiểm tra định kỳ',
      treatment: 'Xét nghiệm HbA1c, đường huyết lúc đói. Điều chỉnh chế độ ăn uống.',
      status: 'finished',
    },
  ];


  const handleViewMedicalHistory = () => {
    router.push(`/dashboard/healthcare/encounters?search=${encodeURIComponent(patient.name)}`);
  };

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Ambient background mesh glow */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl hc-glass-card border border-slate-200/80 dark:border-slate-800/80">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại danh sách</span>
        </button>

        <div className="flex items-center gap-3">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-extrabold text-xs rounded-xl transition-all"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>Lưu thay đổi</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleStartEdit}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md shadow-teal-500/20 transition-all active:scale-95"
            >
              <Edit className="w-4 h-4" />
              <span>Chỉnh sửa hồ sơ</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Patient Detail Container */}
      <form onSubmit={handleSaveEdit} className="space-y-7">
        {/* Patient Profile Card Header */}
        <div className="p-7 rounded-[28px] hc-glass-card hc-glass-card-hover border border-slate-200/90 dark:border-slate-800/90 shadow-xl relative">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-6">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600 text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-teal-500/25 ring-4 ring-teal-500/20 shrink-0">
                {formData.name.charAt(0).toUpperCase()}
              </div>

              <div className="space-y-1">
                {isEditing ? (
                  <div className="space-y-2 max-w-sm">
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase">Họ và Tên bệnh nhân:</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full p-2.5 text-base font-black rounded-xl border border-teal-500 focus:ring-2 focus:ring-teal-500/30 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                ) : (
                  <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {patient.name}
                  </h1>
                )}

                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {getGenderLabel(patient.gender)} · {calculateAge(patient.dob)} tuổi · Sinh ngày {patient.dob}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 font-bold pt-1">
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-900/50">
                    <ClipboardList className="w-3.5 h-3.5" />
                    {patient.encounters || 0} lượt khám
                  </span>
                  {patient.lastVisit && (
                    <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      <Calendar className="w-3.5 h-3.5" />
                      Gần nhất: {patient.lastVisit}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <span className="self-start px-3.5 py-1 text-xs font-black bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full shadow-sm">
              ● ĐANG HOẠT ĐỘNG
            </span>
          </div>

          {/* Quick Contact & Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60">
            {/* Phone */}
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-teal-600" /> Số điện thoại:
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full p-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:border-teal-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                />
              ) : (
                <p className="text-sm font-black font-mono text-slate-900 dark:text-white">{patient.phone}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-blue-500" /> Email:
              </span>
              {isEditing ? (
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="Nhập email..."
                  className="w-full p-2 text-xs font-bold rounded-lg border border-slate-300 focus:border-teal-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                />
              ) : (
                <p className="text-sm font-bold text-slate-900 dark:text-white">{patient.email || '—'}</p>
              )}
            </div>

            {/* BHYT */}
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-teal-600" /> Mã BHYT:
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.bhyt || ''}
                  onChange={(e) => setFormData({ ...formData, bhyt: e.target.value })}
                  placeholder="Mã BHYT..."
                  className="w-full p-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:border-teal-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                />
              ) : (
                <p className="text-sm font-black font-mono text-teal-600 dark:text-teal-400">{patient.bhyt || 'Chưa cập nhật'}</p>
              )}
            </div>

            {/* CCCD */}
            <div className="space-y-1">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" /> Mã CCCD:
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.cccd || ''}
                  onChange={(e) => setFormData({ ...formData, cccd: e.target.value })}
                  placeholder="Mã CCCD..."
                  className="w-full p-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:border-teal-500 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                />
              ) : (
                <p className="text-sm font-black font-mono text-slate-900 dark:text-white">{patient.cccd || 'Chưa cập nhật'}</p>
              )}
            </div>
          </div>
        </div>

        {/* Address & Emergency Contact Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Address Card */}
          <div className="p-6 rounded-[24px] hc-glass-card border border-slate-200/90 dark:border-slate-800/90 shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-5 h-5 text-teal-600" />
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Địa chỉ liên hệ</h2>
            </div>
            {isEditing ? (
              <textarea
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                placeholder="Nhập địa chỉ nhà..."
                className="w-full p-3 text-xs font-medium rounded-xl border border-slate-300 focus:border-teal-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
            ) : (
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                {patient.address || 'Chưa có thông tin địa chỉ.'}
              </p>
            )}
          </div>

          {/* Emergency Contact */}
          <div className="p-6 rounded-[24px] bg-gradient-to-br from-amber-50/80 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/80 dark:border-amber-900/40 shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-black text-amber-900 dark:text-amber-300 tracking-tight">Liên hệ khẩn cấp</h2>
            </div>

            {isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-800 dark:text-amber-400">Họ tên:</label>
                  <input
                    type="text"
                    value={formData.emergencyContact?.name || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      emergencyContact: { ...formData.emergencyContact, name: e.target.value, phone: formData.emergencyContact?.phone || '', relationship: formData.emergencyContact?.relationship || '' }
                    })}
                    className="w-full p-2 text-xs rounded-lg border border-amber-300 dark:bg-slate-900 dark:border-amber-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-800 dark:text-amber-400">Số ĐT:</label>
                  <input
                    type="text"
                    value={formData.emergencyContact?.phone || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      emergencyContact: { ...formData.emergencyContact, phone: e.target.value, name: formData.emergencyContact?.name || '', relationship: formData.emergencyContact?.relationship || '' }
                    })}
                    className="w-full p-2 text-xs font-mono rounded-lg border border-amber-300 dark:bg-slate-900 dark:border-amber-800 dark:text-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-amber-800 dark:text-amber-400">Quan hệ:</label>
                  <input
                    type="text"
                    value={formData.emergencyContact?.relationship || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      emergencyContact: { ...formData.emergencyContact, relationship: e.target.value, name: formData.emergencyContact?.name || '', phone: formData.emergencyContact?.phone || '' }
                    })}
                    className="w-full p-2 text-xs rounded-lg border border-amber-300 dark:bg-slate-900 dark:border-amber-800 dark:text-white"
                  />
                </div>
              </div>
            ) : patient.emergencyContact ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-extrabold uppercase mb-0.5">Họ tên</p>
                  <p className="text-sm font-black text-amber-900 dark:text-amber-200">{patient.emergencyContact.name}</p>
                </div>
                <div>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-extrabold uppercase mb-0.5">Số điện thoại</p>
                  <p className="text-sm font-black font-mono text-amber-900 dark:text-amber-200">{patient.emergencyContact.phone}</p>
                </div>
                <div>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-extrabold uppercase mb-0.5">Mối quan hệ</p>
                  <p className="text-sm font-black text-amber-900 dark:text-amber-200">{patient.emergencyContact.relationship}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-700 font-medium">Chưa khai báo người liên hệ khẩn cấp.</p>
            )}
          </div>
        </div>

        {/* Medical Highlights & Family Relationships */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Blood Type Card */}
          <div className="p-6 rounded-[24px] hc-glass-card border border-slate-200/90 dark:border-slate-800/90 shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5 text-rose-500" />
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Nhóm máu</h2>
            </div>
            {isEditing ? (
              <input
                type="text"
                value={formData.bloodType || ''}
                onChange={(e) => setFormData({ ...formData, bloodType: e.target.value })}
                placeholder="VD: O+, A+..."
                className="w-full p-2.5 text-base font-black rounded-xl border border-rose-300 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-rose-600 dark:text-rose-400">{patient.bloodType || 'Chưa rõ'}</span>
                <span className="text-xs font-bold text-slate-400">Tương thích truyền máu</span>
              </div>
            )}
          </div>

          {/* Allergies Card */}
          <div className="p-6 rounded-[24px] bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-rose-600" />
              <h2 className="text-base font-black text-rose-900 dark:text-rose-300 tracking-tight">Tiền sử dị ứng</h2>
            </div>
            {isEditing ? (
              <input
                type="text"
                value={formData.allergies?.join(', ') || ''}
                onChange={(e) => setFormData({ ...formData, allergies: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="Phẩy để tách dị ứng..."
                className="w-full p-2.5 text-xs font-bold rounded-xl border border-rose-300 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
            ) : patient.allergies && patient.allergies.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {patient.allergies.map((allergy, idx) => (
                  <span key={idx} className="px-3 py-1 text-xs font-black bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 rounded-xl">
                    ⚠️ {allergy}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-600 font-bold">Không có dị ứng ghi nhận.</p>
            )}
          </div>

          {/* Chronic Diseases */}
          <div className="p-6 rounded-[24px] hc-glass-card border border-slate-200/90 dark:border-slate-800/90 shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <Heart className="w-5 h-5 text-purple-600" />
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Bệnh mãn tính</h2>
            </div>
            {isEditing ? (
              <input
                type="text"
                value={formData.chronicDiseases?.join(', ') || ''}
                onChange={(e) => setFormData({ ...formData, chronicDiseases: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="Phẩy để tách bệnh..."
                className="w-full p-2.5 text-xs font-bold rounded-xl border border-purple-300 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
            ) : patient.chronicDiseases && patient.chronicDiseases.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {patient.chronicDiseases.map((disease, idx) => (
                  <span key={idx} className="px-3 py-1 text-xs font-black bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 rounded-xl">
                    {disease}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 font-medium">Chưa ghi nhận bệnh mãn tính.</p>
            )}
          </div>
        </div>
      </form>

      {/* Action Buttons Toolbar & Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl hc-glass-card border border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleViewMedicalHistory}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-slate-900 text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-extrabold text-xs rounded-2xl border border-teal-500/30 shadow-md transition-all active:scale-95"
          >
            <ClipboardList className="w-4 h-4" />
            <span>Xem lịch sử khám bệnh ({patient.name})</span>
          </button>

          <button
            type="button"
            onClick={() => router.push(`/dashboard/healthcare/encounters?new=true&patient=${encodeURIComponent(patient.name)}`)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-teal-500/25 transition-all active:scale-95"
          >
            <FileText className="w-4 h-4" />
            <span>Tạo lượt khám mới</span>
          </button>
        </div>
      </div>

      {/* Embedded Medical History Timeline */}
      <div className="p-7 rounded-[28px] hc-glass-card hc-glass-card-hover border border-slate-200/90 dark:border-slate-800/90 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60 pb-3">
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
            <span className="p-1.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">📜</span>
            Lịch sử khám bệnh lâm sàng của bệnh nhân ({patient.name})
          </h2>
          <span className="text-xs font-bold text-teal-600 dark:text-teal-400 px-3 py-1 bg-teal-50 dark:bg-teal-950/40 rounded-full border border-teal-200/60">
            {medicalHistoryRecords.length} lần khám gần nhất
          </span>
        </div>

        <div className="space-y-4">
          {medicalHistoryRecords.map((record) => (
            <div
              key={record.id}
              className="p-5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-teal-400 transition-all text-left shadow-sm"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/60">
                    {record.date}
                  </span>
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                    {record.doctor}
                  </span>
                  <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full">
                    ĐÃ HOÀN TẤT
                  </span>
                </div>
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Chẩn đoán: <span className="text-teal-600 dark:text-teal-400">{record.diagnosis}</span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Điều trị: {record.treatment}
                </p>
              </div>

              <button
                onClick={() => router.push(`/dashboard/healthcare/encounters/${record.id}`)}
                className="self-start md:self-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold text-xs rounded-xl transition-all"
              >
                Xem chi tiết
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

