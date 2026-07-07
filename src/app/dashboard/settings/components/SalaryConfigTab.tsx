'use client';
// Version: 2.0.0 - Configuration-Driven Payroll System

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Coins, Award, Calendar, Star, Save, Loader2 } from 'lucide-react';
import {
  loadKPIConfig,
  saveKPIConfig,
  loadAttendanceConfig,
  saveAttendanceConfig,
  loadRatingConfig,
  saveRatingConfig,
} from '@/services/payroll-config-actions';
import type { TenantGeneralSettings } from '@/types/domain';
import type {
  KPIThresholdConfig,
  AttendanceCombinedConfig,
  RatingThresholdConfig,
} from '@/types/payroll-config';

interface SalaryConfigTabProps {
  generalSettings: TenantGeneralSettings;
  setGeneralSettings: (settings: TenantGeneralSettings) => void;
}

export default function SalaryConfigTab({
  generalSettings,
  setGeneralSettings,
}: SalaryConfigTabProps) {
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // KPI Config
  const [kpiEnabled, setKpiEnabled] = useState(false);
  const [kpiTarget, setKpiTarget] = useState(30);
  const [kpiBonus, setKpiBonus] = useState(1000000);

  // Attendance Config
  const [attendanceEnabled, setAttendanceEnabled] = useState(true);
  const [latePenalty, setLatePenalty] = useState(50000);
  const [absentPenalty, setAbsentPenalty] = useState(200000);
  const [lateGracePeriod, setLateGracePeriod] = useState(15);

  // Rating Config
  const [ratingEnabled, setRatingEnabled] = useState(false);
  const [minRating, setMinRating] = useState(4.5);
  const [ratingBonus, setRatingBonus] = useState(50000);

  // Legacy fallback: Load from generalSettings.salary_config if new config not available
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Get tenantId from session/context
  useEffect(() => {
    async function fetchTenantId() {
      try {
        const { createClient } = await import('@/lib/supabase-client');
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile } = await supabase
            .from('users')
            .select('tenant_id')
            .eq('id', user.id)
            .single();
          
          if (profile?.tenant_id) {
            setTenantId(profile.tenant_id);
          }
        }
      } catch (error) {
        console.error('[SalaryConfigTab] Error fetching tenantId:', error);
      }
    }
    fetchTenantId();
  }, []);

  // Load configurations
  useEffect(() => {
    if (!tenantId) return;

    async function loadConfigs() {
      setIsLoading(true);
      try {
        // Load KPI
        const kpiResult = await loadKPIConfig(tenantId!);
        if (kpiResult.success && kpiResult.data) {
          setKpiEnabled(kpiResult.data.enabled);
          const config = kpiResult.data.config as KPIThresholdConfig;
          setKpiTarget(config.target || 30);
          setKpiBonus(config.bonus || 1000000);
        } else {
          // Fallback to legacy generalSettings
          setKpiTarget(generalSettings.salary_config?.kpi_target_sessions || 30);
          setKpiBonus(generalSettings.salary_config?.kpi_bonus_amount || 1000000);
        }

        // Load Attendance
        const attendanceResult = await loadAttendanceConfig(tenantId!);
        if (attendanceResult.success && attendanceResult.data) {
          setAttendanceEnabled(attendanceResult.data.enabled);
          const config = attendanceResult.data.config as AttendanceCombinedConfig;
          setLatePenalty(config.latePenalty || 50000);
          setAbsentPenalty(config.absentPenalty || 200000);
          setLateGracePeriod(config.lateGracePeriod || 15);
        } else {
          // Fallback to legacy generalSettings
          setLatePenalty(generalSettings.salary_config?.penalty_late_per_day || 50000);
          setAbsentPenalty(generalSettings.salary_config?.penalty_absent_per_day || 200000);
        }

        // Load Rating
        const ratingResult = await loadRatingConfig(tenantId!);
        if (ratingResult.success && ratingResult.data) {
          setRatingEnabled(ratingResult.data.enabled);
          const config = ratingResult.data.config as RatingThresholdConfig;
          setMinRating(config.minRating || 4.5);
          setRatingBonus(config.bonus || 50000);
        } else {
          // Fallback to legacy generalSettings
          setRatingBonus(generalSettings.salary_config?.bonus_5_star || 50000);
        }
      } catch (error) {
        console.error('[SalaryConfigTab] Error loading configs:', error);
        toast.error('Không thể tải cấu hình lương');
      } finally {
        setIsLoading(false);
      }
    }

    loadConfigs();
  }, [tenantId, generalSettings.salary_config]);

  // Save configurations
  const handleSave = async () => {
    if (!tenantId) {
      toast.error('Không tìm thấy tenant ID');
      return;
    }

    setIsSaving(true);
    try {
      // Save KPI
      const kpiResult = await saveKPIConfig(
        tenantId,
        kpiEnabled,
        'threshold',
        {
          target: kpiTarget,
          bonus: kpiBonus,
          metric: 'sessions',
        }
      );
      if (!kpiResult.success) {
        throw new Error(`KPI: ${kpiResult.error}`);
      }

      // Save Attendance
      const attendanceResult = await saveAttendanceConfig(
        tenantId,
        attendanceEnabled,
        'combined',
        {
          latePenalty,
          absentPenalty,
          lateGracePeriod,
        }
      );
      if (!attendanceResult.success) {
        throw new Error(`Attendance: ${attendanceResult.error}`);
      }

      // Save Rating
      const ratingResult = await saveRatingConfig(
        tenantId,
        ratingEnabled,
        'threshold',
        {
          minRating,
          bonus: ratingBonus,
        }
      );
      if (!ratingResult.success) {
        throw new Error(`Rating: ${ratingResult.error}`);
      }

      // Also update legacy generalSettings for backward compatibility
      setGeneralSettings({
        ...generalSettings,
        salary_config: {
          ...generalSettings.salary_config,
          kpi_target_sessions: kpiTarget,
          kpi_bonus_amount: kpiBonus,
          penalty_late_per_day: latePenalty,
          penalty_absent_per_day: absentPenalty,
          bonus_5_star: ratingBonus,
          bonus_4_5_star: Math.round(ratingBonus * 0.6),
          bonus_4_star: Math.round(ratingBonus * 0.2),
        },
      });

      toast.success('Đã lưu cấu hình lương thành công!');
    } catch (error: any) {
      console.error('[SalaryConfigTab] Save error:', error);
      toast.error(error.message || 'Không thể lưu cấu hình');
    } finally {
      setIsSaving(false);
    }
  };

  // Input helpers
  const parseIntegerInput = (value: string, { min = 0, max = 1000000000 } = {}) => {
    const num = parseInt(value.replace(/\D/g, ''), 10);
    if (isNaN(num)) return min;
    return Math.min(Math.max(num, min), max);
  };

  const parseFloatInput = (value: string, { min = 0, max = 5, decimals = 1 } = {}) => {
    const num = parseFloat(value);
    if (isNaN(num)) return min;
    return Math.min(Math.max(Number(num.toFixed(decimals)), min), max);
  };

  if (isLoading && !tenantId) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-[#EFE9E1] tracking-tight uppercase">
          Lương & Thưởng
        </h2>
        <p className="text-sm text-slate-500 dark:text-[#CDBCAB] mt-2 font-medium">
          Cấu hình các chính sách tính lương, thưởng KPI, phạt kỷ luật và thưởng chất lượng dịch vụ.
        </p>
      </div>

      {/* KPI Bonus Section */}
      <section className="bg-white dark:bg-[#1C1B19] rounded-3xl border border-slate-100 dark:border-[#3E3A35] p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 dark:bg-[#5D1C34]/30 rounded-2xl flex items-center justify-center">
              <Award className="w-6 h-6 text-primary dark:text-[#A67D44]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase">
                Thưởng KPI
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#CDBCAB] font-medium">
                Đạt mục tiêu ca làm việc → Nhận thưởng
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={kpiEnabled}
              onChange={(e) => setKpiEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-200 dark:bg-[#3E3A35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-[#2E2B27] after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary dark:peer-checked:bg-[#A67D44]"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Mục tiêu (số ca)
            </label>
            <input
              type="number"
              value={kpiTarget}
              onChange={(e) => setKpiTarget(parseIntegerInput(e.target.value, { min: 1, max: 500 }))}
              disabled={!kpiEnabled}
              className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-[#A67D44] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Thưởng (VNĐ)
            </label>
            <input
              type="number"
              value={kpiBonus}
              onChange={(e) => setKpiBonus(parseIntegerInput(e.target.value, { min: 0 }))}
              disabled={!kpiEnabled}
              className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-primary dark:focus:border-[#A67D44] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {!kpiEnabled && (
          <div className="bg-slate-50 dark:bg-[#11100F] border border-slate-100 dark:border-[#3E3A35] rounded-xl px-4 py-3 text-xs text-slate-500 dark:text-[#CDBCAB] font-medium">
            ⚠️ Thưởng KPI hiện đang <strong>tắt</strong>. KTV sẽ không nhận thưởng khi đạt mục tiêu.
          </div>
        )}
      </section>

      {/* Attendance Penalties Section */}
      <section className="bg-white dark:bg-[#1C1B19] rounded-3xl border border-slate-100 dark:border-[#3E3A35] p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-50 dark:bg-[#5D1C34]/30 rounded-2xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-rose-500 dark:text-[#A67D44]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase">
                Phạt Kỷ Luật
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#CDBCAB] font-medium">
                Đi trễ, Vắng mặt → Trừ lương
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={attendanceEnabled}
              onChange={(e) => setAttendanceEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-200 dark:bg-[#3E3A35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-[#2E2B27] after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-rose-500 dark:peer-checked:bg-[#5D1C34]"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Phạt đi trễ (VNĐ)
            </label>
            <input
              type="number"
              value={latePenalty}
              onChange={(e) => setLatePenalty(parseIntegerInput(e.target.value, { min: 0 }))}
              disabled={!attendanceEnabled}
              className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-rose-500 dark:focus:border-[#5D1C34] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Phạt vắng (VNĐ)
            </label>
            <input
              type="number"
              value={absentPenalty}
              onChange={(e) => setAbsentPenalty(parseIntegerInput(e.target.value, { min: 0 }))}
              disabled={!attendanceEnabled}
              className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-rose-500 dark:focus:border-[#5D1C34] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Dung sai (phút)
            </label>
            <input
              type="number"
              value={lateGracePeriod}
              onChange={(e) => setLateGracePeriod(parseIntegerInput(e.target.value, { min: 0, max: 60 }))}
              disabled={!attendanceEnabled}
              className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-rose-500 dark:focus:border-[#5D1C34] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {!attendanceEnabled && (
          <div className="bg-rose-50 dark:bg-[#5D1C34]/20 border border-rose-100 dark:border-[#5D1C34] rounded-xl px-4 py-3 text-xs text-rose-600 dark:text-[#EFE9E1] font-medium">
            ⚠️ Phạt kỷ luật hiện đang <strong>tắt</strong>. Hệ thống sẽ không tự động trừ lương khi KTV đi trễ hoặc vắng mặt.
          </div>
        )}
      </section>

      {/* Rating Bonus Section */}
      <section className="bg-white dark:bg-[#1C1B19] rounded-3xl border border-slate-100 dark:border-[#3E3A35] p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-50 dark:bg-[#A67D44]/20 rounded-2xl flex items-center justify-center">
              <Star className="w-6 h-6 text-amber-500 dark:text-[#A67D44]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-[#EFE9E1] uppercase">
                Thưởng Chất Lượng
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#CDBCAB] font-medium">
                Đánh giá khách hàng cao → Nhận thưởng
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={ratingEnabled}
              onChange={(e) => setRatingEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-slate-200 dark:bg-[#3E3A35] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 dark:after:border-[#2E2B27] after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-amber-500 dark:peer-checked:bg-[#A67D44]"></div>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Đánh giá tối thiểu (⭐)
            </label>
            <input
              type="number"
              step="0.1"
              value={minRating}
              onChange={(e) => setMinRating(parseFloatInput(e.target.value, { min: 0, max: 5 }))}
              disabled={!ratingEnabled}
              className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-amber-500 dark:focus:border-[#A67D44] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-xs font-black text-slate-600 dark:text-[#CDBCAB] uppercase tracking-wider mb-3 block">
              Thưởng (VNĐ)
            </label>
            <input
              type="number"
              value={ratingBonus}
              onChange={(e) => setRatingBonus(parseIntegerInput(e.target.value, { min: 0 }))}
              disabled={!ratingEnabled}
              className="w-full h-14 rounded-2xl border-2 border-slate-100 dark:border-[#3E3A35] bg-slate-50 dark:bg-[#11100F] px-5 text-base font-bold text-slate-900 dark:text-[#EFE9E1] focus:outline-none focus:border-amber-500 dark:focus:border-[#A67D44] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {!ratingEnabled && (
          <div className="bg-amber-50 dark:bg-[#A67D44]/20 border border-amber-100 dark:border-[#A67D44] rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-[#EFE9E1] font-medium">
            ⚠️ Thưởng chất lượng hiện đang <strong>tắt</strong>. KTV sẽ không nhận thưởng khi có đánh giá cao.
          </div>
        )}
      </section>

      {/* Save Button (shown at bottom for convenience) */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving || !tenantId}
          className="flex items-center gap-3 bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-2xl font-black transition-all shadow-xl shadow-pink-200/50 dark:shadow-none active:scale-95 uppercase tracking-wider disabled:opacity-50 disabled:grayscale"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
          <span>{isSaving ? 'Đang lưu...' : 'Lưu cấu hình'}</span>
        </button>
      </div>

      {/* Info Footer */}
      <div className="bg-blue-50 dark:bg-[#11100F] border border-blue-100 dark:border-[#3E3A35] rounded-2xl px-6 py-4">
        <p className="text-xs text-blue-700 dark:text-[#CDBCAB] font-medium leading-relaxed">
          💡 <strong>Lưu ý:</strong> Các thay đổi sẽ áp dụng cho kỳ lương hiện tại và các kỳ tiếp theo. 
          Bảng lương đã chốt (finalized) sẽ không bị ảnh hưởng.
        </p>
      </div>
    </div>
  );
}
