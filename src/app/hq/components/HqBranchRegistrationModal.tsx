'use client';

import { motion } from 'framer-motion';
import { Building2, Mail, MapPin, Phone, RefreshCw, ShieldCheck, Sparkles, User, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';

export type HqBranchRegistrationInput = {
  spaName: string;
  contactPhone: string;
  address: string;
  email: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
  branchType: 'owned' | 'franchise';
  businessModule: 'babycare' | 'beauty_spa';
};

interface HqBranchRegistrationModalProps {
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: HqBranchRegistrationInput) => Promise<void>;
}

const emptyForm: HqBranchRegistrationInput = {
  spaName: '',
  contactPhone: '',
  address: '',
  email: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  branchType: 'owned',
  businessModule: 'babycare',
};

export function HqBranchRegistrationModal({
  open,
  submitting,
  onClose,
  onSubmit,
}: HqBranchRegistrationModalProps) {
  const [form, setForm] = useState<HqBranchRegistrationInput>(emptyForm);

  if (!open) return null;

  const updateField = <K extends keyof HqBranchRegistrationInput>(
    key: K,
    value: HqBranchRegistrationInput[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-[#3E3A35] w-full max-w-3xl max-h-[90vh] overflow-y-auto text-left"
      >
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 px-8 py-6 text-white flex justify-between items-center sticky top-0 z-10">
          <div>
            <span className="text-[9px] bg-primary/20 text-rose-300 font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-primary/20">
              HQ TENANT ONBOARDING
            </span>
            <h3 className="text-lg font-black uppercase tracking-tight mt-1">Đăng ký chi nhánh mới</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-white disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => updateField('branchType', 'owned')}
              className={`rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                form.branchType === 'owned'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Building2 size={15} />
              Trực thuộc
            </button>
            <button
              type="button"
              onClick={() => updateField('branchType', 'franchise')}
              className={`rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                form.branchType === 'franchise'
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck size={15} />
              Nhượng quyền
            </button>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ngành kinh doanh *</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => updateField('businessModule', 'babycare')}
                className={`rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  form.businessModule === 'babycare'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Building2 size={15} />
                Mother & Baby
              </button>
              <button
                type="button"
                onClick={() => updateField('businessModule', 'beauty_spa')}
                className={`rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  form.businessModule === 'beauty_spa'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                }`}
              >
                <Sparkles size={15} />
                Beauty Spa
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tên chi nhánh *</span>
              <div className="relative">
                <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={form.spaName}
                  onChange={(event) => updateField('spaName', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary"
                  placeholder="Bella Spa Quận 7"
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hotline *</span>
              <div className="relative">
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={form.contactPhone}
                  onChange={(event) => updateField('contactPhone', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary"
                  placeholder="0900000000"
                />
              </div>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Địa chỉ *</span>
              <div className="relative">
                <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={form.address}
                  onChange={(event) => updateField('address', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary"
                  placeholder="Địa chỉ chi nhánh"
                />
              </div>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email chi nhánh *</span>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary"
                  placeholder="branch@bellaspa.vn"
                />
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-5 border-t border-slate-100 dark:border-[#3E3A35]">
            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tên admin *</span>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  value={form.adminName}
                  onChange={(event) => updateField('adminName', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary"
                  placeholder="Admin chi nhánh"
                />
              </div>
            </label>

            <label className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email admin *</span>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="email"
                  value={form.adminEmail}
                  onChange={(event) => updateField('adminEmail', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] pl-11 pr-4 py-3 text-sm font-bold outline-none focus:border-primary"
                  placeholder="admin.branch@bellaspa.vn"
                />
              </div>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mật khẩu tạm thời *</span>
              <input
                required
                minLength={6}
                type="password"
                value={form.adminPassword}
                onChange={(event) => updateField('adminPassword', event.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
                placeholder="Tối thiểu 6 ký tự"
              />
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-5 border-t border-slate-100 dark:border-[#3E3A35]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : null}
              Tạo chi nhánh
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
