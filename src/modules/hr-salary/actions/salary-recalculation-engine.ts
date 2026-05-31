'use server';

import { getLocalDateString } from '@/lib/utils';
import { Database } from '@/types/database.types';
import { TenantSalaryConfig } from '@/types/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calcProRataBaseSalary } from './base-salary-actions';

interface KtvUserDataAdmin {
  id: string;
  full_name: string | null;
  base_salary: number | null;
  resignation_date: string | null;
  tenant_id?: string | null;
}

interface AttendanceLogAdmin {
  id: string;
  ktv_id: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'half_day';
}

interface SessionLogAdmin {
  id: string;
  rating: number | null;
  bookings: { ktv_commission: number | null; package_name: string | null } | null;
  session_reviews: { rating: number | null; status: string | null }[];
}

interface PackageMultiplierRow {
  name: string | null;
  session_multiplier: number | null;
}

interface KpiBonusRow {
  bonus_amount: number | null;
}

export interface SalaryRecordDbAdmin {
  id: string;
  ktv_id: string;
  month_year: string;
  base_salary: number | null;
  session_bonus: number | null;
  rating_bonus: number | null;
  kpi_bonus: number | null;
  violations_deduction: number | null;
  service_percentage_bonus: number | null;
  total_sessions: number | null;
  total_salary: number | null;
  status: string | null;
  published_at?: string | null;
  notes?: string | null;
  tenant_id: string;
  users?: { full_name: string | null } | null;
}

export interface SalaryRecalculationOverrides {
  base_salary?: number;
  kpi_bonus?: number;
  violations_deduction?: number;
  service_percentage_bonus?: number;
  status?: string;
  total_sessions?: number;
}

/**
 * Recalculate and save a KTV salary record.
 * Keeps pro-rata base salary, session multipliers, KPI, rating bonus, deductions,
 * and non-draft preservation rules in one central engine.
 */
export async function recalculateAndSaveSalaryRecordEngine(
  supabase: SupabaseClient<Database>,
  ktvId: string,
  monthYear: string,
  tenantId: string,
  overrides?: SalaryRecalculationOverrides
) {
  const { data: ktvData, error: ktvError } = await supabase
    .from('users')
    .select('id, full_name, base_salary, resignation_date')
    .eq('id', ktvId)
    .single();

  if (ktvError) throw ktvError;
  const ktv = ktvData as KtvUserDataAdmin | null;

  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('salary_config')
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantError) throw tenantError;
  const stored = (tenantData?.salary_config as unknown as Partial<TenantSalaryConfig>) || {};
  const salaryConfig: TenantSalaryConfig = {
    bonus_5_star: stored.bonus_5_star ?? 50000,
    bonus_4_5_star: stored.bonus_4_5_star ?? 30000,
    bonus_4_star: stored.bonus_4_star ?? 10000,
    kpi_target_sessions: stored.kpi_target_sessions ?? 30,
    kpi_bonus_amount: stored.kpi_bonus_amount ?? 1000000,
    penalty_late_per_day: stored.penalty_late_per_day ?? 50000,
    penalty_absent_per_day: stored.penalty_absent_per_day ?? 200000,
  };
  const penaltyLate = salaryConfig.penalty_late_per_day ?? 50000;
  const penaltyAbsent = salaryConfig.penalty_absent_per_day ?? 200000;

  const startOfMonthStr = monthYear;
  const endOfMonthStr = getLocalDateString(new Date(new Date(monthYear).getFullYear(), new Date(monthYear).getMonth() + 1, 1));

  const { data: attendanceList, error: attError } = await supabase
    .from('attendance')
    .select('status, date')
    .eq('ktv_id', ktvId)
    .gte('date', startOfMonthStr)
    .lt('date', endOfMonthStr);

  if (attError) throw attError;
  const attendanceListTyped = (attendanceList || []) as unknown as AttendanceLogAdmin[];

  let actualDays = 0;
  if (attendanceListTyped.length > 0) {
    attendanceListTyped.forEach((att) => {
      if (att.status === 'present' || att.status === 'late') {
        actualDays += 1.0;
      } else if (att.status === 'half_day') {
        actualDays += 0.5;
      }
    });
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from('session_logs')
    .select('id, rating, bookings(ktv_commission, package_name), session_reviews(rating, status)')
    .eq('completed_by_ktv_id', ktvId)
    .eq('status', 'completed')
    .gte('completed_date', startOfMonthStr)
    .lt('completed_date', endOfMonthStr);

  if (sessionsError) throw sessionsError;
  const sessionsTyped = (sessions || []) as unknown as SessionLogAdmin[];

  const { data: packagesData, error: packagesError } = await supabase
    .from('packages')
    .select('name, session_multiplier')
    .eq('tenant_id', tenantId);

  if (packagesError) throw packagesError;
  const packagesList = (packagesData || []) as PackageMultiplierRow[];

  const packageMultiplierMap = new Map<string, number>();
  packagesList.forEach((pkg) => {
    if (pkg.name) {
      packageMultiplierMap.set(pkg.name, Number(pkg.session_multiplier ?? 1.0));
    }
  });

  const sessionsCount = overrides?.total_sessions !== undefined
    ? overrides.total_sessions
    : sessionsTyped.reduce((acc: number, s) => {
        const pkgName = s.bookings?.package_name || '';
        const multiplier = packageMultiplierMap.get(pkgName) ?? 1.0;
        return acc + multiplier;
      }, 0);

  const sessionBonus = sessionsTyped.reduce((acc: number, s) =>
    acc + (s.bookings?.ktv_commission || 150000), 0);

  const { data: leaderboardData, error: leaderboardError } = await supabase.rpc(
    'get_ktv_leaderboard',
    { p_tenant_id: tenantId, p_month: monthYear }
  );
  if (leaderboardError) throw leaderboardError;

  const leaderboard = (leaderboardData || []) as unknown as {
    ktv_id: string;
    average_rating: number | null;
    late_days: number | null;
    absent_days: number | null;
  }[];
  const ktvRow = leaderboard.find((row) => row.ktv_id === ktvId);
  const avgRating: number | null = ktvRow?.average_rating ?? null;
  const lateDays = ktvRow?.late_days ?? 0;
  const absentDays = ktvRow?.absent_days ?? 0;
  const autoAttendancePenalty = (lateDays * penaltyLate) + (absentDays * penaltyAbsent);

  let bonusPerSession = 0;
  if (avgRating !== null) {
    if (avgRating === 5.0) bonusPerSession = salaryConfig.bonus_5_star;
    else if (avgRating >= 4.5) bonusPerSession = salaryConfig.bonus_4_5_star;
    else if (avgRating >= 4.0) bonusPerSession = salaryConfig.bonus_4_star;
  }
  const ratingBonus = sessionsCount * bonusPerSession;

  const { data: kpiRecords, error: kpiError } = await supabase
    .from('kpi_records')
    .select('bonus_amount')
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear);

  if (kpiError) throw kpiError;
  const kpiRecordsTyped = (kpiRecords || []) as KpiBonusRow[];
  const dbKpiBonus = kpiRecordsTyped.reduce((acc, k) => acc + Number(k.bonus_amount || 0), 0);

  const { data: existingData, error: existingError } = await supabase
    .from('salary_records')
    .select('*')
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear)
    .maybeSingle();

  if (existingError) throw existingError;
  const existing = existingData as SalaryRecordDbAdmin | null;

  const rawBaseSalary = ktv?.base_salary ?? 6000000;
  let proRataNote = '';

  const isDraft = !existing || existing.status === 'draft';

  let finalBaseSalary: number;
  if (overrides?.base_salary !== undefined) {
    finalBaseSalary = overrides.base_salary;
  } else if (existing && !isDraft && existing.base_salary !== null && existing.base_salary !== undefined) {
    finalBaseSalary = Number(existing.base_salary);
    if (existing.notes) proRataNote = existing.notes;
  } else if (attendanceListTyped.length > 0) {
    finalBaseSalary = Math.round((rawBaseSalary / 26) * actualDays);
    proRataNote = `📊 Công thực tế: ${actualDays}/26 ngày. `;
  } else {
    finalBaseSalary = rawBaseSalary;
    proRataNote = `ℹ️ Áp dụng lương cứng mặc định (Chưa có dữ liệu chấm công). `;
  }

  let deductions: number;
  if (overrides?.violations_deduction !== undefined) {
    deductions = overrides.violations_deduction;
  } else if (existing && !isDraft && existing.violations_deduction !== null && existing.violations_deduction !== undefined) {
    deductions = Number(existing.violations_deduction);
    if (existing.notes && !proRataNote) proRataNote = existing.notes;
  } else {
    deductions = autoAttendancePenalty;
  }

  if (overrides?.violations_deduction === undefined && isDraft && (lateDays > 0 || absentDays > 0)) {
    proRataNote += `⚠️ Tự động trừ ${autoAttendancePenalty.toLocaleString('vi-VN')}đ (trễ ${lateDays} ngày × ${penaltyLate.toLocaleString('vi-VN')}đ + vắng ${absentDays} ngày × ${penaltyAbsent.toLocaleString('vi-VN')}đ). `;
  }

  const advances = overrides?.service_percentage_bonus !== undefined
    ? overrides.service_percentage_bonus
    : (existing?.service_percentage_bonus ?? 0);

  const finalKpiBonus = overrides?.kpi_bonus !== undefined
    ? overrides.kpi_bonus
    : (existing && !isDraft && existing.kpi_bonus !== null && existing.kpi_bonus !== undefined ? Number(existing.kpi_bonus) : dbKpiBonus);

  if (ktv?.resignation_date) {
    const resignDate = new Date(ktv.resignation_date);
    const monthDate = new Date(monthYear);
    const now = new Date();
    if (resignDate.getFullYear() === now.getFullYear() && resignDate.getMonth() === now.getMonth()) {
      const resignCap = await calcProRataBaseSalary(rawBaseSalary, resignDate, monthDate);
      if (finalBaseSalary > resignCap) {
        finalBaseSalary = resignCap;
      }
      proRataNote += `⚠️ KTV nghỉ việc từ ngày ${resignDate.toLocaleDateString('vi-VN')}`;
    }
  }

  const totalSalary = Math.max(0, finalBaseSalary + sessionBonus + ratingBonus + finalKpiBonus - deductions - advances);
  const status = overrides?.status || existing?.status || 'draft';

  const payload: Database['public']['Tables']['salary_records']['Insert'] = {
    ktv_id: ktvId,
    month_year: monthYear,
    base_salary: finalBaseSalary,
    session_bonus: sessionBonus,
    rating_bonus: ratingBonus,
    kpi_bonus: finalKpiBonus,
    violations_deduction: deductions,
    service_percentage_bonus: advances,
    total_sessions: sessionsCount,
    total_salary: totalSalary,
    status,
    published_at: overrides?.status === 'published' ? new Date().toISOString() : (existing?.published_at || null),
    notes: proRataNote || null,
    tenant_id: tenantId,
  };

  let result;
  if (existing) {
    result = await supabase
      .from('salary_records')
      .update(payload as Database['public']['Tables']['salary_records']['Update'])
      .eq('id', existing.id);
  } else {
    result = await supabase
      .from('salary_records')
      .insert(payload);
  }

  if (result.error) throw result.error;

  return { success: true, totalSalary };
}
