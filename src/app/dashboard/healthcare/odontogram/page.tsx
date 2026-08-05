'use client';
import React, { useState } from 'react';
import { Smile, Search, ShieldAlert, Award, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { OdontogramTwin, type ToothData, type ToothStatus } from '@/modules/bella-healthcare/components/OdontogramTwin';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

export default function OdontogramPage() {
  const [selectedPatient, setSelectedPatient] = useState('Nguyễn Văn Hùng');
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);

  const patientOptions = [
    { value: 'Nguyễn Văn Hùng', label: 'Nguyễn Văn Hùng (GD4797921800124)' },
    { value: 'Lê Thị Mai', label: 'Lê Thị Mai (DN4797921800567)' },
  ];

  // Tooth status database for selected patient
  const [toothData, setToothData] = useState<Record<string, ToothData>>({
    '16': { status: 'decayed', notes: 'Sâu ngà răng sâu' },
    '18': { status: 'missing', notes: 'Đã nhổ răng khôn' },
    '36': { status: 'implanted', notes: 'Cấy trụ Implant Nobel Biocare' },
    '46': { status: 'crowned', notes: 'Mão sứ thẩm mỹ Cercon' },
  });

  const handleUpdateStatus = (num: string, status: ToothStatus, notes?: string) => {
    setToothData((prev) => ({
      ...prev,
      [num]: { status, notes: notes || prev[num]?.notes },
    }));
    toast.success(`Cập nhật răng #${num} sang trạng thái: ${status}`);
  };

  const handleSaveOdontogram = () => {
    toast.success('🎉 Đã lưu lược đồ răng nha khoa vào bệnh án thành công');
  };

  const handleResetOdontogram = () => {
    setToothData({});
    setSelectedTooth(null);
    toast.info('🎉 Đã đưa sơ đồ 32 răng về trạng thái mặc định ban đầu');
  };

  return (
    <div className="p-6 w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(20,184,166,0.12),0_4px_12px_-2px_rgba(20,184,166,0.06)] hover:-translate-y-0.5 transition-all duration-300">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 border border-teal-500/20 shadow-sm">
            <Smile className="w-5 h-5" />
          </span>
          <div className="text-left">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Khám và lược đồ răng (Odontogram)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Biểu diễn trực quan trạng thái 32 răng người lớn phục vụ chuẩn đoán nha khoa lâm sàng
            </p>
          </div>
        </div>

        <button
          onClick={handleSaveOdontogram}
          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
        >
          Lưu Bệnh Án Nha Khoa
        </button>
      </div>

      {/* Patient Picker Bar */}
      <div className="p-4 rounded-[16px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-[0_4px_12px_-1px_rgba(0,0,0,0.04)] dark:shadow-none flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">Bệnh nhân khám:</span>
          <PremiumSelect
            options={patientOptions}
            value={selectedPatient}
            onChange={setSelectedPatient}
            placeholder="Chọn bệnh nhân..."
            buttonClassName="py-1 px-2.5 text-xs font-bold rounded-lg border border-slate-200 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
            className="w-auto"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Tiền sử bệnh lý răng miệng:</span>
          <span className="font-bold text-rose-600">Sâu răng hàm, Mất răng #18</span>
        </div>
      </div>

      {/* Main Interactive Twin */}
      <OdontogramTwin
        toothData={toothData}
        selectedTooth={selectedTooth}
        onSelectTooth={setSelectedTooth}
        onUpdateToothStatus={handleUpdateStatus}
        onResetOdontogram={handleResetOdontogram}
      />

      {/* Pathology History Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(20,184,166,0.12),0_4px_12px_-2px_rgba(20,184,166,0.06)] hover:-translate-y-0.5 transition-all duration-300 text-left space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            Răng sâu & bệnh lý đang tiến triển
          </h3>
          <div className="space-y-2.5">
            {Object.keys(toothData).filter(k => toothData[k].status === 'decayed').map(k => (
              <div key={k} className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/50">
                <span className="font-bold text-xs text-rose-700 dark:text-rose-400">Răng #{k}</span>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">{toothData[k].notes || 'Phát hiện sâu răng'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(20,184,166,0.12),0_4px_12px_-2px_rgba(20,184,166,0.06)] hover:-translate-y-0.5 transition-all duration-300 text-left space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Award className="w-4 h-4 text-cyan-500" />
            Lịch sử cấy ghép phục hình răng
          </h3>
          <div className="space-y-2.5">
            {Object.keys(toothData).filter(k => ['implanted', 'crowned'].includes(toothData[k].status)).map(k => (
              <div key={k} className="p-3 rounded-xl bg-cyan-50/50 dark:bg-cyan-950/10 border border-cyan-100 dark:border-cyan-900/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-cyan-700 dark:text-cyan-400">Răng #{k}</span>
                  <span className="text-[8px] font-bold px-1.5 py-0.2 bg-cyan-100 dark:bg-cyan-950 text-cyan-700 rounded uppercase">
                    {toothData[k].status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">{toothData[k].notes || 'Đã phục hình thành công'}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-[24px] bg-white dark:bg-slate-950 border border-slate-300/85 dark:border-slate-850 shadow-[0_6px_24px_-2px_rgba(15,23,42,0.08),0_2px_6px_-1px_rgba(15,23,42,0.04)] dark:shadow-[0_6px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_16px_36px_-4px_rgba(20,184,166,0.12),0_4px_12px_-2px_rgba(20,184,166,0.06)] hover:-translate-y-0.5 transition-all duration-300 text-left space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-teal-600" />
            Kế hoạch điều trị nha khoa đề xuất
          </h3>
          
          <div className="space-y-3 text-[11px] text-slate-700 dark:text-slate-300">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <b className="text-slate-900 dark:text-white">Điều trị tủy & Hàn răng #16</b>
                <p className="text-[10px] text-slate-500 mt-0.5">Dự kiến thực hiện trong tuần này</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div>
                <b className="text-slate-900 dark:text-white">Lấy cao răng toàn hàm</b>
                <p className="text-[10px] text-slate-500 mt-0.5">Đã hoàn tất lúc check-in tiếp đón</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
