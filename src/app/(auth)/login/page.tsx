'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { getSupabase } from '@/lib/supabase-client';
import { LogIn, Mail, Lock, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      window.location.href = '/dashboard';
    }
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
              Hệ thống quản lý chăm sóc mẹ & bé
            </p>
          </div>

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
              className="w-full bg-primary hover:bg-primary-hover disabled:bg-muted text-white font-black py-5 rounded-2xl shadow-xl shadow-pink-200 transition-all active:scale-95 flex items-center justify-center gap-3 text-lg uppercase tracking-widest"
            >
              {loading ? (
                <Loader2 className="animate-spin w-6 h-6" />
              ) : (
                'Đăng nhập ngay'
              )}
            </button>
          </form>

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
