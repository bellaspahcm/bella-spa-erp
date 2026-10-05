'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, Users, Clock, AlertTriangle, ChevronLeft, ChevronRight, MoreHorizontal, Filter } from 'lucide-react';
import type { SessionBooking } from '../types';

export function MonthCalendarView({
  sessions,
  onSelectBooking,
  onOpenBookingModal,
}: {
  sessions: SessionBooking[];
  onSelectBooking: (booking: SessionBooking) => void;
  onOpenBookingModal?: () => void;
}) {
  const [selectedDay, setSelectedDay] = useState(5);
  const [agendaTab, setAgendaTab] = useState<'all' | 'confirmed' | 'pending' | 'in_progress' | 'cancelled'>('all');

  // Days in October 2026 matching Image 2
  const monthDays = [
    { day: 27, isOtherMonth: true },
    { day: 28, isOtherMonth: true },
    { day: 29, isOtherMonth: true },
    { day: 30, isOtherMonth: true },
    { day: 1, count: 8, cap: 72, dotColor: 'bg-emerald-500' },
    { day: 2, count: 12, cap: 90, dotColor: 'bg-blue-500' },
    { day: 4, count: 11, cap: 68, dotColor: 'bg-amber-500' },

    { day: 5, count: 18, cap: 73, isSelected: selectedDay === 5, dotColor: 'bg-emerald-500' },
    { day: 6, count: 14, cap: 71, dotColor: 'bg-emerald-500' },
    { day: 7, count: 10, cap: 55, dotColor: 'bg-blue-500' },
    { day: 8, count: 16, cap: 80, dotColor: 'bg-purple-500' },
    { day: 9, count: 12, cap: 65, dotColor: 'bg-amber-500' },
    { day: 10, count: 20, cap: 95, dotColor: 'bg-rose-500' },
    { day: 11, count: 18, cap: 88, dotColor: 'bg-rose-500' },

    { day: 12, count: 8, cap: 48, dotColor: 'bg-emerald-500' },
    { day: 13, count: 11, cap: 60, dotColor: 'bg-amber-500' },
    { day: 14, count: 13, cap: 72, dotColor: 'bg-blue-500' },
    { day: 15, count: 12, cap: 66, dotColor: 'bg-emerald-500' },
    { day: 16, count: 17, cap: 82, dotColor: 'bg-rose-500' },
    { day: 17, count: 21, cap: 100, dotColor: 'bg-rose-500' },
    { day: 18, count: 16, cap: 78, dotColor: 'bg-blue-500' },

    { day: 19, count: 8, cap: 51, dotColor: 'bg-emerald-500' },
    { day: 20, count: 12, cap: 63, dotColor: 'bg-amber-500' },
    { day: 21, count: 15, cap: 75, dotColor: 'bg-blue-500' },
    { day: 22, count: 12, cap: 69, dotColor: 'bg-purple-500' },
    { day: 23, count: 18, cap: 88, dotColor: 'bg-rose-500' },
    { day: 24, count: 20, cap: 94, dotColor: 'bg-rose-500' },
    { day: 25, count: 14, cap: 73, dotColor: 'bg-emerald-500' },

    { day: 26, count: 10, cap: 56, dotColor: 'bg-blue-500' },
    { day: 27, count: 12, cap: 67, dotColor: 'bg-amber-500' },
    { day: 28, count: 11, cap: 61, dotColor: 'bg-emerald-500' },
    { day: 29, count: 15, cap: 79, dotColor: 'bg-purple-500' },
    { day: 30, count: 17, cap: 85, dotColor: 'bg-rose-500' },
    { day: 31, count: 19, cap: 91, dotColor: 'bg-rose-500' },
    { day: 1, isOtherMonth: true },
  ];

  // Daily agenda items matching Image 2
  const agendaItems = [
    { time: '08:00 - 09:00', customer: 'Nguyễn Thị Mai', phone: '0908 102 601', service: 'Chăm sóc da mặt (Facial chuyên sâu)', ktv: 'Demo Facial', status: 'Đã check-in', statusColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { time: '09:00 - 10:00', customer: 'Trần Ngọc An', phone: '0908 102 602', service: 'Gội đầu dưỡng sinh (Dưỡng sinh)', ktv: 'Demo Body', status: 'Đã xác nhận', statusColor: 'bg-blue-50 text-blue-700 border-blue-200' },
    { time: '10:00 - 11:00', customer: 'Lê Thị Hạnh', phone: '0908 102 603', service: 'Triệt lông Diode (Công nghệ)', ktv: 'Demo An', status: 'Chờ xác nhận', statusColor: 'bg-amber-50 text-amber-700 border-amber-200' },
    { time: '11:00 - 12:00', customer: 'Phạm Thu Trang', phone: '0908 102 604', service: 'Massage body (Body thư giãn)', ktv: 'Demo Body', status: 'Đã xác nhận', statusColor: 'bg-blue-50 text-blue-700 border-blue-200' },
    { time: '12:00 - 13:00', customer: 'Võ Minh Tuấn', phone: '0908 102 605', service: 'Chăm sóc da mặt (Facial cơ bản)', ktv: '--', status: 'Chưa phân công', statusColor: 'bg-rose-50 text-rose-700 border-rose-200' },
    { time: '13:00 - 14:00', customer: 'Ngô Bảo Trân', phone: '0908 102 606', service: 'Gội đầu dưỡng sinh (Dưỡng sinh)', ktv: 'Demo Facial', status: 'Đã xác nhận', statusColor: 'bg-blue-50 text-blue-700 border-blue-200' },
    { time: '14:00 - 15:00', customer: 'Đặng Khánh Vy', phone: '0908 102 607', service: 'Triệt lông Diode (Công nghệ)', ktv: 'Demo An', status: 'Đã xác nhận', statusColor: 'bg-blue-50 text-blue-700 border-blue-200' },
    { time: '15:00 - 16:00', customer: 'Bùi Hoài Nam', phone: '0908 102 608', service: 'Chăm sóc da mặt (Facial nâng cao)', ktv: 'Demo Facial', status: 'Đang thực hiện', statusColor: 'bg-purple-50 text-purple-700 border-purple-200' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Operational Monthly KPI Summary ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black text-slate-900 leading-none">286</span>
              <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">↑ 12%</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Tổng lịch hẹn (Tháng 10/2026)</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-pink-50 text-pink-600 border border-pink-100 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black text-slate-900 leading-none">214</span>
              <span className="text-[9px] font-black text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded-full">↑ 8%</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Khách hàng unique</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 border border-teal-100 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-slate-900 leading-none">71%</span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Công suất trung bình</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-2xl font-black text-rose-600 leading-none">12</span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mt-1">Chưa phân công</p>
          </div>
        </div>
      </div>

      {/* ── Month Navigator & Filter Bar ── */}
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
          <h3 className="text-lg font-black text-slate-900">Tháng 10 Năm 2026</h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black transition-colors">
            Hôm nay
          </button>
          <select className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none">
            <option>Tất cả chi nhánh</option>
          </select>
          <select className="px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none">
            <option>Tất cả KTV</option>
          </select>
        </div>
      </div>

      {/* ── Monthly Heatmap Calendar Grid ── */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xl shadow-slate-200/50 overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 mb-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">
            <div>THỨ HAI</div>
            <div>THỨ BA</div>
            <div>THỨ TƯ</div>
            <div>THỨ NĂM</div>
            <div>THỨ SÁU</div>
            <div>THỨ BẢY</div>
            <div>CHỦ NHẬT</div>
          </div>

          {/* Day Grid */}
          <div className="grid grid-cols-7 gap-2">
            {monthDays.map((item, idx) => (
              <div
                key={idx}
                onClick={() => !item.isOtherMonth && setSelectedDay(item.day)}
                className={cn(
                  "min-h-[84px] p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative",
                  item.isOtherMonth
                    ? "bg-slate-50/40 border-slate-100 text-slate-300 pointer-events-none"
                    : item.isSelected
                    ? "bg-slate-950 text-white border-slate-900 shadow-xl shadow-slate-900/20"
                    : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("text-base font-black", item.isSelected ? "text-white" : "text-slate-900")}>
                    {item.day}
                  </span>
                  {item.dotColor && (
                    <span className={cn("w-2 h-2 rounded-full", item.dotColor)} />
                  )}
                </div>

                {!item.isOtherMonth && item.count && (
                  <div className="space-y-0.5">
                    <p className={cn("text-[10px] font-black", item.isSelected ? "text-slate-300" : "text-slate-700")}>
                      • {item.count} lịch
                    </p>
                    <p className={cn("text-[9px] font-bold", item.isSelected ? "text-emerald-400" : "text-emerald-600")}>
                      ● {item.cap}%
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Lower Daily Agenda & Operational Summary Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Daily Agenda (2/3 width) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">Thứ Hai, 05/10/2026</h3>
                <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2.5 py-0.5 rounded-full">Hôm nay</span>
              </div>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                18 lịch hẹn • 12 khách hàng • 73% công suất • <span className="text-rose-600 font-black">🔴 2 chưa phân công</span>
              </p>
            </div>
            <button className="text-xs font-bold text-blue-600 hover:underline shrink-0">
              Xem theo Timeline &gt;
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setAgendaTab('all')}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-black transition-all border",
                agendaTab === 'all' ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
              )}
            >
              Tất cả (18)
            </button>
            <button
              onClick={() => setAgendaTab('confirmed')}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-black transition-all border",
                agendaTab === 'confirmed' ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200"
              )}
            >
              Đã xác nhận (14)
            </button>
            <button
              onClick={() => setAgendaTab('pending')}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-black transition-all border",
                agendaTab === 'pending' ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-600 border-slate-200"
              )}
            >
              Chờ xác nhận (2)
            </button>
            <button
              onClick={() => setAgendaTab('in_progress')}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-black transition-all border",
                agendaTab === 'in_progress' ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"
              )}
            >
              Đang thực hiện (2)
            </button>
          </div>

          {/* Agenda Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-2.5 px-3">Giờ</th>
                  <th className="py-2.5 px-3">Khách hàng</th>
                  <th className="py-2.5 px-3">Dịch vụ</th>
                  <th className="py-2.5 px-3">KTV</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold">
                {agendaItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-3 text-slate-900 whitespace-nowrap">{item.time}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <Image
                          src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80"
                          alt={item.customer}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full object-cover border border-slate-200"
                        />
                        <div>
                          <p className="font-black text-slate-900">{item.customer}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{item.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-700">{item.service}</td>
                    <td className="py-3 px-3 text-slate-800">{item.ktv}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={cn("px-2.5 py-1 rounded-full text-[9.5px] font-black border", item.statusColor)}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Daily Operational Widgets (1/3 width) */}
        <div className="space-y-6">
          {/* Daily Operational Summary */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50 space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-emerald-600" />
              <span>Tổng quan trong ngày</span>
            </h3>

            <div className="space-y-2.5 text-xs font-bold">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Tổng lịch hẹn</span>
                <span className="text-slate-900 font-black">18</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Khách hàng</span>
                <span className="text-slate-900 font-black">12</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">KTV làm việc</span>
                <span className="text-slate-900 font-black">3 / 3</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Công suất</span>
                <span className="text-emerald-600 font-black">73%</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Chưa phân công</span>
                <span className="text-rose-600 font-black">2</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Lịch trễ</span>
                <span className="text-amber-600 font-black">1</span>
              </div>
            </div>
          </div>

          {/* Phân bổ dịch vụ (Service distribution) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50 space-y-4">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Filter className="w-5 h-5 text-indigo-600" />
              <span>Phân bổ dịch vụ</span>
            </h3>

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Chăm sóc da mặt</span>
                <span className="text-slate-900 font-black">7 (33%)</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Chăm sóc body</span>
                <span className="text-slate-900 font-black">5 (28%)</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Triệt lông / CN</span>
                <span className="text-slate-900 font-black">4 (22%)</span>
              </div>
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Gội đầu / Dưỡng sinh</span>
                <span className="text-slate-900 font-black">3 (17%)</span>
              </div>
            </div>
          </div>

          {/* Phân bổ theo KTV */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-lg shadow-slate-200/50 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span>Phân bổ theo KTV</span>
              </h3>
              <button className="text-xs font-bold text-blue-600 hover:underline">Chi tiết &gt;</button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-black">
                  <span className="text-slate-900">Demo Facial</span>
                  <span className="text-blue-600">7 lịch • 82%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '82%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-black">
                  <span className="text-slate-900">Demo Body</span>
                  <span className="text-rose-600">8 lịch • 75%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: '75%' }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-black">
                  <span className="text-slate-900">Demo An</span>
                  <span className="text-amber-600">3 lịch • 50%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '50%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
