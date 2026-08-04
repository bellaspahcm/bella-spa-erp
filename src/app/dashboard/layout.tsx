'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  DashboardAuthLoadingShell,
  DashboardAuthorizedShell,
} from '@/components/layout/DashboardLoadingShell';
import { resolveTenantBrandIdentity } from '@/lib/business-rules/tenant-modules';
import { getCachedCurrentUser, getCachedTenantSettings } from '@/lib/dashboard-client-context';

const RUNTIME_BRAND_CACHE_KEY = 'bella.runtime.brand.v1';

async function applyDashboardTenantBrandRuntime(
  tenantSettings?: Awaited<ReturnType<typeof getCachedTenantSettings>>,
) {
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
  root.dataset.tenantBrandPreset = brand.stylePreset || (brand.primaryColor === '#074E44' ? 'jade_wellness' : brand.primaryColor === '#1E3A8A' ? 'luxury_navy' : brand.primaryColor === '#1E40AF' ? 'ocean_clean' : brand.primaryColor === '#18181B' ? 'graphite_luxe' : 'bella_rose');

  // Dynamically set browser title to match current tenant & module identity
  if (brand.displayName) {
    document.title = `${brand.displayName} — ${brand.subtitle}`;
  }

  for (const token of ['--background', '--foreground', '--border', '--input']) {
    root.style.removeProperty(token);
  }

  root.style.setProperty('--primary', brand.primaryColor);
  root.style.setProperty('--primary-hover', brand.primaryHoverColor);
  root.style.setProperty('--accent', brand.accentColor);
  root.style.setProperty('--ring', brand.primaryColor);
  // Inject tenant heading font: 'serif' → Playfair Display, 'sans' → Geist
  root.style.setProperty(
    '--font-heading',
    brand.fontHeading === 'serif'
      ? 'var(--font-serif), Georgia, serif'
      : 'var(--font-sans), system-ui, sans-serif',
  );
  themeMeta?.setAttribute('content', brand.primaryColor);

  try {
    window.sessionStorage.setItem(
      RUNTIME_BRAND_CACHE_KEY,
      JSON.stringify({
        tenantId: tenant.id,
        ...brand,
      }),
    );
  } catch {
    // Runtime cache only prevents first-paint theme flashes.
  }
}

import { UserProvider } from '@/lib/user-context';

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
        // ── Warm-up: kick off tenant settings fetch in PARALLEL with auth check ──
        // By the time any child page mounts and calls getCachedTenantSettings(),
        // the value is already cached — eliminating a cold round-trip for every page.
        const tenantWarmupPromise = getCachedTenantSettings().catch((e) => {
          console.warn('[DashboardLayout] Tenant settings warm-up failed (non-fatal):', e);
          return null;
        });

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
        if (user.role?.toLowerCase() === 'ktv') {
          router.replace('/ktv/dashboard');
          return;
        }
        try {
          // Reuse the already-in-flight tenant settings promise (no extra fetch)
          const tenant = await tenantWarmupPromise;
          
          // ── Auto-upgrade legacy theme colors ──
          if (tenant) {
            const { needsThemeUpgrade, upgradeTheme, getUpgradeDescription } = await import('@/lib/utils/theme-upgrade');
            const { getDefaultTenantModuleKey } = await import('@/lib/business-rules/tenant-modules');
            
            const moduleKey = getDefaultTenantModuleKey(tenant.enabled_modules, tenant.name);
            
            if (needsThemeUpgrade(tenant.brand_theme as Record<string, unknown> | null, moduleKey)) {
              console.log(`[ThemeUpgrade] 🎨 Detected legacy theme for ${moduleKey}, upgrading...`);
              
              const result = await upgradeTheme(tenant.id, moduleKey);
              
              if (result.success && result.upgraded) {
                console.log(`[ThemeUpgrade] ✅ ${getUpgradeDescription(moduleKey)}`);
                
                // Show toast notification (optional - only if toast context available)
                type WindowWithToast = Window & { showToast?: (opts: { title: string; description: string; variant: string }) => void };
                if (typeof window !== 'undefined' && (window as WindowWithToast).showToast) {
                  (window as WindowWithToast).showToast({
                    title: 'Cập nhật giao diện',
                    description: getUpgradeDescription(moduleKey),
                    variant: 'success',
                  });
                }
                
                // Force reload tenant settings to get updated theme
                await getCachedTenantSettings.cache?.delete?.(getCachedTenantSettings);
                const updatedTenant = await getCachedTenantSettings().catch(() => tenant);
                await applyDashboardTenantBrandRuntime(updatedTenant ?? undefined);
              } else {
                await applyDashboardTenantBrandRuntime(tenant);
              }
            } else {
              await applyDashboardTenantBrandRuntime(tenant);
            }
          }
        } catch (brandError) {
          console.error('[DashboardLayout] Brand runtime apply failed:', brandError);
        }
        setIsAuthorized(true);
      } catch (err) {
        console.error('[DashboardLayout] Auth check failed:', err);
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
            Tài khoản của bạn hiện đã bị tạm ngưng hoạt động bởi tổng bộ HQ. Vui lòng liên hệ bộ phận hỗ trợ khách hàng để biết thêm chi tiết.
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
    return <DashboardAuthLoadingShell />;
  }

  return (
    <UserProvider>
      <DashboardAuthorizedShell>
        {children}
      </DashboardAuthorizedShell>
    </UserProvider>
  );
}

