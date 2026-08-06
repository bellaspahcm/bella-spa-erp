'use client';

import React, { useState, useEffect } from 'react';
import { Ticket, Volume2, Users, CheckCircle, Clock, ChevronRight, Play, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getPatientQueueAction, createQueueTicketAction, callTicketAction } from '@/services/healthcare/healthcare-actions';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

const QUEUE_TYPE_OPTIONS = [
  { value: 'service', label: '⭐ Khám Dịch Vụ / Khám Thường' },
  { value: 'bhyt', label: '🏥 Đón Tiếp BHYT (Hưởng 80/20%)' },
  { value: 'priority', label: '🚨 Ưu Tiên Cấp Cứu / Người Già & Trẻ Em' },
];

const STATION_OPTIONS = [
  { value: 'consultation', label: 'Phòng Khám Bác Sĩ (Consultation)' },
  { value: 'vitals', label: 'Trạm Đo Sinh Tồn (Vitals Check)' },
  { value: 'registration', label: 'Quầy Đăng Ký Đón Tiếp (Registration)' },
  { value: 'lab', label: 'Khu LIS Xét Nghiệm (Laboratory)' },
  { value: 'imaging', label: 'Khu RIS CĐHA & PACS (Imaging)' },
  { value: 'billing', label: 'Quầy Thu Ngân Viện Phí (Billing)' },
  { value: 'pharmacy', label: 'Quầy Cấp Phát Dược BHYT (Pharmacy)' },
];

interface QueueItem {
  id: string;
  ticketNumber: string;
  patientName: string;
  station: 'registration' | 'vitals' | 'consultation' | 'lab' | 'imaging' | 'billing' | 'pharmacy';
  status: 'waiting' | 'called' | 'in_service' | 'completed';
  queueType: 'bhyt' | 'service' | 'priority';
  calledAt?: string;
}

export default function PatientQueuePage() {
  const [queues, setQueues] = useState<QueueItem[]>([]);
  const [currentCalling, setCurrentCalling] = useState<QueueItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadQueueData = async () => {
    try {
      setIsLoading(true);
      const res = await getPatientQueueAction();
      if (res.success && res.data) {
        // Map database queue model to frontend QueueItem model
        const mapped: QueueItem[] = res.data.map((q: any) => ({
          id: q.id,
          ticketNumber: q.ticket_number,
          patientName: q.patient_name,
          station: q.current_station,
          status: q.status,
          queueType: q.queue_type,
          calledAt: q.called_at ? new Date(q.called_at).toLocaleTimeString('vi-VN') : undefined,
        }));
        setQueues(mapped);

        // Find the most recently called ticket
        const called = mapped.filter((q) => q.status === 'called');
        if (called.length > 0) {
          setCurrentCalling(called[called.length - 1]);
        } else {
          setCurrentCalling(null);
        }
      } else {
        toast.error('Lỗi tải danh sách hàng đợi: ' + res.error);
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQueueData();
  }, []);

  const [newTicket, setNewTicket] = useState({
    patientName: '',
    queueType: 'service' as 'bhyt' | 'service' | 'priority',
    station: 'consultation' as QueueItem['station'],
  });

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.patientName.trim()) {
      toast.error('Vui lòng nhập họ tên bệnh nhân!');
      return;
    }

    const dbRes = await createQueueTicketAction({
      patientName: newTicket.patientName.trim(),
      queueType: newTicket.queueType,
      station: newTicket.station,
    });

    if (!dbRes.success) {
      toast.error('Lỗi cấp số STT mới: ' + dbRes.error);
      return;
    }

    setIsAddModalOpen(false);
    toast.success(`🎫 Đã cấp số thành công ${dbRes.data?.ticket_number} cho BN ${newTicket.patientName}!`);
    setNewTicket({ patientName: '', queueType: 'service', station: 'consultation' });
    loadQueueData();
  };

  const handleCallNextTicket = async () => {
    const waitingItem = queues.find((q) => q.status === 'waiting');
    if (!waitingItem) {
      toast.info('Hiện không có bệnh nhân nào đang chờ!');
      return;
    }

    const dbRes = await callTicketAction(waitingItem.id);
    if (!dbRes.success) {
      toast.error('Lỗi gọi số tiếp theo: ' + dbRes.error);
      return;
    }

    toast.success(`🔊 Đang phát loa gọi số STT ${waitingItem.ticketNumber} - Bệnh nhân ${waitingItem.patientName} vào Phòng khám!`, {
      duration: 5000
    });
    loadQueueData();
  };

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
              <Ticket className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Điều Phối Hàng Đợi & Cấp Số STT (Patient Queue)
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Màn hình TV Gọi số tự động, Phân luồng BHYT/Dịch vụ & Theo dõi Hành trình Bệnh nhân Realtime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs shadow-md hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            + Cấp Số STT Mới
          </button>
          <button
            onClick={handleCallNextTicket}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white font-black text-xs shadow-lg shadow-teal-500/20 hover:scale-105 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Volume2 className="w-4 h-4 animate-pulse" />
            Phát Loa Gọi Số Tiếp Theo
          </button>
        </div>
      </div>

      {/* TV Display Broadcast Box */}
      {currentCalling && (
        <div className="p-7 rounded-3xl bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 border border-teal-500/40 shadow-2xl text-white flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-left">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-black uppercase text-teal-300 tracking-wider">Đang Gọi Loa TV Display (Trạm Khám Bác Sĩ)</span>
            </div>
            <h2 className="text-5xl font-black tracking-tight text-white">{currentCalling.ticketNumber}</h2>
            <p className="text-xl font-bold text-teal-100">{currentCalling.patientName}</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-1 text-center min-w-[200px]">
            <span className="text-[11px] text-teal-200 uppercase font-bold block">Thời Gian Gọi</span>
            <span className="text-2xl font-black text-emerald-400">{currentCalling.calledAt || '14:10:00'}</span>
          </div>
        </div>
      )}

      {/* Queue List Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-black text-sm text-slate-900 dark:text-white flex items-center justify-between">
          <span>Danh Sách Bệnh Nhân Đang Chờ Đón Tiếp & Khám</span>
          <span className="text-xs text-slate-400 font-normal">Tổng số: {queues.length} bệnh nhân</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                <th className="p-4">Mã Số STT</th>
                <th className="p-4">Họ Và Tên Bệnh Nhân</th>
                <th className="p-4">Phân Luồng Kiosk</th>
                <th className="p-4">Trạm Hiện Tại</th>
                <th className="p-4">Trạng Thái</th>
                <th className="p-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {queues.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-4 font-black text-teal-600 dark:text-teal-400 text-sm">{q.ticketNumber}</td>
                  <td className="p-4 font-bold text-slate-900 dark:text-white">{q.patientName}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                      q.queueType === 'priority' ? 'bg-red-500/10 text-red-600 border border-red-500/20' : q.queueType === 'bhyt' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
                    }`}>
                      {q.queueType === 'priority' ? '🚨 Ưu Tiên KH' : q.queueType === 'bhyt' ? '🏥 BHYT' : '⭐ Khám Dịch Vụ'}
                    </span>
                  </td>
                  <td className="p-4 font-semibold text-slate-700 dark:text-slate-300 capitalize">{q.station}</td>
                  <td className="p-4">
                    {q.status === 'called' ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-[10px] flex items-center gap-1 w-fit animate-pulse">
                        Đang Gọi Số
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 text-[10px] font-bold">
                        Đang Chờ
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => {
                        setCurrentCalling({ ...q, status: 'called', calledAt: new Date().toLocaleTimeString('vi-VN') });
                        toast.success(`🔊 Đã phát loa gọi lại số STT ${q.ticketNumber}!`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold hover:bg-teal-500 hover:text-white transition-all cursor-pointer"
                    >
                      Gọi Số
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Cấp Số STT Đón Tiếp Mới */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md p-6 space-y-5 animate-in fade-in zoom-in duration-200 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Ticket className="w-5 h-5 text-teal-600" />
                Cấp Số STT Đón Tiếp Mới
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Họ & Tên Bệnh Nhân *</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập tên bệnh nhân..."
                  value={newTicket.patientName}
                  onChange={(e) => setNewTicket({ ...newTicket, patientName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Phân Luồng Đón Tiếp</label>
                <PremiumSelect
                  options={QUEUE_TYPE_OPTIONS}
                  value={newTicket.queueType}
                  onChange={(val) => setNewTicket({ ...newTicket, queueType: val as any })}
                  buttonClassName="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white text-xs h-10"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Trạm Điều Phối / Phòng Khám</label>
                <PremiumSelect
                  options={STATION_OPTIONS}
                  value={newTicket.station}
                  onChange={(val) => setNewTicket({ ...newTicket, station: val as any })}
                  buttonClassName="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white text-xs h-10"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer">
                  Hủy Bỏ
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl text-xs font-black bg-teal-600 hover:bg-teal-700 text-white shadow-md cursor-pointer active:scale-95 transition-all">
                  + In Số & Cấp STT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
