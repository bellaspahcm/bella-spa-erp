import React from 'react';
import { Clock, CheckCircle2, Circle } from 'lucide-react';
import { ClinicalContextType } from './ClinicalContext';

interface TimelineStep {
  time: string;
  eventName: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending';
}

export default function MedicalTimeline({ context }: { context: ClinicalContextType }) {
  const { encounter } = context;

  // CQRS Timeline Projection: Project the timeline steps dynamically from the active encounter state
  const projectTimeline = (): TimelineStep[] => {
    const steps: TimelineStep[] = [
      {
        time: '08:15',
        eventName: 'Đăng Ký Khám (EncounterStarted)',
        description: 'Bệnh nhân đăng ký tiếp đón tại quầy & cấp số thứ tự.',
        status: 'completed',
      },
    ];

    if (encounter.startedAt || encounter.status !== 'planned') {
      steps.push({
        time: '08:18',
        eventName: 'Khám Sơ Bộ',
        description: 'Bác sĩ kiểm tra sinh hiệu, ghi nhận lý do khám SOAP.',
        status: 'completed',
      });
    }

    // Lab order simulation
    const isLabDone = encounter.plan?.toLowerCase().includes('xét nghiệm') || encounter.status === 'finished';
    steps.push({
      time: '08:30',
      eventName: 'Chỉ Chỉ Định LIS (LabOrdered)',
      description: 'Y lệnh xét nghiệm huyết học công thức máu.',
      status: isLabDone ? 'completed' : 'in_progress',
    });

    // Imaging order simulation
    const isImagingDone = encounter.plan?.toLowerCase().includes('phổi') || encounter.status === 'finished';
    steps.push({
      time: '09:00',
      eventName: 'Chụp X-Quang Phổi (ImagingOrdered)',
      description: 'Chỉ định chụp X-Quang ngực thẳng PACS DICOM.',
      status: isImagingDone ? 'completed' : (isLabDone ? 'in_progress' : 'pending'),
    });

    // Prescription issued simulation
    const isRxDone = encounter.plan?.toLowerCase().includes('kê đơn') || encounter.status === 'finished';
    steps.push({
      time: '09:35',
      eventName: 'Kê Đơn Thuốc (PrescriptionIssued)',
      description: 'Khởi tạo đơn thuốc điện tử & rà soát CDSS dị ứng.',
      status: isRxDone ? 'completed' : (isImagingDone ? 'in_progress' : 'pending'),
    });

    // Billing / Payment
    const isPaid = encounter.status === 'finished';
    steps.push({
      time: '09:40',
      eventName: 'Thanh Toán Viện Phí (InvoiceCreated)',
      description: 'Khấu trừ đồng chi trả BHYT (80/20) & xác thực sổ cái.',
      status: isPaid ? 'completed' : (isRxDone ? 'in_progress' : 'pending'),
    });

    return steps;
  };

  const steps = projectTimeline();

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-left">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-500" />
          Dòng Thời Gian Y Lệnh (CQRS Timeline)
        </h3>
        <span className="text-[9px] font-extrabold text-teal-600 px-2 py-0.5 rounded-full bg-teal-500/10">Event-driven</span>
      </div>

      <div className="relative border-l-2 border-slate-100 dark:border-slate-800 pl-4 ml-2.5 space-y-5 text-xs">
        {steps.map((step, idx) => (
          <div key={idx} className="relative space-y-1">
            <span className="absolute -left-[23px] top-0.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
              {step.status === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 bg-white dark:bg-slate-900" />
              ) : step.status === 'in_progress' ? (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              ) : (
                <Circle className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 bg-white dark:bg-slate-900" />
              )}
            </span>
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
              <span>{step.time}</span>
              <span className={`px-1.5 py-0.25 rounded text-[8px] uppercase tracking-wider ${
                step.status === 'completed' 
                  ? 'bg-teal-50 text-teal-700' 
                  : step.status === 'in_progress'
                  ? 'bg-amber-50 text-amber-700 animate-pulse'
                  : 'bg-slate-50 text-slate-500'
              }`}>
                {step.status === 'completed' ? 'Hoàn tất' : step.status === 'in_progress' ? 'Đang thực hiện' : 'Chờ'}
              </span>
            </div>
            <h4 className="font-black text-slate-950 dark:text-white">{step.eventName}</h4>
            <p className="text-slate-500 font-medium">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
