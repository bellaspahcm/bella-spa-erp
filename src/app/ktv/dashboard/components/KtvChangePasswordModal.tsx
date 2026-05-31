'use client';

import type { FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, RefreshCw, X } from 'lucide-react';

type KtvChangePasswordModalProps = {
  isOpen: boolean;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  isPasswordVisible: boolean;
  isChangingPassword: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onTogglePasswordVisibility: () => void;
};

export function KtvChangePasswordModal({
  isOpen,
  currentPassword,
  newPassword,
  confirmPassword,
  isPasswordVisible,
  isChangingPassword,
  onClose,
  onSubmit,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onTogglePasswordVisibility,
}: KtvChangePasswordModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!isChangingPassword) {
                onClose();
              }
            }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
          />
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[101] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="bg-white rounded-[32px] p-6 w-full max-w-sm shadow-2xl border border-slate-100 pointer-events-auto relative"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 rounded-t-[32px]" />

              <button
                onClick={onClose}
                disabled={isChangingPassword}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center text-slate-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mt-4 flex flex-col items-center text-center mb-6">
                <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 shadow-md bg-rose-100 text-rose-600 border border-rose-200/50 shadow-rose-100">
                  <KeyRound className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-slate-900 leading-tight mb-1">Đổi mật khẩu</h3>
                <p className="text-[11px] text-slate-400 font-medium">Nhập mật khẩu hiện tại để xác nhận, rồi đặt mật khẩu mới.</p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Lock className="w-3 h-3" /> Mật khẩu hiện tại
                  </label>
                  <div className="relative">
                    <input
                      type={isPasswordVisible ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(event) => onCurrentPasswordChange(event.target.value)}
                      autoComplete="current-password"
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 pr-10 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={onTogglePasswordVisibility}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <KeyRound className="w-3 h-3" /> Mật khẩu mới (tối thiểu 6 ký tự)
                  </label>
                  <input
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => onNewPasswordChange(event.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Xác nhận mật khẩu mới
                  </label>
                  <input
                    type={isPasswordVisible ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => onConfirmPasswordChange(event.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
                    placeholder="••••••••"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-rose-100 mt-2"
                >
                  {isChangingPassword ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Đang cập nhật...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Xác nhận đổi mật khẩu
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
