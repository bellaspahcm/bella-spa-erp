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
}

export function OdontogramTwin({
  toothData,
  selectedTooth,
  onSelectTooth,
  onUpdateToothStatus,
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

  const renderTooth = (num: string) => {
    const isSelected = selectedTooth === num;
    const status = toothData[num]?.status || 'healthy';

    return (
      <div
        key={num}
        onClick={() => onSelectTooth(num)}
        className={`flex flex-col items-center justify-between p-2 rounded-xl border transition-all duration-300 cursor-pointer select-none group ${
          isSelected
            ? 'bg-teal-50 border-teal-500 shadow-[0_4px_12px_rgba(20,184,166,0.12)] ring-1 ring-teal-500/20 dark:bg-teal-950/30 dark:border-teal-400'
            : 'bg-white border-slate-200/70 hover:border-teal-300 hover:shadow-[0_4px_12px_rgba(20,184,166,0.06)] dark:bg-slate-900 dark:border-slate-800/80 dark:hover:border-teal-800'
        }`}
      >
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 group-hover:text-teal-600 transition-colors">
          #{num}
        </span>
        
        {/* Simple Interactive Tooth SVG Representation */}
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          className="tooth-svg my-1.5"
        >
          {/* Tooth Crown / Shape */}
          <path
            d="M 8 10 C 8 4, 24 4, 24 10 C 24 16, 22 22, 20 26 C 18 30, 14 30, 12 26 C 10 22, 8 16, 8 10 Z"
            className={`${getToothClass(num)} stroke-slate-400 dark:stroke-slate-600`}
            strokeWidth="1.5"
            fill="#e2e8f0"
          />
          {/* Tooth Occlusal Surface / Inner circle */}
          <circle
            cx="16"
            cy="12"
            r="4"
            className="fill-white/80 dark:fill-slate-800/80 stroke-slate-400 dark:stroke-slate-600"
            strokeWidth="1"
          />
        </svg>

        <span className="text-[9px] font-semibold uppercase tracking-wider scale-90 text-slate-500 dark:text-slate-400">
          {status === 'healthy' ? 'Khỏe' : status === 'decayed' ? 'Sâu' : status === 'missing' ? 'Mất' : status === 'crowned' ? 'Sứ' : 'Implant'}
        </span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(20,184,166,0.12),0_4px_12px_-2px_rgba(20,184,166,0.06)] hover:-translate-y-0.5 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            🧬 Lược đồ răng Nha khoa (Odontogram Twin)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Click chọn răng để xem bệnh lý và cập nhật trạng thái lâm sàng của bệnh nhân
          </p>
        </div>
        
        {/* Status Legends */}
        <div className="flex items-center gap-3 text-[10px] font-semibold text-slate-500">
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full" /> Sâu răng</div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-400 rounded-full" /> Răng sứ</div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-cyan-500 rounded-full" /> Implant</div>
          <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-slate-400 opacity-50 rounded-full" /> Mất răng</div>
        </div>
      </div>

      {/* Adult Dentition Layout */}
      <div className="flex flex-col gap-4">
        {/* Upper Arch (Hàm Trên) */}
        <div>
          <div className="text-[10px] font-bold text-slate-400 mb-1">HÀM TRÊN (MAXILLA)</div>
          <div className="grid grid-cols-8 gap-2">
            {/* Right side (reverse view to match clinic perspective) */}
            {maxillaRight.map(renderTooth)}
            {/* Left side */}
            {maxillaLeft.map(renderTooth)}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-dashed border-slate-200 dark:border-slate-800 my-2" />

        {/* Lower Arch (Hàm Dưới) */}
        <div>
          <div className="text-[10px] font-bold text-slate-400 mb-1">HÀM DƯỚI (MANDIBLE)</div>
          <div className="grid grid-cols-8 gap-2">
            {/* Left side */}
            {mandibleLeft.map(renderTooth)}
            {/* Right side */}
            {mandibleRight.map(renderTooth)}
          </div>
        </div>
      </div>

      {/* Selected Tooth Detail Panel */}
      {selectedTooth && (
        <div className="mt-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Đang chọn: Răng #{selectedTooth}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Trạng thái hiện tại: <span className="font-semibold text-teal-600 uppercase">{toothData[selectedTooth]?.status || 'Lành mạnh'}</span>
              {toothData[selectedTooth]?.notes && ` - Ghi chú: ${toothData[selectedTooth].notes}`}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onUpdateToothStatus(selectedTooth, 'healthy')}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg transition-all"
            >
              Khỏe mạnh
            </button>
            <button
              onClick={() => onUpdateToothStatus(selectedTooth, 'decayed', 'Phát hiện sâu men răng')}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900/30 text-xs font-bold text-rose-600 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/50 rounded-lg transition-all"
            >
              Sâu răng
            </button>
            <button
              onClick={() => onUpdateToothStatus(selectedTooth, 'crowned', 'Phục hình răng sứ thẩm mỹ')}
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:hover:bg-amber-900/30 text-xs font-bold text-amber-600 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/50 rounded-lg transition-all"
            >
              Bọc sứ
            </button>
            <button
              onClick={() => onUpdateToothStatus(selectedTooth, 'implanted', 'Đã cắm trụ Implant phục hình')}
              className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/20 dark:hover:bg-cyan-900/30 text-xs font-bold text-cyan-600 dark:text-cyan-400 border border-cyan-200/50 dark:border-cyan-900/50 rounded-lg transition-all"
            >
              Implant
            </button>
            <button
              onClick={() => onUpdateToothStatus(selectedTooth, 'missing', 'Răng đã nhổ/mất răng')}
              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg transition-all"
            >
              Mất răng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
