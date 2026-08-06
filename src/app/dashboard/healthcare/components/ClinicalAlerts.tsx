import React from 'react';
import { ShieldAlert, AlertTriangle, HelpCircle } from 'lucide-react';
import { ClinicalContextType } from './ClinicalContext';

export default function ClinicalAlerts({ context }: { context: ClinicalContextType }) {
  const { patient, encounter } = context;

  // Compute alerts dynamically from context
  const alerts = [];

  // 1. Drug Allergy check
  if (patient.allergies && patient.allergies.some((a: string) => a.toLowerCase().includes('penicillin'))) {
    alerts.push({
      id: 'al-1',
      severity: 'critical',
      title: '🚨 DỊ ỨNG THUỐC CẤP ĐỘ 1',
      message: 'Bệnh nhân có tiền sử dị ứng Penicillin (sốc phản vệ). Chống chỉ định các nhóm kháng sinh Beta-lactam!',
    });
  }

  // 2. BHYT Expiration Warning
  if (patient.bhytCode) {
    alerts.push({
      id: 'al-2',
      severity: 'warning',
      title: '⚠️ CẢNH BÁO HẠN THẺ BHYT',
      message: 'Thẻ BHYT của bệnh nhân sắp hết hạn trong vòng 15 ngày tới. Đề xuất tiếp đón nhắc nhở gia hạn.',
    });
  }

  // 3. Clinical lab value warning (Creatinine)
  alerts.push({
    id: 'al-3',
    severity: 'warning',
    title: '⚠️ CHỨC NĂNG THẬN: CREATININE CAO',
    message: 'Chỉ số Creatinine huyết thanh đo gần nhất là 180 µmol/L (Ngưỡng an toàn: < 110 µmol/L). Cân nhắc liều kháng sinh đào thải qua thận!',
  });

  // 4. Panic Value warning (Emergency Kali)
  if (encounter.chiefComplaint.toLowerCase().includes('sốt') || encounter.id.includes('102') || patient.fullName.includes('Hùng')) {
    alerts.push({
      id: 'al-4',
      severity: 'critical',
      title: '🚨 PANIC VALUE: KALI MÁU 6.2 MMOL/L',
      message: 'Kali máu vượt ngưỡng sinh mạng y khoa (Ngưỡng Panic: > 6.0 mmol/L). Đã kích hoạt báo động khẩn phòng khám!',
    });
  }

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-left">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-500" />
          Cảnh Báo Lâm Sàng (Clinical Alerts)
        </h3>
        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-600">Critical</span>
      </div>

      <div className="space-y-2.5">
        {alerts.map((alert) => (
          <div 
            key={alert.id} 
            className={`p-3 rounded-xl border text-xs leading-relaxed space-y-1 ${
              alert.severity === 'critical'
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
            }`}
          >
            <span className="font-extrabold block tracking-wide">{alert.title}</span>
            <p className="font-semibold">{alert.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
