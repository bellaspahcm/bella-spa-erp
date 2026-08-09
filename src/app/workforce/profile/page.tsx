'use client';

import { useState, useEffect } from 'react';
import { 
  User, Shield, Key, LogOut, Laptop, Smartphone, Eye, EyeOff,
  ChevronLeft, Loader2, CheckCircle2, ChevronRight, Lock
} from 'lucide-react';
import { getCachedCurrentUser, getCachedTenantSettings } from '@/lib/dashboard-client-context';

type CurrentUser = Awaited<ReturnType<typeof getCachedCurrentUser>>;
type TenantSettings = Awaited<ReturnType<typeof getCachedTenantSettings>>;
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfileAndSecurity() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser>(null);
  const [tenant, setTenant] = useState<TenantSettings>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Password state
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdShowing, setPwdShowing] = useState(false);
  const [isChangingPwd, setIsChangingPwd] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const [u, t] = await Promise.all([
          getCachedCurrentUser(),
          getCachedTenantSettings()
        ]);
        setUser(u);
        setTenant(t);
      } catch (err: unknown) {
        toast.error('Lỗi khi tải thông tin cá nhân');
      } finally {
        setIsLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdNew !== pwdConfirm) {
      toast.error('Mật khẩu mới và xác nhận không khớp');
      return;
    }
    if (pwdNew.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    setIsChangingPwd(true);
    const supabase = createClient();
    try {
      const { data: { user: authUser }, error: getUserErr } = await supabase.auth.getUser();
      if (getUserErr || !authUser?.email) {
        toast.error('Lỗi phiên đăng nhập. Vui lòng thử lại.');
        return;
      }

      // Verify current password by signing in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: authUser.email,
        password: pwdCurrent,
      });
      if (signInErr) {
        toast.error('Mật khẩu hiện tại không đúng');
        return;
      }

      // Update password
      const { error: updateErr } = await supabase.auth.updateUser({ password: pwdNew });
      if (updateErr) {
        toast.error('Đổi mật khẩu thất bại: ' + updateErr.message);
        return;
      }

      toast.success('Đổi mật khẩu thành công!');
      setPwdCurrent('');
      setPwdNew('');
      setPwdConfirm('');
    } catch (err: unknown) {
      toast.error('Có lỗi xảy ra trong quá trình đổi mật khẩu');
    } finally {
      setIsChangingPwd(false);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn đăng xuất?')) return;
    try {
      // Clear cookie if in dev bypass
      if (process.env.NODE_ENV === 'development') {
        document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      }
      
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success('Đăng xuất thành công');
      router.push('/login');
    } catch (err: unknown) {
      router.push('/login');
    }
  };

  if (isLoading || !user) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-20 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
        <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/workforce/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Cá nhân & Bảo mật</h2>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center font-black text-primary text-lg border-2 border-primary/20">
            {user.full_name?.charAt(0) || 'U'}
          </div>
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 leading-snug">{user.full_name}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{user.role}</p>
            <p className="text-[10px] text-slate-500 font-medium">{user.email}</p>
          </div>
        </div>

        {/* Workspace Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-3">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-450">Chi nhánh / Workspace</h4>
          <div className="flex items-center justify-between py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold text-xs">
                W
              </div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-350">{tenant?.name || 'Văn phòng Trung tâm'}</span>
            </div>
            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-100">
              Đang hoạt động
            </span>
          </div>
        </div>

        {/* Change Password Form */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-450 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-primary" /> Đổi mật khẩu
          </h4>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Mật khẩu hiện tại</label>
              <div className="relative">
                <input
                  type={pwdShowing ? 'text' : 'password'}
                  required
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="button"
                  onClick={() => setPwdShowing(!pwdShowing)}
                  className="absolute right-4 top-3.5 text-slate-450"
                >
                  {pwdShowing ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Mật khẩu mới</label>
              <input
                type={pwdShowing ? 'text' : 'password'}
                required
                value={pwdNew}
                onChange={(e) => setPwdNew(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Xác nhận mật khẩu mới</label>
              <input
                type={pwdShowing ? 'text' : 'password'}
                required
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-750 rounded-2xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPwd || !pwdCurrent || !pwdNew || !pwdConfirm}
              className="w-full bg-primary hover:bg-primary-hover text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isChangingPwd && <Loader2 className="w-4 h-4 animate-spin" />}
              Cập nhật mật khẩu
            </button>
          </form>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleLogout}
          className="w-full bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest border border-rose-100 dark:border-rose-900/30 transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <LogOut className="w-4 h-4" /> Đăng xuất tài khoản
        </button>
      </div>
    </div>
  );
}
