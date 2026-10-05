'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, Clock, AlertTriangle, Users, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SessionBooking } from '../types';

export function TimelineKtvView({
  sessions,
  onSelectBooking,
  onOpenBookingModal,
}: {
  sessions: SessionBooking[];
  onSelectBooking: (booking: SessionBooking) => void;
  onOpenBookingModal?: () => void;
}) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState('12:15');

  // Update current time indicator live
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setCurrentTimeStr(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const weekDays = [
    { label: 'T2', date: '5', active: selectedDayIndex === 0 },
    { label: 'T3', date: '6', active: selectedDayIndex === 1 },
    { label: 'T4', date: '7', active: selectedDayIndex === 2 },
    { label: 'T5', date: '8', active: selectedDayIndex === 3 },
    { label: 'T6', date: '9', active: selectedDayIndex === 4 },
    { label: 'T7', date: '10', active: selectedDayIndex === 5 },
    { label: 'CN', date: '11', active: selectedDayIndex === 6 },
  ];

  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00'
  ];

  return (
    <div className="space-y-6">
      {/* ── Operational KPI Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black text-slate-900 leading-none">18</span>
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">↑ 12%</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Tổng lịch hôm nay</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 border border-pink-100 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black text-slate-900 leading-none">12</span>
              <span className="text-[9px] font-black text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded-full">↑ 8%</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Khách hàng</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black text-slate-900 leading-none">73%</span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Công suất chung</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black text-rose-600 leading-none">2</span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Chưa phân công</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black text-amber-600 leading-none">1</span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Lịch trễ</p>
          </div>
        </div>
      </div>

      {/* ── Date Navigator & Week Strip ── */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">Thứ Hai, 5 Tháng 10, 2026</h3>
            <p className="text-[9.5px] font-black text-emerald-600 uppercase tracking-widest">BEAUTY SPA COORDINATOR</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {weekDays.map((day, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedDayIndex(idx)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[42px] py-2 px-3 rounded-xl text-xs font-black transition-all",
                day.active
                  ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              <span className="text-[9px] uppercase tracking-wider font-bold opacity-80">{day.label}</span>
              <span className="text-sm font-black">{day.date}</span>
            </button>
          ))}
          <button className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition-colors ml-1 whitespace-nowrap">
            Hôm nay
          </button>
        </div>
      </div>

      {/* ── Filters Toolbar ── */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center gap-3 flex-wrap">
        <select className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none">
          <option>Tất cả KTV (12)</option>
        </select>
        <select className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none">
          <option>Tất cả dịch vụ</option>
        </select>
        <select className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none">
          <option>Tất cả trạng thái</option>
        </select>
        <select className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none">
          <option>Tất cả chi nhánh</option>
        </select>
        <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          Bộ lọc nâng cao
        </button>

        <div className="relative flex-1 min-w-[200px] w-full md:w-auto ml-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm khách hàng, SĐT, dịch vụ..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-slate-400"
          />
        </div>
      </div>

      {/* ── KTV Timeline Scheduling Board ── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50 overflow-x-auto relative">
        <div className="min-w-[900px] relative">
          {/* Header Row */}
          <div className="grid grid-cols-5 border-b border-slate-200 bg-slate-50/80 sticky top-0 z-20">
            <div className="p-4 border-r border-slate-200 font-black text-xs text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Giờ</span>
              <span className="bg-rose-100 text-rose-700 text-[10px] px-2 py-0.5 rounded-full">2 Lịch</span>
            </div>

            {/* Unassigned Column Header */}
            <div className="p-4 border-r border-slate-200 bg-rose-50/40">
              <div className="flex items-center gap-2">
                <span className="font-black text-xs text-rose-700">Chưa phân công</span>
                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center">2</span>
              </div>
              <p className="text-[10px] font-bold text-rose-600 mt-0.5">🔴 2 lịch cần xử lý</p>
            </div>

            {/* KTV 1 Header */}
            <div className="p-4 border-r border-slate-200 flex items-center gap-3">
              <Image
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80"
                alt="KTV Demo Facial"
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
              />
              <div>
                <h4 className="font-black text-xs text-slate-900">KTV Demo Facial</h4>
                <p className="text-[10px] font-bold text-slate-500">🟢 08:00 - 17:00 • <span className="text-emerald-600">5 lịch - 70%</span></p>
              </div>
            </div>

            {/* KTV 2 Header */}
            <div className="p-4 border-r border-slate-200 flex items-center gap-3">
              <Image
                src="https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80"
                alt="KTV Demo Body"
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
              />
              <div>
                <h4 className="font-black text-xs text-slate-900">KTV Demo Body</h4>
                <p className="text-[10px] font-bold text-slate-500">🟢 08:00 - 16:00 • <span className="text-rose-600 font-black">6 lịch - 85%</span></p>
              </div>
            </div>

            {/* KTV 3 Header */}
            <div className="p-4 flex items-center gap-3">
              <Image
                src="https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=200&q=80"
                alt="KTV Demo An"
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm"
              />
              <div>
                <h4 className="font-black text-xs text-slate-900">KTV Demo An</h4>
                <p className="text-[10px] font-bold text-slate-500">🟢 09:00 - 17:00 • <span className="text-blue-600">3 lịch - 45%</span></p>
              </div>
            </div>
          </div>

          {/* Time Grid Rows */}
          <div className="relative">
            {/* ── P0 Current Time Indicator Line (Red Bar across grid) ── */}
            <div className="absolute left-0 right-0 top-[260px] z-30 pointer-events-none flex items-center">
              <span className="bg-rose-600 text-white font-black text-[9px] px-2 py-0.5 rounded-r-md shadow-md">
                {currentTimeStr}
              </span>
              <div className="h-0.5 flex-1 bg-rose-500 shadow-sm" />
              <div className="w-2.5 h-2.5 rounded-full bg-rose-600 -ml-1 border-2 border-white" />
            </div>

            {timeSlots.map((time, idx) => (
              <div key={idx} className="grid grid-cols-5 border-b border-slate-100 min-h-[48px]">
                <div className="p-2 border-r border-slate-200 text-[11px] font-bold text-slate-400 bg-slate-50/40">
                  {time}
                </div>
                <div className="border-r border-slate-200 bg-slate-50/20" />
                <div className="border-r border-slate-200" />
                <div className="border-r border-slate-200" />
                <div />
              </div>
            ))}

            {/* Overlay Cards Positioned Mock Grid Matching Image 1 */}
            
            {/* Unassigned Card 1 */}
            <div className="absolute top-[48px] left-[20%] w-[19%] p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 text-slate-900 shadow-md">
              <div className="flex justify-between items-start text-[10px] font-bold text-amber-700">
                <span>09:00 - 10:00</span>
                <span>...</span>
              </div>
              <h5 className="font-black text-xs text-slate-900 mt-1">Lê Thị Hoa</h5>
              <p className="text-[10px] text-slate-600 font-medium">Triệt lông Diode</p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 text-[9px] font-black uppercase">
                Chưa phân công
              </span>
            </div>

            {/* Unassigned Card 2 */}
            <div className="absolute top-[280px] left-[20%] w-[19%] p-3 rounded-2xl bg-amber-50 border-2 border-amber-300 text-slate-900 shadow-md">
              <div className="flex justify-between items-start text-[10px] font-bold text-amber-700">
                <span>11:00 - 12:00</span>
                <span>...</span>
              </div>
              <h5 className="font-black text-xs text-slate-900 mt-1">Nguyễn Quốc Bảo</h5>
              <p className="text-[10px] text-slate-600 font-medium">Gội đầu dưỡng sinh</p>
              <span className="inline-block mt-2 px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 text-[9px] font-black uppercase">
                Chưa phân công
              </span>
            </div>

            {/* KTV 1 Active Card */}
            <div className="absolute top-[0px] left-[40%] w-[19%] p-3 rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 border border-emerald-400">
              <div className="flex justify-between items-start text-[10px] font-bold text-emerald-100">
                <span>08:00 - 09:00</span>
                <span>...</span>
              </div>
              <h5 className="font-black text-xs text-white mt-1">Nguyễn Thị Mai</h5>
              <p className="text-[10px] text-emerald-100 font-medium">Chăm sóc da mặt</p>
              <div className="flex items-center justify-between mt-2 text-[9px] font-black">
                <span className="px-2 py-0.5 rounded-md bg-white/20 text-white uppercase">Đang thực hiện</span>
                <span>P.01</span>
              </div>
            </div>

            {/* KTV 2 Confirmed Card */}
            <div className="absolute top-[48px] left-[60%] w-[19%] p-3 rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20 border border-blue-400">
              <div className="flex justify-between items-start text-[10px] font-bold text-blue-100">
                <span>08:30 - 09:30</span>
                <span>...</span>
              </div>
              <h5 className="font-black text-xs text-white mt-1">Trần Ngọc An</h5>
              <p className="text-[10px] text-blue-100 font-medium">Gội đầu dưỡng sinh</p>
              <div className="flex items-center justify-between mt-2 text-[9px] font-black">
                <span className="px-2 py-0.5 rounded-md bg-white/20 text-white uppercase">Đã xác nhận</span>
                <span>P.02</span>
              </div>
            </div>

            {/* KTV 3 Confirmed Card */}
            <div className="absolute top-[96px] left-[80%] w-[19%] p-3 rounded-2xl bg-blue-500 text-white shadow-lg shadow-blue-500/20 border border-blue-400">
              <div className="flex justify-between items-start text-[10px] font-bold text-blue-100">
                <span>09:00 - 10:00</span>
                <span>...</span>
              </div>
              <h5 className="font-black text-xs text-white mt-1">Phạm Thu Trang</h5>
              <p className="text-[10px] text-blue-100 font-medium">Massage body</p>
              <div className="flex items-center justify-between mt-2 text-[9px] font-black">
                <span className="px-2 py-0.5 rounded-md bg-white/20 text-white uppercase">Đã xác nhận</span>
                <span>P.03</span>
              </div>
            </div>

            {/* Lunch Break Hatch Block matching Image 1 */}
            <div className="absolute top-[384px] left-[40%] w-[39%] h-[48px] bg-slate-100/90 border border-slate-200/80 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-slate-500 backdrop-blur-xs">
              <span>🍴 Nghỉ trưa</span>
              <span className="text-[10px] font-medium text-slate-400">12:00 - 13:00</span>
            </div>

            {/* Off-shift Hatch Block matching Image 1 */}
            <div className="absolute top-[650px] left-[20%] w-[79%] h-[80px] bg-slate-100/90 border border-slate-200/80 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold text-slate-500 backdrop-blur-xs">
              <span>🔒 Ngoài ca làm việc</span>
              <span className="text-[10px] font-medium text-slate-400">17:00 - 22:00</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Grid: Unassigned List + KTV Workload Overview ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Unassigned List */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-rose-600" />
              <span>Lịch chưa phân công (2)</span>
            </h3>
            <button className="text-xs font-bold text-blue-600 hover:underline">Xem tất cả &gt;</button>
          </div>

          <div className="space-y-3">
            <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black text-amber-900">09:00 - 10:00</span>
                <h4 className="font-black text-sm text-slate-900">Lê Thị Hoa</h4>
                <p className="text-xs text-slate-600 font-medium">Triệt lông Diode</p>
                <p className="text-[10px] text-amber-700 font-black mt-1">✨ AI đề xuất KTV: Demo An — 96 điểm</p>
              </div>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all shadow-md active:scale-95">
                Phân công
              </button>
            </div>

            <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-black text-amber-900">11:00 - 12:00</span>
                <h4 className="font-black text-sm text-slate-900">Nguyễn Quốc Bảo</h4>
                <p className="text-xs text-slate-600 font-medium">Gội đầu dưỡng sinh</p>
                <p className="text-[10px] text-amber-700 font-black mt-1">✨ AI đề xuất KTV: Demo Body — 94 điểm</p>
              </div>
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all shadow-md active:scale-95">
                Phân công
              </button>
            </div>
          </div>
        </div>

        {/* Right: KTV Workload Overview */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Tổng quan KTV</span>
            </h3>
            <button className="text-xs font-bold text-blue-600 hover:underline">Xem chi tiết &gt;</button>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-black">
                <span className="text-slate-900">KTV Demo Facial</span>
                <span className="text-emerald-600">5 lịch • 70%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '70%' }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-black">
                <span className="text-slate-900">KTV Demo Body</span>
                <span className="text-rose-600">6 lịch • 85%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: '85%' }} />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-black">
                <span className="text-slate-900">KTV Demo An</span>
                <span className="text-amber-600">3 lịch • 45%</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '45%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
