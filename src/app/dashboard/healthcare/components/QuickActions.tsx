import React from 'react';
import { PlusCircle, Pill, FileSpreadsheet, TestTube, Camera, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { ClinicalContextType } from './ClinicalContext';

export default function QuickActions({ context }: { context: ClinicalContextType }) {
  const { patient } = context;

  const actions = [
    { label: 'Khám mới', icon: PlusCircle, color: 'text-teal-600 bg-teal-50 hover:bg-teal-100', toastMsg: 'Đã mở form tiếp đón ca khám mới!' },
    { label: 'Kê đơn thuốc', icon: Pill, color: 'text-purple-600 bg-purple-50 hover:bg-purple-100', toastMsg: 'Chuyển sang tab Kê đơn thuốc!' },
    { label: 'Y lệnh điều trị', icon: FileSpreadsheet, color: 'text-blue-600 bg-blue-50 hover:bg-blue-100', toastMsg: 'Đã lưu y lệnh điều trị!' },
    { label: 'Chỉ định Lab', icon: TestTube, color: 'text-amber-600 bg-amber-50 hover:bg-amber-100', toastMsg: 'Đã tạo phiếu chỉ định LIS Xét nghiệm máu!' },
    { label: 'Chỉ định X-ray', icon: Camera, color: 'text-cyan-600 bg-cyan-50 hover:bg-cyan-100', toastMsg: 'Đã tạo phiếu chỉ định RIS PACS X-Quang!' },
    { label: 'Hẹn tái khám', icon: CalendarClock, color: 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100', toastMsg: 'Đã lên lịch hẹn tái khám y khoa!' },
  ];

  const handleAction = (label: string, msg: string) => {
    toast.success(`[Quick Action] ${label}: ${msg}`);
  };

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-left">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-black text-slate-900 dark:text-white">
          Thao Tác Nhanh (Quick Actions)
        </h3>
        <span className="text-[10px] text-slate-400 font-bold">BN: {patient.fullName}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {actions.map((act, idx) => {
          const Icon = act.icon;
          return (
            <button
              key={idx}
              onClick={() => handleAction(act.label, act.toastMsg)}
              className={`p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-all active:scale-95 ${act.color}`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-extrabold">{act.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
