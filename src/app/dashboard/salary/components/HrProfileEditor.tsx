'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { adminUpdateKtvHrProfile } from '@/services/attendance-actions';
import { toast } from 'sonner';
import { KtvSalaryRecord } from '@/types/domain';

interface HrProfileEditorProps {
  isOpen: boolean;
  onClose: () => void;
  hrKtvProfile: KtvSalaryRecord | null;
  onSaveSuccess: () => void;
}

export default function HrProfileEditor({
  isOpen,
  onClose,
  hrKtvProfile,
  onSaveSuccess,
}: HrProfileEditorProps) {
  const [hrBaseSalary, setHrBaseSalary] = useState(0);
  const [hrHireDate, setHrHireDate] = useState('');
  const [hrResignDate, setHrResignDate] = useState('');
  const [hrStatus, setHrStatus] = useState('active');
  const [isHrSaving, setIsHrSaving] = useState(false);

  useEffect(() => {
    if (hrKtvProfile) {
      setHrBaseSalary(hrKtvProfile.baseSalary);
      setHrHireDate(hrKtvProfile.hireDate || '');
      setHrResignDate(hrKtvProfile.resignationDate || '');
      setHrStatus(hrKtvProfile.status || 'active');
    }
  }, [hrKtvProfile]);

  if (!isOpen || !hrKtvProfile) return null;

  const handleSaveHrProfile = async () => {
    setIsHrSaving(true);
    const res = await adminUpdateKtvHrProfile(hrKtvProfile.id, {
      base_salary: hrBaseSalary,
      hire_date: hrHireDate || null,
      resignation_date: hrResignDate || null,
      status: hrStatus,
    });

    if (res.success) {
      toast.success('Cập nhật thông tin nhân sự thành công!');
      onSaveSuccess();
      onClose();
    } else {
      toast.error('Lỗi: ' + res.error);
    }
    setIsHrSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[32px] w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-8">
          <h3 className="text-2xl font-black text-slate-900 mb-6">Thiết lập nhân sự (HR)</h3>
          <p className="text-slate-500 font-bold text-sm mb-6">
            Hồ sơ kỹ thuật viên: <span className="text-primary font-black">{hrKtvProfile.name}</span>
          </p>

          <div className="space-y-5">
            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                Lương cứng cơ bản (Cố định)
              </label>
              <input
                type="number"
                value={hrBaseSalary}
                onChange={(e) => setHrBaseSalary(Number(e.target.value))}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                Ngày nhận việc chính thức
              </label>
              <input
                type="date"
                value={hrHireDate}
                onChange={(e) => setHrHireDate(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                Ngày thôi việc
              </label>
              <input
                type="date"
                value={hrResignDate}
                onChange={(e) => setHrResignDate(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 block">
                Trạng thái nhân sự
              </label>
              <select
                value={hrStatus}
                onChange={(e) => setHrStatus(e.target.value)}
                className="w-full bg-slate-50 border-none rounded-xl px-4 py-3 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <option value="active">Đang làm việc (Active)</option>
                <option value="inactive">Đã nghỉ việc (Inactive)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 bg-white border border-slate-200 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition-all text-sm"
          >
            Hủy bỏ
          </button>
          <button
            onClick={handleSaveHrProfile}
            disabled={isHrSaving}
            className="flex-1 py-4 bg-primary text-white font-black rounded-2xl hover:bg-primary-hover shadow-lg shadow-pink-100 transition-all disabled:opacity-50 text-sm"
          >
            {isHrSaving ? 'Đang lưu...' : 'Lưu thông tin'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
