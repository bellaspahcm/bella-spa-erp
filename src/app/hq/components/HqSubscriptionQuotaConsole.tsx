'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Crown,
  Database,
  Gauge,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@bella/shared';;
import {
  getHqSubscriptionOverview,
  resetTenantUsageCounter,
  setTenantQuotaOverride,
  updateSubscriptionPlanCatalog,
  updateSubscriptionPlanEntitlement,
  updateTenantSubscriptionPlan,
} from '@/services/hq-subscription-actions';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

type HqSubscriptionOverview = Awaited<ReturnType<typeof getHqSubscriptionOverview>>;
type SubscriptionPlan = HqSubscriptionOverview['plans'][number];
type SubscriptionEntitlement = HqSubscriptionOverview['entitlements'][number];
type SubscriptionTenant = HqSubscriptionOverview['tenants'][number];
type SubscriptionOverride = HqSubscriptionOverview['overrides'][number];
type UsageCounter = HqSubscriptionOverview['usageCounters'][number];
type UsageSnapshot = HqSubscriptionOverview['usageSnapshots'][number];

interface HqSubscriptionQuotaConsoleProps {
  refreshSignal: number;
  onTenantSubscriptionChanged: () => Promise<void>;
}

const defaultOverview: HqSubscriptionOverview = {
  plans: [],
  entitlements: [],
  tenants: [],
  overrides: [],
  usageCounters: [],
  usageSnapshots: [],
};

const selectButtonClassName =
  'flex min-h-12 w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left text-sm font-bold text-slate-900 outline-none transition-all hover:border-primary/30 hover:bg-white focus:ring-4 focus:ring-primary/10 disabled:opacity-50 dark:border-[#3E3A35] dark:bg-[#11100F] dark:text-[#EFE9E1]';

const featureLabels: Record<string, string> = {
  ktv: 'KTV',
  customer: 'Khách hàng',
  sms: 'Zalo/SMS',
  branch: 'Chi nhánh',
};

const usageStatusLabels: Record<string, string> = {
  ok: 'Ổn định',
  near_limit: 'Sắp đầy',
  limit_reached: 'Đạt giới hạn',
  exceeded: 'Vượt gói',
  unlimited: 'Không giới hạn',
};

const usageStatusPriority: Record<string, number> = {
  unlimited: 0,
  ok: 1,
  near_limit: 2,
  limit_reached: 3,
  exceeded: 4,
};

const quotaFeatureOptions = [
  { value: 'sms', label: 'Zalo/SMS', unit: 'message', resetPeriod: 'monthly' },
  { value: 'ktv', label: 'KTV', unit: 'count', resetPeriod: 'none' },
  { value: 'customer', label: 'Khách hàng', unit: 'count', resetPeriod: 'none' },
  { value: 'branch', label: 'Chi nhánh', unit: 'count', resetPeriod: 'none' },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Lỗi không xác định';
}

function formatLimit(row: Pick<SubscriptionEntitlement | SubscriptionOverride, 'is_unlimited' | 'limit_value' | 'unit'>) {
  if (row.is_unlimited) return 'Không giới hạn';
  const unit = row.unit === 'message' ? 'tin' : row.unit;
  return `${Number(row.limit_value ?? 0).toLocaleString('vi-VN')} ${unit}`;
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function toEndOfDayIso(value: string) {
  if (!value) return null;
  return new Date(`${value}T23:59:59.000+07:00`).toISOString();
}

function getTenantName(tenants: SubscriptionTenant[], tenantId: string) {
  return tenants.find((tenant) => tenant.id === tenantId)?.name ?? tenantId;
}

function getPlanLabel(plans: SubscriptionPlan[], planCode?: string | null) {
  const plan = plans.find((item) => item.plan_code === planCode);
  return plan ? plan.display_name : planCode || 'Dùng thử';
}

function formatQuotaSnapshotValue(value: number, isUnlimited?: boolean) {
  return isUnlimited ? 'Không giới hạn' : Number(value || 0).toLocaleString('vi-VN');
}

function getUsageStatusClassName(status: UsageSnapshot['overall_status']) {
  if (status === 'exceeded') {
    return 'bg-red-50 text-red-700 border-red-100 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/60';
  }
  if (status === 'limit_reached') {
    return 'bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60';
  }
  if (status === 'near_limit') {
    return 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/60';
  }
  if (status === 'unlimited') {
    return 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/60';
  }
  return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/60';
}

export function HqSubscriptionQuotaConsole({
  refreshSignal,
  onTenantSubscriptionChanged,
}: HqSubscriptionQuotaConsoleProps) {
  const [overview, setOverview] = useState<HqSubscriptionOverview>(defaultOverview);
  const [loading, setLoading] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [planExpiryDate, setPlanExpiryDate] = useState('');
  const [submittingPlan, setSubmittingPlan] = useState(false);

  const [catalogPlanCode, setCatalogPlanCode] = useState('');
  const [catalogDisplayName, setCatalogDisplayName] = useState('');
  const [catalogDescription, setCatalogDescription] = useState('');
  const [catalogPriceMonthly, setCatalogPriceMonthly] = useState('0');
  const [catalogSortOrder, setCatalogSortOrder] = useState('0');
  const [catalogIsActive, setCatalogIsActive] = useState(true);
  const [submittingCatalog, setSubmittingCatalog] = useState(false);

  const [entitlementPlanCode, setEntitlementPlanCode] = useState('');
  const [entitlementFeatureKey, setEntitlementFeatureKey] = useState('branch');
  const [entitlementLimitValue, setEntitlementLimitValue] = useState('1');
  const [entitlementIsUnlimited, setEntitlementIsUnlimited] = useState(false);
  const [entitlementUnit, setEntitlementUnit] = useState('count');
  const [entitlementResetPeriod, setEntitlementResetPeriod] = useState('none');
  const [entitlementDescription, setEntitlementDescription] = useState('');
  const [submittingEntitlement, setSubmittingEntitlement] = useState(false);

  const [overrideTenantId, setOverrideTenantId] = useState('');
  const [overrideFeatureKey, setOverrideFeatureKey] = useState('sms');
  const [overrideLimitValue, setOverrideLimitValue] = useState('100');
  const [overrideIsUnlimited, setOverrideIsUnlimited] = useState(false);
  const [overrideUnit, setOverrideUnit] = useState('message');
  const [overrideResetPeriod, setOverrideResetPeriod] = useState('monthly');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideExpiresAt, setOverrideExpiresAt] = useState('');
  const [submittingOverride, setSubmittingOverride] = useState(false);
  const [resettingCounterKey, setResettingCounterKey] = useState<string | null>(null);

  const activeTenants = useMemo(
    () => overview.tenants.filter((tenant) => tenant.name !== 'Bella Spa Headquarter'),
    [overview.tenants]
  );
  const hasActiveTenants = activeTenants.length > 0;
  const hasPlans = overview.plans.length > 0;

  const entitlementsByPlan = useMemo(() => {
    return overview.entitlements.reduce<Record<string, SubscriptionEntitlement[]>>((acc, entitlement) => {
      acc[entitlement.plan_code] = [...(acc[entitlement.plan_code] || []), entitlement];
      return acc;
    }, {});
  }, [overview.entitlements]);

  const activeOverrides = useMemo(
    () => overview.overrides.filter((override) => override.is_active),
    [overview.overrides]
  );

  const visibleUsageSnapshots = useMemo(() => {
    return overview.usageSnapshots
      .filter((snapshot) => snapshot.tenant_name !== 'Bella Spa Headquarter')
      .sort((a, b) => {
        const statusDelta =
          (usageStatusPriority[b.overall_status] || 0) - (usageStatusPriority[a.overall_status] || 0);
        return statusDelta || a.tenant_name.localeCompare(b.tenant_name, 'vi');
      });
  }, [overview.usageSnapshots]);

  const selectedCatalogPlan = useMemo(
    () => overview.plans.find((plan) => plan.plan_code === catalogPlanCode),
    [catalogPlanCode, overview.plans]
  );

  const selectedCatalogEntitlement = useMemo(
    () => (entitlementsByPlan[entitlementPlanCode] || []).find(
      (entitlement) => entitlement.feature_key === entitlementFeatureKey
    ),
    [entitlementFeatureKey, entitlementPlanCode, entitlementsByPlan]
  );

  useEffect(() => {
    if (!selectedCatalogPlan) return;
    setCatalogDisplayName(selectedCatalogPlan.display_name);
    setCatalogDescription(selectedCatalogPlan.description || '');
    setCatalogPriceMonthly(String(Number(selectedCatalogPlan.price_monthly ?? 0)));
    setCatalogSortOrder(String(Number(selectedCatalogPlan.sort_order ?? 0)));
    setCatalogIsActive(selectedCatalogPlan.is_active);
  }, [selectedCatalogPlan]);

  useEffect(() => {
    const option = quotaFeatureOptions.find((item) => item.value === entitlementFeatureKey);
    if (selectedCatalogEntitlement) {
      setEntitlementLimitValue(String(Number(selectedCatalogEntitlement.limit_value ?? 0)));
      setEntitlementIsUnlimited(selectedCatalogEntitlement.is_unlimited);
      setEntitlementUnit(selectedCatalogEntitlement.unit);
      setEntitlementResetPeriod(selectedCatalogEntitlement.reset_period);
      setEntitlementDescription(selectedCatalogEntitlement.description || '');
      return;
    }

    setEntitlementLimitValue('0');
    setEntitlementIsUnlimited(false);
    setEntitlementUnit(option?.unit || 'count');
    setEntitlementResetPeriod(option?.resetPeriod || 'none');
    setEntitlementDescription('');
  }, [entitlementFeatureKey, selectedCatalogEntitlement]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHqSubscriptionOverview();
      setOverview(data);
      const firstPlanCode = data.plans[0]?.plan_code || '';
      setCatalogPlanCode((current) => current || firstPlanCode);
      setEntitlementPlanCode((current) => current || firstPlanCode);

      const firstTenant = data.tenants.find((tenant) => tenant.name !== 'Bella Spa Headquarter');
      if (firstTenant) {
        setSelectedTenantId((current) => current || firstTenant.id);
        setOverrideTenantId((current) => current || firstTenant.id);
        setSelectedPlanCode((current) => current || firstTenant.subscription_tier || data.plans[0]?.plan_code || '');
        setPlanExpiryDate((current) => current || toDateInput(firstTenant.subscription_expires_at));
      } else {
        setSelectedTenantId('');
        setOverrideTenantId('');
        setSelectedPlanCode((current) => current || data.plans[0]?.plan_code || '');
        setPlanExpiryDate('');
      }
    } catch (error) {
      toast.error('Không thể tải dữ liệu thuê bao HQ: ' + getErrorMessage(error));
      setOverview(defaultOverview);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadOverview();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadOverview, refreshSignal]);

  const handleTenantSelection = (tenantId: string) => {
    const tenant = overview.tenants.find((item) => item.id === tenantId);
    setSelectedTenantId(tenantId);
    setSelectedPlanCode(tenant?.subscription_tier || overview.plans[0]?.plan_code || '');
    setPlanExpiryDate(toDateInput(tenant?.subscription_expires_at));
  };

  const handleSaveCatalog = async (event: React.FormEvent) => {
    event.preventDefault();
    const priceMonthly = Number(catalogPriceMonthly);
    const sortOrder = Number(catalogSortOrder);
    if (!catalogPlanCode || !catalogDisplayName.trim()) {
      toast.error('Vui lòng chọn gói và nhập tên hiển thị.');
      return;
    }
    if (!Number.isFinite(priceMonthly) || priceMonthly < 0) {
      toast.error('Giá gói phải là số không âm.');
      return;
    }
    if (!Number.isFinite(sortOrder) || sortOrder < 0) {
      toast.error('Thứ tự hiển thị phải là số không âm.');
      return;
    }

    setSubmittingCatalog(true);
    try {
      const result = await updateSubscriptionPlanCatalog({
        planCode: catalogPlanCode,
        displayName: catalogDisplayName,
        description: catalogDescription || null,
        priceMonthly,
        isActive: catalogIsActive,
        sortOrder,
      });

      if (result.success) {
        toast.success('Đã cập nhật catalog gói thuê bao.');
        await loadOverview();
      } else {
        toast.error(result.error || 'Cập nhật catalog gói thuê bao thất bại.');
      }
    } catch (error) {
      toast.error('Lỗi cập nhật catalog gói thuê bao: ' + getErrorMessage(error));
    } finally {
      setSubmittingCatalog(false);
    }
  };

  const handleSaveEntitlement = async (event: React.FormEvent) => {
    event.preventDefault();
    const limitNumber = Number(entitlementLimitValue);
    if (!entitlementPlanCode || !entitlementFeatureKey) {
      toast.error('Vui lòng chọn gói và loại hạn mức.');
      return;
    }
    if (!entitlementIsUnlimited && (!Number.isFinite(limitNumber) || limitNumber < 0)) {
      toast.error('Hạn mức mặc định phải là số không âm hoặc bật không giới hạn.');
      return;
    }

    setSubmittingEntitlement(true);
    try {
      const result = await updateSubscriptionPlanEntitlement({
        planCode: entitlementPlanCode,
        featureKey: entitlementFeatureKey,
        limitValue: entitlementIsUnlimited ? null : limitNumber,
        isUnlimited: entitlementIsUnlimited,
        unit: entitlementUnit,
        enforcementMode: 'hard',
        resetPeriod: entitlementResetPeriod,
        description: entitlementDescription || null,
      });

      if (result.success) {
        toast.success('Đã cập nhật hạn mức mặc định của gói.');
        await loadOverview();
      } else {
        toast.error(result.error || 'Cập nhật hạn mức mặc định thất bại.');
      }
    } catch (error) {
      toast.error('Lỗi cập nhật hạn mức mặc định: ' + getErrorMessage(error));
    } finally {
      setSubmittingEntitlement(false);
    }
  };

  const handleSavePlan = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTenantId || !selectedPlanCode) {
      toast.error('Vui lòng chọn chi nhánh và gói thuê bao.');
      return;
    }

    setSubmittingPlan(true);
    try {
      const result = await updateTenantSubscriptionPlan({
        tenantId: selectedTenantId,
        planCode: selectedPlanCode,
        subscriptionExpiresAt: toEndOfDayIso(planExpiryDate),
      });

      if (result.success) {
        toast.success('Đã cập nhật gói thuê bao cho chi nhánh.');
        await Promise.all([loadOverview(), onTenantSubscriptionChanged()]);
      } else {
        toast.error(result.error || 'Cập nhật gói thuê bao thất bại.');
      }
    } catch (error) {
      toast.error('Lỗi cập nhật gói thuê bao: ' + getErrorMessage(error));
    } finally {
      setSubmittingPlan(false);
    }
  };

  const handleSaveOverride = async (event: React.FormEvent) => {
    event.preventDefault();
    const limitNumber = Number(overrideLimitValue);
    if (!overrideTenantId || !overrideFeatureKey) {
      toast.error('Vui lòng chọn chi nhánh và loại hạn ngạch.');
      return;
    }
    if (!overrideIsUnlimited && (!Number.isFinite(limitNumber) || limitNumber < 0)) {
      toast.error('Hạn ngạch phải là số không âm hoặc bật không giới hạn.');
      return;
    }

    setSubmittingOverride(true);
    try {
      const result = await setTenantQuotaOverride({
        tenantId: overrideTenantId,
        featureKey: overrideFeatureKey,
        limitValue: overrideIsUnlimited ? null : limitNumber,
        isUnlimited: overrideIsUnlimited,
        unit: overrideUnit,
        enforcementMode: 'hard',
        resetPeriod: overrideResetPeriod,
        reason: overrideReason || null,
        expiresAt: overrideExpiresAt ? toEndOfDayIso(overrideExpiresAt) : null,
      });

      if (result.success) {
        toast.success('Đã lưu hạn ngạch riêng cho chi nhánh.');
        await loadOverview();
      } else {
        toast.error(result.error || 'Lưu hạn ngạch riêng thất bại.');
      }
    } catch (error) {
      toast.error('Lỗi lưu hạn ngạch riêng: ' + getErrorMessage(error));
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleResetCounter = async (counter: UsageCounter) => {
    const tenantName = getTenantName(overview.tenants, counter.tenant_id);
    const confirmed = window.confirm(
      `Đặt lại bộ đếm ${counter.feature_key} của ${tenantName} về 0 cho kỳ ${counter.period_start} - ${counter.period_end}?`
    );
    if (!confirmed) return;

    const key = `${counter.tenant_id}:${counter.feature_key}:${counter.period_start}`;
    setResettingCounterKey(key);
    try {
      const result = await resetTenantUsageCounter({
        tenantId: counter.tenant_id,
        featureKey: counter.feature_key,
        periodStart: counter.period_start,
        periodEnd: counter.period_end,
        reason: 'HQ manual reset from subscription quota console',
      });

      if (result.success) {
        toast.success('Đã đặt lại bộ đếm sử dụng.');
        await loadOverview();
      } else {
        toast.error(result.error || 'Đặt lại bộ đếm sử dụng thất bại.');
      }
    } catch (error) {
      toast.error('Lỗi đặt lại bộ đếm sử dụng: ' + getErrorMessage(error));
    } finally {
      setResettingCounterKey(null);
    }
  };

  const selectedTenant = overview.tenants.find((tenant) => tenant.id === selectedTenantId);

  return (
    <div className="space-y-8 text-left">
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2rem] p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-[#5D1C34]/40 text-primary dark:text-rose-400 flex items-center justify-center">
            <Crown size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gói đang bật</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-[#EFE9E1]">{overview.plans.length}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2rem] p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chi nhánh quản trị</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-[#EFE9E1]">{activeTenants.length}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2rem] p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 flex items-center justify-center">
            <SlidersHorizontal size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hạn ngạch riêng</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-[#EFE9E1]">{activeOverrides.length}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2rem] p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
            <Gauge size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lượt dùng</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-[#EFE9E1]">{overview.usageCounters.length}</h3>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2.5rem] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 dark:border-[#3E3A35] pb-5 mb-5">
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-widest">Danh mục gói & hạn ngạch</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Nguồn chuẩn cho hạn ngạch chi nhánh</p>
          </div>
          <button
            type="button"
            onClick={() => void loadOverview()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#3E3A35] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-[#CDBCAB] hover:bg-slate-50 dark:hover:bg-[#292623] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Tải lại hạn ngạch
          </button>
        </div>

        {loading && overview.plans.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw size={22} className="mx-auto animate-spin text-primary" />
          </div>
        ) : overview.plans.length === 0 ? (
          <p className="py-10 text-center text-xs font-bold italic text-slate-400">Chưa có gói thuê bao nào.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {overview.plans.map((plan) => (
              <div key={plan.plan_code} className="rounded-3xl border border-slate-100 dark:border-[#3E3A35] bg-slate-50/60 dark:bg-[#11100F]/60 p-4 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h5 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] truncate">{plan.display_name}</h5>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{plan.plan_code}</p>
                  </div>
                  <span className="rounded-full bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] px-2 py-0.5 text-[9px] font-black text-slate-500">
                    {formatCurrency(plan.price_monthly)}đ
                  </span>
                </div>
                <div className="space-y-2">
                  {(entitlementsByPlan[plan.plan_code] || []).map((entitlement) => (
                    <div key={entitlement.id} className="flex items-center justify-between rounded-2xl bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] px-3 py-2 text-[10px]">
                      <span className="font-black text-slate-500 dark:text-[#CDBCAB]">{featureLabels[entitlement.feature_key] || entitlement.feature_key}</span>
                      <span className="font-black text-slate-900 dark:text-[#EFE9E1]">{formatLimit(entitlement)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2.5rem] p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-widest">Sức khỏe gói đang dùng</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
              HQ theo dõi KTV, khách hàng, Zalo/SMS và chi nhánh theo từng tenant
            </p>
          </div>
          <span className="inline-flex w-fit items-center rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
            Chi nhánh chuỗi cần owner model trước khi khóa cứng
          </span>
        </div>

        {visibleUsageSnapshots.length === 0 ? (
          <p className="py-10 text-center text-xs font-bold italic text-slate-400">Chưa có dữ liệu sử dụng gói của chi nhánh.</p>
        ) : (
          <div className="custom-scrollbar overflow-x-auto rounded-3xl border border-slate-100 dark:border-[#3E3A35]">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="bg-slate-50 dark:bg-[#11100F]">
                <tr className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="px-5 py-4">Chi nhánh</th>
                  <th className="px-5 py-4">Gói</th>
                  <th className="px-5 py-4">Tình trạng</th>
                  <th className="px-5 py-4">Hạn mức đang dùng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]">
                {visibleUsageSnapshots.map((snapshot) => (
                  <tr key={snapshot.tenant_id} className="bg-white dark:bg-[#1C1B19]">
                    <td className="px-5 py-4 align-top">
                      <p className="font-black text-slate-900 dark:text-[#EFE9E1]">{snapshot.tenant_name}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {snapshot.is_franchise ? 'Nhượng quyền / SaaS' : 'Trực thuộc'}
                      </p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <p className="font-black text-slate-900 dark:text-[#EFE9E1]">{snapshot.plan_name}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{snapshot.plan_code}</p>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getUsageStatusClassName(snapshot.overall_status)}`}>
                        {usageStatusLabels[snapshot.overall_status] || snapshot.overall_status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                        {snapshot.features.map((feature) => (
                          <div
                            key={feature.feature_key}
                            className={`rounded-2xl border px-3 py-2 ${getUsageStatusClassName(feature.status)}`}
                          >
                            <p className="text-[9px] font-black uppercase tracking-widest opacity-80">
                              {featureLabels[feature.feature_key] || feature.label}
                            </p>
                            <p className="mt-1 text-sm font-black">
                              {Number(feature.current || 0).toLocaleString('vi-VN')} / {formatQuotaSnapshotValue(feature.max, feature.is_unlimited)}
                            </p>
                            {!feature.is_unlimited && (
                              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70 dark:bg-black/30">
                                <div
                                  className="h-full rounded-full bg-current"
                                  style={{ width: `${Math.min(100, feature.usage_percent)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleSaveCatalog} className="xl:col-span-5 bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2.5rem] p-6 shadow-sm space-y-5">
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-widest">Quản lý bảng giá gói</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">HQ chỉnh tên, giá và trạng thái gói SaaS</p>
          </div>

          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gói cần chỉnh</span>
            <PremiumSelect
              value={catalogPlanCode}
              onChange={setCatalogPlanCode}
              disabled={!hasPlans}
              options={
                hasPlans
                  ? overview.plans.map((plan) => ({ value: plan.plan_code, label: plan.display_name }))
                  : [{ value: '__empty__', label: 'Chưa có gói' }]
              }
              buttonClassName={selectButtonClassName}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-2 sm:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tên hiển thị</span>
              <input
                value={catalogDisplayName}
                onChange={(event) => setCatalogDisplayName(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Giá tháng</span>
              <input
                type="number"
                min="0"
                value={catalogPriceMonthly}
                onChange={(event) => setCatalogPriceMonthly(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Thứ tự</span>
              <input
                type="number"
                min="0"
                value={catalogSortOrder}
                onChange={(event) => setCatalogSortOrder(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
              />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mô tả</span>
            <textarea
              value={catalogDescription}
              onChange={(event) => setCatalogDescription(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
            />
          </label>

          <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-[#3E3A35] px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-[#CDBCAB]">
            <input
              type="checkbox"
              checked={catalogIsActive}
              onChange={(event) => setCatalogIsActive(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            Gói đang bán
          </label>

          <button
            type="submit"
            disabled={submittingCatalog || loading || !hasPlans || !catalogPlanCode}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary hover:bg-primary/90 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            {submittingCatalog ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Lưu bảng giá gói
          </button>
        </form>

        <form onSubmit={handleSaveEntitlement} className="xl:col-span-7 bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2.5rem] p-6 shadow-sm space-y-5">
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-widest">Hạn mức mặc định của gói</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Bao gồm KTV, khách hàng, Zalo/SMS và số chi nhánh</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gói</span>
              <PremiumSelect
                value={entitlementPlanCode}
                onChange={setEntitlementPlanCode}
                disabled={!hasPlans}
                options={
                  hasPlans
                    ? overview.plans.map((plan) => ({ value: plan.plan_code, label: plan.display_name }))
                    : [{ value: '__empty__', label: 'Chưa có gói' }]
                }
                buttonClassName={selectButtonClassName}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loại hạn mức</span>
              <PremiumSelect
                value={entitlementFeatureKey}
                onChange={setEntitlementFeatureKey}
                options={quotaFeatureOptions.map((option) => ({ value: option.value, label: option.label }))}
                buttonClassName={selectButtonClassName}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hạn mức</span>
              <input
                type="number"
                min="0"
                value={entitlementLimitValue}
                onChange={(event) => setEntitlementLimitValue(event.target.value)}
                disabled={entitlementIsUnlimited}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đơn vị</span>
              <PremiumSelect
                value={entitlementUnit}
                onChange={setEntitlementUnit}
                options={[
                  { value: 'count', label: 'Lượt' },
                  { value: 'message', label: 'Tin' },
                ]}
                buttonClassName={selectButtonClassName}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chu kỳ</span>
              <PremiumSelect
                value={entitlementResetPeriod}
                onChange={setEntitlementResetPeriod}
                options={[
                  { value: 'none', label: 'Không đặt lại' },
                  { value: 'daily', label: 'Hàng ngày' },
                  { value: 'monthly', label: 'Hàng tháng' },
                  { value: 'yearly', label: 'Hàng năm' },
                ]}
                buttonClassName={selectButtonClassName}
              />
            </label>
            <label className="inline-flex items-center gap-3 self-end rounded-2xl border border-slate-200 dark:border-[#3E3A35] px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-[#CDBCAB]">
              <input
                type="checkbox"
                checked={entitlementIsUnlimited}
                onChange={(event) => setEntitlementIsUnlimited(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Không giới hạn
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ghi chú hạn mức</span>
            <input
              value={entitlementDescription}
              onChange={(event) => setEntitlementDescription(event.target.value)}
              placeholder="VD: Số chi nhánh/địa điểm được vận hành trong gói"
              className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
            />
          </label>

          <button
            type="submit"
            disabled={submittingEntitlement || loading || !hasPlans || !entitlementPlanCode}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 hover:bg-amber-600 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-950 disabled:opacity-50"
          >
            {submittingEntitlement ? <RefreshCw size={14} className="animate-spin" /> : <SlidersHorizontal size={14} />}
            Lưu hạn mức mặc định
          </button>
        </form>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleSavePlan} className="xl:col-span-5 bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2.5rem] p-6 shadow-sm space-y-5">
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-widest">Đổi gói thuê bao chi nhánh</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Cập nhật gói thuê bao chi nhánh qua action có audit rollback</p>
          </div>

          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chi nhánh</span>
            <PremiumSelect
              value={selectedTenantId}
              onChange={handleTenantSelection}
              disabled={!hasActiveTenants}
              options={
                hasActiveTenants
                  ? activeTenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))
                  : [{ value: '__empty__', label: 'Chưa có chi nhánh' }]
              }
              buttonClassName={selectButtonClassName}
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Gói</span>
              <PremiumSelect
                value={selectedPlanCode}
                onChange={setSelectedPlanCode}
                disabled={!hasPlans}
                options={
                  hasPlans
                    ? overview.plans.map((plan) => ({ value: plan.plan_code, label: plan.display_name }))
                    : [{ value: '__empty__', label: 'Chưa có gói' }]
                }
                buttonClassName={selectButtonClassName}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hạn gói</span>
              <input
                type="date"
                value={planExpiryDate}
                onChange={(event) => setPlanExpiryDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-slate-100 dark:border-[#3E3A35] bg-slate-50/70 dark:bg-[#11100F]/70 p-4 text-[11px] font-bold text-slate-500 dark:text-[#CDBCAB]">
            <p className="font-black text-slate-800 dark:text-[#EFE9E1]">{selectedTenant?.name || 'Chưa chọn chi nhánh'}</p>
            <p className="mt-1">Hiện tại: {getPlanLabel(overview.plans, selectedTenant?.subscription_tier)} • Hạn: {toDateInput(selectedTenant?.subscription_expires_at) || 'Không giới hạn'}</p>
          </div>

          <button
            type="submit"
            disabled={submittingPlan || loading || !hasActiveTenants || !selectedTenantId || !selectedPlanCode}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 hover:bg-slate-800 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            {submittingPlan ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Lưu gói chi nhánh
          </button>
        </form>

        <form onSubmit={handleSaveOverride} className="xl:col-span-7 bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2.5rem] p-6 shadow-sm space-y-5">
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-widest">Điều chỉnh hạn ngạch</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Điều chỉnh theo chi nhánh + tính năng, tự cập nhật hạn ngạch đang hiệu lực nếu đã tồn tại</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block space-y-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chi nhánh</span>
              <PremiumSelect
                value={overrideTenantId}
                onChange={setOverrideTenantId}
                disabled={!hasActiveTenants}
                options={
                  hasActiveTenants
                    ? activeTenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))
                    : [{ value: '', label: 'Chưa có chi nhánh' }]
                }
                buttonClassName={selectButtonClassName}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tính năng</span>
              <PremiumSelect
                value={overrideFeatureKey}
                onChange={(value) => {
                  setOverrideFeatureKey(value);
                  const option = quotaFeatureOptions.find((item) => item.value === value);
                  if (option) {
                    setOverrideUnit(option.unit);
                    setOverrideResetPeriod(option.resetPeriod);
                  }
                }}
                options={quotaFeatureOptions.map((option) => ({ value: option.value, label: option.label }))}
                buttonClassName={selectButtonClassName}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hạn mức</span>
              <input
                type="number"
                min="0"
                value={overrideLimitValue}
                onChange={(event) => setOverrideLimitValue(event.target.value)}
                disabled={overrideIsUnlimited}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đơn vị</span>
              <PremiumSelect
                value={overrideUnit}
                onChange={setOverrideUnit}
                options={[
                  { value: 'message', label: 'Tin' },
                  { value: 'count', label: 'Lượt' },
                ]}
                buttonClassName={selectButtonClassName}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chu kỳ</span>
              <PremiumSelect
                value={overrideResetPeriod}
                onChange={setOverrideResetPeriod}
                options={[
                  { value: 'none', label: 'Không đặt lại' },
                  { value: 'daily', label: 'Hàng ngày' },
                  { value: 'monthly', label: 'Hàng tháng' },
                  { value: 'yearly', label: 'Hàng năm' },
                ]}
                buttonClassName={selectButtonClassName}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hết hạn</span>
              <input
                type="date"
                value={overrideExpiresAt}
                onChange={(event) => setOverrideExpiresAt(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-4 items-end">
            <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-[#3E3A35] px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-600 dark:text-[#CDBCAB]">
              <input
                type="checkbox"
                checked={overrideIsUnlimited}
                onChange={(event) => setOverrideIsUnlimited(event.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Không giới hạn
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lý do</span>
              <input
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                placeholder="VD: chiến dịch marketing tháng 6"
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={submittingOverride || loading || !hasActiveTenants || !overrideTenantId}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            {submittingOverride ? <RefreshCw size={14} className="animate-spin" /> : <SlidersHorizontal size={14} />}
            Lưu hạn ngạch
          </button>
        </form>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2.5rem] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <Database size={18} className="text-amber-600" />
            <h4 className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-widest">Hạn ngạch riêng đang bật</h4>
          </div>
          {activeOverrides.length === 0 ? (
            <p className="text-xs font-bold italic text-slate-400 py-8 text-center">Chưa có hạn ngạch riêng đang bật.</p>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {activeOverrides.map((override) => (
                <div key={override.id} className="rounded-2xl border border-slate-100 dark:border-[#3E3A35] bg-slate-50/70 dark:bg-[#11100F]/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-sm text-slate-900 dark:text-[#EFE9E1] truncate">{getTenantName(overview.tenants, override.tenant_id)}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{featureLabels[override.feature_key] || override.feature_key}</p>
                    </div>
                    <span className="rounded-full bg-amber-50 dark:bg-amber-950/40 px-3 py-1 text-[10px] font-black text-amber-700 dark:text-amber-300">{formatLimit(override)}</span>
                  </div>
                  <p className="mt-3 text-[11px] font-bold text-slate-500 dark:text-[#CDBCAB]">{override.reason || 'Không ghi chú lý do'} • Hết hạn: {toDateInput(override.expires_at) || 'Không giới hạn'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2.5rem] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <Activity size={18} className="text-emerald-600" />
            <h4 className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-widest">Bộ đếm sử dụng</h4>
          </div>
          {overview.usageCounters.length === 0 ? (
            <p className="text-xs font-bold italic text-slate-400 py-8 text-center">Chưa có bộ đếm sử dụng nào.</p>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {overview.usageCounters.map((counter) => {
                const key = `${counter.tenant_id}:${counter.feature_key}:${counter.period_start}`;
                return (
                  <div key={key} className="rounded-2xl border border-slate-100 dark:border-[#3E3A35] bg-slate-50/70 dark:bg-[#11100F]/70 p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-black text-sm text-slate-900 dark:text-[#EFE9E1] truncate">{getTenantName(overview.tenants, counter.tenant_id)}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        {featureLabels[counter.feature_key] || counter.feature_key} • {counter.period_start} - {counter.period_end}
                      </p>
                      <p className="mt-1 text-[11px] font-bold text-slate-500 dark:text-[#CDBCAB]">Đã dùng: {Number(counter.used_value).toLocaleString('vi-VN')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleResetCounter(counter)}
                      disabled={resettingCounterKey === key}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-emerald-700 disabled:opacity-50"
                    >
                      {resettingCounterKey === key ? <RefreshCw size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                      Đặt lại
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
