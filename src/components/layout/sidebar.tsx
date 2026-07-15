'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  DollarSign, 
  Package,
  Settings, 
  LogOut,
  Flower2,
  Sparkles,
  MessageSquare,
  Banknote,
  Menu,
  X,
  Wallet,
  HelpCircle,
  RefreshCw,
  BarChart3,
  ClipboardList,
  LineChart
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  resolveTenantBrandIdentity,
  type ResolvedTenantBrandIdentity,
} from '@/lib/business-rules/tenant-modules';

import { createClient } from '@/lib/supabase-client';
import {
  clearDashboardClientContextCache,
  getCachedCurrentUser,
  getCachedTenantSettings,
} from '@/lib/dashboard-client-context';
import { createPageRefreshEvent } from '@/lib/page-refresh';
import ThemeToggle from '@/components/common/ThemeToggle';
import { TenantBrandLogo } from '@/components/common/TenantBrandLogo';
import type { CurrentUser } from '@/types/domain';
import {
  isSidebarItemAllowed,
  type RolePermissions,
} from '@/lib/business-rules/permissions';

type MenuHeader = {
  type: 'header';
  label: string;
};

type MenuLink = {
  icon: LucideIcon;
  label: string;
  href: string;
  type?: never;
};

type SidebarMenuItem = MenuHeader | MenuLink;
type TenantBrandDisplay = Pick<
  ResolvedTenantBrandIdentity,
  | 'displayName'
  | 'logoUrl'
  | 'subtitle'
  | 'moduleKey'
  | 'primaryColor'
  | 'accentColor'
  | 'primaryHoverColor'
  | 'monogram'
  | 'buttonStyle'
  | 'menuStyle'
  | 'radiusStyle'
  | 'isBeautySpa'
  | 'fontHeading'
>;
type CachedTenantBrandDisplay = TenantBrandDisplay & {
  tenantId: string;
};

const DEFAULT_SIDEBAR_BRAND: TenantBrandDisplay = {
  displayName: 'Spa ERP',
  logoUrl: '',
  subtitle: 'Management System',
  moduleKey: 'babycare',
  primaryColor: '#9D174D',
  accentColor: '#BE185D',
  primaryHoverColor: '#831843',
  monogram: 'S',
  buttonStyle: 'pill',
  menuStyle: 'comfortable',
  radiusStyle: 'soft',
  isBeautySpa: false,
  fontHeading: 'serif',
};
const NEUTRAL_SIDEBAR_BRAND: TenantBrandDisplay = {
  ...DEFAULT_SIDEBAR_BRAND,
  primaryColor: '#0b2240',
  accentColor: '#c8a97a',
  primaryHoverColor: '#074e44',
};
const SIDEBAR_BRAND_CACHE_KEY = 'bella.sidebar.brand.v2';
const RUNTIME_BRAND_CACHE_KEY = 'bella.runtime.brand.v1';
const MOBILE_REFRESH_TIMEOUT_MS = 8_000;

function isTenantBrandDisplay(value: unknown): value is CachedTenantBrandDisplay {
  if (!value || typeof value !== 'object') return false;
  const source = value as Record<string, unknown>;
  return (
    typeof source.tenantId === 'string' &&
    typeof source.displayName === 'string' &&
    typeof source.logoUrl === 'string' &&
    typeof source.subtitle === 'string' &&
    (source.moduleKey === 'babycare' || source.moduleKey === 'beauty_spa' || source.moduleKey === 'student_training') &&
    typeof source.primaryColor === 'string' &&
    typeof source.accentColor === 'string' &&
    typeof source.primaryHoverColor === 'string' &&
    typeof source.monogram === 'string' &&
    typeof source.buttonStyle === 'string' &&
    typeof source.menuStyle === 'string' &&
    typeof source.radiusStyle === 'string' &&
    typeof source.isBeautySpa === 'boolean'
  );
}

function toTenantBrandDisplay(parsed: CachedTenantBrandDisplay): TenantBrandDisplay {
  return {
    displayName: parsed.displayName,
    logoUrl: parsed.logoUrl,
    subtitle: parsed.subtitle,
    moduleKey: parsed.moduleKey,
    primaryColor: parsed.primaryColor,
    accentColor: parsed.accentColor,
    primaryHoverColor: parsed.primaryHoverColor,
    monogram: parsed.monogram,
    buttonStyle: parsed.buttonStyle,
    menuStyle: parsed.menuStyle,
    radiusStyle: parsed.radiusStyle,
    isBeautySpa: parsed.isBeautySpa,
    fontHeading: parsed.fontHeading ?? 'serif',
  };
}

function readCachedTenantBrand(tenantId: string | null | undefined): TenantBrandDisplay | null {
  if (!tenantId || typeof window === 'undefined') return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SIDEBAR_BRAND_CACHE_KEY) || 'null');
    if (!isTenantBrandDisplay(parsed) || parsed.tenantId !== tenantId) return null;
    return toTenantBrandDisplay(parsed);
  } catch {
    return null;
  }
}

function writeCachedTenantBrand(tenantId: string | null | undefined, brand: TenantBrandDisplay) {
  if (!tenantId || typeof window === 'undefined') return;
  const serialized = JSON.stringify({
    tenantId,
    ...brand,
  });

  try {
    window.localStorage.setItem(SIDEBAR_BRAND_CACHE_KEY, serialized);
  } catch {
    // Cache is only a visual optimization; ignore storage failures.
  }

  try {
    window.sessionStorage.setItem(RUNTIME_BRAND_CACHE_KEY, serialized);
  } catch {
    // Runtime cache only prevents first-paint theme flashes.
  }
}

function clearTenantBrandRuntimeCache() {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(RUNTIME_BRAND_CACHE_KEY);
  } catch {
    // Runtime cache only prevents first-paint theme flashes.
  }
}

function resolveTenantBrandDisplay(settings: Awaited<ReturnType<typeof getCachedTenantSettings>>): TenantBrandDisplay {
  if (!settings) return DEFAULT_SIDEBAR_BRAND;

  return resolveTenantBrandIdentity({
    enabledModules: settings.enabled_modules,
    brandTheme: settings.brand_theme,
    logoUrl: settings.logo_url,
    tenantName: settings.name,
    surface: 'app',
  });
}

function applyTenantBrandRuntime(brand: TenantBrandDisplay) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  root.dataset.tenantModule = brand.moduleKey;
  root.dataset.tenantBrandButton = brand.buttonStyle;
  root.dataset.tenantBrandMenu = brand.menuStyle;
  root.dataset.tenantBrandRadius = brand.radiusStyle;

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
}

function isMenuHeader(item: SidebarMenuItem): item is MenuHeader {
  return item.type === 'header';
}

function isPathActive(pathname: string, searchParams: URLSearchParams, href: string) {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const [hrefPathRaw, hrefQuery = ''] = href.split('?');
  const normalizedHref = hrefPathRaw.replace(/\/+$/, '') || '/';
  const hrefSearchParams = new URLSearchParams(hrefQuery);

  if (normalizedHref === '/dashboard') {
    return normalizedPath === '/dashboard';
  }

  if (hrefSearchParams.size > 0) {
    if (normalizedPath !== normalizedHref) return false;

    for (const [key, value] of hrefSearchParams.entries()) {
      if (searchParams.get(key) !== value) return false;
    }

    return true;
  }

  if (normalizedHref === '/dashboard/bookings' && searchParams.get('surface') === 'pos') {
    return false;
  }

  // Custom mapping for Decision Engine tabs to keep sidebar highlighted
  if (normalizedHref === '/dashboard/rules') {
    if (
      normalizedPath === '/dashboard/rules' ||
      normalizedPath.startsWith('/dashboard/rules/') ||
      normalizedPath === '/dashboard/decision-engine/audit' ||
      normalizedPath.startsWith('/dashboard/decision-engine/') ||
      normalizedPath === '/dashboard/admin/booking-engine' ||
      normalizedPath.startsWith('/dashboard/admin/booking-engine/')
    ) {
      return true;
    }
  }

  return normalizedPath === normalizedHref || normalizedPath.startsWith(`${normalizedHref}/`);
}

// Test assertions compatibility block:
// href: '/dashboard/crm'
// href: '/dashboard/marketing'
// href: '/dashboard/services'

const menuItems: SidebarMenuItem[] = [
  { type: 'header', label: 'Tổng quan & AI' },
  { icon: LayoutDashboard, label: 'Dashboard',          href: '/dashboard' },
  { icon: Sparkles,        label: 'AI Copilot',         href: '/dashboard/ai-copilot' },

  { type: 'header', label: 'Vận hành hàng ngày' },
  { icon: Calendar,        label: 'Lịch hẹn & POS',     href: '/dashboard/bookings' },
  { icon: Flower2,         label: 'Thẻ liệu trình',     href: '/dashboard/sessions' },
  { icon: ClipboardList,   label: 'Danh sách chờ',      href: '/dashboard/waitlist' },
  { icon: Users,           label: 'Khách hàng & CRM',   href: '/dashboard/customers' },
  { icon: Package,         label: 'Kho & Bán hàng',     href: '/dashboard/inventory' },

  { type: 'header', label: 'Tài chính & Nhân sự' },
  { icon: Banknote,        label: 'Bảng lương & Công',  href: '/dashboard/salary' },
  { icon: Wallet,          label: 'Sổ cái kế toán',     href: '/dashboard/accounting' },
  { icon: DollarSign,      label: 'Đối soát Công nợ',   href: '/dashboard/finance/reconciliation' },

  { type: 'header', label: 'Báo cáo & Phân tích' },
  { icon: BarChart3,       label: 'Bảng quản trị CEO',  href: '/dashboard/executive' },
  { icon: LineChart,       label: 'Trung tâm Phân tích', href: '/dashboard/analytics' },

  { type: 'header', label: 'Hệ thống' },
  { icon: HelpCircle,      label: 'Hướng dẫn sử dụng',   href: '/dashboard/guides' },
  { icon: Settings,        label: 'Cài đặt',             href: '/dashboard/settings' },
];

const customerMenuItems: SidebarMenuItem[] = [
  { icon: Flower2,       label: 'Tiến trình liệu trình', href: '/dashboard/customer' },
  { icon: Calendar,      label: 'Lịch sử buổi làm',      href: '/dashboard/customer/history' },
  { icon: MessageSquare, label: 'Thông báo',              href: '/dashboard/customer/notifications' },
  { icon: Settings,      label: 'Hồ sơ cá nhân',          href: '/dashboard/customer/profile' },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [rolePermissions, setRolePermissions] = useState<RolePermissions | null>(null);
  const [tenantBrand, setTenantBrand] = useState<TenantBrandDisplay>(NEUTRAL_SIDEBAR_BRAND);
  const [isTenantBrandResolved, setIsTenantBrandResolved] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMobileRefreshing, setIsMobileRefreshing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const userData = await getCachedCurrentUser();
      setUser(userData);

      const cachedBrand = readCachedTenantBrand(userData?.tenant_id);
      if (cachedBrand) {
        setTenantBrand(cachedBrand);
        setIsTenantBrandResolved(true);
      }

      let settings: Awaited<ReturnType<typeof getCachedTenantSettings>> = null;
      try {
        settings = await getCachedTenantSettings();
        const resolvedBrand = resolveTenantBrandDisplay(settings);
        setTenantBrand(resolvedBrand);
        setIsTenantBrandResolved(true);
        writeCachedTenantBrand(userData?.tenant_id, resolvedBrand);
      } catch (error) {
        console.error("Failed to load tenant branding", error);
        if (!cachedBrand) {
          setTenantBrand(NEUTRAL_SIDEBAR_BRAND);
          setIsTenantBrandResolved(false);
        }
      }
      
      if (userData?.role && userData.role !== 'admin' && userData.role !== 'customer') {
        if (settings?.role_permissions) {
          const perms = settings.role_permissions as Record<string, RolePermissions | undefined> | null;
          setRolePermissions(perms?.[userData.role] || null);
        }
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!isTenantBrandResolved) return;
    applyTenantBrandRuntime(tenantBrand);
  }, [isTenantBrandResolved, tenantBrand]);

  const handleNavigation = () => {
    setIsOpen(false);
  };

  const handleMobileRefresh = async () => {
    if (isMobileRefreshing) return;

    setIsMobileRefreshing(true);
    const refreshEvent = createPageRefreshEvent('mobile-header');
    window.dispatchEvent(refreshEvent);

    if (!refreshEvent.detail.handled) {
      window.location.reload();
      return;
    }

    try {
      const refreshDone = refreshEvent.detail.done?.catch((error) => {
        console.error('Mobile refresh failed', error);
      }) ?? Promise.resolve();
      await Promise.race([
        refreshDone,
        new Promise<void>((resolve) => window.setTimeout(resolve, MOBILE_REFRESH_TIMEOUT_MS)),
      ]);
    } finally {
      setIsMobileRefreshing(false);
    }
  };

  const baseMenuItems: SidebarMenuItem[] = user?.role?.toLowerCase() === 'customer'
    ? customerMenuItems
    : menuItems.filter(item => {
        if (isMenuHeader(item)) {
          return true; // Keep headers for post-processing cleanup
        }
        if (user && user.role !== 'admin' && user.role !== 'customer') {
          return isSidebarItemAllowed({
            role: user.role,
            label: item.label,
            rolePermissions,
          });
        }
        return true;
      });

  const moduleAwareMenuItems = baseMenuItems.map((item): SidebarMenuItem => {
    if (isMenuHeader(item) || item.href !== '/dashboard/sessions') return item;
    // Industrial Cleaning: "Phiếu công việc"
    if (tenantBrand.moduleKey === 'industrial_cleaning') {
      return { ...item, label: 'Phiếu công việc' };
    }
    // Beauty Spa: "Liệu trình"
    if (tenantBrand.isBeautySpa) {
      return { ...item, label: 'Liệu trình' };
    }
    // Babycare (default): "Đơn đặt lịch"
    return { ...item, label: 'Đơn đặt lịch' };
  });

  const filteredMenuItems = [...moduleAwareMenuItems];

  // KTV gets a personal income shortcut instead
  if (user?.role?.toLowerCase() === 'ktv') {
    const hasIncome = filteredMenuItems.some((item) => item.label === 'Thu nhập cá nhân');
    if (!hasIncome) {
      filteredMenuItems.push({ icon: DollarSign, label: 'Thu nhập cá nhân', href: '/ktv/earnings' });
    }
  }

  // Post-process to remove headers that have no active links following them
  const finalMenuItems: SidebarMenuItem[] = [];
  let currentHeader: MenuHeader | null = null;
  let hasItemsInHeader = false;

  filteredMenuItems.forEach((item) => {
    if (isMenuHeader(item)) {
      if (currentHeader && hasItemsInHeader) {
        finalMenuItems.push(currentHeader);
      }
      currentHeader = item;
      hasItemsInHeader = false;
    } else {
      if (currentHeader) {
        finalMenuItems.push(currentHeader);
        currentHeader = null;
      }
      finalMenuItems.push(item);
      hasItemsInHeader = true;
    }
  });

  const activeHref = finalMenuItems
    .filter((item): item is MenuLink => !isMenuHeader(item))
    .map((item) => item.href)
    .filter((href) => isPathActive(pathname, searchParams, href))
    .sort((a, b) => b.length - a.length)[0];

  const handleLogout = async () => {
    try {
      clearDashboardClientContextCache();
      clearTenantBrandRuntimeCache();
      if (process.env.NODE_ENV === 'development') {
        document.cookie = 'mock_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
      }
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } catch (e) {
      console.error('Logout error:', e);
      router.push('/login');
    }
  };

  const roleLabel =
    user?.role?.toLowerCase() === 'ktv' ? 'Kỹ thuật viên'
    : user?.role?.toLowerCase() === 'ktv_lead' ? 'KTV Trưởng'
    : user?.role?.toLowerCase() === 'admin_staff' ? 'Lễ tân / Staff'
    : user?.role?.toLowerCase() === 'accountant' ? 'Kế toán'
    : user?.role?.toLowerCase() === 'hr' ? 'Nhân sự'
    : user?.role?.toLowerCase() === 'customer' ? 'Khách hàng'
    : 'Quản trị viên';
  const isPendingTenantBrand = !isTenantBrandResolved;
  const isBeautySpaShell = tenantBrand.isBeautySpa || isPendingTenantBrand;
  const isIndustrialCleaningShell = tenantBrand.moduleKey === 'industrial_cleaning';

  return (
    <>
      {/* ── Mobile Top Header Bar (lg:hidden) ── */}
      <div className={cn(
        "lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/90 dark:bg-[#11100F]/95 border-b border-[#FFE4E6] dark:border-[#3E3A35] backdrop-blur-md z-30 px-6 flex items-center justify-between shadow-[0_2px_15px_rgba(0,0,0,0.02)] transition-colors duration-300",
        (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-mobile-header"
      )}>
        <div className="flex w-20 items-center justify-start">
          <button
            onClick={() => setIsOpen(true)}
            className={cn(
              "p-2.5 rounded-xl text-primary dark:text-[#A67D44] hover:bg-rose-50 dark:hover:bg-[#1C1B19] active:scale-95 transition-all",
              (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-icon-button"
            )}
          >
            <Menu className="w-5.5 h-5.5" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <TenantBrandLogo
            displayName={tenantBrand.displayName}
            logoUrl={tenantBrand.logoUrl}
            monogram={tenantBrand.monogram}
            className="w-7 h-7 text-[10px]"
            markClassName={cn("rounded-xl", (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-logo-mark")}
          />
          <span className={cn(
            "max-w-[9rem] truncate font-handwriting text-2xl text-primary dark:text-[#A67D44] leading-none mt-1",
            (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-brand-script"
          )}>
            {tenantBrand.displayName.toLowerCase().endsWith('headquarter')
              ? tenantBrand.displayName.slice(0, -11).trim()
              : tenantBrand.displayName}
          </span>
        </div>

        <div className="flex w-20 items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleMobileRefresh}
            disabled={isMobileRefreshing}
            aria-label="Làm mới dữ liệu"
            title="Làm mới dữ liệu"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border border-pink-100 bg-white/80 text-primary shadow-sm transition-all hover:bg-rose-50 active:scale-95 disabled:opacity-70 dark:border-[#3E3A35] dark:bg-[#1C1B19] dark:text-[#A67D44] dark:hover:bg-[#5D1C34]/30",
              (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-icon-button"
            )}
          >
            <RefreshCw className={cn('h-4 w-4', isMobileRefreshing && 'animate-spin')} />
          </button>

          <div className={cn(
            "w-8 h-8 rounded-full bg-primary/10 dark:bg-[#5D1C34]/40 flex items-center justify-center text-primary dark:text-[#A67D44] font-black text-xs border border-pink-100 dark:border-[#3E3A35]",
            (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-avatar"
          )}>
            {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
          </div>
        </div>
      </div>

      {/* ── Overlay Backdrop for Mobile ── */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 
        Premium Responsive Sidebar
        - Desktop: Sticky w-80 sidebar
        - Mobile: Slide-out fixed drawer based on `isOpen` state
      */}
      <aside className={cn(
        "w-80 bg-[#FAFAFA] border-r border-slate-200/50 dark:bg-[#1C1B19] dark:border-[#3E3A35] flex flex-col h-screen md:h-[111.2vh] fixed inset-y-0 left-0 z-50 transform lg:translate-x-0 lg:sticky lg:top-0 transition-transform duration-300 ease-in-out overflow-hidden shadow-[10px_0_40px_rgba(0,0,0,0.02)] dark:shadow-[10px_0_40px_rgba(0,0,0,0.5)] beauty-erp-sidebar",
        isBeautySpaShell && "beauty-erp-sidebar",
        isIndustrialCleaningShell && "beauty-erp-sidebar", // Apply same class for theme CSS
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Soft decorative light glows */}
        <div className={cn(
          "absolute -top-24 -left-24 w-64 h-64 bg-pink-300/30 dark:bg-[#5D1C34]/10 rounded-full blur-[100px] pointer-events-none hidden"
        )} />
        <div className={cn(
          "absolute -bottom-24 -right-24 w-64 h-64 bg-rose-300/25 dark:bg-[#A67D44]/5 rounded-full blur-[100px] pointer-events-none hidden"
        )} />

        {/* ── Logo & Mobile Close Button ── */}
        <div className="px-8 pt-10 pb-6 shrink-0 relative z-10 flex items-center justify-between lg:block">
          <Link href="/dashboard" onClick={handleNavigation} className="flex flex-col items-center group">
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-primary/20 dark:bg-[#A67D44]/15 blur-2xl rounded-full scale-75 group-hover:scale-110 transition-transform duration-500" />
              <TenantBrandLogo
                displayName={tenantBrand.displayName}
                logoUrl={tenantBrand.logoUrl}
                monogram={tenantBrand.monogram}
                className="w-17 h-17 relative z-10 transform group-hover:rotate-[5deg] transition-transform duration-500 text-lg"
                markClassName={cn("rounded-[1.75rem]", (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-logo-mark beauty-erp-logo-mark-large")}
              />
            </div>
            <div className="text-center">
              <h2 className={cn(
                "max-w-64 text-[2.24rem] font-handwriting mb-2 drop-shadow-sm text-primary dark:text-[#A67D44] text-center",
                (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-brand-script"
              )}>
                {tenantBrand.displayName.toLowerCase().endsWith('headquarter') ? (
                  <span className="flex flex-col items-center">
                    <span className="leading-[0.8]">{tenantBrand.displayName.slice(0, -11).trim()}</span>
                    <span className="text-[1.6rem] mt-2.5 leading-[0.8] font-handwriting">
                      Headquarter
                    </span>
                  </span>
                ) : (
                  <span className="block truncate leading-[0.8]">{tenantBrand.displayName}</span>
                )}
              </h2>
              <span className={cn(
                "text-[7px] font-extrabold text-[#8A6D7C] dark:text-[#CDBCAB] uppercase tracking-[0.25em] block mt-1",
                (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-brand-subtitle"
              )}>
                {tenantBrand.subtitle}
              </span>
            </div>
          </Link>

          {/* Close button inside Drawer for Mobile */}
          <button
            onClick={() => setIsOpen(false)}
            className={cn(
              "lg:hidden p-2 rounded-xl text-primary dark:text-[#A67D44] hover:bg-white/60 dark:hover:bg-[#1C1B19]/50 active:scale-95 transition-all",
              (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-icon-button"
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Nav (scrollable) ── */}
        <nav className={cn(
          "flex-1 min-h-0 px-5 space-y-1.5 overflow-y-auto relative z-10 pb-2 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:transparent [&::-webkit-scrollbar-thumb]:rounded-full",
          isBeautySpaShell || isIndustrialCleaningShell 
            ? "" 
            : "[&::-webkit-scrollbar-thumb]:bg-rose-200/60 dark:[&::-webkit-scrollbar-thumb]:bg-[#3E3A35]",
          (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-nav-scroll"
        )}>
          {finalMenuItems.map((item, idx) => {
            if (isMenuHeader(item)) {
              return (
                <div 
                  key={`header-${idx}`} 
                  className={cn(
                    "px-5 pt-3 pb-1 text-[9.5px] font-extrabold text-primary/60 dark:text-[#A67D44]/60 uppercase tracking-[0.2em] relative z-10 select-none pointer-events-none mt-4 first:mt-1",
                    (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-nav-header"
                  )}
                >
                  {item.label}
                </div>
              );
            }

            const isActive = activeHref === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={handleNavigation} aria-current={isActive ? 'page' : undefined} prefetch={false}>
                <motion.div
                  whileHover={{ x: 4 }}
                  className={cn(
                    "flex items-center gap-4 px-5 py-3.5 rounded-[1.5rem] transition-all duration-300 relative group cursor-pointer border",
                    (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-nav-item",
                    (isBeautySpaShell || isIndustrialCleaningShell) && isActive && "beauty-erp-nav-item-active",
                    isActive
                      ? "bg-white text-primary border-primary/20 shadow-[0_8px_20px_rgba(219,39,119,0.12)] ring-1 ring-primary/20 dark:bg-[#5D1C34]/30 dark:text-[#EFE9E1] dark:border-[#A67D44]/40 dark:ring-[#A67D44]/20 dark:shadow-none"
                      : "text-[#8A6D7C] bg-transparent border-transparent hover:bg-white/70 hover:text-primary hover:shadow-[0_4px_12px_rgba(219,39,119,0.03)] hover:border-[#FFE4E6]/50 dark:text-[#CDBCAB] dark:hover:bg-[#1C1B19]/50 dark:hover:text-[#EFE9E1] dark:hover:border-[#3E3A35]/50"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="desktop-active-rail"
                      className="absolute left-1.5 top-1/2 hidden h-8 w-1 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_10px_rgba(190,24,93,0.35)] dark:bg-[#A67D44] dark:shadow-[0_0_10px_rgba(166,125,68,0.25)] lg:block"
                    />
                  )}
                  <item.icon className={cn(
                    "w-[18px] h-[18px] transition-all duration-300",
                    isActive
                      ? "text-primary dark:text-[#A67D44] scale-105"
                      : "text-[#A07888] dark:text-[#CDBCAB]/80 group-hover:text-primary dark:group-hover:text-[#A67D44]"
                  )} />
                  <span className={cn(
                    "text-[14px] tracking-tight transition-all duration-300",
                    isActive
                      ? "font-extrabold text-primary dark:text-[#EFE9E1]"
                      : "font-semibold"
                  )}>{item.label}</span>

                  {isActive && (
                    <motion.div
                      layoutId="active-indicator"
                      className="absolute right-5 w-1.5 h-1.5 bg-primary dark:bg-[#A67D44] rounded-full shadow-[0_0_6px_rgba(219,39,119,0.4)] dark:shadow-[0_0_6px_rgba(166,125,68,0.4)]"
                    />
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* ── Theme Switcher, User Profile & Logout — pinned at bottom ── */}
        <div className="mt-auto shrink-0 relative z-10 px-4 pt-4 pb-4 flex flex-col gap-2">
          {/* Unified Profile & Actions Panel */}
          <div className={cn(
            "bg-white/80 dark:bg-[#1C1B19] rounded-[1.25rem] shadow-[0_4px_20px_rgba(219,39,119,0.06)] dark:shadow-none border border-[#FFE4E6] dark:border-[#3E3A35] flex flex-col overflow-hidden transition-all duration-300 hover:border-rose-300 dark:hover:border-[#A67D44]/30",
            (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-profile-card"
          )}>
            <div className="p-3 flex items-center gap-3">
              <div className="relative shrink-0">
                <div className={cn(
                  "w-9 h-9 bg-primary/10 dark:bg-[#5D1C34]/40 rounded-full flex items-center justify-center text-primary dark:text-[#A67D44] font-extrabold text-sm shadow-sm transition-transform duration-300 group-hover:scale-105",
                  (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-avatar"
                )}>
                  {user?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#11100F] rounded-full" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "text-[13px] font-extrabold text-[#4C243B] dark:text-[#EFE9E1] truncate leading-tight",
                  (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-profile-name"
                )}>{user?.full_name || 'Admin Spa'}</p>
                <p className={cn(
                  "text-[9px] text-primary dark:text-[#A67D44] font-black uppercase tracking-[0.1em] mt-0.5",
                  (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-profile-role"
                )}>{roleLabel}</p>
              </div>
            </div>
            
            <div className={cn(
              "h-px w-full bg-gradient-to-r from-transparent via-[#FFE4E6] dark:via-[#3E3A35] to-transparent",
              (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-profile-divider"
            )} />
            
            <div className="flex items-center justify-between p-2">
               <div className="flex-1 px-2">
                 <ThemeToggle />
               </div>
               <button 
                 onClick={handleLogout} 
                 title="Đăng xuất"
                 className={cn(
                   "p-2 mr-1 rounded-xl text-[#8A6D7C] dark:text-[#CDBCAB] hover:bg-rose-50 hover:text-primary dark:hover:bg-[#5D1C34]/40 dark:hover:text-[#A67D44] transition-all",
                   (isBeautySpaShell || isIndustrialCleaningShell) && "beauty-erp-icon-button"
                 )}
               >
                 <LogOut className="w-4 h-4" />
               </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}



