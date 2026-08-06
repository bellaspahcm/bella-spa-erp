'use client';

import React, { useState, useEffect } from 'react';
import {
  Volume2,
  Tv,
  Users,
  Clock,
  ArrowRight,
  Sparkles,
  Play,
  CheckCircle,
  AlertCircle,
  Maximize2,
  Minimize2,
  Stethoscope,
  FlaskConical,
  Pill,
  ChevronRight,
  VolumeX
} from 'lucide-react';
import toast from 'react-hot-toast';

interface QueueItem {
  stt: number;
  patientName: string;
  roomName: string;
  doctorName: string;
  status: 'calling' | 'waiting' | 'in_consultation' | 'completed_to_lis' | 'completed_to_pharmacy';
  waitTime: string;
}

export default function QueueTVScreenPage() {
  const [queueList, setQueueList] = useState<QueueItem[]>([
    { stt: 102, patientName: 'Trần Minh Hoàng', roomName: 'Phòng Khám Số 3 - Tim Mạch', doctorName: 'BS. CKII Nguyễn Văn Minh', status: 'calling', waitTime: '2 phút' },
    { stt: 103, patientName: 'Lê Thị Mai', roomName: 'Phòng Khám Số 1 - Tiêu Hóa', doctorName: 'BS. CKI Trần Đức Hùng', status: 'in_consultation', waitTime: '8 phút' },
    { stt: 104, patientName: 'Nguyễn Văn Hùng', roomName: 'Phòng Khám Số 2 - Nhi Khoa', doctorName: 'ThS. BS Lê Thị Mai', status: 'waiting', waitTime: '12 phút' },
    { stt: 105, patientName: 'Phạm Thị Hoa', roomName: 'Phòng Khám Số 4 - Tai Mũi Họng', doctorName: 'BS. Vũ Thị Dung', status: 'waiting', waitTime: '15 phút' },
    { stt: 106, patientName: 'Hoàng Đức Nam', roomName: 'Phòng Khám Số 3 - Tim Mạch', doctorName: 'BS. CKII Nguyễn Văn Minh', status: 'waiting', waitTime: '20 phút' },
  ]);

  const [currentCalling, setCurrentCalling] = useState<QueueItem>(queueList[0]);
  const [isAutoSpeechEnabled, setIsAutoSpeechEnabled] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Web Speech Audio API AI Voice Call Function
  const speakAIVoiceCall = (item: QueueItem) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Trình duyệt không hỗ trợ Web Speech API Synthesis');
      return;
    }

    const textToSpeak = `Mời bệnh nhân số thứ tự ${item.stt}, ${item.patientName}, vào ${item.roomName} gặp ${item.doctorName}`;
    
    window.speechSynthesis.cancel(); // Clear previous audio queue
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.9; // Slightly slower for clear announcements
    utterance.pitch = 1.0;
    
    window.speechSynthesis.speak(utterance);
    toast.success(`🔊 AI Voice đang phát thông báo: "${textToSpeak}"`);
  };

  // Trigger speech on initial mount or calling change
  useEffect(() => {
    if (isAutoSpeechEnabled && currentCalling) {
      speakAIVoiceCall(currentCalling);
    }
  }, [currentCalling]);

  // Handle Call Next Patient
  const handleCallNext = () => {
    const waitingItems = queueList.filter((i) => i.status === 'waiting');
    if (waitingItems.length === 0) {
      toast.error('Đã hết bệnh nhân đang chờ trong hàng đợi!');
      return;
    }

    const nextPatient = waitingItems[0];
    setQueueList((prev) =>
      prev.map((i) => {
        if (i.stt === currentCalling.stt) return { ...i, status: 'completed_to_lis' };
        if (i.stt === nextPatient.stt) return { ...i, status: 'calling' };
        return i;
      })
    );

    setCurrentCalling({ ...nextPatient, status: 'calling' });
  };

  return (
    <div className={`w-full min-h-screen transition-all duration-300 ${
      isFullScreen 
        ? 'fixed inset-0 z-50 bg-slate-950 text-white p-8 overflow-y-auto' 
        : 'p-6 md:p-8 bg-transparent text-slate-900 dark:text-white space-y-7'
    }`}>
      {/* Top Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <Tv className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Màn Hình TV Gọi Số Hàng Đợi & AI Voice
            </h1>
            <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-black border border-emerald-500/30 flex items-center gap-1.5 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> LIVE TV MODE
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Giao Diện Màn Hình TV Phòng Khám • AI Đọc Giọng Nói Việt Nam Độc Quyền Gọi Bệnh Nhân Vào Khám & Tự Động Chuyển LIS/RIS/Kho Dược.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAutoSpeechEnabled(!isAutoSpeechEnabled)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-2xs transition-all ${
              isAutoSpeechEnabled
                ? 'bg-cyan-600 text-white hover:bg-cyan-700'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {isAutoSpeechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{isAutoSpeechEnabled ? 'AI Voice: BẬT' : 'AI Voice: TẮT'}</span>
          </button>

          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer shadow-2xs transition-all"
          >
            {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span>{isFullScreen ? 'Thoát TV Fullscreen' : 'Toàn Màn Hình TV Kiosk'}</span>
          </button>
        </div>
      </div>

      {/* Main TV Hero Banner: Current Calling Patient */}
      <div className="p-8 md:p-10 rounded-[36px] bg-gradient-to-br from-slate-900 via-cyan-950 to-teal-950 text-white border-2 border-cyan-500/40 shadow-2xl space-y-6 relative overflow-hidden text-left">
        {/* Glowing Background Radial */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-500/20 pb-5">
          <div className="flex items-center gap-3">
            <span className="px-3.5 py-1.5 rounded-full bg-rose-500 text-white font-black text-xs tracking-wider uppercase shadow-md animate-pulse">
              🚨 MỜI BỆNH NHÂN VÀO KHÁM
            </span>
            <span className="text-xs text-cyan-300 font-mono">Cập nhật lúc: {new Date().toLocaleTimeString('vi-VN')}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => speakAIVoiceCall(currentCalling)}
              className="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-black text-xs border border-cyan-500/40 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span>Phát Giọng Nói AI (Gọi Lại)</span>
            </button>

            <button
              onClick={handleCallNext}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-600 hover:to-emerald-600 text-white font-black text-xs shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Gọi Số Tiếp Theo ➔</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* STT Giant Badge */}
          <div className="lg:col-span-4 bg-slate-900/90 border-2 border-cyan-500/50 p-6 md:p-8 rounded-[28px] text-center shadow-xl space-y-2">
            <span className="text-xs text-cyan-400 font-bold uppercase tracking-widest block">SỐ THỨ TỰ (STT)</span>
            <div className="text-6xl md:text-7xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-emerald-400 font-mono">
              #{currentCalling.stt}
            </div>
            <span className="text-[11px] font-bold text-slate-400 block">Thời gian chờ: {currentCalling.waitTime}</span>
          </div>

          {/* Patient Details */}
          <div className="lg:col-span-8 space-y-4">
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">HỌ VÀ TÊN BỆNH NHÂN:</span>
              <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight mt-1">
                {currentCalling.patientName}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-1">
                <span className="text-[11px] text-cyan-300 font-bold uppercase block">PHÒNG KHÁM CHUYÊN KHOA:</span>
                <strong className="text-lg font-black text-cyan-200 block">{currentCalling.roomName}</strong>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="text-[11px] text-emerald-300 font-bold uppercase block">BÁC SĨ KHÁM PHỤ TRÁCH:</span>
                <strong className="text-lg font-black text-emerald-200 block">{currentCalling.doctorName}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Queue List Table & Workflow Dispatch Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Upcoming Waiting Queue */}
        <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 space-y-5 text-left">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-cyan-600" />
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                DANH SÁCH BỆNH NHÂN ĐANG CHỜ KHÁM ({queueList.filter((i) => i.status === 'waiting').length})
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-bold">Màn Hình TV Hàng Đợi Realtime</span>
          </div>

          <div className="space-y-3">
            {queueList
              .filter((i) => i.status === 'waiting')
              .map((item) => (
                <div
                  key={item.stt}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 hover:border-cyan-500/40 transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-12 h-12 rounded-xl bg-cyan-600 text-white font-mono font-black text-lg flex items-center justify-center shadow-md shrink-0">
                      #{item.stt}
                    </span>
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white text-sm">{item.patientName}</h4>
                      <span className="text-xs text-slate-500 font-medium">{item.roomName} • {item.doctorName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                      ⏰ Chờ {item.waitTime}
                    </span>

                    <button
                      onClick={() => {
                        setCurrentCalling(item);
                        setQueueList((prev) =>
                          prev.map((i) => (i.stt === item.stt ? { ...i, status: 'calling' } : i))
                        );
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs shadow-xs cursor-pointer transition-all active:scale-95"
                    >
                      Gọi Ngay
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Right Col: Automated Workflow Router (LIS / RIS PACS / Pharmacy) */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm p-6 space-y-5 text-left">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase">Tự Động Chuyển Trạng Thái</h3>
            </div>
          </div>

          <p className="text-xs text-slate-500 font-medium">
            Khi bác sĩ hoàn tất lượt khám SOAP, bệnh nhân được tự động điều hướng luồng y tế:
          </p>

          <div className="space-y-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <FlaskConical className="w-4 h-4" /> 1. Chuyển LIS / RIS PACS
                </span>
                <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-md">TỰ ĐỘNG</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11px]">Tự động phát số chờ Xét Nghiệm / Siêu Âm ngay khi bác sĩ kê chỉ định CLS.</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <Pill className="w-4 h-4" /> 2. Chuyển Kho Dược BHYT
                </span>
                <span className="text-[10px] font-bold bg-emerald-600 text-white px-2 py-0.5 rounded-md">TỰ ĐỘNG</span>
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-[11px]">Đơn thuốc tự động truyền sang Kho dược sẵn sàng cấp phát khi khám xong.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
