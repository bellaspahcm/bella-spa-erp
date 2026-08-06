import React, { useState } from 'react';
import { Heart, Save, Edit } from 'lucide-react';
import { toast } from 'sonner';
import { ClinicalContextType } from './ClinicalContext';

export default function VitalSigns({ context }: { context: ClinicalContextType }) {
  const { encounter } = context;

  const [isEditing, setIsEditing] = useState(false);
  const [bp, setBp] = useState('120/80');
  const [hr, setHr] = useState('75');
  const [temp, setTemp] = useState('36.8');
  const [weight, setWeight] = useState('68');

  const handleSave = () => {
    setIsEditing(false);
    toast.success('🎉 Đã cập nhật chỉ số sinh hiệu vào hồ sơ bệnh án!');
  };

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-left">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
          <Heart className="w-4.5 h-4.5 text-rose-500" />
          Dấu Hiệu Sinh Tồn (Vital Signs)
        </h3>
        <button
          onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 rounded-xl transition-all"
        >
          {isEditing ? <Save className="w-3.5 h-3.5" /> : <Edit className="w-3.5 h-3.5" />}
          <span>{isEditing ? 'Lưu sinh hiệu' : 'Sửa sinh hiệu'}</span>
        </button>
      </div>

      {isEditing ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-rose-700 uppercase">Huyết áp (mmHg)</label>
            <input
              type="text"
              value={bp}
              onChange={(e) => setBp(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-rose-200 dark:border-slate-800 dark:bg-slate-950 outline-none focus:border-rose-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-rose-700 uppercase">Nhịp tim (lần/phút)</label>
            <input
              type="number"
              value={hr}
              onChange={(e) => setHr(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-rose-200 dark:border-slate-800 dark:bg-slate-950 outline-none focus:border-rose-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-rose-700 uppercase">Nhiệt độ (°C)</label>
            <input
              type="number"
              step="0.1"
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-rose-200 dark:border-slate-800 dark:bg-slate-950 outline-none focus:border-rose-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-rose-700 uppercase">Cân nặng (kg)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-rose-200 dark:border-slate-800 dark:bg-slate-950 outline-none focus:border-rose-500"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950">
            <p className="text-slate-500 font-semibold mb-1">Huyết áp</p>
            <p className="text-sm font-black text-slate-900 dark:text-white">{bp} <span className="text-[10px] text-slate-400">mmHg</span></p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950">
            <p className="text-slate-500 font-semibold mb-1">Nhịp tim</p>
            <p className="text-sm font-black text-slate-900 dark:text-white">{hr} <span className="text-[10px] text-slate-400">bpm</span></p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950">
            <p className="text-slate-500 font-semibold mb-1">Nhiệt độ</p>
            <p className="text-sm font-black text-slate-900 dark:text-white">{temp} <span className="text-[10px] text-slate-400">°C</span></p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950">
            <p className="text-slate-500 font-semibold mb-1">Cân nặng</p>
            <p className="text-sm font-black text-slate-900 dark:text-white">{weight} <span className="text-[10px] text-slate-400">kg</span></p>
          </div>
        </div>
      )}
    </div>
  );
}
