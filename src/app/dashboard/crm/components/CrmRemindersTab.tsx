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
          <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Danh sÃ¡ch Lá»‹ch háº¹n Nháº¯c nhá»Ÿ Zalo</h3>
          <p className="text-xs text-slate-400 font-medium">Buá»•i chÄƒm sÃ³c máº¹ & bÃ© hÃ´m nay vÃ  ngÃ y mai</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Thá»i gian Ä‘á»“ng bá»™: Má»›i nháº¥t</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
              <th className="py-4 px-6">MÃ£ Booking</th>
              <th className="py-4 px-6">Máº¹ & BÃ©</th>
              <th className="py-4 px-6">KTV phá»¥ trÃ¡ch</th>
              <th className="py-4 px-6">Thá»i gian háº¹n (GMT+7)</th>
              <th className="py-4 px-6">Äá»‹a chá»‰</th>
              <th className="py-4 px-6">Gá»­i Zalo (ZNS)</th>
              <th className="py-4 px-6 text-center">Thao tÃ¡c</th>
            </tr>
          </thead>
          <tbody>
            {upcomingSessions.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400 font-medium italic">
                  {loadError ? 'KhÃ´ng thá»ƒ táº£i danh sÃ¡ch lá»‹ch nháº¯c háº¹n.' : 'KhÃ´ng tÃ¬m tháº¥y buá»•i chÄƒm sÃ³c nÃ o hÃ´m nay vÃ  ngÃ y mai.'}
                </td>
              </tr>
            ) : (
              upcomingSessions.map((session) => {
                const customer = session.bookings?.customers;
                const ktvName = session.bookings?.assigned_ktv?.full_name || 'ChÆ°a phÃ¢n cÃ´ng';
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
                        <span className="font-black text-sm text-slate-800">{customer?.name_mother || 'KhÃ¡ch hÃ ng'}</span>
                        <span className="text-[11px] text-slate-400 font-bold">
                          BÃ©: {customer?.name_baby || 'ChÆ°a ghi nháº­n'} â€¢ SÄT: {customer?.phone || 'N/A'}
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
                      <span className="text-xs font-medium text-slate-500">{session.address || 'Táº¡i nhÃ '}</span>
                    </td>
                    <td className="py-4 px-6">
                      {isSent ? (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          ÄÃƒ Gá»¬I
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5" />
                          CHá»œ Gá»¬I (2.5H)
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {isSent ? (
                        <button
                          onClick={() => onSendSingleReminder(session.id)}
                          disabled={actionLoading === session.id}
                          className="text-[10px] font-black text-slate-400 hover:text-primary uppercase tracking-widest p-2 hover:bg-slate-100 rounded-xl transition-all"
                        >
                          {actionLoading === session.id ? 'Gá»¬I Láº I...' : 'Gá»¬I Láº I TIN'}
                        </button>
                      ) : (
                        <button
                          onClick={() => onSendSingleReminder(session.id)}
                          disabled={actionLoading === session.id}
                          className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md shadow-rose-100 dark:shadow-none hover:shadow-lg transition-all"
                        >
                          {actionLoading === session.id ? 'ÄANG Gá»¬I...' : 'Gá»¬I NGAY'}
                        </button>
                      )}
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
