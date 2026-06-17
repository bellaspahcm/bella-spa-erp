'use client';

import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { changeStudentPassword } from '@/services/training-actions';

export function StudentChangePasswordForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const cleanPassword = password.trim();
    if (cleanPassword.length < 6) {
      setMessage({ type: 'error', text: 'Mật khẩu mới phải chứa ít nhất 6 ký tự.' });
      return;
    }

    if (cleanPassword !== confirmPassword.trim()) {
      setMessage({ type: 'error', text: 'Xác nhận mật khẩu mới không khớp.' });
      return;
    }

    setIsLoading(true);
    try {
      const res = await changeStudentPassword(cleanPassword);
      if (res.success) {
        setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
        setPassword('');
        setConfirmPassword('');
        setTimeout(() => setIsOpen(false), 2000);
      } else {
        setMessage({ type: 'error', text: res.error || 'Đã xảy ra lỗi khi đổi mật khẩu.' });
      }
    } catch (_err) {
      setMessage({ type: 'error', text: 'Lỗi kết nối hệ thống.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <KeyRound className="h-3 w-3" />
        Đổi mật khẩu
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 mb-3">Đổi mật khẩu</h3>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="password"
            placeholder="Mật khẩu mới"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
            required
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Xác nhận mật khẩu mới"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-100"
            required
          />
        </div>
        {message && (
          <p className={`text-xs font-bold ${message.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
            {message.text}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:bg-slate-300"
          >
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            Lưu
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setMessage(null);
              setPassword('');
              setConfirmPassword('');
            }}
            disabled={isLoading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Hủy
          </button>
        </div>
      </form>
    </div>
  );
}
