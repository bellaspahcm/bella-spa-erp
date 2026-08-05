'use client';
import React from 'react';

export type ToothStatus = 'healthy' | 'decayed' | 'missing' | 'crowned' | 'implanted';

export interface ToothData {
  readonly status: ToothStatus;
  readonly notes?: string;
}

export interface OdontogramTwinProps {
  readonly toothData: Record<string, ToothData>;
  readonly selectedTooth: string | null;
  readonly onSelectTooth: (toothNumber: string) => void;
  readonly onUpdateToothStatus: (toothNumber: string, status: ToothStatus, notes?: string) => void;
  readonly onResetOdontogram?: () => void;
}

export function OdontogramTwin({
  toothData,
  selectedTooth,
  onSelectTooth,
  onUpdateToothStatus,
  onResetOdontogram,
}: OdontogramTwinProps) {
  // 32 adult teeth numbered by FDI notation
  const maxillaRight = ['18', '17', '16', '15', '14', '13', '12', '11'];
  const maxillaLeft = ['21', '22', '23', '24', '25', '26', '27', '28'];
  const mandibleLeft = ['31', '32', '33', '34', '35', '36', '37', '38'];
  const mandibleRight = ['48', '47', '46', '45', '44', '43', '42', '41'];

  const getToothClass = (num: string) => {
    const status = toothData[num]?.status || 'healthy';
    switch (status) {
      case 'decayed': return 'tooth-decayed';
      case 'missing': return 'tooth-missing';
      case 'crowned': return 'tooth-crowned';
      case 'implanted': return 'tooth-implanted';
      default: return 'tooth-healthy';
    }
  };

  const countByStatus = (status: ToothStatus) => {
    return Object.values(toothData).filter((t) => t.status === status).length;
  };

  const renderTooth = (num: string) => {
    const isSelected = selectedTooth === num;
    const status = toothData[num]?.status || 'healthy';

    return (
      <div
        key={num}
        onClick={() => onSelectTooth(isSelected ? '' : num)}
        className={`flex flex-col items-center justify-between p-2.5 rounded-2xl border transition-all duration-300 cursor-pointer select-none group relative ${
          isSelected
            ? 'bg-gradient-to-b from-teal-500/10 to-teal-500/5 border-teal-500 shadow-lg shadow-teal-500/20 ring-2 ring-teal-500/30 scale-105 dark:border-teal-400'
            : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/80 hover:border-teal-400 hover:shadow-md hover:-translate-y-0.5 dark:border-slate-800/80 dark:hover:border-teal-700'
        }`}
      >
        <span className={`text-[10px] font-black tracking-tight transition-colors ${
          isSelected ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-teal-600'
        }`}>
          #{num}
        </span>
        
        {/* Anatomical 3D Tooth SVG Graphic */}
        <svg
          width="34"
          height="34"
          viewBox="0 0 34 34"
          className="tooth-svg my-1 drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
        >
          {/* Anatomical Crown & Roots Outline */}
          <path
            d="M 10 11 C 9 5, 25 5, 24 11 C 24 16, 23 21, 21 27 C 19 31, 15 31, 13 27 C 11 21, 10 16, 10 11 Z"
            className={`${getToothClass(num)} stroke-slate-400/80 dark:stroke-slate-600`}
            strokeWidth="1.6"
          />
          {/* Crown Fissure / Grooves */}
          <path
            d="M 14 11 Q 17 14, 20 11 M 17 8 L 17 14"
            className="stroke-slate-400/50 dark:stroke-slate-500/50 fill-none"
            strokeWidth="1"
            strokeLinecap="round"
          />
          {/* Inner Surface Highlight */}
          <circle
            cx="17"
            cy="12"
            r="3.5"
            className="fill-white/60 dark:fill-slate-800/60 stroke-slate-300 dark:stroke-slate-700"
            strokeWidth="0.8"
          />
        </svg>

        <span className={`text-[9px] font-extrabold uppercase tracking-wider ${
          status === 'decayed' ? 'text-rose-600 dark:text-rose-400' :
          status === 'crowned' ? 'text-amber-600 dark:text-amber-400' :
          status === 'implanted' ? 'text-cyan-600 dark:text-cyan-400' :
          status === 'missing' ? 'text-slate-400 dark:text-slate-500' :
          'text-emerald-600 dark:text-emerald-400'
        }`}>
          {status === 'healthy' ? 'Khỏe' : status === 'decayed' ? 'Sâu' : status === 'missing' ? 'Mất' : status === 'crowned' ? 'Sứ' : 'Implant'}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-7 rounded-[28px] hc-glass-card hc-glass-card-hover border border-slate-200/90 dark:border-slate-800/90 shadow-xl relative overflow-hidden">
      {/* SVG Gradient definitions for anatomical tooth rendering */}
      <svg width="0" height="0" className="absolute opacity-0 pointer-events-none">
        <defs>
          <linearGradient id="healthyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </linearGradient>
          <linearGradient id="decayedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#e11d48" />
          </linearGradient>
          <linearGradient id="crownedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
          <linearGradient id="implantedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>
      </svg>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800/60">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
            <span className="p-1.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">🧬</span>
            Lược đồ răng Nha khoa (Odontogram Twin)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Mô hình Digital Twin 3D theo chuẩn quốc tế FDI. Click chọn răng để cập nhật hồ sơ lâm sàng.
          </p>
        </div>
        
        {/* Status Legends */}
        <div className="flex items-center gap-2.5 flex-wrap text-[10px] font-extrabold">
          <span className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/50 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm" /> Sâu ({countByStatus('decayed')})
          </span>
          <span className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/50 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 shadow-sm" /> Bọc Sứ ({countByStatus('crowned')})
          </span>
          <span className="px-2.5 py-1 rounded-full bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 border border-cyan-200/60 dark:border-cyan-900/50 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-sm" /> Implant ({countByStatus('implanted')})
          </span>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-400 opacity-60" /> Mất ({countByStatus('missing')})
          </span>

          {onResetOdontogram && (
            <button
              onClick={onResetOdontogram}
              className="px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/60 hover:bg-teal-600 hover:text-white font-black transition-all cursor-pointer shadow-sm"
              title="Đưa toàn bộ sơ đồ răng về trạng thái mặc định ban đầu"
            >
              🔄 Đưa về mặc định
            </button>
          )}
        </div>
      </div>

      {/* Adult Dentition Layout - Curved FDI Quadrants */}
      <div className="flex flex-col gap-5 p-4 rounded-2xl bg-slate-50/60 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
        {/* Upper Arch (Hàm Trên - Maxilla) */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-2 px-1">
            <span>Phân hàm Q1 (Phải)</span>
            <span className="text-teal-600 dark:text-teal-400 font-extrabold">HÀM TRÊN (MAXILLA)</span>
            <span>Phân hàm Q2 (Trái)</span>
          </div>
          <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 sm:gap-2">
            {/* Right side (reverse view to match clinical perspective) */}
            {maxillaRight.map(renderTooth)}
            {/* Left side */}
            {maxillaLeft.map(renderTooth)}
          </div>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center my-1">
          <div className="border-t border-dashed border-slate-300 dark:border-slate-700 w-full" />
          <span className="absolute px-3 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            Đường cắn trung tâm (Occlusal Line)
          </span>
        </div>

        {/* Lower Arch (Hàm Dưới - Mandible) */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-black tracking-wider text-slate-400 dark:text-slate-500 uppercase mb-2 px-1">
            <span>Phân hàm Q4 (Phải)</span>
            <span className="text-teal-600 dark:text-teal-400 font-extrabold">HÀM DƯỚI (MANDIBLE)</span>
            <span>Phân hàm Q3 (Trái)</span>
          </div>
          <div className="grid grid-cols-8 sm:grid-cols-16 gap-1.5 sm:gap-2">
            {/* Left side */}
            {mandibleLeft.map(renderTooth)}
            {/* Right side */}
            {mandibleRight.map(renderTooth)}
          </div>
        </div>
      </div>

      {/* Selected Tooth Floating Detail Drawer */}
      {selectedTooth && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 text-white shadow-2xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-teal-500/20 text-teal-300 border border-teal-500/30">
                Răng #{selectedTooth}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Vị trí FDI: <b className="text-slate-200">{selectedTooth.startsWith('1') || selectedTooth.startsWith('2') ? 'Hàm Trên' : 'Hàm Dưới'}</b>
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium">
              Trạng thái hiện tại: <span className="font-extrabold text-teal-400 uppercase">{toothData[selectedTooth]?.status || 'Lành mạnh'}</span>
              {toothData[selectedTooth]?.notes && ` — Ghi chú: "${toothData[selectedTooth].notes}"`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onUpdateToothStatus(selectedTooth, 'healthy')}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 rounded-xl transition-all active:scale-95 shadow-sm"
            >
              ✨ Khỏe mạnh
            </button>
            <button
              onClick={() => onUpdateToothStatus(selectedTooth, 'decayed', 'Phát hiện sâu men/sâu tủy')}
              className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-xs font-extrabold text-rose-300 border border-rose-500/40 rounded-xl transition-all active:scale-95 shadow-sm"
            >
              🔴 Sâu răng
            </button>
            <button
              onClick={() => onUpdateToothStatus(selectedTooth, 'crowned', 'Phục hình bọc răng sứ thẩm mỹ')}
              className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-xs font-extrabold text-amber-300 border border-amber-500/40 rounded-xl transition-all active:scale-95 shadow-sm"
            >
              👑 Bọc sứ
            </button>
            <button
              onClick={() => onUpdateToothStatus(selectedTooth, 'implanted', 'Đã cắm trụ Implant phục hình')}
              className="px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-xs font-extrabold text-cyan-300 border border-cyan-500/40 rounded-xl transition-all active:scale-95 shadow-sm"
            >
              🔩 Implant
            </button>
            <button
              onClick={() => onUpdateToothStatus(selectedTooth, 'missing', 'Răng đã nhổ/mất răng')}
              className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-xs font-bold text-slate-400 border border-slate-600 rounded-xl transition-all active:scale-95 shadow-sm"
            >
              ❌ Mất răng
            </button>
            <button
              onClick={() => onSelectTooth('')}
              className="px-3 py-1.5 bg-slate-800/80 hover:bg-rose-950/80 text-xs font-bold text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-700/50 rounded-xl transition-all active:scale-95 shadow-sm ml-2 cursor-pointer"
              title="Bỏ chọn răng hiện tại"
            >
              ✕ Bỏ chọn
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

