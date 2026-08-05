'use client';
import React, { useState } from 'react';
import { Sparkles, Brain, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import { toast } from 'sonner';

export interface AiClinicalPanelProps {
  readonly patientName: string;
  readonly patientAllergies: string[];
  readonly onRunClinicalCheck: (allergies: string[], drugs: string[]) => Promise<{
    readonly triggered: boolean;
    readonly warnings: string[];
    readonly blockers: string[];
  }>;
}

export function AiClinicalPanel({
  patientName,
  patientAllergies,
  onRunClinicalCheck,
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
  const [isCheckingSafety, setIsCheckingSafety] = useState<boolean>(false);
  const [checkResult, setCheckResult] = useState<{
    status: 'unchecked' | 'safe' | 'warning' | 'blocked';
    messages: string[];
  }>({ status: 'unchecked', messages: [] });

  const availableDrugs = [
    { code: 'J01CA04', label: 'Amoxicillin 500mg (Kháng sinh)' },
    { code: 'J01CR02', label: 'Augmentin 625mg (Amox + Clavulanic)' },
    { code: 'M01AE01', label: 'Ibuprofen 400mg (Giảm đau hạ sốt)' },
  ];

  const handleGenerateSoap = () => {
    if (!rawNotes.trim()) {
      toast.warning('Vui lòng nhập ghi chú thô của bác sĩ');
      return;
    }
    setIsGeneratingSoap(true);
    // Simulate AI parsing notes to SOAP structure
    setTimeout(() => {
      setSoapNote({
        s: 'Bệnh nhân nam 28 tuổi đến khám do đau nhức âm ỉ răng hàm dưới bên trái (#36) khi ăn uống đồ nóng lạnh, đau lan lên thái dương.',
        o: 'Khám lâm sàng phát hiện răng #36 sâu mặt nhai sâu sát tủy, gõ đau nhẹ, tủy răng phản ứng chậm với thử lạnh. Phim X-quang: Vùng thấu quang quanh chóp chân răng #36 khu trú nhẹ.',
        a: 'Viêm tủy cấp không hồi phục răng #36 do sâu răng ăn sâu vào tủy răng.',
        p: '1. Tiến hành lấy tủy buồng, bơm rửa tạo hình ống tủy răng #36.\n2. Đặt Ca(OH)2 diệt khuẩn.\n3. Kê đơn kháng sinh giảm đau dự phòng.\n4. Hẹn tái khám sau 7 ngày hàn kín tủy.',
      });
      setIsGeneratingSoap(false);
      toast.success('✨ Bella AI đã cấu trúc hóa SOAP Note thành công');
    }, 1200);
  };

  const handleToggleDrug = (code: string) => {
    setSelectedDrugs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleCheckSafety = async () => {
    setIsCheckingSafety(true);
    try {
      const res = await onRunClinicalCheck(patientAllergies, selectedDrugs);
      
      if (res.blockers.length > 0) {
        setCheckResult({ status: 'blocked', messages: res.blockers });
        toast.error('❌ Phát hiện chống chỉ định kê đơn nghiêm trọng!');
      } else if (res.warnings.length > 0) {
        setCheckResult({ status: 'warning', messages: res.warnings });
        toast.warning('⚠️ Cảnh báo tương tác thuốc lâm sàng!');
      } else {
        setCheckResult({ status: 'safe', messages: ['Kê đơn an toàn. Không phát hiện xung đột chéo.'] });
        toast.success('✅ Kiểm tra an toàn kê đơn hoàn tất');
      }
    } catch (err) {
      toast.error('Lỗi hệ thống CDSS');
    } finally {
      setIsCheckingSafety(false);
    }
  };

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
            placeholder="Nhập ghi chú thô của bác sĩ (ví dụ: bệnh nhân đau răng 36 khi ăn đồ nóng lạnh, đau nhiều tối qua, khám thấy sâu sâu sát tủy...)"
            className="w-full min-h-[90px] p-3.5 text-xs rounded-2xl border border-slate-200/90 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:bg-slate-900/90 dark:border-slate-800 dark:text-white leading-relaxed resize-none"
          />
        </div>

        <button
          onClick={handleGenerateSoap}
          disabled={isGeneratingSoap}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-teal-500 via-teal-600 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-50"
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

      {/* Clinical Decision Support System (CDSS) - Safety Check */}
      <div className="space-y-4 text-left">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
          <span className="p-1 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <Brain className="w-4 h-4" />
          </span>
          Hệ thống CDSS (Kiểm tra An toàn Đơn thuốc)
        </h3>

        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800/80">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
            Bệnh nhân đang chỉ định:
          </span>
          <span className="text-xs font-black text-slate-900 dark:text-slate-100 mt-0.5 block">
            {patientName}
          </span>
          
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[10px] text-slate-500 font-bold">Tiền sử dị ứng:</span>
            {patientAllergies.length > 0 ? (
              patientAllergies.map((alg) => (
                <span
                  key={alg}
                  className="text-[9px] font-black px-2 py-0.5 bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 rounded-full border border-rose-200/60 dark:border-rose-900/50"
                >
                  ⚠️ {alg.toUpperCase()}
                </span>
              ))
            ) : (
              <span className="text-[9px] font-extrabold px-2 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 rounded-full">
                Không có dị ứng ghi nhận
              </span>
            )}
          </div>
        </div>

        {/* Drug Picker */}
        <div className="space-y-2">
          <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
            Chọn đơn thuốc dự kiến:
          </label>
          <div className="flex flex-col gap-2">
            {availableDrugs.map((drug) => {
              const selected = selectedDrugs.includes(drug.code);
              return (
                <div
                  key={drug.code}
                  onClick={() => handleToggleDrug(drug.code)}
                  className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer select-none transition-all ${
                    selected
                      ? 'bg-cyan-50/60 border-cyan-500 dark:bg-cyan-950/30 ring-1 ring-cyan-500/20'
                      : 'bg-white dark:bg-slate-900/80 border-slate-200/80 hover:border-slate-300 dark:border-slate-800'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {drug.label}
                  </span>
                  <div className={`w-4 h-4 rounded-lg border flex items-center justify-center transition-colors ${
                    selected ? 'bg-cyan-600 border-cyan-600 text-white' : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {selected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Check Action */}
        <button
          onClick={handleCheckSafety}
          disabled={isCheckingSafety || selectedDrugs.length === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50 active:scale-95"
        >
          <span>Check an toàn lâm sàng (CDSS Engine)</span>
        </button>

        {/* Check Result Display */}
        {checkResult.status !== 'unchecked' && (
          <div className={`p-4 rounded-2xl border flex items-start gap-3 shadow-md ${
            checkResult.status === 'blocked'
              ? 'bg-rose-50/90 border-rose-300 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/60 dark:text-rose-300'
              : checkResult.status === 'warning'
              ? 'bg-amber-50/90 border-amber-300 text-amber-800 dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-300'
              : 'bg-emerald-50/90 border-emerald-300 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/60 dark:text-emerald-300'
          }`}>
            {checkResult.status === 'safe' ? (
              <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <h4 className="text-xs font-black uppercase tracking-wider">
                {checkResult.status === 'blocked' ? 'Khóa kê đơn tuyệt đối' : checkResult.status === 'warning' ? 'Cảnh báo tương tác' : 'Kê đơn an toàn'}
              </h4>
              {checkResult.messages.map((m, idx) => (
                <p key={idx} className="text-xs font-medium leading-relaxed">{m}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

