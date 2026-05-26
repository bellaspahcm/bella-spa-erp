'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase-client';
import { challengeAndVerify, needsMfaChallenge } from '@/lib/mfa';
import { LogIn, Mail, Lock, Loader2, ShieldCheck, Smartphone } from 'lucide-react';

type Stage =
  | { name: 'password' }
  | { name: 'mfa'; code: string };

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState<Stage>({ name: 'password' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalizeLogin = () => {
    if (process.env.NODE_ENV === 'development') {
      document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    }
    window.location.href = '/dashboard';
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabase();

    // DEVELOPMENT BYPASS: dev user with password123 — preserved as-is
    if (process.env.NODE_ENV === 'development' && password === 'password123') {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: 'password123',
      });

      if (!authError && authData?.user) {
        document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        // Still honour MFA in dev if enrolled
        if (await needsMfaChallenge()) {
          setStage({ name: 'mfa', code: '' });
          setLoading(false);
          return;
        }
        window.location.href = '/dashboard';
        return;
      }

      if (email === 'bellaspa.testadmin@gmail.com') {
        document.cookie = `mock_user_email=${email}; path=/; max-age=31536000; SameSite=Lax`;
        window.location.href = '/dashboard';
        return;
      }

      const { data: userExists } = await supabase
        .from('users')
        .select('email, role')
        .eq('email', email)
        .single();

      if (userExists) {
        document.cookie = `mock_user_email=${email}; path=/; max-age=31536000; SameSite=Lax`;
        window.location.href = '/dashboard';
        return;
      }
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Check whether session needs to be upgraded to AAL2 (TOTP)
    if (await needsMfaChallenge()) {
      setStage({ name: 'mfa', code: '' });
      setLoading(false);
      return;
    }

    finalizeLogin();
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stage.name !== 'mfa') return;
    if (!/^\d{6}$/.test(stage.code)) {
      setError('Mã xác minh phải gồm đúng 6 chữ số.');
      return;
    }
    setLoading(true);
    setError(null);
    const result = await challengeAndVerify(stage.code);
    if (!result.ok) {
      setError('Mã không đúng hoặc đã hết hạn: ' + result.error);
      setLoading(false);
      return;
    }
    finalizeLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="relative glass-pink shadow-2xl rounded-[2.5rem] p-8 md:p-12 overflow-hidden border-2 border-white">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-secondary to-primary" />

          <div className="flex flex-col items-center mb-10 text-center">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="mb-6 drop-shadow-xl"
            >
              <img src="/logo.png" alt="Bella Spa" className="h-24 w-auto object-contain" />
            </motion.div>
            <h1 className="text-3xl font-black text-foreground tracking-tight uppercase">
              Bella Spa ERP
            </h1>
            <p className="text-muted-foreground mt-2 font-medium">
              {stage.name === 'mfa'
                ? 'Nhập mã xác minh 2 lớp'
                : 'Hệ thống quản lý chăm sóc mẹ & bé'}
            </p>
          </div>

          {stage.name === 'password' ? (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Email công việc
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                    <Mail size={20} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-12 pr-4 py-4 bg-white/60 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground placeholder:text-muted-foreground/40 font-medium"
                    placeholder="admin@bellaspa.vn"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">
                  Mật khẩu
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors">
                    <Lock size={20} />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-12 pr-4 py-4 bg-white/60 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground placeholder:text-muted-foreground/40 font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-pink-600 text-sm font-bold bg-pink-50 p-4 rounded-2xl border border-pink-100 flex items-center gap-3"
                >
                  <div className="w-2 h-2 bg-pink-600 rounded-full animate-pulse" />
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-hover disabled:bg-muted text-white font-black py-5 rounded-2xl shadow-xl shadow-pink-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3 text-lg uppercase tracking-widest"
              >
                {loading ? (
                  <Loader2 className="animate-spin w-6 h-6" />
                ) : (
                  'Đăng nhập ngay'
                )}
              </button>
            </form>
          ) : (
            /* ─── MFA challenge stage ──────────────────────── */
            <form onSubmit={handleMfaSubmit} className="space-y-6">
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-pink-50 border border-pink-100">
                <Smartphone className="w-6 h-6 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  Mở app authenticator và nhập mã 6 số đang hiển thị.
                </p>
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
                value={stage.code}
                onChange={(e) =>
                  setStage({
                    name: 'mfa',
                    code: e.target.value.replace(/\D/g, '').slice(0, 6),
                  })
                }
                className="block w-full text-center text-3xl font-black tracking-[0.5em] px-4 py-5 bg-white/60 border border-border rounded-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none text-foreground"
                placeholder="000000"
              />

              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-pink-600 text-sm font-bold bg-pink-50 p-4 rounded-2xl border border-pink-100 flex items-center gap-3"
                >
                  <div className="w-2 h-2 bg-pink-600 rounded-full animate-pulse" />
                  {error}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary-hover disabled:bg-muted text-white font-black py-5 rounded-2xl shadow-xl shadow-pink-200 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-3 text-lg uppercase tracking-widest"
              >
                {loading ? (
                  <Loader2 className="animate-spin w-6 h-6" />
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    Xác minh
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={async () => {
                  await getSupabase().auth.signOut();
                  setStage({ name: 'password' });
                  setPassword('');
                  setError(null);
                }}
                className="w-full text-sm font-bold text-muted-foreground hover:text-primary transition-colors"
              >
                Huỷ & đăng nhập lại
              </button>
            </form>
          )}

          <div className="mt-10 pt-6 border-t border-pink-100 flex flex-col items-center gap-4">
            <p className="text-sm text-muted-foreground font-medium">
              Gặp sự cố? <span className="text-primary font-bold cursor-pointer hover:underline">Liên hệ kỹ thuật</span>
            </p>
          </div>
        </div>

        <p className="text-center mt-10 text-muted-foreground/60 text-xs font-bold uppercase tracking-widest">
          &copy; {new Date().getFullYear()} Bella Spa Group
        </p>
      </motion.div>
    </div>
  );
}
