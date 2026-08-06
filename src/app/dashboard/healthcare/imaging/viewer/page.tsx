'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'react-router-dom';
import { 
  Eye, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Sun, 
  Play, 
  Pause, 
  Layers, 
  HardDrive, 
  Sparkles, 
  CheckCircle, 
  ShieldAlert, 
  ArrowLeft, 
  Printer, 
  Download, 
  Maximize2, 
  SlidersHorizontal,
  Activity,
  Ruler
} from 'lucide-react';
import { toast } from 'sonner';

function DICOMViewerContent() {
  // Query params
  const [studyUid, setStudyUid] = useState('1.2.840.113619.2.100.20260806.102');
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('study');
      if (s) setStudyUid(s);
    }
  }, []);

  // Viewer State
  const [currentSlice, setCurrentSlice] = useState(48);
  const [totalSlices, setTotalSlices] = useState(192);
  const [zoomLevel, setZoomLevel] = useState(125);
  const [windowPreset, setWindowPreset] = useState<'BRAIN' | 'BONE' | 'SOFT_TISSUE' | 'LUNG'>('BRAIN');
  const [isPlayingCine, setIsPlayingCine] = useState(false);
  const [showAIOverlay, setShowAIOverlay] = useState(true);
  const [activeSeries, setActiveSeries] = useState(2);
  const [measurementMode, setMeasurementMode] = useState(false);

  // Determine study metadata from UID
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
    ? 'CT-Scanner Sọ Não Không Tiêm Thuốc Tương Quang' 
    : isSpineMRI 
    ? 'MRI Cột Sống Thắt Lưng Cắt Lớp Vi Tính 3D' 
    : isChestXray 
    ? 'X-Quang Ngực Thẳng Kỹ Thuật Số (DR)' 
    : isUltrasound 
    ? 'Siêu Âm Bụng Tổng Quát 4D Doppler' 
    : 'Nội Soi Dạ Dày Thực Quản An Thần';

  // Cine Playback Loop
  useEffect(() => {
    let interval: any;
    if (isPlayingCine) {
      interval = setInterval(() => {
        setCurrentSlice((prev) => (prev >= totalSlices ? 1 : prev + 1));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlayingCine, totalSlices]);

  return (
    <div className="w-screen h-screen bg-[#070b14] text-white flex flex-col overflow-hidden select-none font-sans">
      {/* 1. PACS Top Command Bar */}
      <div className="h-14 px-4 bg-[#0d1322] border-b border-slate-800 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (window.history.length > 1) window.history.back();
              else window.location.href = '/dashboard/healthcare/imaging';
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Quay lại RIS
          </button>
          <div className="h-5 w-px bg-slate-800" />
          <div className="space-y-0.5 text-left">
            <h2 className="text-xs font-black text-white flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 font-mono text-[10px]">
                {modality} • PACS VIEWER 3D
              </span>
              {patientName}
            </h2>
            <p className="text-[10px] text-slate-400 font-mono">{studyTitle} • UID: {studyUid}</p>
          </div>
        </div>

        {/* Center PACS Window Presets */}
        <div className="hidden lg:flex items-center gap-1 bg-[#12192c] p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
          {[
            { key: 'BRAIN', label: 'Brain W/L (350/40)' },
            { key: 'BONE', label: 'Bone W/L (2000/400)' },
            { key: 'SOFT_TISSUE', label: 'Soft Tissue (400/50)' },
            { key: 'LUNG', label: 'Lung W/L (1500/-600)' },
          ].map((preset) => (
            <button
              key={preset.key}
              onClick={() => setWindowPreset(preset.key as any)}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                windowPreset === preset.key
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Actions Right */}
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setShowAIOverlay(!showAIOverlay)}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              showAIOverlay ? 'bg-purple-600 text-white shadow-md' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Diagnostic Overlays
          </button>
          <button
            onClick={() => toast.success('🖨️ Đã xuất tệp DICOM & Kết xuất phim 3D sang Server PACS!')}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="In / Export DICOM"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 2. Left Thumbnails / Series Panel */}
        <div className="w-56 bg-[#0a0e1a] border-r border-slate-800/80 p-3 space-y-3 shrink-0 overflow-y-auto hidden md:block">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block text-left">
            DICOM Series List (4 Series)
          </span>

          {[
            { id: 1, name: 'Series 1: Scout View', count: 2, type: '2D' },
            { id: 2, name: `Series 2: Axial 1.0mm (${modality})`, count: totalSlices, type: '3D Volume' },
            { id: 3, name: 'Series 3: Coronal MPR', count: 48, type: 'MPR' },
            { id: 4, name: 'Series 4: 3D Bone / Angio', count: 1, type: 'VR 3D' },
          ].map((s) => (
            <div
              key={s.id}
              onClick={() => setActiveSeries(s.id)}
              className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                activeSeries === s.id
                  ? 'bg-indigo-600/20 border-indigo-500/80 text-white shadow-md'
                  : 'bg-[#101625] border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span>{s.name}</span>
                <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[9px]">
                  {s.type}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1 font-mono">{s.count} Slices • 512x512 matrix</p>
            </div>
          ))}
        </div>

        {/* 3. Center DICOM Image Canvas */}
        <div className="flex-1 bg-[#050810] flex flex-col justify-between items-center relative overflow-hidden p-4">
          {/* Top Interactive Tool Ribbon */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-[#0d1322]/90 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 flex items-center gap-3 text-xs shadow-2xl">
            <button
              onClick={() => setZoomLevel((z) => Math.min(z + 25, 250))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel((z) => Math.max(z - 25, 75))}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] font-mono text-indigo-400 font-bold">{zoomLevel}%</span>
            <div className="w-px h-4 bg-slate-800" />

            <button
              onClick={() => setMeasurementMode(!measurementMode)}
              className={`p-1.5 rounded-lg transition-all ${
                measurementMode ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300'
              }`}
              title="Measurement Ruler"
            >
              <Ruler className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlayingCine(!isPlayingCine)}
              className={`px-3 py-1 rounded-xl font-bold flex items-center gap-1 transition-all ${
                isPlayingCine ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-600 text-white'
              }`}
            >
              {isPlayingCine ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlayingCine ? 'Dừng Cine' : 'Phát Cine Loop'}
            </button>
          </div>

          {/* HUD Overlay - Top Left */}
          <div className="absolute top-4 left-4 z-10 text-left text-[11px] font-mono text-cyan-400 space-y-0.5 drop-shadow">
            <div className="font-bold text-white text-xs">{patientName}</div>
            <div>STT-103 • {modality} DICOM 3D</div>
            <div>Kỹ thuật: {windowPreset} Mode</div>
          </div>

          {/* HUD Overlay - Top Right */}
          <div className="absolute top-4 right-4 z-10 text-right text-[11px] font-mono text-emerald-400 space-y-0.5 drop-shadow">
            <div>Bella DICOM Engine v4.2</div>
            <div>Server Node: Storage-HN-01</div>
            <div>Lossless DICOM Compression</div>
          </div>

          {/* Canvas Render Area */}
          <div
            className="flex-1 w-full flex items-center justify-center relative transition-transform duration-150"
            style={{ transform: `scale(${zoomLevel / 100})` }}
          >
            {/* SVG Anatomical Render Simulation */}
            <div className="w-96 h-96 relative border border-slate-800 rounded-3xl bg-slate-950 flex items-center justify-center shadow-2xl overflow-hidden">
              <svg className="w-full h-full p-6 text-slate-700" viewBox="0 0 200 200">
                {isBrainCT ? (
                  <>
                    {/* Skull Outline */}
                    <circle cx="100" cy="100" r="75" fill="#151d30" stroke="#475569" strokeWidth="6" />
                    <circle cx="100" cy="100" r="62" fill="#0d1322" stroke="#334155" strokeWidth="2" />
                    {/* Ventricles */}
                    <path d="M 85 80 Q 95 65 100 80 Q 105 65 115 80 Q 100 110 85 80" fill="#1e293b" />
                    {/* Hemorrhage Highlight (Red Area for STAT) */}
                    {showAIOverlay && (
                      <g className="animate-pulse">
                        <ellipse cx="125" cy="95" rx="18" ry="14" fill="#ef4444" opacity="0.75" />
                        <rect x="95" y="65" width="55" height="50" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 3" />
                        <text x="100" y="60" fill="#ef4444" fontSize="7" fontWeight="bold">AI: Xuất Huyết (98%)</text>
                      </g>
                    )}
                  </>
                ) : isSpineMRI ? (
                  <>
                    {/* Spine Vertebrae L1-S1 */}
                    <rect x="80" y="30" width="40" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                    <rect x="80" y="60" width="40" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                    <rect x="80" y="90" width="40" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                    <rect x="80" y="120" width="40" height="22" rx="4" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                    {/* Herniated Disc Highlight */}
                    {showAIOverlay && (
                      <g className="animate-pulse">
                        <ellipse cx="122" cy="118" rx="12" ry="8" fill="#f59e0b" opacity="0.8" />
                        <text x="110" y="140" fill="#f59e0b" fontSize="7" fontWeight="bold">AI: L5-S1 (92%)</text>
                      </g>
                    )}
                  </>
                ) : (
                  <>
                    {/* Chest X-Ray Outline */}
                    <path d="M 50 40 Q 100 20 150 40 L 160 160 L 40 160 Z" fill="#111827" stroke="#374151" strokeWidth="4" />
                    <ellipse cx="75" cy="90" rx="25" ry="35" fill="#1f2937" />
                    <ellipse cx="125" cy="90" rx="25" ry="35" fill="#1f2937" />
                    <circle cx="115" cy="115" r="22" fill="#374151" opacity="0.6" />
                  </>
                )}
              </svg>

              {/* Simulated HU Crosshair */}
              <div className="absolute inset-0 border border-indigo-500/20 pointer-events-none flex items-center justify-center">
                <div className="w-4 h-4 border border-cyan-400 rounded-full flex items-center justify-center">
                  <div className="w-1 h-1 bg-cyan-400 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* HUD Overlay - Bottom Left */}
          <div className="absolute bottom-16 left-4 z-10 text-left text-[11px] font-mono text-cyan-400 space-y-0.5">
            <div>Slice: {currentSlice} / {totalSlices}</div>
            <div>Độ dày cắt: 1.0mm • Vị trí: -{(currentSlice * 0.8).toFixed(1)}mm</div>
          </div>

          {/* HUD Overlay - Bottom Right */}
          <div className="absolute bottom-16 right-4 z-10 text-right text-[11px] font-mono text-emerald-400 space-y-0.5">
            <div>Hounsfield Unit (HU): +65.2 HU</div>
            <div>Tỷ lệ Zoom: {zoomLevel}%</div>
          </div>

          {/* Bottom Slice Slider Bar */}
          <div className="w-full max-w-xl z-20 bg-[#0d1322]/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-800 flex items-center gap-4 text-xs">
            <span className="font-mono text-slate-400 text-[11px] shrink-0">Slice {currentSlice}</span>
            <input
              type="range"
              min="1"
              max={totalSlices}
              value={currentSlice}
              onChange={(e) => setCurrentSlice(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
            <span className="font-mono text-slate-400 text-[11px] shrink-0">{totalSlices} Slices</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DICOMViewerPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white font-bold bg-[#070b14] h-screen">Đang tải DICOM Viewer...</div>}>
      <DICOMViewerContent />
    </Suspense>
  );
}
