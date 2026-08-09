'use client';

import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  UserCheck,
  Stethoscope,
  Sparkles,
  Plus,
  Filter,
  CheckCircle,
  AlertCircle,
  Lock,
  RefreshCw,
  User,
  Building,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

interface DoctorShift {
  id: string;
  doctorName: string;
  doctorRole: string;
  department: string;
  dayOfWeek: 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN';
  shiftType: 'morning' | 'afternoon' | 'night_call';
  roomName: string;
  isBlockedForEmergency: boolean;
}

export default function DoctorSchedulePage() {
  const [shifts, setShifts] = useState<DoctorShift[]>([
    { id: 'S-01', doctorName: 'BS. CKII Nguyễn Văn Minh', doctorRole: 'Trưởng Khoa', department: 'Khoa Tim Mạch', dayOfWeek: 'T2', shiftType: 'morning', roomName: 'Phòng Khám Số 3', isBlockedForEmergency: false },
    { id: 'S-02', doctorName: 'BS. CKI Trần Đức Hùng', doctorRole: 'Bác Sĩ Chính', department: 'Khoa Tiêu Hóa', dayOfWeek: 'T2', shiftType: 'afternoon', roomName: 'Phòng Khám Số 1', isBlockedForEmergency: false },
    { id: 'S-03', doctorName: 'ThS. BS Lê Thị Mai', doctorRole: 'Phó Khoa', department: 'Khoa Nhi', dayOfWeek: 'T3', shiftType: 'morning', roomName: 'Phòng Khám Số 2', isBlockedForEmergency: false },
    { id: 'S-04', doctorName: 'BS. Vũ Thị Dung', doctorRole: 'Bác Sĩ Chuyên Khoa', department: 'Khoa Tai Mũi Họng', dayOfWeek: 'T3', shiftType: 'afternoon', roomName: 'Phòng Khám Số 4', isBlockedForEmergency: false },
    { id: 'S-05', doctorName: 'BS. CKII Nguyễn Văn Minh', doctorRole: 'Trưởng Khoa', department: 'Khoa Tim Mạch', dayOfWeek: 'T4', shiftType: 'night_call', roomName: 'Phòng Cấp Cứu A1', isBlockedForEmergency: true },
    { id: 'S-06', doctorName: 'BS. CKI Trần Đức Hùng', doctorRole: 'Bác Sĩ Chính', department: 'Khoa Tiêu Hóa', dayOfWeek: 'T5', shiftType: 'morning', roomName: 'Phòng Khám Số 1', isBlockedForEmergency: false },
    { id: 'S-07', doctorName: 'ThS. BS Lê Thị Mai', doctorRole: 'Phó Khoa', department: 'Khoa Nhi', dayOfWeek: 'T6', shiftType: 'afternoon', roomName: 'Phòng Khám Số 2', isBlockedForEmergency: false },
  ]);

  const [selectedDept, setSelectedDept] = useState('ALL');
  const [isAddShiftModalOpen, setIsAddShiftModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'weekly' | 'daily'>('weekly');
  const [activeDay, setActiveDay] = useState<'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN'>('T2');
  const [newShift, setNewShift] = useState({
    doctorName: 'BS. CKII Nguyễn Văn Minh',
    department: 'Khoa Tim Mạch',
    dayOfWeek: 'T2' as 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN',
    shiftType: 'morning' as 'morning' | 'afternoon' | 'night_call',
    roomName: 'Phòng Khám Số 3',
  });

  const days: Array<'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN'> = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  // Toggle emergency block
  const handleToggleBlock = (id: string) => {
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const nextState = !s.isBlockedForEmergency;
          toast.success(
            nextState
              ? `🔒 Đã khóa slot khám ca trực này phục vụ Ca Phẫu Thuật Cấp Cứu!`
              : `🔓 Đã mở khóa ca trực cho phép tiếp nhận lịch khám Online.`
          );
          return { ...s, isBlockedForEmergency: nextState };
        }
        return s;
      })
    );
  };

  // Add new shift
  const handleAddShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const created: DoctorShift = {
      id: `S-${Math.floor(10 + Math.random() * 90)}`,
      doctorName: newShift.doctorName,
      doctorRole: 'Bác Sĩ Chuyên Khoa',
      department: newShift.department,
      dayOfWeek: newShift.dayOfWeek,
      shiftType: newShift.shiftType,
      roomName: newShift.roomName,
      isBlockedForEmergency: false,
    };
    setShifts([...shifts, created]);
    setIsAddShiftModalOpen(false);
    toast.success(`🎉 Đã phân ca trực thành công cho ${created.doctorName} (${created.dayOfWeek} - ${created.shiftType === 'morning' ? 'Ca Sáng' : 'Ca Chiều'})!`);
  };

  // Helper to render daily shift columns
  const renderDailyShiftColumn = (
    shiftType: 'morning' | 'afternoon' | 'night_call',
    label: string,
    timeRange: string,
    badgeClass: string
  ) => {
    const dayShifts = shifts.filter(
      (s) => s.dayOfWeek === activeDay && s.shiftType === shiftType && (selectedDept === 'ALL' || s.department === selectedDept)
    );

    return (
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4 text-left">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="space-y-0.5">
            <h3 className="font-black text-slate-900 dark:text-white text-base">{label}</h3>
            <span className="text-[10px] text-slate-400 font-bold block">{timeRange}</span>
          </div>
          <span className={`text-xs font-black px-2.5 py-1 rounded-xl border ${badgeClass}`}>
            {dayShifts.length} bác sĩ đang trực
          </span>
        </div>

        <div className="space-y-4">
          {dayShifts.length === 0 ? (
            <div className="py-12 text-center text-slate-400 italic text-xs space-y-2">
              <p>Chưa có bác sĩ trực ca này</p>
              <button
                onClick={() => {
                  setNewShift({ ...newShift, dayOfWeek: activeDay, shiftType });
                  setIsAddShiftModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 hover:bg-cyan-500/20 text-[10px] font-black cursor-pointer inline-block"
              >
                + Thêm ca nhanh
              </button>
            </div>
          ) : (
            dayShifts.map((s) => (
              <div
                key={s.id}
                className={`p-4 rounded-2xl border-2 transition-all space-y-3 shadow-2xs relative overflow-hidden ${
                  s.isBlockedForEmergency
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-150 dark:border-slate-850 hover:border-cyan-500/40 text-slate-800 dark:text-slate-200'
                }`}
              >
                {s.isBlockedForEmergency && (
                  <div className="absolute top-0 right-0 px-2 py-0.5 bg-rose-600 text-[9px] font-black uppercase text-white tracking-widest rounded-bl-lg">
                    CẤP CỨU
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[9px] font-black text-slate-400 block tracking-wider font-mono">MÃ CA: {s.id}</span>
                    <strong className="text-sm font-black text-slate-900 dark:text-white block">{s.doctorName}</strong>
                    <span className="text-xs text-slate-500 font-medium block">{s.department}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="px-2 py-1 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-[10px] font-black border border-cyan-500/20">
                    📍 {s.roomName}
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-500 font-semibold">{s.doctorRole}</span>
                </div>

                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-850 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleBlock(s.id)}
                    className={`text-[10px] font-black px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                      s.isBlockedForEmergency
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-slate-200 dark:bg-slate-850 text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                    }`}
                  >
                    {s.isBlockedForEmergency ? '🔒 Khóa Cấp Cứu' : '🔓 Khóa Slot'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShifts(prev => prev.filter(item => item.id !== s.id));
                      toast.error(`❌ Đã xóa ca trực ${s.id} của ${s.doctorName}`);
                    }}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 px-2 py-1.5 hover:bg-rose-500/10 rounded-lg transition-all"
                  >
                    Xóa Ca
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative text-left">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <Stethoscope className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Lịch Trực Bác Sĩ & Quản Lý Ca Khám
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Phân Ca Trực Theo Ngày Trong Tuần, Đổi Ca Trực, Đăng Ký Nghỉ Phép & Khóa Khung Giờ Mổ Cấp Cứu.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddShiftModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Phân Ca Trực Mới
          </button>
        </div>
      </div>

      {/* Quick Summary KPI Counters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Tổng Ca Trực Trong Tuần</span>
            <span className="text-xl font-black text-slate-900 dark:text-white mt-0.5 block">{shifts.length} ca trực</span>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Ca Đã Khóa Mổ Cấp Cứu</span>
            <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5 block">
              {shifts.filter((s) => s.isBlockedForEmergency).length} ca cấp cứu
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Bác Sĩ Đang Trực Sáng</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {shifts.filter((s) => s.shiftType === 'morning').length} bác sĩ
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase">Ca Trực Khẩn Ban Đêm</span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">
              {shifts.filter((s) => s.shiftType === 'night_call').length} ca trực đêm
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="w-56 text-left">
            <PremiumSelect
              options={[
                { value: 'ALL', label: 'Tất cả Chuyên Khoa' },
                { value: 'Khoa Tim Mạch', label: 'Khoa Tim Mạch' },
                { value: 'Khoa Tiêu Hóa', label: 'Khoa Tiêu Hóa' },
                { value: 'Khoa Nhi', label: 'Khoa Nhi' },
                { value: 'Khoa Tai Mũi Họng', label: 'Khoa Tai Mũi Họng' },
              ]}
              value={selectedDept}
              onChange={setSelectedDept}
              placeholder="Chọn chuyên khoa..."
              buttonClassName="!py-0 h-9 px-3 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-750 dark:text-slate-200 !rounded-xl font-bold shadow-xs flex items-center w-full"
            />
          </div>

          <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200/40 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('weekly')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                viewMode === 'weekly'
                  ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Lịch Theo Tuần
            </button>
            <button
              type="button"
              onClick={() => setViewMode('daily')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                viewMode === 'daily'
                  ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Quản Lý Theo Ngày
            </button>
          </div>
        </div>

        <span className="text-xs font-bold text-slate-500">Tuần hiện tại: 03/08 - 09/08/2026</span>
      </div>

      {/* Weekly Matrix Grid */}
      {viewMode === 'weekly' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {days.map((day) => {
            const dayShifts = shifts.filter(
              (s) => s.dayOfWeek === day && (selectedDept === 'ALL' || s.department === selectedDept)
            );

            return (
              <div
                key={day}
                className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3 min-h-[320px]"
              >
                <div className="pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="font-black text-slate-900 dark:text-white text-sm">{day}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600">
                    {dayShifts.length} ca
                  </span>
                </div>

                <div className="space-y-3">
                  {dayShifts.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic text-center pt-8">Chưa phân ca</p>
                  ) : (
                    dayShifts.map((s) => (
                      <div
                        key={s.id}
                        className={`p-3 rounded-2xl border text-xs space-y-2 transition-all shadow-2xs ${
                          s.isBlockedForEmergency
                            ? 'bg-rose-500/10 border-rose-500/40 text-rose-900 dark:text-rose-200'
                            : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-black text-cyan-600">{s.id}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            s.shiftType === 'morning'
                              ? 'bg-amber-500/20 text-amber-700'
                              : s.shiftType === 'afternoon'
                              ? 'bg-blue-500/20 text-blue-700'
                              : 'bg-indigo-500/20 text-indigo-700'
                          }`}>
                            {s.shiftType === 'morning' ? 'Sáng 7h30' : s.shiftType === 'afternoon' ? 'Chiều 13h' : 'Trực Đêm'}
                          </span>
                        </div>

                        <div>
                          <strong className="block font-black text-slate-900 dark:text-white">{s.doctorName}</strong>
                          <span className="text-[11px] text-slate-500 block">{s.department}</span>
                          <span className="text-[10px] text-cyan-600 font-bold block mt-0.5">📍 {s.roomName}</span>
                        </div>

                        <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handleToggleBlock(s.id)}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded cursor-pointer transition-all ${
                              s.isBlockedForEmergency
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {s.isBlockedForEmergency ? '🔒 Khóa Cấp Cứu' : '🔓 Khóa Slot'}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Daily Management Section */}
      {viewMode === 'daily' && (
        <div className="space-y-6">
          {/* Day Selector Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/50 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              {days.map((d) => {
                const dayShiftsCount = shifts.filter(s => s.dayOfWeek === d && (selectedDept === 'ALL' || s.department === selectedDept)).length;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setActiveDay(d)}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 ${
                      activeDay === d
                        ? 'bg-cyan-600 border-cyan-500 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <span>Thứ {d === 'CN' ? 'Nhật' : d.replace('T', '')}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeDay === d ? 'bg-cyan-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {dayShiftsCount} ca
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-3 py-1.5 rounded-xl border border-cyan-500/20 w-fit">
              📅 Ca trực hoạt động ngày: {activeDay === 'CN' ? 'Chủ Nhật' : `Thứ ${activeDay.replace('T', '')}`}
            </div>
          </div>

          {/* 3-Column Shift Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {renderDailyShiftColumn('morning', '☀️ Ca Sáng', '7h30 - 11h30', 'bg-amber-500/10 border-amber-500/20 text-amber-700')}
            {renderDailyShiftColumn('afternoon', '🌤️ Ca Chiều', '13h00 - 17h00', 'bg-blue-500/10 border-blue-500/20 text-blue-700')}
            {renderDailyShiftColumn('night_call', '🌙 Ca Trực Đêm', '18h00 - 7h30 sáng', 'bg-indigo-500/10 border-indigo-500/20 text-indigo-700')}
          </div>
        </div>
      )}

      {/* Modal Add Shift */}
      {isAddShiftModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-5 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <span className="font-black text-slate-900 dark:text-white text-sm">PHÂN CA TRỰC BÁC SĨ MỚI</span>
              <button onClick={() => setIsAddShiftModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-black">✕</button>
            </div>

            <form onSubmit={handleAddShiftSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tên Bác Sĩ</label>
                <PremiumSelect
                  options={[
                    { value: 'BS. CKII Nguyễn Văn Minh', label: 'BS. CKII Nguyễn Văn Minh' },
                    { value: 'BS. CKI Trần Đức Hùng', label: 'BS. CKI Trần Đức Hùng' },
                    { value: 'ThS. BS Lê Thị Mai', label: 'ThS. BS Lê Thị Mai' },
                    { value: 'BS. Vũ Thị Dung', label: 'BS. Vũ Thị Dung' },
                  ]}
                  value={newShift.doctorName}
                  onChange={(val) => {
                    const deptMap: Record<string, string> = {
                      'BS. CKII Nguyễn Văn Minh': 'Khoa Tim Mạch',
                      'BS. CKI Trần Đức Hùng': 'Khoa Tiêu Hóa',
                      'ThS. BS Lê Thị Mai': 'Khoa Nhi',
                      'BS. Vũ Thị Dung': 'Khoa Tai Mũi Họng'
                    };
                    setNewShift({ ...newShift, doctorName: val, department: deptMap[val] || 'Khoa Tim Mạch' });
                  }}
                  placeholder="Chọn bác sĩ..."
                  buttonClassName="!py-0 h-10 px-3.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 !rounded-xl font-bold shadow-xs flex items-center w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Ngày Trong Tuần</label>
                  <PremiumSelect
                    options={days.map((d) => ({ value: d, label: d }))}
                    value={newShift.dayOfWeek}
                    onChange={(val) => setNewShift({ ...newShift, dayOfWeek: val as unknown })}
                    placeholder="Chọn ngày..."
                    buttonClassName="!py-0 h-10 px-3.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 !rounded-xl font-bold shadow-xs flex items-center w-full"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Ca Làm Việc</label>
                  <PremiumSelect
                    options={[
                      { value: 'morning', label: 'Ca Sáng (7h30-11h30)' },
                      { value: 'afternoon', label: 'Ca Chiều (13h00-17h00)' },
                      { value: 'night_call', label: 'Ca Trực Đêm Khẩn' },
                    ]}
                    value={newShift.shiftType}
                    onChange={(val) => setNewShift({ ...newShift, shiftType: val as unknown })}
                    placeholder="Chọn ca..."
                    buttonClassName="!py-0 h-10 px-3.5 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 !rounded-xl font-bold shadow-xs flex items-center w-full"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Phòng Khám Phân Công</label>
                <input
                  type="text"
                  value={newShift.roomName}
                  onChange={(e) => setNewShift({ ...newShift, roomName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-medium text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddShiftModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-cyan-600 text-white hover:bg-cyan-700 shadow-md cursor-pointer"
                >
                  Xác Nhận Phân Ca
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
