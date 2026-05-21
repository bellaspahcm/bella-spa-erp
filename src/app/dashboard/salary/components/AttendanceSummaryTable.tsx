'use client';

import { motion } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { KtvAttendanceSummary } from '@/types/domain';

interface AttendanceSummaryTableProps {
  attendanceData: KtvAttendanceSummary[];
  openKtvCalendar: (ktv: KtvAttendanceSummary) => void;
}

export default function AttendanceSummaryTable({
  attendanceData,
  openKtvCalendar,
}: AttendanceSummaryTableProps) {
  return (
    <div className="space-y-10">
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
              <CalendarDays className="w-8 h-8 text-primary" />
              Bảng tổng hợp công thực tế
            </h2>
            <p className="text-slate-500 font-medium text-sm mt-1">
              Giám sát chuyên chuyên cần, đi muộn, nghỉ phép và số ca hoàn thành
            </p>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 backdrop-blur-md">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] min-w-[200px]">
                  Nhân viên
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                  Tổng công
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center text-emerald-600">
                  Đúng giờ
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center text-amber-600">
                  Đi muộn
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center text-rose-600">
                  Nghỉ
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                  Nửa ngày
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                  Lương cơ bản
                </th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                  Hành động
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {attendanceData.map((ktv, idx) => (
                <motion.tr
                  key={ktv.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="hover:bg-slate-50/50 transition-colors"
                >
                  <td className="px-8 py-6 whitespace-nowrap">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black">
                        {ktv.name.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block">{ktv.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{ktv.role}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap font-black text-slate-700">
                    {ktv.totalDays}
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap font-black text-emerald-600">
                    +{ktv.present}
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap font-black text-amber-600">
                    +{ktv.late}
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap font-black text-rose-500">
                    -{ktv.absent}
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap font-black text-blue-500">
                    +{ktv.halfDay}
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap font-black text-slate-900">
                    {ktv.baseSalary ? `${ktv.baseSalary.toLocaleString()}đ` : 'Chưa thiết lập'}
                  </td>
                  <td className="px-8 py-6 text-center whitespace-nowrap">
                    <button
                      onClick={() => openKtvCalendar(ktv)}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all"
                    >
                      Chi tiết & Sửa
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
