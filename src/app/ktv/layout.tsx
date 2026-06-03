import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/services/user-actions';

function SuspendedTenantNotice() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="max-w-md glass-pink rounded-3xl p-8 border-2 border-white shadow-2xl space-y-6">
        <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto text-pink-600 animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-2xl font-black text-foreground uppercase tracking-wide">Chi nhanh tam ngung</h2>
        <p className="text-muted-foreground font-medium">
          Tai khoan Spa cua ban hien da bi tam ngung hoat dong boi Bella Spa HQ.
          Vui long lien he bo phan ho tro khach hang de biet them chi tiet.
        </p>
        <a
          href="/login"
          className="block w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 text-sm uppercase tracking-widest"
        >
          Dang xuat
        </a>
      </div>
    </div>
  );
}

export default async function KtvLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.isSuspended) {
    return <SuspendedTenantNotice />;
  }

  if (user.role?.toLowerCase() !== 'ktv') {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
