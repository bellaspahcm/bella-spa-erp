'use client';

import { motion } from 'framer-motion';
import { Baby, CheckCircle2, MapPin, Phone, Play } from 'lucide-react';

export type KtvDashboardSession = {
  id: string;
  session_number?: number | string | null;
  start_time?: string | number | Date | null;
  assigned_time?: string | null;
  address?: string | null;
  is_reassigned?: boolean | null;
  bookings?: {
    package_name?: string | null;
    total_sessions?: number | string | null;
    assigned_ktv_id?: string | null;
    packages?: {
      duration?: string | null;
    } | null;
    customers?: {
      name_mother?: string | null;
      name_baby?: string | null;
      phone?: string | null;
      address?: string | null;
    } | null;
  } | null;
};

type KtvSessionSectionsProps = {
  activeSessions: KtvDashboardSession[];
  upcomingSessions: KtvDashboardSession[];
  currentUserId?: string | null;
  isActionLoading: string | null;
  onOpenCheckout: (session: KtvDashboardSession) => void;
  onOpenCheckin: (session: KtvDashboardSession) => void;
};

function isHotlinePhone(phone?: string | null) {
  const cleanPhone = phone?.replace(/[^\d]/g, '') || '';
  return cleanPhone === '0865701493' || cleanPhone === '84865701493';
}

function getSessionAddress(session: KtvDashboardSession) {
  return session.bookings?.customers?.address || session.address || 'Chưa cập nhật địa chỉ';
}

function formatStartTime(value?: string | number | Date | null) {
  if (!value) {
    return '--:--';
  }

  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function KtvSessionSections({
  activeSessions,
  upcomingSessions,
  currentUserId,
  isActionLoading,
  onOpenCheckout,
  onOpenCheckin,
}: KtvSessionSectionsProps) {
  return (
    <div className="px-6 mt-8 space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest">Đang thực hiện</h2>
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        </div>

        {activeSessions.length === 0 ? (
          <div className="bg-white p-8 rounded-[32px] border border-dashed border-slate-200 text-center">
            <p className="text-slate-400 text-sm font-medium">Không có ca nào đang chạy</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeSessions.map((session) => {
              const customer = session.bookings?.customers;
              const isHotline = isHotlinePhone(customer?.phone);

              return (
                <motion.div
                  layoutId={session.id}
                  key={session.id}
                  className="bg-slate-900 p-6 rounded-[32px] text-white shadow-xl shadow-slate-200"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="bg-white/10 text-white/80 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-block">
                          {session.bookings?.package_name}
                        </span>
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-block animate-pulse">
                          Buổi {session.session_number}/{session.bookings?.total_sessions || '--'}
                        </span>
                        {session.bookings?.assigned_ktv_id !== currentUserId && (
                          <span className="bg-amber-500/25 text-amber-300 border border-amber-500/40 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest inline-block animate-pulse">
                            🔄 Làm thay
                          </span>
                        )}
                      </div>
                      <div className="text-xl font-black text-white">{customer?.name_mother}</div>
                      <p className="text-xs text-rose-300 font-bold mt-1.5 flex items-center gap-1.5">
                        <Baby className="w-4 h-4 shrink-0 text-rose-300" />
                        <span>Bé: {customer?.name_baby || 'Chưa sinh/Chưa có'}</span>
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <p className="text-[10px] font-black text-white/40 uppercase">Bắt đầu lúc</p>
                      <p className="font-black">{formatStartTime(session.start_time)}</p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6 opacity-80">
                    <div className="flex items-center gap-2 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                      <span className="truncate">{getSessionAddress(session)}</span>
                    </div>
                    {customer?.phone && !isHotline && (
                      <div className="flex items-center gap-2 text-xs">
                        <Phone className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => onOpenCheckout(session)}
                    disabled={isActionLoading !== null}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Kết thúc & Check-out
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Lịch hôm nay</h2>

        {upcomingSessions.length === 0 ? (
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 text-center">
            <p className="text-slate-400 text-sm font-medium">Hôm nay không còn ca nào</p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingSessions.map((session) => {
              const customer = session.bookings?.customers;
              const isHotline = isHotlinePhone(customer?.phone);

              return (
                <div key={session.id} className="bg-white p-6 rounded-[32px] border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex flex-col items-center justify-center border border-slate-100 flex-shrink-0">
                        <span className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Giờ</span>
                        <span className="text-sm font-black text-slate-900 leading-none">{session.assigned_time || '--:--'}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="bg-rose-50 text-primary px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                            Buổi {session.session_number}/{session.bookings?.total_sessions || '--'}
                          </span>
                          {session.is_reassigned && (
                            <span className="bg-amber-50 text-amber-600 border border-amber-100 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-0.5">
                              🔄 Làm thay
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-slate-500 truncate">{session.bookings?.package_name}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenCheckin(session)}
                      disabled={isActionLoading !== null}
                      className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center hover:bg-primary hover:text-white transition-all active:scale-95 disabled:opacity-50 shrink-0"
                    >
                      <Play className="w-5 h-5 fill-current" />
                    </button>
                  </div>

                  {session.is_reassigned && (
                    <div className="bg-amber-50/50 border border-amber-200/60 rounded-2xl p-3 flex gap-2 items-center">
                      <span className="text-base shrink-0">⚠️</span>
                      <p className="text-[11px] text-amber-800 font-bold leading-normal">
                        Đây là ca làm thay được phân công. Vui lòng kiểm tra kỹ thông tin khách hàng và dịch vụ trước khi bắt đầu.
                      </p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div>
                      <h4 className="text-base font-black text-slate-800">{customer?.name_mother}</h4>
                      {customer?.name_baby && (
                        <p className="text-[11px] text-rose-500 font-bold mt-0.5 flex items-center gap-1">
                          <Baby className="w-3.5 h-3.5 shrink-0" />
                          <span>Bé: {customer.name_baby}</span>
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-500">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed font-medium">{getSessionAddress(session)}</span>
                      </div>
                      {customer?.phone && !isHotline && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                          <a href={`tel:${customer.phone}`} className="hover:text-primary font-bold transition-colors">
                            {customer.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
