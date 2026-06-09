'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Loader2,
  Moon,
  Palette,
  RefreshCw,
  Save,
  Sparkles,
  Sun,
} from 'lucide-react';
import { toast } from 'sonner';
import { getTenantSettings, saveTenantSettings } from '@/services/tenant-actions';
import {
  DEFAULT_ENABLED_MODULES,
  DEFAULT_TENANT_BRAND_THEME,
  normalizeEnabledModules,
  normalizeTenantBrandTheme,
  type TenantBrandTheme,
  type TenantEnabledModules,
} from '@/lib/business-rules/tenant-modules';
import { cn } from '@/lib/utils';

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-xs font-black uppercase tracking-widest text-slate-400">
      {children}
    </span>
  );
}

export default function AppearanceTab() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [brandTheme, setBrandTheme] = useState<TenantBrandTheme>(DEFAULT_TENANT_BRAND_THEME);
  const [logoUrl, setLogoUrl] = useState('');
  const [enabledModules, setEnabledModules] = useState<TenantEnabledModules>(DEFAULT_ENABLED_MODULES);
  const [isLoadingTenantConfig, setIsLoadingTenantConfig] = useState(true);
  const [isSavingTenantConfig, setIsSavingTenantConfig] = useState(false);

  useEffect(() => {
    const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    setTheme(currentTheme);
  }, []);

  const loadTenantDisplayConfig = useCallback(async () => {
    setIsLoadingTenantConfig(true);
    try {
      const tenant = await getTenantSettings();
      if (!tenant) return;

      const normalizedBrandTheme = normalizeTenantBrandTheme(tenant.brand_theme);
      setBrandTheme(normalizedBrandTheme);
      setLogoUrl(tenant.logo_url || normalizedBrandTheme.logoUrl || '');
      setEnabledModules(normalizeEnabledModules(tenant.enabled_modules));
    } catch (error) {
      console.error('Tenant display config load failed', error);
      toast.error('Không thể tải cấu hình giao diện chi nhánh');
    } finally {
      setIsLoadingTenantConfig(false);
    }
  }, []);

  useEffect(() => {
    loadTenantDisplayConfig();
  }, [loadTenantDisplayConfig]);

  const handleThemeChange = (newTheme: 'light' | 'dark') => {
    if (theme === newTheme) return;

    setTheme(newTheme);
    document.cookie = `theme=${newTheme}; path=/; max-age=31536000; SameSite=Lax`;

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      toast.success('Đã kích hoạt chế độ tối Deep Velvet');
    } else {
      document.documentElement.classList.remove('dark');
      toast.success('Đã kích hoạt giao diện Soft Luxury');
    }

    window.dispatchEvent(new Event('theme-change'));
  };

  const updateBrandTheme = (patch: Partial<TenantBrandTheme>) => {
    setBrandTheme((current) => ({ ...current, ...patch }));
  };

  async function handleSaveTenantConfig() {
    setIsSavingTenantConfig(true);
    try {
      const nextBrandTheme = normalizeTenantBrandTheme({
        ...brandTheme,
        logoUrl,
      });

      const result = await saveTenantSettings({
        logo_url: logoUrl,
        brand_theme: nextBrandTheme,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setBrandTheme(nextBrandTheme);
      setLogoUrl(nextBrandTheme.logoUrl);
      toast.success('Đã lưu nhận diện thương hiệu');
    } catch (error) {
      console.error('Tenant display config save failed', error);
      toast.error('Không thể lưu cấu hình giao diện chi nhánh');
    } finally {
      setIsSavingTenantConfig(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Palette className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Giao diện & Module</h2>
            <p className="text-sm font-semibold text-muted-foreground">
              Cấu hình phong cách hiển thị, nhận diện thương hiệu và module theo từng spa.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadTenantDisplayConfig}
          disabled={isLoadingTenantConfig || isSavingTenantConfig}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-100 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-rose-200 hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', isLoadingTenantConfig && 'animate-spin')} />
          Làm mới
        </button>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-black text-slate-900">Chế độ màu hệ thống</h3>
          <p className="text-sm font-semibold text-muted-foreground">
            Tùy chỉnh trải nghiệm sáng/tối cho người đang sử dụng thiết bị này.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <button
            type="button"
            onClick={() => handleThemeChange('light')}
            className={cn(
              'relative overflow-hidden rounded-[2rem] p-8 text-left transition-all duration-300',
              theme === 'light'
                ? 'bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-xl shadow-pink-200/50 scale-[1.01]'
                : 'border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
            )}
          >
            <Sun className={cn('absolute right-4 top-4 h-6 w-6', theme === 'light' ? 'text-white/35' : 'text-slate-400')} />
            <h4 className="mb-2 text-xl font-bold">Soft Luxury</h4>
            <p className={cn('text-sm font-medium', theme === 'light' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400')}>
              Tông hồng pastel và bề mặt mềm, phù hợp màn hình vận hành ban ngày.
            </p>
            <div className="mt-6">
              {theme === 'light' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-4 py-1.5 text-[10px] font-black uppercase">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Đang áp dụng
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-slate-200 px-4 py-1.5 text-[10px] font-black uppercase dark:bg-slate-800">
                  Kích hoạt
                </span>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleThemeChange('dark')}
            className={cn(
              'relative overflow-hidden rounded-[2rem] p-8 text-left transition-all duration-300',
              theme === 'dark'
                ? 'border border-purple-500/20 bg-gradient-to-br from-purple-950 to-slate-950 text-white shadow-xl shadow-purple-950/50 scale-[1.01]'
                : 'border border-slate-200 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200',
            )}
          >
            <Moon className={cn('absolute right-4 top-4 h-6 w-6', theme === 'dark' ? 'text-white/35' : 'text-slate-400')} />
            <h4 className="mb-2 text-xl font-bold">Modern Dark</h4>
            <p className={cn('text-sm font-medium', theme === 'dark' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400')}>
              Chế độ tối Deep Velvet cho các ca làm việc buổi tối hoặc màn hình lớn.
            </p>
            <div className="mt-6">
              {theme === 'dark' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-4 py-1.5 text-[10px] font-black uppercase">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Đang áp dụng
                </span>
              ) : (
                <span className="inline-flex rounded-full bg-slate-200 px-4 py-1.5 text-[10px] font-black uppercase dark:bg-slate-800">
                  Kích hoạt
                </span>
              )}
            </div>
          </button>
        </div>
      </section>

      <section className="space-y-6 border-t border-pink-100/70 pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Nhận diện thương hiệu riêng</h3>
              <p className="text-sm font-semibold text-muted-foreground">
                Dùng cho mô hình white-label khi bán gói dịch vụ cho spa khác.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveTenantConfig}
            disabled={isLoadingTenantConfig || isSavingTenantConfig}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-black uppercase tracking-wider text-white shadow-lg shadow-pink-200/60 transition hover:bg-primary-hover active:scale-95 disabled:opacity-50"
          >
            {isSavingTenantConfig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Lưu cấu hình
          </button>
        </div>

        {isLoadingTenantConfig ? (
          <div className="flex items-center justify-center rounded-[2rem] border border-pink-100 bg-white/60 py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <FieldLabel>Tên thương hiệu</FieldLabel>
                <input
                  value={brandTheme.brandName}
                  onChange={(event) => updateBrandTheme({ brandName: event.target.value })}
                  placeholder="VD: Bella Spa Premium"
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900 outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-50"
                />
              </label>

              <label className="space-y-2">
                <FieldLabel>Logo URL</FieldLabel>
                <input
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900 outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-50"
                />
              </label>

              <label className="space-y-2">
                <FieldLabel>Màu chính</FieldLabel>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <input
                    type="color"
                    value={brandTheme.primaryColor}
                    onChange={(event) => updateBrandTheme({ primaryColor: event.target.value })}
                    className="h-10 w-12 cursor-pointer rounded-xl border-0 bg-transparent p-0"
                    aria-label="Màu chính"
                  />
                  <input
                    value={brandTheme.primaryColor}
                    onChange={(event) => updateBrandTheme({ primaryColor: event.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-sm font-black text-slate-900 outline-none"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <FieldLabel>Màu nhấn</FieldLabel>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                  <input
                    type="color"
                    value={brandTheme.accentColor}
                    onChange={(event) => updateBrandTheme({ accentColor: event.target.value })}
                    className="h-10 w-12 cursor-pointer rounded-xl border-0 bg-transparent p-0"
                    aria-label="Màu nhấn"
                  />
                  <input
                    value={brandTheme.accentColor}
                    onChange={(event) => updateBrandTheme({ accentColor: event.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-sm font-black text-slate-900 outline-none"
                  />
                </div>
              </label>

              <label className="space-y-2">
                <FieldLabel>Tên hiển thị trên portal</FieldLabel>
                <input
                  value={brandTheme.portalDisplayName}
                  onChange={(event) => updateBrandTheme({ portalDisplayName: event.target.value })}
                  placeholder="Tên khách nhìn thấy khi vào portal"
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900 outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-50"
                />
              </label>

              <label className="space-y-2">
                <FieldLabel>Tên trên báo giá / hóa đơn</FieldLabel>
                <input
                  value={brandTheme.invoiceDisplayName}
                  onChange={(event) => updateBrandTheme({ invoiceDisplayName: event.target.value })}
                  placeholder="Tên dùng cho báo giá và chứng từ"
                  className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-sm font-bold text-slate-900 outline-none transition focus:border-rose-300 focus:bg-white focus:ring-4 focus:ring-rose-50"
                />
              </label>
            </div>

            <div className="space-y-4 rounded-[2rem] border border-rose-100 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <BadgeCheck className="h-5 w-5 text-primary" />
                <h4 className="text-base font-black text-slate-900">Module đang cấp cho spa</h4>
              </div>

              <div className="space-y-3">
                <div
                  className={cn(
                    'w-full rounded-2xl border px-5 py-4 text-left',
                    enabledModules.babycare
                      ? 'border-emerald-100 bg-emerald-50 text-slate-900 shadow-sm'
                      : 'border-slate-100 bg-slate-50 text-slate-400',
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-slate-900">Bella Mother & Baby</p>
                      <p className="text-xs font-bold text-slate-500">
                        Bật riêng cho tenant vận hành theo mô hình Mother & Baby.
                      </p>
                    </div>
                    <span className={cn(
                      'rounded-full px-3 py-1 text-[10px] font-black uppercase',
                      enabledModules.babycare
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-200 text-slate-500',
                    )}>
                      {enabledModules.babycare ? 'Đang bật' : 'Đang tắt'}
                    </span>
                  </div>
                </div>

                <div
                  className={cn(
                    'w-full rounded-2xl border px-5 py-4 text-left',
                    enabledModules.beauty_spa
                      ? 'border-primary bg-primary text-white shadow-lg shadow-pink-200/60'
                      : 'border-slate-100 bg-slate-50 text-slate-400',
                  )}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-black">Beauty Spa</p>
                      <p className={cn('text-xs font-bold', enabledModules.beauty_spa ? 'text-white/75' : 'text-slate-500')}>
                        Bật khi triển khai spa làm đẹp, liệu trình, giường/phòng và rule riêng.
                      </p>
                    </div>
                    <span className={cn(
                      'rounded-full px-3 py-1 text-[10px] font-black uppercase',
                      enabledModules.beauty_spa
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-500',
                    )}>
                      {enabledModules.beauty_spa ? 'Đang bật' : 'Đang tắt'}
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs font-bold leading-relaxed text-slate-500">
                Module ngành được cấu hình khi setup tenant. Admin của từng spa chỉ quản lý vận hành trong
                ngành đã được cấp, không thể tự chuyển đổi giữa các mô hình kinh doanh khác nhau.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
