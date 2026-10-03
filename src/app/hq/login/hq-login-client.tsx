'use client';

import { FormEvent, useState } from 'react';
import { AlertTriangle, Building2, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { getSupabase } from '@/lib/supabase-client';
import { verifyHqLogin } from '@/services/hq-login-actions';

export default function HqLoginClient() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    const verified = await verifyHqLogin();

    if (!verified.success) {
      await supabase.auth.signOut();
      setError(verified.error || 'Tài khoản này không có quyền truy cập Tổng bộ.');
      setLoading(false);
      return;
    }

    window.location.assign('/hq');
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10">
        <section className="grid w-full gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-slate-500 shadow-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Bella HQ Portal
            </div>

            <div className="max-w-2xl space-y-5">
              <h1 className="text-4xl font-black tracking-normal text-slate-950 sm:text-5xl">
                Đăng nhập Tổng bộ
              </h1>
              <p className="text-base font-medium leading-8 text-slate-600">
                Khu vực quản trị cấp hệ thống cho điều hành mạng lưới chi nhánh Bella.
              </p>
            </div>

            <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <Building2 className="mb-3 h-5 w-5 text-sky-600" />
                <p className="text-sm font-black text-slate-900">Network Console</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">Chi nhánh, gói dịch vụ và vận hành liên cơ sở.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <ShieldCheck className="mb-3 h-5 w-5 text-emerald-600" />
                <p className="text-sm font-black text-slate-900">Executive Access</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">Báo cáo hợp nhất và kiểm soát Tổng bộ.</p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/70"
          >
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Secure Access</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">HQ Admin</h2>
            </div>

            {error && (
              <div className="mb-5 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Email HQ
                </span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    autoComplete="email"
                    className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    placeholder="hq-admin@bella.vn"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  Mật khẩu
                </span>
                <span className="relative block">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    autoComplete="current-password"
                    className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-sky-500 focus:bg-white focus:ring-4 focus:ring-sky-100"
                    placeholder="********"
                  />
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Vào Tổng bộ
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
