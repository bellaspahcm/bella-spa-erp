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
    { code: 'J01CA04', label: 'Amoxicillin 500mg' },
    { code: 'J01CR02', label: 'Augmentin 625mg' },
    { code: 'M01AE01', label: 'Ibuprofen 400mg' },
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
      toast.success('✨ AI đã cấu trúc hóa SOAP Note thành công');
    }, 1500);
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

  return (
    <div className="flex flex-col gap-6 p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 shadow-sm">
      {/* SOAP Note Generator Panel */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-teal-600" />
          Trợ lý AI SOAP Note (Nhận diện giọng nói/Ghi chú thô)
        </h3>
        
        <textarea
          value={rawNotes}
          onChange={(e) => setRawNotes(e.target.value)}
          placeholder="Nhập ghi chú thô của bác sĩ (ví dụ: bệnh nhân đau răng 36 khi ăn đồ nóng lạnh, đau nhiều tối qua, khám thấy sâu sâu sát tủy...)"
          className="w-full min-h-[80px] p-3 text-xs rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 dark:bg-slate-900 dark:border-slate-800 dark:text-white"
        />

        <button
          onClick={handleGenerateSoap}
          disabled={isGeneratingSoap}
          className="w-full flex items-center justify-center gap-2 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition-all"
        >
          <Brain className={`w-4 h-4 ${isGeneratingSoap ? 'animate-bounce' : ''}`} />
          {isGeneratingSoap ? 'AI đang phân tích...' : 'Cấu trúc hóa SOAP Note'}
        </button>

        {soapNote && (
          <div className="p-4 rounded-xl bg-teal-50/40 dark:bg-teal-950/10 border border-teal-100 dark:border-teal-900/50 space-y-3 text-left">
            <h4 className="text-xs font-bold text-teal-800 dark:text-teal-400">Kết quả SOAP Note:</h4>
            
            <div className="space-y-2 text-[11px] leading-relaxed text-slate-700 dark:text-slate-300">
              <div>
                <span className="font-extrabold text-teal-700 dark:text-teal-400">S (Subjective):</span> {soapNote.s}
              </div>
              <div>
                <span className="font-extrabold text-teal-700 dark:text-teal-400">O (Objective):</span> {soapNote.o}
              </div>
              <div>
                <span className="font-extrabold text-teal-700 dark:text-teal-400">A (Assessment):</span> {soapNote.a}
              </div>
              <div>
                <span className="font-extrabold text-teal-700 dark:text-teal-400">P (Plan):</span>
                <p className="whitespace-pre-line mt-0.5">{soapNote.p}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <hr className="border-slate-100 dark:border-slate-800" />

      {/* Clinical Decision Support System (CDSS) - Safety Check */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          <Brain className="w-4 h-4 text-cyan-600" />
          Hệ thống CDSS (Kiểm tra an toàn đơn thuốc)
        </h3>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-left">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Bệnh nhân đang chọn:
          </span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
            {patientName}
          </span>
          
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-[10px] text-slate-500 font-semibold">Tiền sử dị ứng:</span>
            {patientAllergies.length > 0 ? (
              patientAllergies.map((alg) => (
                <span
                  key={alg}
                  className="text-[9px] font-bold px-2 py-0.5 bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-400 rounded-full border border-rose-100 dark:border-rose-900/50"
                >
                  ⚠️ {alg.toUpperCase()}
                </span>
              ))
            ) : (
              <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 rounded-full">
                Không dị ứng
              </span>
            )}
          </div>
        </div>

        {/* Drug Picker */}
        <div className="space-y-2 text-left">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Chọn thuốc kê đơn dự kiến:
          </label>
          <div className="flex flex-col gap-2">
            {availableDrugs.map((drug) => {
              const selected = selectedDrugs.includes(drug.code);
              return (
                <div
                  key={drug.code}
                  onClick={() => handleToggleDrug(drug.code)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                    selected
                      ? 'bg-cyan-50/50 border-cyan-500 dark:bg-cyan-950/20'
                      : 'bg-white border-slate-200/80 hover:border-slate-300 dark:bg-slate-950 dark:border-slate-800/80'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {drug.label}
                  </span>
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                    selected ? 'bg-cyan-500 border-cyan-500 text-white' : 'border-slate-300'
                  }`}>
                    {selected && <Check className="w-3 h-3" />}
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
          className="w-full flex items-center justify-center gap-2 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl transition-all disabled:opacity-50"
        >
          Check an toàn lâm sàng (CDSS)
        </button>

        {/* Check Result Display */}
        {checkResult.status !== 'unchecked' && (
          <div className={`p-4 rounded-xl border text-left flex items-start gap-3 ${
            checkResult.status === 'blocked'
              ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/50 dark:text-rose-400'
              : checkResult.status === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400'
          }`}>
            {checkResult.status === 'safe' ? (
              <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0" />
            )}
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider">
                {checkResult.status === 'blocked' ? 'Khóa kê đơn' : checkResult.status === 'warning' ? 'Cảnh báo' : 'An toàn'}
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
