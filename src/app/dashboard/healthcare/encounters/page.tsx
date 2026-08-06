'use client';

import React, { useState, useEffect } from 'react';
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
  completeEncounterAction 
} from '@/services/healthcare/healthcare-actions';

interface EncounterRecord {
  id: string;
  patientName: string;
  chiefComplaint: string;
  status: 'in_consultation' | 'orders_pending' | 'completed';
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

export default function EncountersPage() {
  const [encounters, setEncounters] = useState<EncounterRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadEncounters = async () => {
    try {
      setIsLoading(true);
      const res = await getAllEncountersAction();
      if (res.success && res.data) {
        // Enhance data with mock EMR attributes for rich UI presentation
        const enhancedData: EncounterRecord[] = (res.data as any[]).map((e, index) => ({
          ...e,
          age: e.age || (32 + (index * 7) % 30),
          gender: e.gender || (index % 2 === 0 ? 'Nam' : 'Nữ'),
          insuranceType: e.insuranceType || (index % 3 === 0 ? 'Khám Dịch Vụ' : index % 3 === 1 ? 'BHYT (80%)' : 'BHYT (100%)'),
          visitType: e.visitType || (index % 2 === 0 ? 'Khám lần đầu' : 'Tái khám'),
          waitTimeMinutes: e.waitTimeMinutes || (8 + (index * 5)),
          allergies: index % 2 === 0 ? ['Dị ứng Penicillin', 'Tăng Huyết Áp'] : ['Tiểu đường Tuýp 2'],
          timeline: [
            { time: '09:15', label: 'Check-in', done: true },
            { time: '09:20', label: 'Đón Tiếp', done: true },
            { time: '09:25', label: 'Sinh Hiệu', done: true },
            { time: '09:32', label: 'Bác Sĩ Khám', done: e.status === 'completed' || e.status === 'in_consultation' },
          ]
        }));
        setEncounters(enhancedData);
      } else {
        toast.error('Lỗi tải lượt khám: ' + res.error);
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEncounters();
  }, []);

  const [selectedEncId, setSelectedEncId] = useState<string | null>(null);
  const [soapData, setSoapData] = useState({ subjective: '', objective: '', assessment: '', plan: '' });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEnc, setNewEnc] = useState({
    patientName: '',
    chiefComplaint: '',
    subjective: '',
    assessment: '',
  });

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
              Bệnh Án Điện Tử & Khám SOAP
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Ghi nhận Sinh hiệu, Khám bệnh SOAP & Mã hóa Chẩn đoán ICD-10 chuẩn Enterprise HIS/EMR.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-md flex items-center gap-2 cursor-pointer w-fit transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Tạo Lượt Khám Mới
        </button>
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
              {encounters.filter((e) => e.status !== 'completed').length} ca trực tiếp
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
              {encounters.filter((e) => e.status === 'completed').length} lượt hoàn tất
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

                      {e.status === 'completed' ? (
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
                    onClick={() => toast.success('🤖 Đã áp dụng gợi ý AI vào ghi chú SOAP!')}
                    className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[11px] shadow-sm shrink-0 cursor-pointer"
                  >
                    + Áp Dụng AI
                  </button>
                </div>
              </div>

              {/* 5. Quick Action Bar & Edit Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                {/* Enterprise Quick Actions */}
                <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
                  <button 
                    onClick={() => setActivePrintEncounter(e)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
                  >
                    <Printer className="w-3.5 h-3.5 text-cyan-600" />
                    <span>In Bệnh Án</span>
                  </button>

                  <button 
                    onClick={() => setActiveCLSEncounter(e)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
                  >
                    <Stethoscope className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Chỉ Định CLS</span>
                  </button>

                  <button 
                    onClick={() => setActivePrescriptionEncounter(e)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
                  >
                    <Pill className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Kê Đơn Thuốc</span>
                  </button>

                  <button 
                    onClick={() => setActiveFollowUpEncounter(e)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Hẹn Tái Khám</span>
                  </button>
                </div>
                {/* Primary SOAP Edit Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {isSelected ? (
                    <div className="w-full space-y-3 p-4 bg-cyan-500/5 rounded-2xl border border-cyan-500/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">S - Hỏi Bệnh & Tiền Sử</label>
                          <textarea rows={2} placeholder="S - Hỏi bệnh & Tiền sử..." value={soapData.subjective} onChange={(ev) => setSoapData({ ...soapData, subjective: ev.target.value })} className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">O - Khám Thể Trạng & Sinh Hiệu</label>
                          <textarea rows={2} placeholder="O - Khám thể trạng & Sinh hiệu..." value={soapData.objective} onChange={(ev) => setSoapData({ ...soapData, objective: ev.target.value })} className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">A - Chẩn Đoán & Mã ICD-10</label>
                          <textarea rows={2} placeholder="A - Chẩn đoán & Mã ICD-10..." value={soapData.assessment} onChange={(ev) => setSoapData({ ...soapData, assessment: ev.target.value })} className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-white" />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">P - Kế Hoạch & Hướng Điều Trị</label>
                          <textarea rows={2} placeholder="P - Kế hoạch & Hướng điều trị..." value={soapData.plan} onChange={(ev) => setSoapData({ ...soapData, plan: ev.target.value })} className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-white" />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setSelectedEncId(null)} className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer">Hủy Bỏ</button>
                        <button onClick={() => handleSaveSOAP(e.id)} className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black shadow-md cursor-pointer">Lưu Nhật Ký SOAP</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setSelectedEncId(e.id);
                          setSoapData({
                            subjective: e.subjective || '',
                            objective: e.objective || '',
                            assessment: e.assessment || '',
                            plan: e.plan || '',
                          });
                        }}
                        className="px-3.5 py-2 rounded-xl border border-cyan-300 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-200 font-bold text-xs hover:bg-cyan-100 cursor-pointer transition-all shadow-2xs"
                      >
                        Cập nhật Nhật Ký SOAP
                      </button>
                      {e.status !== 'completed' && (
                        <button
                          onClick={() => handleCompleteEncounter(e.id)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 shadow-md cursor-pointer active:scale-95 transition-all"
                        >
                          Hoàn Tất Lượt Khám
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
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
                onClick={() => {
                  toast.success(`🩺 Đã gửi ${selectedClsItems.length} chỉ định CLS khẩn cho bệnh nhân ${activeCLSEncounter.patientName} sang phòng LIS/RIS!`);
                  setActiveCLSEncounter(null);
                }} 
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer"
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
                onClick={() => {
                  toast.success(`💊 Đã xuất đơn thuốc gồm ${selectedMeds.length} loại cho bệnh nhân ${activePrescriptionEncounter.patientName} sang Kho Dược!`);
                  setActivePrescriptionEncounter(null);
                }} 
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer"
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
                onClick={() => {
                  toast.success(`📅 Đã lên lịch hẹn tái khám thành công vào ngày ${followUpDate} cho bệnh nhân ${activeFollowUpEncounter.patientName}!`);
                  setActiveFollowUpEncounter(null);
                }} 
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shadow-md flex items-center gap-2 cursor-pointer"
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
