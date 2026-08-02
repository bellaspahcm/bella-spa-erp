'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCachedCurrentUser, getCachedTenantSettings } from '@/lib/dashboard-client-context';
import { resolveTenantBrandIdentity } from '@/lib/business-rules/tenant-modules';
import { WorkforceBottomNav } from './components/WorkforceBottomNav';
import { toast } from 'sonner';

async function applyWorkforceBrandRuntime(tenantSettings?: any) {
  const tenant = tenantSettings ?? await getCachedTenantSettings();
  if (!tenant || typeof document === 'undefined') return;

  const brand = resolveTenantBrandIdentity({
    enabledModules: tenant.enabled_modules,
    brandTheme: tenant.brand_theme,
    logoUrl: tenant.logo_url,
    tenantName: tenant.name,
    surface: 'app',
  });
  
  const root = document.documentElement;
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  root.dataset.tenantModule = brand.moduleKey;
  root.dataset.tenantBrandButton = brand.buttonStyle;
  root.dataset.tenantBrandMenu = brand.menuStyle;
  root.dataset.tenantBrandRadius = brand.radiusStyle;
  root.dataset.tenantBrandPreset = brand.stylePreset || 'graphite_luxe';

  document.title = `Workforce Portal — ${tenant.name}`;

  for (const token of ['--background', '--foreground', '--border', '--input']) {
    root.style.removeProperty(token);
  }

  root.style.setProperty('--primary', brand.primaryColor);
  root.style.setProperty('--primary-hover', brand.primaryHoverColor);
  root.style.setProperty('--accent', brand.accentColor);
  root.style.setProperty('--ring', brand.primaryColor);
  
  root.style.setProperty(
    '--font-heading',
    brand.fontHeading === 'serif'
      ? 'var(--font-serif), Georgia, serif'
      : 'var(--font-sans), system-ui, sans-serif',
  );
  themeMeta?.setAttribute('content', brand.primaryColor);
}

export default function WorkforceLayout({
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
        const tenantWarmupPromise = getCachedTenantSettings().catch(() => null);
        const user = await getCachedCurrentUser();
        
        if (!user) {
          router.replace('/login');
          return;
        }

        if (user.isSuspended) {
          setIsSuspended(true);
          setIsAuthorized(false);
          return;
        }

        // Allowed roles: sale, ktv_lead, admin_staff, admin, hr, accountant, ktv
        const allowedRoles = ['sale', 'ktv_lead', 'admin_staff', 'admin', 'hr', 'accountant', 'ktv'];
        const userRole = user.role?.toLowerCase() || '';
        
        if (!allowedRoles.includes(userRole)) {
          toast.error('Tài khoản của bạn không có quyền truy cập Workforce Portal');
          router.replace('/login');
          return;
        }

        const tenant = await tenantWarmupPromise;
        await applyWorkforceBrandRuntime(tenant ?? undefined);
        setIsAuthorized(true);
      } catch (err) {
        console.error('[WorkforceLayout] Auth check failed:', err);
        router.replace('/login');
      }
    }
    checkAuth();
  }, [router]);

  if (isSuspended) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 text-center">
        <div className="max-w-md bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">Chi nhánh tạm ngưng</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Tài khoản của bạn hiện đã bị tạm ngưng hoạt động bởi tổng bộ HQ. Vui lòng liên hệ bộ phận hỗ trợ khách hàng để biết thêm chi tiết.
          </p>
        </div>
      </div>
    );
  }

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-300 border-t-primary rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest animate-pulse">Đang kết nối...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20">
      <div className="max-w-lg mx-auto bg-white dark:bg-slate-900 min-h-screen shadow-lg relative border-x border-slate-100 dark:border-slate-800">
        {children}
        <WorkforceBottomNav />
      </div>
    </div>
  );
}
