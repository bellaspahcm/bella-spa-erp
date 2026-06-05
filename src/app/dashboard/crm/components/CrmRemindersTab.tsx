'use client';

import { CheckCircle2, Clock } from 'lucide-react';
import type { UpcomingCrmSession } from '../types';

interface CrmRemindersTabProps {
  upcomingSessions: UpcomingCrmSession[];
  loadError: string | null;
  actionLoading: string | null;
  onSendSingleReminder: (sessionId: string) => void;
}

export function CrmRemindersTab({
  upcomingSessions,
  loadError,
  actionLoading,
  onSendSingleReminder,
}: CrmRemindersTabProps) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-100/50 border border-slate-100/80 overflow-hidden">
      <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-white/50 backdrop-blur-md">
        <div>
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Danh sách lịch hẹn nhắc nhở Zalo</h3>
          <p className="text-xs text-slate-400 font-medium">Buổi chăm sóc mẹ & bé hôm nay và ngày mai</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Thời gian đồng bộ: mới nhất</span>
        </div>
      </div>

      <div className="overflow-x-auto overscroll-x-contain custom-scrollbar">
        <table className="bella-data-table min-w-[72rem] text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <th className="py-4 px-6">Mã booking</th>
              <th className="py-4 px-6">Mẹ & bé</th>
              <th className="py-4 px-6">KTV phụ trách</th>
              <th className="py-4 px-6">Thời gian hẹn</th>
              <th className="py-4 px-6">Địa chỉ</th>
              <th className="py-4 px-6">Gửi Zalo</th>
              <th className="py-4 px-6 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {upcomingSessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400 font-medium italic">
                  {loadError ? 'Không thể tải danh sách lịch nhắc hẹn.' : 'Không tìm thấy buổi chăm sóc nào hôm nay và ngày mai.'}
                </td>
              </tr>
            ) : (
              upcomingSessions.map((session) => {
                const customer = session.bookings?.customers;
                const ktvName = session.bookings?.assigned_ktv?.full_name || 'Chưa phân công';
                const isSent = session.zalo_reminder_sent;

                return (
                  <tr key={session.id} className="border-b border-slate-100/70 hover:bg-slate-50/30 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-bold text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                        {session.bookings?.booking_number || 'N/A'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-slate-800">{customer?.name_mother || 'Khách hàng'}</span>
                        <span className="text-[11px] text-slate-400 font-bold">
                          Bé: {customer?.name_baby || 'Chưa ghi nhận'} • SĐT: {customer?.phone || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs font-bold text-slate-600">{ktvName}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col">
                        <span className="font-black text-xs text-primary">{session.assigned_time?.substring(0, 5) || '08:00'}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{session.assigned_date}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 max-w-xs truncate">
                      <span className="text-xs font-medium text-slate-500">{session.address || 'Tại nhà'}</span>
                    </td>
                    <td className="py-4 px-6">
                      {isSent ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Đã gửi
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5" />
                          Chờ gửi
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => onSendSingleReminder(session.id)}
                        disabled={actionLoading === session.id}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-rose-100 dark:shadow-none hover:shadow-lg transition-all disabled:opacity-50"
                      >
                        {actionLoading === session.id ? 'Đang gửi...' : isSent ? 'Gửi lại tin' : 'Gửi ngay'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
