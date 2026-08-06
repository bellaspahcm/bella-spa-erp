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
      <div className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Tất cả Chuyên Khoa</option>
            <option value="Khoa Tim Mạch">Khoa Tim Mạch</option>
            <option value="Khoa Tiêu Hóa">Khoa Tiêu Hóa</option>
            <option value="Khoa Nhi">Khoa Nhi</option>
            <option value="Khoa Tai Mũi Họng">Khoa Tai Mũi Họng</option>
          </select>
        </div>

        <span className="text-xs font-bold text-slate-500">Tuần hiện tại: 03/08 - 09/08/2026</span>
      </div>

      {/* Weekly Matrix Grid */}
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
                <select
                  value={newShift.doctorName}
                  onChange={(e) => setNewShift({ ...newShift, doctorName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                >
                  <option value="BS. CKII Nguyễn Văn Minh">BS. CKII Nguyễn Văn Minh</option>
                  <option value="BS. CKI Trần Đức Hùng">BS. CKI Trần Đức Hùng</option>
                  <option value="ThS. BS Lê Thị Mai">ThS. BS Lê Thị Mai</option>
                  <option value="BS. Vũ Thị Dung">BS. Vũ Thị Dung</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Ngày Trong Tuần</label>
                  <select
                    value={newShift.dayOfWeek}
                    onChange={(e) => setNewShift({ ...newShift, dayOfWeek: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                  >
                    {days.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Ca Làm Việc</label>
                  <select
                    value={newShift.shiftType}
                    onChange={(e) => setNewShift({ ...newShift, shiftType: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                  >
                    <option value="morning">Ca Sáng (7h30-11h30)</option>
                    <option value="afternoon">Ca Chiều (13h00-17h00)</option>
                    <option value="night_call">Ca Trực Đêm Khẩn</option>
                  </select>
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
