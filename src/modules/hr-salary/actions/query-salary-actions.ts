'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { resolvePackageName, getLocalDateString } from '@/lib/utils';
import { calculateAttendancePenalty } from '@/lib/business-rules/attendance';
import { calcProRataBaseSalary } from './base-salary-actions';
import {
  buildPackageMultiplierMap,
  calculateAttendanceWorkDays,
  calculateProRataBaseSalaryFromActualDays,
  calculateRatingBonus,
  calculateSessionCommissionBonus,
  calculateWeightedSessionCount,
  getSessionPackageMultiplier,
} from './salary-attendance-calculation';
import { KtvSalaryRecord, KtvSessionMatrix, KtvSessionMatrixRecord, TenantSalaryConfig } from '@/types/domain';

// Interfaces for Database Records
interface KtvUserData {
  id: string;
  full_name: string | null;
  role: string | null;
  base_salary: number | null;
  hire_date: string | null;
  resignation_date: string | null;
  status: string | null;
}

interface SalaryRecordDb {
  id: string;
  ktv_id: string;
  month_year: string;
  total_sessions: number | null;
  session_bonus: number | null;
  rating_bonus: number | null;
  base_salary: number | null;
  kpi_bonus: number | null;
  violations_deduction: number | null;
  service_percentage_bonus: number | null;
  total_salary: number | null;
  status: string | null;
}

interface SessionReviewDb {
  rating: number | null;
  status: string | null;
}

interface BookingDb {
  ktv_commission: number | null;
  package_name: string | null;
}

interface SessionLogDb {
  id: string;
  completed_by_ktv_id: string | null;
  status: string | null;
  is_confirmed: boolean | null;
  rating: number | null;
  bookings: BookingDb | null;
  session_reviews: SessionReviewDb[];
}

interface AttendanceLogDb {
  id: string;
  ktv_id: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'half_day';
}

interface PackageNameDb {
  name: string | null;
  session_multiplier: number | null;
}

interface KpiRecordDb {
  ktv_id: string;
  bonus_amount: number | null;
}

interface MatrixBookingDb {
  id: string;
  package_name: string | null;
  full_price: number | null;
  packages: { name: string | null; session_multiplier: number | null } | null;
}

interface MatrixSessionLogDb {
  id: string;
  completed_by_ktv_id: string | null;
  status: string | null;
  is_confirmed: boolean | null;
  bookings: MatrixBookingDb | null;
}

interface MatrixKtvUser {
  id: string;
  full_name: string | null;
}

export async function getSalaryData(): Promise<KtvSalaryRecord[]> {
  try {
    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const supabase = await createDevelopmentBypassClient();
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;
    if (!tenantId) {
      throw new Error('[getSalaryData] Missing tenantId for current user');
    }

    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('salary_config')
      .eq('id', tenantId)
      .single();
    if (tenantError) {
      throw new Error(`[getSalaryData] tenants query failed: ${tenantError.message}`);
    }
    const stored = (tenantData?.salary_config as unknown as Partial<TenantSalaryConfig>) || {};
    const salaryConfig: TenantSalaryConfig = {
      bonus_5_star:          stored.bonus_5_star          ?? 50000,
      bonus_4_5_star:        stored.bonus_4_5_star        ?? 30000,
      bonus_4_star:          stored.bonus_4_star          ?? 10000,
      kpi_target_sessions:   stored.kpi_target_sessions   ?? 30,
      kpi_bonus_amount:      stored.kpi_bonus_amount      ?? 1000000,
      penalty_late_per_day:  stored.penalty_late_per_day  ?? 50000,
      penalty_absent_per_day: stored.penalty_absent_per_day ?? 200000,
    };

    // Fetch KTVs
    const ktvQuery = supabase
      .from('users')
      .select('id, full_name, role, base_salary, hire_date, resignation_date, status')
      .eq('role', 'ktv')
      .eq('tenant_id', tenantId);

    // If current user is KTV, they can only see their own data
    if (currentUser?.role?.toLowerCase() === 'ktv') {
      ktvQuery.eq('id', currentUser.id);
    }

    const { data: ktvs, error: ktvsError } = await ktvQuery;
    if (ktvsError) {
      throw new Error(`[getSalaryData] users query failed: ${ktvsError.message}`);
    }
    const realKtvs = (ktvs || []) as KtvUserData[];

    const startOfMonthStr = currentMonthYear;
    const endOfMonthStr = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));

    const { data: salaryRecordsData, error: salaryRecordsError } = await supabase
      .from('salary_records')
      .select('*')
      .eq('month_year', currentMonthYear)
      .eq('tenant_id', tenantId);
    if (salaryRecordsError) {
      throw new Error(`[getSalaryData] salary_records query failed: ${salaryRecordsError.message}`);
    }
    
    const salaryRecords = (salaryRecordsData || []) as SalaryRecordDb[];

    // Fetch completed sessions with booking details + rating fallback
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('session_logs')
      .select('id, completed_by_ktv_id, status, is_confirmed, rating, bookings(ktv_commission, package_name), session_reviews(rating, status)')
      .eq('status', 'completed')
      .gte('completed_date', startOfMonthStr)
      .lt('completed_date', endOfMonthStr)
      .eq('tenant_id', tenantId);
    if (sessionsError) {
      throw new Error(`[getSalaryData] session_logs query failed: ${sessionsError.message}`);
    }

    const sessions = (sessionsData || []) as unknown as SessionLogDb[];

    // Fetch blended composite ratings (60% customer + 40% discipline) via RPC.
    // Single source of truth — same data the leaderboard and dashboard cards use.
    // KTVs with no activity yet have average_rating = null → no quality bonus.
    const { data: leaderboardData, error: leaderboardError } = await supabase.rpc(
      'get_ktv_leaderboard',
      { p_tenant_id: tenantId, p_month: currentMonthYear }
    );
    if (leaderboardError) {
      console.error('[getSalaryData] get_ktv_leaderboard failed:', leaderboardError);
      throw new Error(`get_ktv_leaderboard failed: ${leaderboardError.message}`);
    }
    const leaderboard = (leaderboardData || []) as unknown as {
      ktv_id: string;
      average_rating: number | null;
      late_days: number | null;
      absent_days: number | null;
      total_kpi_bonus: number | null;
    }[];
    const leaderboardByKtv = new Map<string, typeof leaderboard[number]>(
      leaderboard.map((row) => [row.ktv_id, row])
    );

    // Fetch all attendance logs this month
    const { data: attendanceLogs, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', startOfMonthStr)
      .lt('date', endOfMonthStr)
      .eq('tenant_id', tenantId);
    if (attendanceError) {
      throw new Error(`[getSalaryData] attendance query failed: ${attendanceError.message}`);
    }

    const attendanceLogsTyped = (attendanceLogs || []) as unknown as AttendanceLogDb[];

    // Fetch packages for multiplier mapping
    const { data: packagesData, error: packagesError } = await supabase
      .from('packages')
      .select('name, session_multiplier')
      .eq('tenant_id', tenantId);

    if (packagesError) {
      throw new Error(`[getSalaryData] packages query failed: ${packagesError.message}`);
    }
    const packagesList = packagesData || [];
    const packageMultiplierMap = buildPackageMultiplierMap(packagesList);

    const { data: kpiRecordsData, error: kpiRecordsError } = await supabase
      .from('kpi_records')
      .select('ktv_id, bonus_amount')
      .eq('month_year', currentMonthYear)
      .eq('tenant_id', tenantId);
    if (kpiRecordsError) {
      throw new Error(`[getSalaryData] kpi_records query failed: ${kpiRecordsError.message}`);
    }

    const kpiBonusByKtv = new Map<string, number>();
    ((kpiRecordsData || []) as KpiRecordDb[]).forEach((record) => {
      kpiBonusByKtv.set(record.ktv_id, (kpiBonusByKtv.get(record.ktv_id) ?? 0) + Number(record.bonus_amount || 0));
    });

    const ktvSalaries = await Promise.all(realKtvs.map(async (ktv) => {
        const record = salaryRecords.find((r) => r.ktv_id === ktv.id);
        const status = record?.status || 'draft';
        const isDraft = !record || record.status === 'draft';
        const shouldUseSavedFinancials = Boolean(record && !isDraft);
        
        const ktvCompletedSessions = sessions.filter((s) => s.completed_by_ktv_id === ktv.id);
        const liveSessionsCount = calculateWeightedSessionCount(ktvCompletedSessions, packageMultiplierMap);
        const ktvSessionsCount = shouldUseSavedFinancials && record?.total_sessions !== undefined && record.total_sessions !== null
          ? Number(record.total_sessions)
          : liveSessionsCount;
        
        // Blended composite rating + attendance breakdown from RPC.
        const ktvLb = leaderboardByKtv.get(ktv.id);
        const avgRating: number | null = ktvLb?.average_rating ?? null;
        const lateDays   = ktvLb?.late_days   ?? 0;
        const absentDays = ktvLb?.absent_days ?? 0;
        const autoAttendancePenalty = calculateAttendancePenalty({
          lateDays,
          absentDays,
          penaltyLatePerDay: salaryConfig.penalty_late_per_day,
          penaltyAbsentPerDay: salaryConfig.penalty_absent_per_day,
        }).totalPenalty;

        const liveRatingBonus = calculateRatingBonus(ktvSessionsCount, avgRating, salaryConfig);
        const ratingBonus = shouldUseSavedFinancials && record?.rating_bonus !== undefined && record.rating_bonus !== null
          ? Number(record.rating_bonus)
          : liveRatingBonus;

        const liveSessionBonus = calculateSessionCommissionBonus(ktvCompletedSessions);
        const sessionBonus = shouldUseSavedFinancials && record?.session_bonus !== undefined && record.session_bonus !== null
          ? Number(record.session_bonus)
          : liveSessionBonus;

        // Attendance tracking
        const ktvAttendance = attendanceLogsTyped.filter((a) => a.ktv_id === ktv.id);
        const actualDays = calculateAttendanceWorkDays(ktvAttendance);

        const rawBaseSalary = ktv.base_salary ?? 6000000;
        let baseSalary: number;

        // Base salary display: Use record value if not draft, or recalculate if draft
        if (record?.base_salary !== undefined && record.base_salary !== null && !isDraft) {
          baseSalary = Number(record.base_salary);
        } else {
          baseSalary = calculateProRataBaseSalaryFromActualDays(rawBaseSalary, actualDays);
        }

        // Cap by resignation date if active
        if (ktv.resignation_date) {
          const resignDate = new Date(ktv.resignation_date);
          const monthDate = new Date(currentMonthYear);
          if (resignDate.getFullYear() === now.getFullYear() && resignDate.getMonth() === now.getMonth()) {
            const resignCap = await calcProRataBaseSalary(rawBaseSalary, resignDate, monthDate);
            if (baseSalary > resignCap) {
              baseSalary = resignCap;
            }
          }
        }

        const kpiBonus = record?.kpi_bonus !== null && record?.kpi_bonus !== undefined && !isDraft
          ? Number(record.kpi_bonus)
          : (kpiBonusByKtv.get(ktv.id) ?? 0);

        // Deductions display: Use record value if not draft, or recalculate if draft
        let deductions: number;
        if (record?.violations_deduction !== undefined && record.violations_deduction !== null && !isDraft) {
          deductions = Number(record.violations_deduction);
        } else {
          deductions = autoAttendancePenalty;
        }

        const advances = record?.service_percentage_bonus !== undefined && record.service_percentage_bonus !== null
          ? Number(record.service_percentage_bonus)
          : 0;

        const liveTotalSalary = Math.max(0, baseSalary + sessionBonus + kpiBonus + ratingBonus - deductions - advances);
        const totalSalary = shouldUseSavedFinancials && record?.total_salary !== undefined && record.total_salary !== null
          ? Number(record.total_salary)
          : liveTotalSalary;

        return {
          id: ktv.id,
          name: ktv.full_name || '',
          sessions: ktvSessionsCount,
          isConfirmed: status === 'confirmed' || status === 'finalized',
          avgRating,
          baseSalary,
          sessionBonus,
          ratingBonus,
          kpiBonus,
          deductions,
          advances,
          totalSalary,
          status,
          hireDate: ktv.hire_date,
          resignationDate: ktv.resignation_date,
          ktvStatus: ktv.status || 'active',
          actualDays,
        };
    }));

    return ktvSalaries;
  } catch (error) {
    console.error('Error in getSalaryData:', error);
    throw error instanceof Error ? error : new Error('getSalaryData failed');
  }
}

export async function getKtvSessionMatrix(): Promise<KtvSessionMatrix> {
  const { unstable_noStore: noStore } = await import('next/cache');
  noStore();
  
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) {
    throw new Error('getKtvSessionMatrix missing tenantId for current user');
  }
  
  try {
    // 1. Fetch all KTVs
    const ktvQuery = supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'ktv')
      .eq('tenant_id', tenantId);

    if (currentUser?.role?.toLowerCase() === 'ktv') {
      ktvQuery.eq('id', currentUser.id);
    }

    const { data: ktvs, error: ktvsError } = await ktvQuery;
    if (ktvsError) {
      throw new Error(`getKtvSessionMatrix users query failed: ${ktvsError.message}`);
    }

    const realKtvs = (ktvs || []) as MatrixKtvUser[];

    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endOfMonthStr = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));

    // 2. Fetch salary records for confirmation status
    const { data: salaryRecordsData, error: salaryRecordsError } = await supabase
      .from('salary_records')
      .select('ktv_id, total_sessions, status')
      .eq('month_year', currentMonthYear)
      .eq('tenant_id', tenantId);
    if (salaryRecordsError) {
      throw new Error(`getKtvSessionMatrix salary_records query failed: ${salaryRecordsError.message}`);
    }

    const salaryRecords = (salaryRecordsData || []) as SalaryRecordDb[];

    // 3. Fetch completed sessions with booking details
    const { data: sessions, error: sessionsError } = await supabase
      .from('session_logs')
      .select(`
        id, 
        completed_by_ktv_id, 
        status, 
        is_confirmed,
        bookings (
          id,
          package_name,
          full_price,
          packages (
            name,
            session_multiplier
          )
        )
      `)
      .eq('status', 'completed')
      .gte('completed_date', currentMonthYear)
      .lt('completed_date', endOfMonthStr)
      .eq('tenant_id', tenantId);

    if (sessionsError) {
      throw new Error(`getKtvSessionMatrix session_logs query failed: ${sessionsError.message}`);
    }

    const sessionsTyped = (sessions || []) as unknown as MatrixSessionLogDb[];

    // 4. Group sessions by KTV and package
    const matrix: Record<string, Record<string, number>> = {};
    
    // Fetch all available packages from the database to ensure all columns are shown
    const { data: allPackages, error: packagesError } = await supabase
      .from('packages')
      .select('name, session_multiplier')
      .eq('tenant_id', tenantId);
    if (packagesError) {
      throw new Error(`getKtvSessionMatrix packages query failed: ${packagesError.message}`);
    }
    const packagesTyped = (allPackages || []) as PackageNameDb[];
    const packageMultiplierMap = buildPackageMultiplierMap(packagesTyped);
    
    // Build list of package names from sessions AND available packages
    const dynamicPackageNames = new Set<string>();
    
    // Add all existing packages to the columns list
    if (packagesTyped) {
      packagesTyped.forEach((pkg) => {
        if (pkg.name) dynamicPackageNames.add(pkg.name);
      });
    }

    if (sessionsTyped) {
      sessionsTyped.forEach((s) => {
        const pkgName = s.bookings ? resolvePackageName(s.bookings) : 'Dịch vụ lẻ';
        dynamicPackageNames.add(pkgName);
      });
    }
    const packageNames = Array.from(dynamicPackageNames);
    if (!packageNames.includes('Dịch vụ lẻ')) packageNames.push('Dịch vụ lẻ');
    
    if (sessionsTyped && sessionsTyped.length > 0) {
      sessionsTyped.forEach((s) => {
        const ktvId = s.completed_by_ktv_id;
        if (!ktvId) return;

        const pkgName = s.bookings ? resolvePackageName(s.bookings) : 'Dịch vụ lẻ';
        
        if (!matrix[ktvId]) matrix[ktvId] = {};
        matrix[ktvId][pkgName] = (matrix[ktvId][pkgName] || 0) + getSessionPackageMultiplier(s, packageMultiplierMap);
      });
    }

    const hasAnyRealData = sessionsTyped && sessionsTyped.length > 0;
    
    const rows = realKtvs.map((ktv) => {
      const row: KtvSessionMatrixRecord = { id: ktv.id, name: ktv.full_name || '', isConfirmed: false };
      
      // Determine if this KTV's sessions are confirmed
      const salaryRecord = salaryRecords.find((r) => r.ktv_id === ktv.id);
      
      // Confirmed ONLY if status is explicitly pending_approval or approved
      row.isConfirmed = !!(salaryRecord && 
                        (salaryRecord.status === 'pending_approval' || salaryRecord.status === 'approved'));
      
      packageNames.forEach((pkg: string) => {
        if (hasAnyRealData && matrix[ktv.id]) {
          row[pkg] = matrix[ktv.id][pkg] || 0;
        } else {
          row[pkg] = 0;
        }
      });
      return row;
    });

    return { 
      packageNames, 
      ktvs: rows
    };
  } catch (error) {
    console.error('Critical error in getKtvSessionMatrix:', error);
    throw error instanceof Error ? error : new Error('getKtvSessionMatrix failed');
  }
}
