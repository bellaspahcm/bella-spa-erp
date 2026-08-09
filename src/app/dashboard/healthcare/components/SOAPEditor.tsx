import React, { useState } from 'react';
import { FileText, Save, HelpCircle, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { updateEncounterSOAPAction } from '@/services/healthcare/healthcare-actions';
import { ClinicalContextType } from './ClinicalContext';

export default function SOAPEditor({ context }: { context: ClinicalContextType }) {
  const { encounter, refreshData } = context;

  const [subjective, setSubjective] = useState(encounter.subjective || '');
  const [objective, setObjective] = useState(encounter.objective || '');
  const [assessment, setAssessment] = useState(encounter.assessment || '');
  const [plan, setPlan] = useState(encounter.plan || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await updateEncounterSOAPAction({
        encounterId: encounter.id,
        soap: {
          subjective,
          objective,
          assessment,
          plan,
        }
      });

      if (res.success) {
        toast.success('🎉 Đã cập nhật Ghi chú SOAP & Chẩn đoán ICD-10 thành công!');
        refreshData();
      } else {
        toast.error('Lỗi lưu EMR SOAP: ' + res.error);
      }
    } catch (err: unknown) {
      toast.error('Lỗi kết nối máy chủ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 rounded-[24px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5 text-left">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-teal-500" />
          Bệnh Án Lâm Sàng EMR SOAP & Khám Bệnh
        </h3>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSaving ? 'Đang lưu...' : 'Lưu SOAP'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="space-y-1">
          <label className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <span className="w-5 h-5 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center font-black">S</span>
            Subjective (Hỏi bệnh & Tiền sử)
          </label>
          <textarea
            rows={3}
            value={subjective}
            onChange={(e) => setSubjective(e.target.value)}
            placeholder="Mô tả triệu chứng bệnh nhân, tiền sử bệnh án, dị ứng..."
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 font-medium text-slate-950 dark:text-white outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="space-y-1">
          <label className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <span className="w-5 h-5 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-black">O</span>
            Objective (Khám thực thể lâm sàng)
          </label>
          <textarea
            rows={3}
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Kết quả thăm khám thực tế của Bác sĩ, nhịp thở, triệu chứng lâm sàng..."
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 font-medium text-slate-950 dark:text-white outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="space-y-1">
          <label className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <span className="w-5 h-5 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center font-black">A</span>
            Assessment (Chẩn đoán & ICD-10)
          </label>
          <input
            type="text"
            value={assessment}
            onChange={(e) => setAssessment(e.target.value)}
            placeholder="Mã ICD-10 hoặc chẩn đoán xác định (Ví dụ: J06.9 - Viêm đường hô hấp trên)"
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 font-bold text-teal-600 outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>

        <div className="space-y-1">
          <label className="font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <span className="w-5 h-5 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center font-black">P</span>
            Plan (Hướng xử trí & Kê đơn)
          </label>
          <textarea
            rows={2}
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            placeholder="Chỉ định Xét nghiệm (LIS), Chẩn đoán hình ảnh (RIS PACS) hoặc dặn dò bệnh nhân..."
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 dark:bg-slate-950 font-medium text-slate-950 dark:text-white outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
      </div>
    </div>
  );
}
