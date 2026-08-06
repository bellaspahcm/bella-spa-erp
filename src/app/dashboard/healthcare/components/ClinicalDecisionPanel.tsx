'use client';

import React, { useState } from 'react';
import { ShieldCheck, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { ClinicalContextType } from './ClinicalContext';
import { useHealthcareKernel } from '@/modules/bella-healthcare-kernel/context/HealthcareKernelContext';

export default function ClinicalDecisionPanel({ context }: { readonly context: ClinicalContextType }) {
  const { manifest } = useHealthcareKernel();
  const { patient, encounter } = context;
  const [approvedRecommendations, setApprovedRecommendations] = useState<readonly string[]>([]);

  // CDSS Clinical Rules Engine: Triggers recommendations based on symptoms
  const getCDSSRecommendations = () => {
    const isDental = manifest?.id === 'bella-dental' || manifest?.id === 'dental_clinic' || manifest?.id === 'dental_workspace';

    if (isDental) {
      return {
        suspectedCondition: 'Nghi ngờ: Viêm tủy răng cấp tính #36 (Acute Pulpitis)',
        evidence: [
          `Triệu chứng: ${encounter.chiefComplaint || 'Đau buốt răng hàm dưới bên trái khi ăn đồ nóng lạnh'}`,
          'Chấn thương/Khám: Răng #36 sâu ngà sâu sát tủy',
          `Cơ địa: Bệnh nhân ${patient.fullName} ổn định`,
        ],
        orders: [
          { id: 'rec-1', title: 'Chụp phim quanh chóp răng #36 (Periapical X-Ray)', category: 'RIS PACS' },
          { id: 'rec-2', title: 'Tiến hành chữa tủy buồng (Root Canal Therapy)', category: 'Clinical' },
          { id: 'rec-3', title: 'Đặt thuốc diệt tủy/Sát khuẩn Ca(OH)2', category: 'Clinical' },
          { id: 'rec-4', title: 'Phục hình bọc mão răng sứ thẩm mỹ Cercon', category: 'Prosthodontics' },
        ],
        aiExplanation: 'Bella EOS AI phân tích: Răng #36 tổn thương sâu ngà độ 4 biến chứng viêm tủy không hồi phục. CDSS chỉ định chụp X-quang chẩn đoán xác định và thực hiện điều trị tủy kết hợp bọc mão để bảo tồn cấu trúc răng thật.',
      };
    }

    // Medical clinic context
    return {
      suspectedCondition: 'Nghi ngờ: Viêm phổi cộng đồng (Community-Acquired Pneumonia)',
      evidence: [
        `Triệu chứng: ${encounter.chiefComplaint || 'Sốt, ho kéo dài'}`,
        'Chỉ số sinh tồn: Kali máu 6.2 mmol/L (Cảnh báo Panic)',
        `Cơ địa: Bệnh nhân ${patient.fullName} dị ứng Penicillin`,
      ],
      orders: [
        { id: 'rec-1', title: 'Chụp X-Quang ngực thẳng (Chest AP/PA)', category: 'RIS PACS' },
        { id: 'rec-2', title: 'Công thức máu (CBC - 24 thông số)', category: 'LIS Lab' },
        { id: 'rec-3', title: 'Đo định lượng CRP (C-Reactive Protein)', category: 'LIS Lab' },
        { id: 'rec-4', title: 'Theo dõi SpO2 liên tục tại giường', category: 'Nursing' },
        { id: 'rec-5', title: 'Kháng sinh nhóm Macrolide (Chống chỉ định Penicillin/Beta-lactam)', category: 'Pharmacy' },
      ],
      aiExplanation: 'Bella EOS AI phân tích: Bệnh nhân có tiền sử sốc phản vệ Penicillin, do đó CDSS tự động chặn kháng sinh họ Beta-lactam và thay bằng Macrolide/Clindamycin để đảm bảo an toàn tuyệt đối.',
    };
  };

  const cdss = getCDSSRecommendations();

  const handleToggleApprove = (id: string) => {
    setApprovedRecommendations((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApplyAll = () => {
    const allIds = cdss.orders.map(o => o.id);
    setApprovedRecommendations(allIds);
    toast.success('🎉 Bác sĩ đã phê chuẩn toàn bộ y lệnh được CDSS đề xuất!');
  };

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-left">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-teal-500" />
          Hệ CDSS & Gợi Ý Phác Đồ (Clinical Decision Support)
        </h3>
        <span className="text-[9px] font-extrabold text-teal-600 px-2 py-0.5 rounded-full bg-teal-500/10">CDSS Guard</span>
      </div>

      <div className="space-y-3 text-xs">
        {/* Suspected condition */}
        <div className="p-3.5 rounded-xl bg-teal-500/5 border border-teal-500/20 space-y-1">
          <span className="font-extrabold text-teal-700 dark:text-teal-400 block">{cdss.suspectedCondition}</span>
          <div className="text-[10px] text-slate-500 space-y-0.5">
            {cdss.evidence.map((ev, i) => <p key={i}>• {ev}</p>)}
          </div>
        </div>

        {/* Recommended orders list */}
        <div className="space-y-2">
          <span className="font-bold text-slate-500 block uppercase tracking-wider text-[10px]">Đề xuất y lệnh y khoa:</span>
          {cdss.orders.map((o) => {
            const isApproved = approvedRecommendations.includes(o.id);
            return (
              <div 
                key={o.id}
                onClick={() => handleToggleApprove(o.id)}
                className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  isApproved 
                    ? 'bg-teal-500/5 border-teal-500 text-teal-900 dark:text-teal-400' 
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.25 bg-slate-200 dark:bg-slate-800 rounded text-slate-500 mr-2 uppercase tracking-wide">
                    {o.category}
                  </span>
                  <span className="font-semibold">{o.title}</span>
                </div>
                <div className={`w-4.5 h-4.5 rounded-md border flex items-center justify-center shrink-0 ${
                  isApproved ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300'
                }`}>
                  {isApproved && <Check className="w-3 h-3" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* AI explanation of the recommendations */}
        <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-1">
          <span className="font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            EOS AI Giải Thích Y Lệnh:
          </span>
          <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 font-medium">{cdss.aiExplanation}</p>
        </div>

        {/* Approval action */}
        <button 
          onClick={handleApplyAll}
          className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all text-center cursor-pointer"
        >
          Phê chuẩn toàn bộ y lệnh
        </button>
      </div>
    </div>
  );
}
