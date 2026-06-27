'use client';

import { ChevronRight, ClipboardList, Clock, Heart, History, TrendingUp } from 'lucide-react';
import type { CustomerDetailBooking, CustomerDetailSession } from '../types';
import { useModuleVocabulary } from '@/lib/business-rules/module-vocabulary';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';

export function SessionHistoryPanel({
  activeBooking,
  sortedSessions,
  nextSession,
  isCompleted,
  isReusing,
  onOpenSessions,
  onOpenBookingSessions,
  onReusePackage,
  tenantModuleKey,
}: {
  activeBooking: CustomerDetailBooking | null;
  sortedSessions: CustomerDetailSession[];
  nextSession?: CustomerDetailSession;
  isCompleted: boolean;
  isReusing: boolean;
  onOpenSessions: () => void;
  onOpenBookingSessions: () => void;
  onReusePackage: () => void;
  tenantModuleKey: TenantModuleKey | null;
}) {
  const vocab = useModuleVocabulary(tenantModuleKey);
  
  return (
          <div className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3 flex-wrap">
                <History className="text-primary w-6 h-6 flex-shrink-0" />
                <span>
                  {vocab.serviceHistory.label}: <span className="text-primary">{activeBooking?.package_name || activeBooking?.packages?.name || (activeBooking?.status === 'deposit_pending' ? 'Phiếu Đặt Cọc' : 'Dịch vụ lẻ')}</span> ({activeBooking?.completed_sessions || 0}/{activeBooking?.total_sessions || 15})
                </span>
              </h3>
              <button
                onClick={onOpenSessions}
                className="text-[10px] font-black text-primary hover:text-rose-600 uppercase tracking-widest flex items-center gap-2 transition-colors"
              >
                Xem tất cả <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-4">
              {nextSession ? (
                <div className="p-6 bg-primary/5 border border-primary/20 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-pink-200 dark:shadow-none">
                      <Clock className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-1">{vocab.workUnit.singular} tiếp theo</p>
                      <h4 className="text-xl font-black text-slate-900">{vocab.workUnit.singular} số {nextSession.session_number}</h4>
                      <p className="text-xs text-slate-500 font-bold mt-1">
                        Ngày {nextSession.assigned_date || 'Chưa đặt'} • {nextSession.assigned_time || activeBooking?.preferred_time || '--:--'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={onOpenSessions}
                    className="w-full md:w-auto bg-primary hover:bg-rose-600 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-rose-200 dark:shadow-none flex items-center justify-center gap-3 active:scale-95"
                  >
                    <ClipboardList className="w-5 h-5" />
                    XEM {vocab.booking.singular.toUpperCase()}
                  </button>
                </div>
              ) : isCompleted ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
                      <Heart className="w-7 h-7" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em] mb-1">{vocab.service.singular} đã hoàn tất</p>
                      <h4 className="text-xl font-black text-slate-900">{vocab.customer.singular} đã hoàn tất {vocab.package.singular.toLowerCase()}</h4>
                    </div>
                  </div>
                  <button
                    onClick={onReusePackage}
                    disabled={isReusing}
                    className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  >
                    {isReusing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <TrendingUp className="w-5 h-5" />}
                    TÁI SỬ DỤNG GÓI NHANH
                  </button>
                </div>
              ) : null}

              {sortedSessions.filter((s) => s.status === 'completed').length > 0 ? (
                sortedSessions.filter((s) => s.status === 'completed').map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-[2rem] hover:bg-slate-100 transition-all group">
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm group-hover:scale-110 transition-transform">
                        <ClipboardList className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800">{session.type || vocab.service.singular} - {vocab.workUnit.singular} {session.session_number}/{activeBooking?.total_sessions || 15}</p>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 flex-wrap mt-1">
                          <span>{vocab.worker.short}: <strong className="text-slate-700">{session.completed_by_ktv?.full_name || activeBooking?.assigned_ktv?.full_name || 'Chưa phân công'}</strong>{session.completed_by_ktv?.phone || activeBooking?.assigned_ktv?.phone ? ` (${session.completed_by_ktv?.phone || activeBooking?.assigned_ktv?.phone})` : ''}</span>
                          <span>•</span>
                          <span>Hotline: <strong className="text-rose-500 font-black">0865 701 493</strong></span>
                          <span>•</span>
                          <span>{session.completed_date || session.assigned_date || 'Chưa cập nhật'}</span>
                        </p>
                        {session.notes && (
                          <p className="text-[11px] font-medium text-slate-500 mt-2 pl-3 border-l-2 border-slate-200">{session.notes}</p>
                        )}
                        <div className="mt-3 grid grid-cols-2 gap-4 bg-white border border-slate-100 rounded-2xl p-3 text-[10px] text-slate-500 font-medium max-w-sm">
                          <div className="space-y-1">
                            <p className="font-black text-slate-400 uppercase tracking-wider">📍 Check-in</p>
                            <p className="font-bold text-slate-700">
                              {session.start_time ? new Date(session.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </p>
                            <p className="text-[9px] text-slate-400 font-mono">
                              {session.checkin_lat && session.checkin_lon
                                ? `${Number(session.checkin_lat).toFixed(5)}, ${Number(session.checkin_lon).toFixed(5)}`
                                : 'Không có GPS'}
                            </p>
                          </div>
                          <div className="space-y-1 border-l border-slate-100 pl-4">
                            <p className="font-black text-slate-400 tracking-wider uppercase">🏁 Check-out</p>
                            <p className="font-bold text-slate-700">
                              {session.end_time ? new Date(session.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                            </p>
                            <p className="text-[9px] text-slate-400 font-mono">
                              {session.checkout_lat && session.checkout_lon
                                ? `${Number(session.checkout_lat).toFixed(5)}, ${Number(session.checkout_lon).toFixed(5)}`
                                : 'Không có GPS'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest">Hoàn thành</span>
                      <button
                        onClick={onOpenBookingSessions}
                        className="p-2 hover:bg-white rounded-xl transition-all shadow-sm group/btn active:scale-90"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover/btn:text-primary transition-colors" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                  <Clock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold italic">{vocab.serviceHistory.emptyState}</p>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-black">{vocab.customer.singular} chưa thực hiện {vocab.workUnit.singular.toLowerCase()} nào</p>
                </div>
              )}
            </div>
          </div>
  );
}
