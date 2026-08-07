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
  VolumeX,
  UserCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

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
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('bella_cloud_vi');
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [debugStatus, setDebugStatus] = useState<string>('Chưa sẵn sàng');

  const fallbackToWebSpeech = (textToSpeak: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Trình duyệt không hỗ trợ Web Speech API Synthesis');
      setDebugStatus('Lỗi: Trình duyệt không hỗ trợ Web Speech');
      return;
    }
    window.speechSynthesis.cancel(); // Clear previous audio queue
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'vi-VN';

    // Explicitly query and assign selected voice to prevent English fallback
    const allVoices = window.speechSynthesis.getVoices();
    let voice = allVoices.find(v => v.name === selectedVoiceName);
    if (!voice) {
      voice = allVoices.find(v =>
        v.lang.toLowerCase().startsWith('vi') ||
        v.lang.toLowerCase().includes('vi-vn') ||
        v.name.toLowerCase().includes('viet')
      );
    }

    if (voice) {
      utterance.voice = voice;
    }

    utterance.rate = 0.85; // Slightly slower for clear, professional announcements
    utterance.pitch = 1.0;

    window.speechSynthesis.speak(utterance);
    setDebugStatus(`WebSpeech (${voice ? voice.name.split(' ')[0] : 'Mặc định'})`);
    toast.success(`🔊 [Web Speech: ${voice ? voice.name : 'Mặc định'}] AI Voice đang phát thông báo: "${textToSpeak}"`);
  };

  const fallbackToGoogleTTS = (textToSpeak: string) => {
    try {
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=vi&q=${encodeURIComponent(textToSpeak)}`;
      const audio = document.getElementById('tts-audio') as HTMLAudioElement;
      if (audio) {
        audio.src = googleTtsUrl;
        audio.play()
          .then(() => {
            setDebugStatus('Google Direct');
            toast.success(`🔊 [Google TTS Direct] AI Voice đang phát thông báo: "${textToSpeak}"`);
          })
          .catch((playError) => {
            console.warn('Google TTS element play failed, trying dynamic audio:', playError);
            const fallbackAudio = new Audio(googleTtsUrl);
            fallbackAudio.play()
              .then(() => {
                setDebugStatus('Google Direct');
                toast.success(`🔊 [Google TTS Dynamic] AI Voice đang phát thông báo: "${textToSpeak}"`);
              })
              .catch((err) => {
                console.warn('Google TTS completely failed, trying WebSpeech:', err);
                fallbackToWebSpeech(textToSpeak);
              });
          });
      } else {
        const fallbackAudio = new Audio(googleTtsUrl);
        fallbackAudio.play()
          .then(() => {
            setDebugStatus('Google Direct');
            toast.success(`🔊 [Google TTS Dynamic] AI Voice đang phát thông báo: "${textToSpeak}"`);
          })
          .catch((err) => {
            console.warn('Dynamic Google TTS failed, trying WebSpeech:', err);
            fallbackToWebSpeech(textToSpeak);
          });
      }
    } catch (err) {
      console.warn('Google TTS initialization failed, falling back to WebSpeech:', err);
      fallbackToWebSpeech(textToSpeak);
    }
  };

  // SoundOfText CORS-friendly API fallback to play Google Vietnamese TTS voice without referrer limits
  const playSoundOfText = (textToSpeak: string, onSuccess: () => void, onError: (err: any) => void) => {
    fetch('https://api.soundoftext.com/sounds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        engine: 'google',
        data: {
          text: textToSpeak,
          voice: 'vi'
        }
      })
    })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP error status: ${res.status}`);
      return res.json();
    })
    .then(data => {
      if (data.success && data.id) {
        const audioUrl = `https://soundoftext.com/static/sounds/${data.id}.mp3`;
        const audio = document.getElementById('tts-audio') as HTMLAudioElement;
        if (audio) {
          audio.src = audioUrl;
          audio.play()
            .then(onSuccess)
            .catch(onError);
        } else {
          const dynamicAudio = new Audio(audioUrl);
          dynamicAudio.play()
            .then(onSuccess)
            .catch(onError);
        }
      } else {
        throw new Error('SoundOfText success is false');
      }
    })
    .catch(err => {
      onError(err);
    });
  };

  // Primary High-Reliability Google TTS Proxy fetching raw MP3 via open CORS Proxy (AllOrigins)
  const playViaCorsProxy = (textToSpeak: string, onSuccess: () => void, onError: (err: any) => void) => {
    try {
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=gtx&tl=vi&q=${encodeURIComponent(textToSpeak)}`;
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(googleTtsUrl)}`;

      fetch(proxyUrl)
        .then(res => {
          if (!res.ok) throw new Error(`Proxy error status: ${res.status}`);
          return res.blob();
        })
        .then(blob => {
          const blobUrl = URL.createObjectURL(blob);
          const audio = document.getElementById('tts-audio') as HTMLAudioElement;
          if (audio) {
            audio.src = blobUrl;
            audio.play()
              .then(onSuccess)
              .catch(onError);
          } else {
            const dynamicAudio = new Audio(blobUrl);
            dynamicAudio.play()
              .then(onSuccess)
              .catch(onError);
          }
        })
        .catch(err => {
          onError(err);
        });
    } catch (e) {
      onError(e);
    }
  };

  // 100% Reliable Local Next.js Server-Side TTS Proxy (immune to client-side CORS/referrer blocks)
  const playViaLocalProxy = (textToSpeak: string, onSuccess: () => void, onError: (err: any) => void) => {
    try {
      const localUrl = `/api/tts?text=${encodeURIComponent(textToSpeak)}`;
      const audio = document.getElementById('tts-audio') as HTMLAudioElement;
      if (audio) {
        audio.src = localUrl;
        audio.play()
          .then(onSuccess)
          .catch(onError);
      } else {
        const dynamicAudio = new Audio(localUrl);
        dynamicAudio.play()
          .then(onSuccess)
          .catch(onError);
      }
    } catch (e) {
      onError(e);
    }
  };

  // Web Speech Audio API AI Voice Call Function
  const speakAIVoiceCall = (item: QueueItem) => {
    // Expand abbreviations for natural speech sound in Vietnamese
    const cleanRoomName = item.roomName.replace(/-/g, ',');
    const cleanDoctorName = item.doctorName
      .replace(/\bBS\b\.?/gi, 'Bác sĩ')
      .replace(/\bCKII\b/gi, 'Chuyên khoa hai')
      .replace(/\bCKI\b/gi, 'Chuyên khoa một')
      .replace(/\bThS\b\.?/gi, 'Thạc sĩ')
      .replace(/\bGS\b\.?/gi, 'Giáo sư')
      .replace(/\bPGS\b\.?/gi, 'Phó giáo sư');

    const textToSpeak = `Mời bệnh nhân số thứ tự ${item.stt}, ${item.patientName}, vào ${cleanRoomName} gặp ${cleanDoctorName}`;

    // If user explicitly selected a WebSpeech voice (other than our custom option), use fallbackToWebSpeech directly!
    if (selectedVoiceName !== 'bella_cloud_vi') {
      fallbackToWebSpeech(textToSpeak);
      return;
    }

    // 1. Try local server-side proxy first (100% reliable, zero CORS/Referrer issues, served from same localhost)
    setDebugStatus('Đang kết nối...');
    playViaLocalProxy(
      textToSpeak,
      () => {
        setDebugStatus('Giọng Việt (Server)');
        toast.success(`🔊 [AI Voice Bella] Đang phát thông báo: "${textToSpeak}"`);
      },
      (localErr) => {
        console.warn('Local Next.js TTS API failed, trying CORS Proxy:', localErr);

        // 2. Try CORS Proxy + Google Translate TTS
        setDebugStatus('Đang kết nối...');
        playViaCorsProxy(
          textToSpeak,
          () => {
            setDebugStatus('Giọng Việt (CORS)');
            toast.success(`🔊 [CORS Proxy Google TTS] AI Voice đang phát thông báo: "${textToSpeak}"`);
          },
          (proxyErr) => {
            console.warn('AllOrigins CORS proxy Google TTS failed, trying ResponsiveVoice:', proxyErr);

            // 3. Try ResponsiveVoice (CDN Cloud TTS with natural native Vietnamese voice)
            setDebugStatus('Đang kết nối...');
            if (typeof window !== 'undefined' && (window as any).responsiveVoice) {
              try {
                (window as any).responsiveVoice.speak(textToSpeak, "Vietnamese Female", {
                  rate: 0.9,
                  pitch: 1.0,
                  onstart: () => {
                    setDebugStatus('Giọng Việt (Cloud 2)');
                    toast.success(`🔊 [ResponsiveVoice] AI Voice đang phát thông báo: "${textToSpeak}"`);
                  },
                  onerror: (rvErr: any) => {
                    console.warn('ResponsiveVoice playback failed, trying SoundOfText:', rvErr);

                    // 4. Try SoundOfText API
                    setDebugStatus('Đang kết nối...');
                    playSoundOfText(
                      textToSpeak,
                      () => {
                        setDebugStatus('Giọng Việt (Cloud 3)');
                        toast.success(`🔊 [SoundOfText] AI Voice đang phát thông báo: "${textToSpeak}"`);
                      },
                      (sotErr) => {
                        console.warn('SoundOfText failed, trying direct Google TTS fallback:', sotErr);
                        fallbackToGoogleTTS(textToSpeak);
                      }
                    );
                  }
                });
                return;
              } catch (err) {
                console.warn('ResponsiveVoice execution failed, trying SoundOfText:', err);
              }
            }

            // 4. Fallback to SoundOfText API
            setDebugStatus('Đang kết nối...');
            playSoundOfText(
              textToSpeak,
              () => {
                setDebugStatus('Giọng Việt (Cloud 3)');
                toast.success(`🔊 [SoundOfText] AI Voice đang phát thông báo: "${textToSpeak}"`);
              },
              (sotErr) => {
                console.warn('SoundOfText failed, trying direct Google TTS fallback:', sotErr);
                fallbackToGoogleTTS(textToSpeak);
              }
            );
          }
        );
      }
    );
  };

  const unlockAudio = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const context = new AudioContextClass();
        if (context.state === 'suspended') {
          context.resume();
        }
        const osc = context.createOscillator();
        const gain = context.createGain();
        gain.gain.value = 0.001;
        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(0);
        osc.stop(0.05);
      }
    } catch (e) {
      console.warn('AudioContext unlock failed:', e);
    }
    setAudioUnlocked(true);
    if (currentCalling) {
      speakAIVoiceCall(currentCalling);
    }
  };

  // Warm up voices loading and load ResponsiveVoice CDN script on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Load ResponsiveVoice script dynamically
      const script = document.createElement('script');
      script.src = 'https://code.responsivevoice.org/responsivevoice.js';
      script.async = true;
      document.head.appendChild(script);

      // Warm up WebSpeech voices
      if ('speechSynthesis' in window) {
        const updateVoices = () => {
          const availableVoices = window.speechSynthesis.getVoices();
          setVoices(availableVoices);
        };

        updateVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = updateVoices;
        }
      }

      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    }
  }, []);

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
        ? 'fixed inset-0 z-50 bg-slate-950 text-white p-8 pb-24 overflow-y-auto'
        : 'p-6 md:p-8 pb-28 md:pb-36 bg-transparent text-slate-900 dark:text-white space-y-7 relative'
    }`}>
      {!isFullScreen && (
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      )}

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

        <div className="flex flex-col items-stretch sm:items-end gap-3 w-full lg:w-auto">
          <div className="w-full sm:w-[420px] flex-shrink-0 text-left">
            <PremiumSelect
              options={[
                { value: 'bella_cloud_vi', label: '✨ AI Voice Bella (Tiếng Việt Đám Mây)' },
                ...voices.map(v => ({ value: v.name, label: `${v.name} (${v.lang})` }))
              ]}
              value={selectedVoiceName}
              onChange={(val) => {
                setSelectedVoiceName(val);
                toast.info(`Đã đổi sang giọng đọc: ${val === 'bella_cloud_vi' ? 'AI Voice Bella' : val}`);
              }}
              placeholder="Chọn giọng đọc..."
              buttonClassName="!py-0 h-11 px-4 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 !rounded-xl font-bold shadow-xs flex items-center w-full"
            />
          </div>

          <div className="flex items-center gap-2.5 justify-end">
            <button
              onClick={() => setIsAutoSpeechEnabled(!isAutoSpeechEnabled)}
              className={`h-11 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 flex-shrink-0 whitespace-nowrap shadow-xs border ${
                isAutoSpeechEnabled
                  ? 'bg-cyan-600 border-cyan-500 text-white hover:bg-cyan-700'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              {isAutoSpeechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{isAutoSpeechEnabled ? 'AI Voice: BẬT' : 'AI Voice: TẮT'}</span>
            </button>

            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="h-11 px-4 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 flex-shrink-0 whitespace-nowrap shadow-xs"
            >
              {isFullScreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isFullScreen ? 'Thoát TV Fullscreen' : 'Toàn Màn Hình TV Kiosk'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main TV Hero Banner: Ultra-High Contrast Dark Slate Card */}
      <div className="p-8 md:p-10 rounded-[32px] bg-slate-900 dark:bg-slate-950 text-white border-2 border-cyan-500/80 shadow-2xl space-y-6 relative overflow-hidden text-left">
        {/* Top Calling Status & Action Bar */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-850 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
            <span className="px-4 py-1.5 rounded-full bg-rose-500/10 text-rose-400 font-black text-xs tracking-wider uppercase border border-rose-500/20 shadow-xs animate-pulse inline-block w-fit">
              🚨 MỜI BỆNH NHÂN VÀO KHÁM
            </span>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 font-medium">
              <span>
                Cập nhật lúc: <strong className="text-cyan-400 font-mono font-bold">{new Date().toLocaleTimeString('vi-VN')}</strong>
              </span>
              <span className="text-slate-800 font-black hidden sm:inline">•</span>
              <span className="flex items-center gap-1.5 bg-slate-950/50 px-3 py-1 rounded-xl border border-slate-850 text-[11px] font-semibold text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Loa: <strong className="text-cyan-400 font-semibold">{debugStatus}</strong></span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => speakAIVoiceCall(currentCalling)}
              className="px-4 py-2 rounded-xl bg-cyan-950 hover:bg-cyan-900 text-cyan-300 font-black text-xs border border-cyan-500/60 flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-sm"
            >
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span>Phát Giọng Nói AI (Gọi Lại)</span>
            </button>

            <button
              onClick={handleCallNext}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Gọi Số Tiếp Theo ➔</span>
            </button>
          </div>
        </div>

        {/* Hero Patient Call Grid - Perfectly Aligned 3-Card Layout with Absolute High Contrast Inline Styles */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Card 1: STT Giant Badge Box */}
          <div className="lg:col-span-3 bg-slate-950 border-2 border-cyan-400 p-6 rounded-[24px] text-center shadow-xl flex flex-col justify-center items-center h-full space-y-2">
            <span className="text-xs font-black uppercase tracking-widest block" style={{ color: '#38bdf8' }}>
              SỐ THỨ TỰ (STT)
            </span>
            <div className="text-6xl md:text-7xl font-black tracking-tight font-mono drop-shadow-md" style={{ color: '#38bdf8' }}>
              #{currentCalling.stt}
            </div>
            <span className="text-xs font-bold block" style={{ color: '#e2e8f0' }}>
              ⏰ Thời gian chờ: {currentCalling.waitTime}
            </span>
          </div>

          {/* Card 2: Bệnh Nhân & Phòng Khám Box */}
          <div className="lg:col-span-5 bg-slate-900 border-2 border-cyan-400 p-6 rounded-[24px] shadow-xl flex flex-col justify-between h-full space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-extrabold uppercase tracking-widest block" style={{ color: '#38bdf8' }}>
                HỌ VÀ TÊN BỆNH NHÂN:
              </span>
              <div className="text-2xl md:text-3xl font-black tracking-tight drop-shadow-sm" style={{ color: '#ffffff' }}>
                {currentCalling.patientName}
              </div>
            </div>

            <div className="border-t border-cyan-500/30 pt-3 space-y-1">
              <span className="text-[11px] font-extrabold uppercase tracking-wider block" style={{ color: '#38bdf8' }}>
                PHÒNG KHÁM CHUYÊN KHOA:
              </span>
              <strong className="text-base md:text-lg font-black block" style={{ color: '#ffffff' }}>
                {currentCalling.roomName}
              </strong>
            </div>
          </div>

          {/* Card 3: Bác Sĩ Khám Phụ Trách Box */}
          <div className="lg:col-span-4 bg-slate-900 border-2 border-emerald-400 p-6 rounded-[24px] shadow-xl flex flex-col justify-between h-full space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-extrabold uppercase tracking-widest block" style={{ color: '#34d399' }}>
                BÁC SĨ KHÁM PHỤ TRÁCH:
              </span>
              <div className="text-xl md:text-2xl font-black tracking-tight drop-shadow-sm" style={{ color: '#ffffff' }}>
                {currentCalling.doctorName}
              </div>
            </div>

            <div className="border-t border-emerald-500/30 pt-3 flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: '#34d399' }}>
                TRẠNG THÁI KHÁM:
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 font-black text-[10px] border border-emerald-400/40" style={{ color: '#34d399' }}>
                ✓ Sẵn Sàng Khám
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Queue List Table & Workflow Dispatch Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
        {/* Left 2 Cols: Upcoming Waiting Queue */}
        <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm p-7 pb-10 md:p-8 md:pb-12 space-y-6 text-left">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Users className="w-5 h-5 text-cyan-600" />
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                DANH SÁCH BỆNH NHÂN ĐANG CHỜ KHÁM ({queueList.filter((i) => i.status === 'waiting').length})
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-bold">Màn Hình TV Hàng Đợi Realtime</span>
          </div>

          <div className="space-y-3.5 pb-2">
            {queueList
              .filter((i) => i.status === 'waiting')
              .map((item) => (
                <div
                  key={item.stt}
                  className="p-4.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 hover:border-cyan-500/40 transition-all shadow-2xs"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-12 h-12 rounded-xl bg-cyan-600 text-white font-mono font-black text-lg flex items-center justify-center shadow-md shrink-0">
                      #{item.stt}
                    </span>
                    <div>
                      <h4 className="font-black text-slate-900 dark:text-white text-base tracking-tight">{item.patientName}</h4>
                      <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold block mt-0.5">{item.roomName} • {item.doctorName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-amber-700 dark:text-amber-300 bg-amber-500/15 px-3 py-1 rounded-full border border-amber-500/30">
                      ⏰ Chờ {item.waitTime}
                    </span>

                    <button
                      onClick={() => {
                        setCurrentCalling(item);
                        setQueueList((prev) =>
                          prev.map((i) => (i.stt === item.stt ? { ...i, status: 'calling' } : i))
                        );
                      }}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs shadow-md cursor-pointer transition-all active:scale-95"
                    >
                      Gọi Ngay
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Right Col: Automated Workflow Router (LIS / RIS PACS / Pharmacy) */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm p-7 pb-10 md:p-8 md:pb-12 space-y-6 text-left">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <h3 className="font-black text-slate-900 dark:text-white text-sm uppercase tracking-wider">Tự Động Chuyển Trạng Thái</h3>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
            Khi bác sĩ hoàn tất lượt khám SOAP, bệnh nhân được tự động điều hướng luồng y tế:
          </p>

          <div className="space-y-4 text-xs pb-2">
            <div className="p-4.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border-2 border-indigo-200 dark:border-indigo-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5 text-sm">
                  <FlaskConical className="w-4 h-4 text-indigo-600" /> 1. Chuyển LIS / RIS PACS
                </span>
                <span className="text-[10px] font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-md uppercase">TỰ ĐỘNG</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-xs font-medium">Tự động phát số chờ Xét Nghiệm / Siêu Âm ngay khi bác sĩ kê chỉ định CLS.</p>
            </div>

            <div className="p-4.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-200 dark:border-emerald-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5 text-sm">
                  <Pill className="w-4 h-4 text-emerald-600" /> 2. Chuyển Kho Dược BHYT
                </span>
                <span className="text-[10px] font-black bg-emerald-600 text-white px-2.5 py-0.5 rounded-md uppercase">TỰ ĐỘNG</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-xs font-medium">Đơn thuốc tự động truyền sang Kho dược sẵn sàng cấp phát khi khám xong.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Explicit Bottom Extra Scroll Spacer Block */}
      <div className="h-40 w-full shrink-0 pointer-events-none" aria-hidden="true" />
      <audio id="tts-audio" className="hidden" referrerPolicy="no-referrer" />

      {!audioUnlocked && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div className="p-6 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 animate-bounce">
            <Volume2 className="w-16 h-16" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-2xl font-black text-white">🔊 KÍCH HOẠT HỆ THỐNG ÂM THANH AI</h2>
            <p className="text-slate-400 text-sm font-medium">
              Trình duyệt yêu cầu xác nhận tương tác để kích hoạt loa gọi số tự động (AI Voice). Vui lòng nhấn nút dưới đây để kết nối.
            </p>
          </div>
          <button
            onClick={unlockAudio}
            className="px-8 py-4 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-sm shadow-xl hover:shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
          >
            KÍCH HOẠT LOA GỌI SỐ ➔
          </button>
        </div>
      )}
    </div>
  );
}
