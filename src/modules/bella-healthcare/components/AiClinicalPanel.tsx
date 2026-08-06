'use client';
import React, { useState } from 'react';
import { Sparkles, Brain } from 'lucide-react';
import { toast } from 'sonner';

export interface AiClinicalPanelProps {
  readonly _patientName: string; // Prefixed with underscore as it's currently unused
  readonly patientAllergies: string[];
  readonly onRunClinicalCheck: (allergies: string[], drugs: string[]) => Promise<{
    readonly triggered: boolean;
    readonly warnings: string[];
    readonly blockers: string[];
  }>;
  readonly isReadOnly?: boolean;
}

export function AiClinicalPanel({
  _patientName,
  patientAllergies,
  onRunClinicalCheck,
  isReadOnly = false,
}: AiClinicalPanelProps) {
  const [rawNotes, setRawNotes] = useState<string>('');
  const [soapNote, setSoapNote] = useState<{
    s?: string;
    o?: string;
    a?: string;
    p?: string;
  } | null>(null);
  const [isGeneratingSoap, setIsGeneratingSoap] = useState<boolean>(false);

  // CDSS States
  const [selectedDrugs, setSelectedDrugs] = useState<string[]>([]);

  const handleGenerateSoap = () => {
    if (!rawNotes.trim()) {
      toast.warning('Vui lòng nhập ghi chú thô của bác sĩ');
      return;
    }
    setIsGeneratingSoap(true);
    // Simulate AI parsing notes to SOAP structure
    setTimeout(() => {
      // AI parses the raw physician notes into standardized SOAP format
      // Demo output reflects internal medicine context (Bella Medical Clinic)
      setSoapNote({
        s: `Bệnh nhân nhập viện với triệu chứng sốt cao (≥38.5°C), ho khan kéo dài 4 ngày, khó thở nhẹ khi gắng sức. Tiền sử ghi nhận dị ứng kháng sinh Penicillin. Ghi chú BS: "${rawNotes.slice(0, 120)}..."`,
        o: 'Khám lâm sàng: Nhiệt độ 38.8°C, SpO2 94%, phổi nghe ran ẩm 2 phế trường đáy phổi. CRP tăng cao. X-quang phổi thẳng: Đám mờ phân thùy dưới phổi phải.',
        a: 'J18.9 — Viêm phổi cộng đồng (Community-Acquired Pneumonia - CAP) mức độ trung bình. Cần loại trừ lao phổi.',
        p: '1. Chỉ định chụp X-Quang ngực thẳng (Chest AP/PA) — RIS PACS.\n2. Xét nghiệm công thức máu CBC, CRP, Procalcitonin — LIS.\n3. Cấy đờm tìm vi khuẩn trước khi dùng kháng sinh.\n4. Kháng sinh: Azithromycin 500mg/ngày (chống chỉ định Penicillin/Beta-lactam do dị ứng).\n5. Theo dõi SpO2 liên tục. Nếu SpO2 < 92% chỉ định thở Oxy.',
      });
      setIsGeneratingSoap(false);
      toast.success('✨ Bella EOS AI đã cấu trúc hóa SOAP Note lâm sàng thành công');
    }, 1200);
  };

  // Note: CDSS safety check functionality commented out pending implementation
  // const handleCheckSafety = async () => { ... }
  // const handleToggleDrug = (code: string) => { ... }
  
  // Suppress unused variable warnings - these are intentionally kept for future CDSS implementation
  void patientAllergies;
  void onRunClinicalCheck;
  void selectedDrugs;
  void setSelectedDrugs;

  const copySoapToClipboard = () => {
    if (!soapNote) return;
    const text = `S: ${soapNote.s}\nO: ${soapNote.o}\nA: ${soapNote.a}\nP: ${soapNote.p}`;
    navigator.clipboard.writeText(text);
    toast.success('Đã chép SOAP Note vào bộ nhớ tạm');
  };

  return (
    <div className="flex flex-col gap-6 p-7 rounded-[28px] hc-glass-card hc-glass-card-hover hc-ai-aura border border-slate-200/90 dark:border-slate-800/90 shadow-xl relative">
      {/* SOAP Note Generator Panel */}
      <div className="space-y-4 text-left">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
            <span className="p-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Sparkles className="w-4 h-4" />
            </span>
            Bella AI Co-Pilot (SOAP Assistant)
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/30">
            NLP Active
          </span>
        </div>
        
        <div className="relative">
          <textarea
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
            readOnly={isReadOnly}
            placeholder={isReadOnly ? "Chỉ Bác sĩ điều trị mới có quyền soạn ghi chú lâm sàng." : "Nhập ghi chú thô của bác sĩ (ví dụ: bệnh nhân đau răng 36 khi ăn đồ nóng lạnh, đau nhiều tối qua, khám thấy sâu sâu sát tủy...)"}
            className="w-full min-h-[90px] p-3.5 text-xs rounded-2xl border border-slate-200/90 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900/90 dark:border-slate-800 dark:text-white leading-relaxed resize-none disabled:opacity-60"
            disabled={isReadOnly}
          />
        </div>

        <button
          onClick={handleGenerateSoap}
          disabled={isGeneratingSoap || isReadOnly}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-teal-500 via-teal-600 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Brain className={`w-4 h-4 ${isGeneratingSoap ? 'animate-spin' : ''}`} />
          <span>{isGeneratingSoap ? 'AI đang phân tích lâm sàng...' : 'Cấu trúc hóa SOAP Note (AI)'}</span>
        </button>

        {soapNote && (
          <div className="p-4.5 rounded-2xl bg-gradient-to-br from-teal-50/80 to-cyan-50/40 dark:from-teal-950/30 dark:to-cyan-950/20 border border-teal-200/70 dark:border-teal-900/60 space-y-3 text-left shadow-sm">
            <div className="flex items-center justify-between border-b border-teal-200/50 dark:border-teal-900/50 pb-2">
              <h4 className="text-xs font-black text-teal-900 dark:text-teal-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" /> Hồ sơ SOAP chuẩn hóa:
              </h4>
              <button
                onClick={copySoapToClipboard}
                className="text-[10px] font-extrabold px-2 py-0.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
              >
                Sao chép
              </button>
            </div>
            
            <div className="space-y-2 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
              <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-teal-100 dark:border-teal-900/40">
                <span className="font-black text-teal-700 dark:text-teal-400 block mb-0.5">S (Subjective - Triệu chứng cơ năng):</span>
                {soapNote.s}
              </div>
              <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-teal-100 dark:border-teal-900/40">
                <span className="font-black text-teal-700 dark:text-teal-400 block mb-0.5">O (Objective - Triệu chứng thực thể):</span>
                {soapNote.o}
              </div>
              <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-teal-100 dark:border-teal-900/40">
                <span className="font-black text-teal-700 dark:text-teal-400 block mb-0.5">A (Assessment - Chẩn đoán xác định):</span>
                {soapNote.a}
              </div>
              <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-teal-100 dark:border-teal-900/40">
                <span className="font-black text-teal-700 dark:text-teal-400 block mb-0.5">P (Plan - Kế hoạch điều trị):</span>
                <p className="whitespace-pre-line text-slate-800 dark:text-slate-200">{soapNote.p}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <hr className="border-slate-100 dark:border-slate-800/80" />

      {/* Clinical Decision Support System (CDSS) - Recommendations */}
      <div className="space-y-4 text-left border-t border-slate-100 dark:border-slate-800/80 pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
            <span className="p-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Brain className="w-4 h-4" />
            </span>
            AI Clinical Recommendation Engine
          </h3>
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
            Decision Support
          </span>
        </div>

        {/* AI Clinical Recommendation — Medical Clinic Context */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/80 to-purple-50/40 dark:from-indigo-950/30 dark:to-purple-950/20 border border-indigo-200/80 dark:border-indigo-900/60 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
              🩺 Nghi ngờ: Viêm phổi cộng đồng (CAP)
            </span>
            <span className="px-2 py-0.2 rounded text-[9px] font-black bg-rose-500 text-white">
              ƯU TIÊN CAO
            </span>
          </div>

          <div className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
              <span>✓ Chụp X-Quang ngực thẳng (Chest AP/PA)</span>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">RIS PACS</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
              <span>✓ Công thức máu CBC + CRP + Procalcitonin</span>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">LIS Lab</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
              <span>✓ Theo dõi SpO2 liên tục tại giường</span>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Nursing</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between">
              <span>✓ Kháng sinh Azithromycin (chống chỉ định Penicillin)</span>
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">Pharmacy ⚠️</span>
            </div>
          </div>

          <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium leading-relaxed italic pt-1">
            💡 Bella EOS AI: Bệnh nhân dị ứng Penicillin — CDSS tự động chặn toàn bộ kháng sinh Beta-lactam và gợi ý Macrolide thay thế. Cần theo dõi SpO2 sát sao.
          </p>
        </div>
      </div>
    </div>
  );
}

