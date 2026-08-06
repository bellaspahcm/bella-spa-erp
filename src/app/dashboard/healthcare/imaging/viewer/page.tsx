'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { 
  Eye, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Sun, 
  Play, 
  Pause, 
  Layers, 
  Sparkles, 
  CheckCircle, 
  ShieldAlert, 
  ArrowLeft, 
  Printer, 
  Maximize2, 
  SlidersHorizontal,
  Activity,
  Ruler,
  Split,
  Mic,
  FileText,
  AlertTriangle,
  Flame,
  Bookmark,
  Compass,
  Square,
  Circle,
  MoveUpRight,
  Clock,
  Send,
  Check,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';

function DICOMViewerContent() {
  const [studyUid, setStudyUid] = useState('1.2.840.113619.2.100.20260806.102');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('study');
      if (s) setStudyUid(s);
    }
  }, []);

  // 1. Core Viewer State
  const [currentSlice, setCurrentSlice] = useState(48);
  const [totalSlices, setTotalSlices] = useState(192);
  const [zoomLevel, setZoomLevel] = useState(125);
  const [windowPreset, setWindowPreset] = useState<'BRAIN' | 'BONE' | 'SOFT_TISSUE' | 'LUNG'>('BRAIN');
  const [isPlayingCine, setIsPlayingCine] = useState(false);
  const [showAIOverlay, setShowAIOverlay] = useState(true);
  const [activeSeries, setActiveSeries] = useState(2);

  // 2. Enterprise Workstation State
  const [heatmapOpacity, setHeatmapOpacity] = useState<number>(50); // 0, 20, 50, 80, 100
  const [activeTool, setActiveTool] = useState<'NONE' | 'DISTANCE' | 'AREA' | 'VOLUME' | 'ANGLE' | 'ARROW' | 'CIRCLE' | 'TEXT' | 'BOOKMARK'>('NONE');
  const [isCompareMode, setIsCompareMode] = useState(false); // Today vs 3 Months Ago
  const [mprLayout, setMprLayout] = useState<'SINGLE' | 'QUAD_MPR'>('SINGLE'); // Single vs 4-Plane
  const [priorSlice, setPriorSlice] = useState(48); // Synced slice for prior study
  const [isDictating, setIsDictating] = useState(false);
  const [activeTabSidebar, setActiveTabSidebar] = useState<'AI_FINDINGS' | 'SERIES' | 'REPORT_WRITER' | 'AUDIT_TIMELINE'>('AI_FINDINGS');

  // Measure & Annotation Mock Store
  const [measurements, setMeasurements] = useState<Array<{ type: string; value: string; slice: number }>>([
    { type: 'Distance', value: '14.2 mm', slice: 48 },
    { type: 'Area', value: '4.8 cm²', slice: 48 },
    { type: 'Volume', value: '2.3 cc', slice: 48 },
    { type: 'Angle', value: '42.5°', slice: 52 },
  ]);

  // Structured Report Form
  const [report, setReport] = useState({
    technique: 'Chụp cắt lớp vi tính sọ não 128 dãy không tiêm thuốc tương quang (1.0mm axial slices).',
    findings: 'Nhu mô não vùng thái dương - đỉnh bên phải có vùng tăng tỷ trọng tự nhiên (HU +65) kích thước 24x18mm. Đè ép nhẹ não thất bên phải, đường giữa dịch chuyển sang trái 4.2mm.',
    impression: '🚨 XUẤT HUYẾT NÃO CẤP VÙNG THÁI DƯƠNG - ĐỈNH (R). ĐÈ ÉP ĐƯỜNG GIỮA 4.2MM.',
    recommendation: 'Hội chẩn khẩn cấp chuyên khoa Phẫu thuật Thần kinh. Đề nghị chụp CT Angio mạch máu bệnh lý.',
  });

  const isBrainCT = studyUid.includes('102') || studyUid.includes('CT');
  const isSpineMRI = studyUid.includes('103') || studyUid.includes('MRI');
  const isChestXray = studyUid.includes('101') || studyUid.includes('XRAY');
  const isUltrasound = studyUid.includes('104');
  const isEndoscopy = studyUid.includes('105');

  const patientName = isBrainCT 
    ? 'Trần Minh Hoàng (Nam, 30t)' 
    : isSpineMRI 
    ? 'Nguyễn Văn Hùng (Nam, 45t)' 
    : isChestXray 
    ? 'Lê Thị Mai (Nữ, 28t)' 
    : isUltrasound 
    ? 'Phạm Thị Hoa (Nữ, 52t)' 
    : 'Hoàng Đức Nam (Nam, 38t)';

  const modality = isBrainCT ? 'CT' : isSpineMRI ? 'MRI' : isChestXray ? 'XRAY' : isUltrasound ? 'ULTRASOUND' : 'ENDOSCOPY';
  const studyTitle = isBrainCT 
    ? 'CT-Scanner Sọ Não 3D Non-Contrast' 
    : isSpineMRI 
    ? 'MRI Cột Sống Thắt Lưng 3D' 
    : isChestXray 
    ? 'X-Quang Ngực Thẳng DR' 
    : isUltrasound 
    ? 'Siêu Âm Bụng 4D' 
    : 'Nội Soi Dạ Dày';

  // Interactive AI Findings
  const aiFindingsList = isBrainCT
    ? [
        { id: 'f1', label: 'Intracranial Hemorrhage (Xuất huyết sọ não cấp)', confidence: 98, slice: 48, volume: '2.3 cc', isCritical: true, status: 'CONFIRMED' },
        { id: 'f2', label: 'Midline Shift 4.2mm (Đè ép đường giữa)', confidence: 89, slice: 52, shift: '4.2 mm', isCritical: true, status: 'PENDING' },
        { id: 'f3', label: 'Perilesional Edema (Phù phát sau tổn thương)', confidence: 82, slice: 46, volume: '1.1 cc', isCritical: false, status: 'PENDING' },
      ]
    : isSpineMRI
    ? [
        { id: 'f1', label: 'Lumbar Disc Herniation L5-S1 (Thoát vị đĩa đệm)', confidence: 92, slice: 124, volume: '0.8 cc', isCritical: true, status: 'CONFIRMED' },
        { id: 'f2', label: 'S1 Nerve Compression (Chèn ép rễ S1 trái)', confidence: 88, slice: 126, shift: 'Nerve compression', isCritical: true, status: 'CONFIRMED' },
      ]
    : [
        { id: 'f1', label: 'Pneumonia Infiltrates (Thâm nhiễm phổi)', confidence: 94, slice: 1, volume: 'N/A', isCritical: false, status: 'CONFIRMED' },
      ];

  // Cine Playback Loop
  useEffect(() => {
    let interval: any;
    if (isPlayingCine) {
      interval = setInterval(() => {
        setCurrentSlice((prev) => {
          const nxt = prev >= totalSlices ? 1 : prev + 1;
          if (isCompareMode) setPriorSlice(nxt);
          return nxt;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlayingCine, totalSlices, isCompareMode]);

  // Voice Dictation Simulation
  const handleDictate = () => {
    setIsDictating(true);
    toast.info('🎤 Đang ghi âm giọng đọc bác sĩ...');
    setTimeout(() => {
      setIsDictating(false);
      toast.success('✨ Bella AI đã nhận diện giọng nói và tự động điền Báo Cáo Chẩn Đoán Cấu Trúc!');
    }, 2500);
  };

  // ER Alert Dispatch
  const handleDispatchER = () => {
    toast.error('🚨 ĐÃ PHÁT BÁO ĐỘNG CẤP CỨU CẤP TÍNH (STAT ALERT)! Đã gửi SMS + Push Notify cho Đội Phẫu Thuật Thần Kinh & Bác Sĩ Cấp Cứu Trực!', {
      duration: 5000,
    });
  };

  return (
    <div className="w-screen h-screen bg-[#f8fafc] text-slate-800 flex flex-col overflow-x-hidden overflow-y-hidden select-none font-sans max-w-full">
      {/* 1. PACS Light Theme Header Bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 shrink-0 shadow-xs max-w-full overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 w-full">
          {/* Section 1: Navigation & Patient Info */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (window.history.length > 1) window.history.back();
                else window.location.href = '/dashboard/healthcare/imaging';
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 border border-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-600" /> RIS Workstation
            </button>

            <div className="h-5 w-px bg-slate-200 shrink-0 hidden sm:block" />

            <div className="min-w-0 truncate text-left">
              <h2 className="text-xs font-black text-slate-900 flex items-center gap-1.5 truncate">
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono text-[9px] font-bold shrink-0">
                  {modality} WORKSTATION
                </span>
                <span className="truncate text-slate-900 font-black">{patientName}</span>
              </h2>
              <p className="text-[10px] text-slate-500 font-mono truncate hidden md:block">{studyTitle} • UID: {studyUid}</p>
            </div>
          </div>

          {/* Section 2: Viewport Mode Selector Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-bold shrink-0">
            <button
              onClick={() => {
                setIsCompareMode(false);
                setMprLayout('SINGLE');
              }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                !isCompareMode && mprLayout === 'SINGLE' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Single 2D
            </button>
            <button
              onClick={() => {
                setIsCompareMode(!isCompareMode);
                setMprLayout('SINGLE');
              }}
              className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                isCompareMode ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Split className="w-3.5 h-3.5" /> Compare Study
            </button>
            <button
              onClick={() => {
                setMprLayout(mprLayout === 'QUAD_MPR' ? 'SINGLE' : 'QUAD_MPR');
                setIsCompareMode(false);
              }}
              className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
                mprLayout === 'QUAD_MPR' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> 4-MPR Quad
            </button>
          </div>

          {/* Section 3: Critical ER & Actions */}
          <div className="flex items-center gap-2 text-xs shrink-0">
            {isBrainCT && (
              <button
                onClick={handleDispatchER}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center gap-1 shadow-md shadow-rose-500/20 animate-pulse cursor-pointer shrink-0"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> 🚨 NOTIFY ER
              </button>
            )}

            <button
              onClick={handleDictate}
              className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0 border ${
                isDictating ? 'bg-amber-500 text-white border-amber-600 animate-pulse' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-amber-600" /> {isDictating ? 'Đang đọc...' : 'Dictate'}
            </button>

            <button
              onClick={() => toast.success('🖨️ Đã xuất tệp DICOM & Kết xuất phim 3D sang Server PACS!')}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 shrink-0"
              title="In / Export DICOM"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workstation Body Layout */}
      <div className="flex-1 flex overflow-hidden relative max-w-full">
        {/* Left Toolbar: Light Theme Measurements & Annotations */}
        <div className="w-12 bg-white border-r border-slate-200 flex flex-col items-center py-3 gap-2.5 shrink-0 shadow-xs">
          <button
            onClick={() => setActiveTool('DISTANCE')}
            className={`p-2 rounded-xl transition-all cursor-pointer ${activeTool === 'DISTANCE' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            title="Measure Distance (mm)"
          >
            <Ruler className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('AREA')}
            className={`p-2 rounded-xl transition-all cursor-pointer ${activeTool === 'AREA' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            title="Measure Area (cm²)"
          >
            <Square className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('VOLUME')}
            className={`p-2 rounded-xl transition-all cursor-pointer ${activeTool === 'VOLUME' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            title="Measure Volume (cc)"
          >
            <Circle className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('ANGLE')}
            className={`p-2 rounded-xl transition-all cursor-pointer ${activeTool === 'ANGLE' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            title="Measure Angle (°)"
          >
            <Compass className="w-4 h-4" />
          </button>

          <div className="w-6 h-px bg-slate-200 my-0.5" />

          <button
            onClick={() => setActiveTool('ARROW')}
            className={`p-2 rounded-xl transition-all cursor-pointer ${activeTool === 'ARROW' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            title="Add Arrow Pointer"
          >
            <MoveUpRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('TEXT')}
            className={`p-2 rounded-xl transition-all cursor-pointer ${activeTool === 'TEXT' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            title="Add Text Annotation"
          >
            <FileText className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveTool('BOOKMARK')}
            className={`p-2 rounded-xl transition-all cursor-pointer ${activeTool === 'BOOKMARK' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}
            title="Bookmark Slice for Clinical Consult"
          >
            <Bookmark className="w-4 h-4" />
          </button>
        </div>

        {/* Center DICOM Viewports Container (Light Theme Frame + High Contrast DICOM Canvas) */}
        <div className="flex-1 bg-[#f1f5f9] flex flex-col justify-between items-center relative overflow-hidden p-3 max-w-full">
          {/* Top Controls Bar Ribbon - Light Theme */}
          <div className="z-20 bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-center gap-3 text-xs shadow-md mb-2 max-w-full">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setZoomLevel((z) => Math.min(z + 25, 250))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                title="Phóng to"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(z - 25, 75))}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono text-indigo-700 font-bold">{zoomLevel}%</span>
            </div>

            <div className="w-px h-4 bg-slate-200" />

            {/* Window Preset Selector Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
              {[
                { key: 'BRAIN', label: 'Brain W/L' },
                { key: 'BONE', label: 'Bone' },
                { key: 'SOFT_TISSUE', label: 'Soft Tissue' },
                { key: 'LUNG', label: 'Lung' },
              ].map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => setWindowPreset(preset.key as any)}
                  className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                    windowPreset === preset.key
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-slate-200" />

            {/* Heatmap Opacity Selector */}
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
              <Flame className="w-3.5 h-3.5 text-rose-500" /> Heatmap:
              {[0, 20, 50, 80, 100].map((op) => (
                <button
                  key={op}
                  onClick={() => setHeatmapOpacity(op)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-all cursor-pointer ${
                    heatmapOpacity === op ? 'bg-rose-600 text-white font-bold' : 'bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  {op}%
                </button>
              ))}
            </div>

            <div className="w-px h-4 bg-slate-200" />

            <button
              onClick={() => setIsPlayingCine(!isPlayingCine)}
              className={`px-3 py-1 rounded-xl font-bold flex items-center gap-1 transition-all text-[11px] ${
                isPlayingCine ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-600 text-white shadow-xs'
              }`}
            >
              {isPlayingCine ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlayingCine ? 'Dừng Cine' : 'Phát Cine Loop'}
            </button>
          </div>

          {/* Viewport Canvas Grid (High Contrast Slate-950 DICOM Frame for Crystal Clear Imaging) */}
          <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-3 items-center justify-center relative overflow-hidden">
            {/* Viewport 1: Today Study */}
            <div className="w-full h-full relative border border-slate-800 rounded-2xl bg-slate-950 flex flex-col items-center justify-center overflow-hidden shadow-xl">
              <div className="absolute top-3 left-3 z-10 text-left text-[10px] font-mono text-cyan-400 bg-slate-900/80 backdrop-blur-md p-2 rounded-xl border border-slate-800">
                <div className="font-bold text-white text-xs">TODAY STUDY (07/08/2026)</div>
                <div>Slice: {currentSlice} / {totalSlices}</div>
                <div>Matrix: 512x512 • 1.0mm Axial</div>
              </div>

              {/* Canvas SVG Anatomical View */}
              <div
                className="w-full h-full flex items-center justify-center transition-transform duration-150 p-6"
                style={{ transform: `scale(${zoomLevel / 100})` }}
              >
                <svg className="w-72 h-72 text-slate-700" viewBox="0 0 200 200">
                  {isBrainCT ? (
                    <>
                      <circle cx="100" cy="100" r="75" fill="#151d30" stroke="#475569" strokeWidth="6" />
                      <circle cx="100" cy="100" r="62" fill="#0d1322" stroke="#334155" strokeWidth="2" />
                      <path d="M 85 80 Q 95 65 100 80 Q 105 65 115 80 Q 100 110 85 80" fill="#1e293b" />
                      
                      {/* AI Heatmap Gradient */}
                      {heatmapOpacity > 0 && (
                        <ellipse
                          cx="125"
                          cy="95"
                          rx="24"
                          ry="18"
                          fill="url(#heatmapGrad)"
                          opacity={heatmapOpacity / 100}
                        />
                      )}

                      {/* AI Bounding Box */}
                      {showAIOverlay && (
                        <g className="animate-pulse">
                          <rect x="95" y="65" width="55" height="50" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
                          <text x="100" y="60" fill="#ef4444" fontSize="7" fontWeight="bold">AI: Xuất Huyết (98%) • 2.3cc</text>
                        </g>
                      )}

                      <defs>
                        <radialGradient id="heatmapGrad">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
                          <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.6" />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </radialGradient>
                      </defs>
                    </>
                  ) : (
                    <>
                      <rect x="80" y="30" width="40" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                      <rect x="80" y="60" width="40" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                      <rect x="80" y="90" width="40" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                      <rect x="80" y="120" width="40" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                      {showAIOverlay && (
                        <g className="animate-pulse">
                          <ellipse cx="122" cy="118" rx="12" ry="8" fill="#f59e0b" opacity="0.8" />
                          <text x="110" y="140" fill="#f59e0b" fontSize="7" fontWeight="bold">AI: L5-S1 (92%)</text>
                        </g>
                      )}
                    </>
                  )}
                </svg>
              </div>

              <div className="absolute bottom-3 left-3 text-[10px] font-mono text-slate-400 bg-slate-900/80 px-2 py-1 rounded-lg">
                W/L: {windowPreset} Mode
              </div>
            </div>

            {/* Viewport 2: Compare Prior Study OR Sagittal MPR */}
            {(isCompareMode || mprLayout === 'QUAD_MPR') && (
              <div className="w-full h-full relative border border-slate-800 rounded-2xl bg-slate-950 flex flex-col items-center justify-center overflow-hidden shadow-xl">
                <div className="absolute top-3 left-3 z-10 text-left text-[10px] font-mono text-amber-400 bg-slate-900/80 backdrop-blur-md p-2 rounded-xl border border-slate-800">
                  <div className="font-bold text-amber-300 text-xs">
                    {isCompareMode ? 'PRIOR STUDY (05/05/2026 - 3 Thâm Trước)' : 'SAGITTAL MPR PLANE'}
                  </div>
                  <div>Slice: {isCompareMode ? priorSlice : Math.round(currentSlice / 4)} / 48</div>
                  <div>Synced Series Scroll</div>
                </div>

                <div className="w-full h-full flex items-center justify-center p-6">
                  <svg className="w-72 h-72 text-slate-700 opacity-80" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="75" fill="#111827" stroke="#374151" strokeWidth="4" />
                    <circle cx="100" cy="100" r="62" fill="#090d16" stroke="#1f2937" strokeWidth="2" />
                    <path d="M 85 80 Q 95 65 100 80 Q 105 65 115 80 Q 100 110 85 80" fill="#1e293b" />
                    {isCompareMode && (
                      <text x="50" y="150" fill="#10b981" fontSize="8" fontWeight="bold">✓ Nhu Mô Phù Hợp Chẩn Đoán Ban Đầu</text>
                    )}
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Interactive Slice Slider - Light Theme */}
          <div className="w-full max-w-xl z-20 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-200 flex items-center gap-3 text-xs mt-2 shadow-md">
            <span className="font-mono text-slate-600 text-[11px] font-bold shrink-0">Slice {currentSlice}</span>
            <input
              type="range"
              min="1"
              max={totalSlices}
              value={currentSlice}
              onChange={(e) => {
                const val = Number(e.target.value);
                setCurrentSlice(val);
                if (isCompareMode) setPriorSlice(val);
              }}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <span className="font-mono text-slate-600 text-[11px] font-bold shrink-0">{totalSlices} Slices</span>
          </div>
        </div>

        {/* Right Panel: Light Theme AI Findings ⭐⭐⭐⭐⭐ & Report Writer & Audit Timeline */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-hidden text-left shadow-xs">
          {/* Sub-Header Tabs */}
          <div className="flex items-center border-b border-slate-200 bg-slate-50 text-[11px] font-bold">
            {[
              { id: 'AI_FINDINGS', label: '🤖 AI Findings' },
              { id: 'REPORT_WRITER', label: '📝 Báo Cáo' },
              { id: 'AUDIT_TIMELINE', label: '⏱️ Timeline' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTabSidebar(tab.id as any)}
                className={`flex-1 py-3 text-center transition-all cursor-pointer border-b-2 ${
                  activeTabSidebar === tab.id
                    ? 'border-indigo-600 text-indigo-700 bg-white font-black shadow-xs'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Detailed AI Findings Panel ⭐⭐⭐⭐⭐ */}
          {activeTabSidebar === 'AI_FINDINGS' && (
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-600" /> Vùng AI Phát Hiện Nghi Ngờ
                </span>
                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-mono text-[10px] font-bold border border-purple-200">
                  {aiFindingsList.length} Findings
                </span>
              </div>

              {aiFindingsList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setCurrentSlice(item.slice)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer group ${
                    currentSlice === item.slice
                      ? 'bg-purple-50 border-purple-400 text-slate-900 shadow-md ring-2 ring-purple-200'
                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-100/80'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <h4 className="text-xs font-black text-slate-900 group-hover:text-purple-700 flex items-center gap-1.5">
                      {item.isCritical && <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                      {item.label}
                    </h4>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono text-[10px] font-black border border-emerald-200">
                      {item.confidence}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-slate-200/80 text-[10px] font-mono text-slate-600">
                    <div>
                      Lát cắt: <span className="text-indigo-700 font-bold">Slice {item.slice}</span>
                    </div>
                    <div>
                      Thể tích: <span className="text-amber-700 font-bold">{item.volume || item.shift}</span>
                    </div>
                  </div>

                  <button className="w-full mt-2.5 py-1.5 rounded-xl bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center gap-1 shadow-xs hover:bg-purple-700 transition-all cursor-pointer">
                    Nhảy ngay đến Slice {item.slice} <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Measurements Recorded List */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                  Đo Đạc Lâm Sàng Recorded
                </span>
                {measurements.map((m, idx) => (
                  <div key={idx} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-slate-600 font-medium">{m.type} (Slice {m.slice}):</span>
                    <span className="text-emerald-700 font-bold">{m.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Structured Radiology Report Generator */}
          {activeTabSidebar === 'REPORT_WRITER' && (
            <div className="flex-1 p-4 space-y-3 overflow-y-auto text-xs">
              <button
                onClick={() => toast.success('✨ Bella AI đã tự động điền Báo Cáo Theo Mẫu Chuẩn RadReport!')}
                className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4" /> AI Auto-Fill Structured Report
              </button>

              <div>
                <label className="font-bold text-slate-500 text-[10px] uppercase">1. Kỹ Thuật (Technique)</label>
                <textarea
                  rows={2}
                  value={report.technique}
                  onChange={(e) => setReport({ ...report, technique: e.target.value })}
                  className="w-full mt-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-[11px] focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-500 text-[10px] uppercase">2. Mô Tả Hình Ảnh (Findings)</label>
                <textarea
                  rows={4}
                  value={report.findings}
                  onChange={(e) => setReport({ ...report, findings: e.target.value })}
                  className="w-full mt-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-[11px] focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-rose-600 text-[10px] uppercase">3. Kết Luận (Impression)</label>
                <textarea
                  rows={2}
                  value={report.impression}
                  onChange={(e) => setReport({ ...report, impression: e.target.value })}
                  className="w-full mt-1 p-2 rounded-xl bg-rose-50/60 border border-rose-300 text-rose-900 text-[11px] font-bold focus:ring-2 focus:ring-rose-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-500 text-[10px] uppercase">4. Gợi Ý Đề Nghị (Recommendation)</label>
                <textarea
                  rows={2}
                  value={report.recommendation}
                  onChange={(e) => setReport({ ...report, recommendation: e.target.value })}
                  className="w-full mt-1 p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-[11px] focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <button
                onClick={() => toast.success('✍️ Đã ký số và trả kết quả Báo Cáo Chẩn Đoán PACS lên hệ thống EMR!')}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4" /> Bác Sĩ Xác Nhận & Ký Số KQ
              </button>
            </div>
          )}

          {/* Tab 3: AI Audit Timeline */}
          {activeTabSidebar === 'AUDIT_TIMELINE' && (
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                Nhật Ký Quyết Định Lâm Sàng (AI & Doctor Audit)
              </span>

              <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {[
                  { title: 'AI Automatic Scan Completed', desc: 'Phát hiện Xuất Huyết Sọ Não (98% confidence) tại Slice 48', time: '09:18:02', done: true },
                  { title: '🚨 STAT ER Alert Dispatched', desc: 'Đã gửi SMS Push cảnh báo cho Đội Cấp Cứu Trực', time: '09:18:15', done: true },
                  { title: 'Workstation Opened by Radiologist', desc: 'BS. Nguyễn Văn Minh bắt đầu đọc ca', time: '09:22:40', done: true },
                  { title: 'AI Findings Confirmed by Doctor', desc: 'Xác nhận tổn thương và đè ép đường giữa 4.2mm', time: '09:25:10', done: true },
                  { title: 'Structured Report Signed', desc: 'Báo cáo chẩn đoán đã ký số và phát hành lên EMR', time: '09:28:00', done: false },
                ].map((step, idx) => (
                  <div key={idx} className="relative pl-7 text-xs">
                    <div className={`absolute left-1.5 top-1 w-3 h-3 rounded-full border-2 ${step.done ? 'bg-emerald-600 border-emerald-400' : 'bg-slate-200 border-slate-400'}`} />
                    <h5 className="font-bold text-slate-900 text-[11px]">{step.title}</h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">{step.desc}</p>
                    <span className="text-[9px] font-mono text-indigo-600 font-bold block mt-1">{step.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DICOMViewerPage() {
  return (
    <Suspense fallback={<div className="p-10 text-slate-900 font-bold bg-[#f8fafc] h-screen">Đang tải Radiology Workstation Enterprise...</div>}>
      <DICOMViewerContent />
    </Suspense>
  );
}
