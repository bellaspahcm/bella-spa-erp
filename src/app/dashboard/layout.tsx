'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { getCurrentUser } from '@/services/user-actions';
import { Loader2 } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isSuspended, setIsSuspended] = useState<boolean>(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await getCurrentUser();
        if (!user) {
          router.replace('/login');
          return;
        }
        if (user.isSuspended) {
          setIsSuspended(true);
          setIsAuthorized(false);
          return;
        }
        if (user.role?.toLowerCase() === 'ktv') {
          router.replace('/ktv/dashboard');
          return;
        }
        setIsAuthorized(true);
      } catch (err) {
        console.error('Auth error in dashboard layout:', err);
        router.replace('/login');
      }
    }
    checkAuth();
  }, [router]);

  if (isSuspended) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-4 text-center">
        <div className="max-w-md glass-pink rounded-3xl p-8 border-2 border-white shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto text-pink-600 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-foreground uppercase tracking-wide">Chi nhánh tạm ngưng</h2>
          <p className="text-muted-foreground font-medium">
            Tài khoản Spa của bạn hiện đã bị tạm ngưng hoạt động bởi tổng bộ Bella Spa HQ. Vui lòng liên hệ bộ phận hỗ trợ khách hàng để biết thêm chi tiết.
          </p>
          <button
            onClick={() => {
              document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
              // Logout from supabase auth too
              import('@/lib/supabase-client').then(m => {
                const s = m.getSupabase();
                s.auth.signOut().then(() => {
                  window.location.href = '/login';
                });
              }).catch(() => {
                window.location.href = '/login';
              });
            }}
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 text-sm uppercase tracking-widest"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  if (isAuthorized === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
}

