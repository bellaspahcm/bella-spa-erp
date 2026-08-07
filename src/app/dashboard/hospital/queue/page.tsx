'use client';

import React, { useState, useEffect } from 'react';
import { PatientJourneyQueueItem } from '@/types/healthcare';
import {
  Volume2,
  Tv,
  Users,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  Clock,
  Play,
  SkipForward,
  User,
  Filter,
} from 'lucide-react';

const INITIAL_QUEUE_ITEMS: PatientJourneyQueueItem[] = [
  {
    id: 'q-101',
    tenant_id: 'bella_healthcare',
    encounter_id: 'enc-101',
    patient_name: 'Nguyễn Văn Hùng',
    ticket_number: 'A042',
    queue_type: 'bhyt',
    current_station: 'consultation',
    status: 'waiting',
    created_at: new Date().toISOString(),
  },
  {
    id: 'q-102',
    tenant_id: 'bella_healthcare',
    encounter_id: 'enc-102',
    patient_name: 'Trần Thị Thu Hà',
    ticket_number: 'A043',
    queue_type: 'priority',
    current_station: 'consultation',
    status: 'waiting',
    created_at: new Date().toISOString(),
  },
  {
    id: 'q-103',
    tenant_id: 'bella_healthcare',
    encounter_id: 'enc-103',
    patient_name: 'Lê Hoàng Nam',
    ticket_number: 'B015',
    queue_type: 'service',
    current_station: 'lab',
    status: 'waiting',
    created_at: new Date().toISOString(),
  },
  {
    id: 'q-104',
    tenant_id: 'bella_healthcare',
    encounter_id: 'enc-104',
    patient_name: 'Phạm Minh Anh',
    ticket_number: 'A041',
    queue_type: 'bhyt',
    current_station: 'consultation',
    status: 'in_service',
    called_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
];

export default function SmartQueueCallPage() {
  const [queueItems, setQueueItems] = useState<PatientJourneyQueueItem[]>(INITIAL_QUEUE_ITEMS);
  const [selectedStation, setSelectedStation] = useState<string>('consultation');
  const [currentCallingItem, setCurrentCallingItem] = useState<PatientJourneyQueueItem | null>(null);

  const speakVoiceCall = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'vi-VN';
      utterance.rate = 0.9; // Natural pace
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleCallNext = (item: PatientJourneyQueueItem) => {
    const updated = queueItems.map((q) => {
      if (q.id === item.id) {
        return { ...q, status: 'called' as const, called_at: new Date().toISOString() };
      }
      return q;
    });

    setQueueItems(updated);
    setCurrentCallingItem(item);

    const callAnnouncement = `Mời bệnh nhân ${item.patient_name}, số thứ tự ${item.ticket_number}, vào phòng khám số 101.`;
    speakVoiceCall(callAnnouncement);
  };

  const handleCompleteService = (item: PatientJourneyQueueItem) => {
    setQueueItems((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: 'completed' as const } : q))
    );
    if (currentCallingItem?.id === item.id) {
      setCurrentCallingItem(null);
    }
  };

  const filteredItems = queueItems.filter(
    (q) => selectedStation === 'all' || q.current_station === selectedStation
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-900 via-cyan-900 to-indigo-900 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2 text-cyan-300 mb-1">
            <Volume2 className="w-5 h-5 animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider">Bella Healthcare AI • Smart Queue Voice Center</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Bảng Điều Khiển Gọi Tên Bệnh Nhân AI Voice</h1>
          <p className="text-cyan-100 text-sm mt-1">
            Gọi loa phát thanh AI bằng giọng nói đọc Tiếng Việt tự động, điều phối hàng đợi thông minh theo ưu tiên BHYT/Cấp cứu.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <a
            href="/dashboard/healthcare/queue/tv"
            target="_blank"
            className="flex items-center space-x-2 bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-lg hover:shadow-cyan-900/50 transition-all border border-cyan-400/30"
          >
            <Tv className="w-5 h-5" />
            <span>Mở Màn Hình TV Hàng Đợi</span>
          </a>
        </div>
      </div>

      {/* Live Calling Alert Card */}
      {currentCallingItem && (
        <div className="bg-gradient-to-r from-emerald-500 via-teal-600 to-cyan-600 text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-emerald-300">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl font-extrabold shadow-inner border border-white/30">
              {currentCallingItem.ticket_number}
            </div>
            <div>
              <div className="flex items-center space-x-2 text-emerald-100 text-xs font-bold uppercase tracking-wider">
                <Volume2 className="w-4 h-4 animate-bounce" /> Đang phát loa gọi tên
              </div>
              <h2 className="text-2xl font-black">{currentCallingItem.patient_name}</h2>
              <div className="text-xs text-emerald-100 mt-0.5">
                Trạm: <span className="font-bold uppercase">{currentCallingItem.current_station}</span> • Loại: {currentCallingItem.queue_type.toUpperCase()}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => speakVoiceCall(`Đọc lại: Mời bệnh nhân ${currentCallingItem.patient_name}, số thứ tự ${currentCallingItem.ticket_number}, vào phòng khám số 101.`)}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-xs font-bold border border-white/30"
            >
              Phát Loa Lại
            </button>
            <button
              onClick={() => handleCompleteService(currentCallingItem)}
              className="bg-white text-emerald-900 hover:bg-emerald-50 px-5 py-2 rounded-xl text-xs font-bold shadow-lg"
            >
              Hoàn Tất Khám
            </button>
          </div>
        </div>
      )}

      {/* Station Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">Chọn vị trí phòng khám (Station):</span>
          <select
            value={selectedStation}
            onChange={(e) => setSelectedStation(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-800 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">Tất Cả Các Trạm Hàng Đợi</option>
            <option value="consultation">Phòng Khám Bác Sĩ (Consultation)</option>
            <option value="vitals">Trạm Đo Sinh Hiệu (Vitals)</option>
            <option value="lab">Phòng Xét Nghiệm (Lab)</option>
            <option value="imaging">Chẩn Đoán Hình Ảnh (Imaging)</option>
            <option value="pharmacy">Quầy Phát Thuốc (Pharmacy)</option>
          </select>
        </div>
      </div>

      {/* Queue Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
            <Users className="w-5 h-5 text-cyan-700" />
            <span>Hàng Đợi Chờ Gọi Khám ({filteredItems.length})</span>
          </h2>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-colors ${
                item.status === 'called' ? 'bg-amber-50/60' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg border ${
                    item.queue_type === 'priority'
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : item.queue_type === 'bhyt'
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}
                >
                  {item.ticket_number}
                </div>

                <div>
                  <div className="font-bold text-slate-900 text-base">{item.patient_name}</div>
                  <div className="text-xs text-slate-500 flex items-center space-x-2 mt-0.5">
                    <span>Mã Lượt khám: {item.encounter_id}</span>
                    <span>•</span>
                    <span className="uppercase font-semibold text-cyan-700">{item.current_station}</span>
                    <span>•</span>
                    <span className="font-medium text-slate-600">Loại: {item.queue_type.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
                {item.status === 'completed' ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-slate-500" /> Hoàn Tất
                  </span>
                ) : item.status === 'called' ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                    <Clock className="w-3.5 h-3.5 mr-1 text-amber-600 animate-spin" /> Đã Gọi Phát Loa
                  </span>
                ) : (
                  <button
                    onClick={() => handleCallNext(item)}
                    className="flex items-center space-x-1.5 bg-cyan-700 hover:bg-cyan-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Gọi Vào Khám (AI Voice)</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
