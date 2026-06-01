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
import { formatCurrency } from '@/lib/utils';
import {
  getHqSubscriptionOverview,
  resetTenantUsageCounter,
  setTenantQuotaOverride,
  updateTenantSubscriptionPlan,
} from '@/services/hq-subscription-actions';

type HqSubscriptionOverview = Awaited<ReturnType<typeof getHqSubscriptionOverview>>;
type SubscriptionPlan = HqSubscriptionOverview['plans'][number];
type SubscriptionEntitlement = HqSubscriptionOverview['entitlements'][number];
type SubscriptionTenant = HqSubscriptionOverview['tenants'][number];
type SubscriptionOverride = HqSubscriptionOverview['overrides'][number];
type UsageCounter = HqSubscriptionOverview['usageCounters'][number];

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
};

const featureLabels: Record<string, string> = {
  ktv: 'KTV',
  customer: 'Khách hàng',
  sms: 'Zalo/SMS',
};

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

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getHqSubscriptionOverview();
      setOverview(data);

      const firstTenant = data.tenants.find((tenant) => tenant.name !== 'Bella Spa Headquarter') ?? data.tenants[0];
      if (firstTenant) {
        setSelectedTenantId((current) => current || firstTenant.id);
        setOverrideTenantId((current) => current || firstTenant.id);
        setSelectedPlanCode((current) => current || firstTenant.subscription_tier || data.plans[0]?.plan_code || '');
        setPlanExpiryDate((current) => current || toDateInput(firstTenant.subscription_expires_at));
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
        toast.success('Đã lưu quota override cho chi nhánh.');
        await loadOverview();
      } else {
        toast.error(result.error || 'Lưu quota override thất bại.');
      }
    } catch (error) {
      toast.error('Lỗi lưu quota override: ' + getErrorMessage(error));
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleResetCounter = async (counter: UsageCounter) => {
    const tenantName = getTenantName(overview.tenants, counter.tenant_id);
    const confirmed = window.confirm(
      `Reset bộ đếm ${counter.feature_key} của ${tenantName} về 0 cho kỳ ${counter.period_start} - ${counter.period_end}?`
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
        toast.success('Đã reset usage counter.');
        await loadOverview();
      } else {
        toast.error(result.error || 'Reset usage counter thất bại.');
      }
    } catch (error) {
      toast.error('Lỗi reset usage counter: ' + getErrorMessage(error));
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
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Plan đang bật</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-[#EFE9E1]">{overview.plans.length}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2rem] p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tenant quản trị</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-[#EFE9E1]">{activeTenants.length}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2rem] p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 flex items-center justify-center">
            <SlidersHorizontal size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Override active</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-[#EFE9E1]">{activeOverrides.length}</h3>
          </div>
        </div>
        <div className="bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2rem] p-5 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
            <Gauge size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Counter usage</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-[#EFE9E1]">{overview.usageCounters.length}</h3>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2.5rem] p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 dark:border-[#3E3A35] pb-5 mb-5">
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-widest">Danh mục plan & entitlement</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Nguồn chuẩn cho hạn ngạch tenant</p>
          </div>
          <button
            type="button"
            onClick={() => void loadOverview()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#3E3A35] px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-[#CDBCAB] hover:bg-slate-50 dark:hover:bg-[#292623] disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Tải lại quota
          </button>
        </div>

        {loading && overview.plans.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <RefreshCw size={22} className="mx-auto animate-spin text-primary" />
          </div>
        ) : overview.plans.length === 0 ? (
          <p className="py-10 text-center text-xs font-bold italic text-slate-400">Chưa có plan thuê bao nào.</p>
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

      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form onSubmit={handleSavePlan} className="xl:col-span-5 bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2.5rem] p-6 shadow-sm space-y-5">
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-widest">Đổi gói thuê bao tenant</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Ghi vào `tenants.subscription_tier` qua action có audit rollback</p>
          </div>

          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chi nhánh</span>
            <select
              value={selectedTenantId}
              onChange={(event) => handleTenantSelection(event.target.value)}
              disabled={!hasActiveTenants}
              className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
            >
              {!hasActiveTenants ? (
                <option value="">Chưa có chi nhánh</option>
              ) : null}
              {activeTenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plan</span>
              <select
                value={selectedPlanCode}
                onChange={(event) => setSelectedPlanCode(event.target.value)}
                disabled={!hasPlans}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
              >
                {!hasPlans ? (
                  <option value="">Chưa có plan</option>
                ) : null}
                {overview.plans.map((plan) => (
                  <option key={plan.plan_code} value={plan.plan_code}>{plan.display_name}</option>
                ))}
              </select>
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
            disabled={submittingPlan || loading || !selectedTenantId || !selectedPlanCode}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 hover:bg-slate-800 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            {submittingPlan ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            Lưu gói tenant
          </button>
        </form>

        <form onSubmit={handleSaveOverride} className="xl:col-span-7 bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2.5rem] p-6 shadow-sm space-y-5">
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-widest">Quota override</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Override theo tenant + feature, action tự update override active nếu đã tồn tại</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="block space-y-2 md:col-span-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chi nhánh</span>
              <select
                value={overrideTenantId}
                onChange={(event) => setOverrideTenantId(event.target.value)}
                disabled={!hasActiveTenants}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
              >
                {!hasActiveTenants ? (
                  <option value="">Chưa có chi nhánh</option>
                ) : null}
                {activeTenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Feature</span>
              <select
                value={overrideFeatureKey}
                onChange={(event) => setOverrideFeatureKey(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
              >
                <option value="sms">Zalo/SMS</option>
                <option value="ktv">KTV</option>
                <option value="customer">Khách hàng</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Limit</span>
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
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Unit</span>
              <select
                value={overrideUnit}
                onChange={(event) => setOverrideUnit(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
              >
                <option value="message">Tin</option>
                <option value="count">Count</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reset</span>
              <select
                value={overrideResetPeriod}
                onChange={(event) => setOverrideResetPeriod(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 dark:border-[#3E3A35] bg-white dark:bg-[#11100F] px-4 py-3 text-sm font-bold outline-none focus:border-primary"
              >
                <option value="none">Không reset</option>
                <option value="daily">Hàng ngày</option>
                <option value="monthly">Hàng tháng</option>
                <option value="yearly">Hàng năm</option>
              </select>
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
            disabled={submittingOverride || loading || !overrideTenantId}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white disabled:opacity-50"
          >
            {submittingOverride ? <RefreshCw size={14} className="animate-spin" /> : <SlidersHorizontal size={14} />}
            Lưu quota override
          </button>
        </form>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1C1B19] border border-slate-100 dark:border-[#3E3A35] rounded-[2.5rem] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <Database size={18} className="text-amber-600" />
            <h4 className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-widest">Override active</h4>
          </div>
          {activeOverrides.length === 0 ? (
            <p className="text-xs font-bold italic text-slate-400 py-8 text-center">Chưa có quota override active.</p>
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
            <h4 className="text-xs font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-widest">Usage counters</h4>
          </div>
          {overview.usageCounters.length === 0 ? (
            <p className="text-xs font-bold italic text-slate-400 py-8 text-center">Chưa có usage counter nào.</p>
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
                      Reset
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
