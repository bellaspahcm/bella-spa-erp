'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { resolvePackageName, getLocalDateString } from '@/lib/utils';
import { calcProRataBaseSalary } from './base-salary-actions';
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
  base_salary: number | null;
  kpi_bonus: number | null;
  violations_deduction: number | null;
  service_percentage_bonus: number | null;
  status: string | null;
}

interface SessionReviewDb {
  rating: number | null;
  status: string | null;
}

interface BookingDb {
  ktv_commission: number | null;
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
}

interface MatrixBookingDb {
  id: string;
  package_name: string | null;
  full_price: number | null;
  packages: { name: string | null } | null;
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
    const supabase = await createClient();
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;
    if (!tenantId) {
      console.warn('[getSalaryData] Không tìm thấy tenantId cho người dùng hiện tại');
      return [];
    }

    const { data: tenantData } = await supabase.from('tenants').select('salary_config').eq('id', tenantId).single();
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
    const penaltyLate   = salaryConfig.penalty_late_per_day   ?? 50000;
    const penaltyAbsent = salaryConfig.penalty_absent_per_day ?? 200000;

    // Fetch KTVs
    const ktvQuery = supabase
      .from('users')
      .select('id, full_name, role, base_salary, hire_date, resignation_date, status')
      .eq('role', 'ktv');

    // If current user is KTV, they can only see their own data
    if (currentUser?.role?.toLowerCase() === 'ktv') {
      ktvQuery.eq('id', currentUser.id);
    }

    const { data: ktvs } = await ktvQuery;
    const realKtvs = (ktvs || []) as KtvUserData[];

    const startOfMonthStr = currentMonthYear;
    const endOfMonthStr = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));

    const { data: salaryRecordsData } = await supabase
      .from('salary_records')
      .select('*')
      .eq('month_year', currentMonthYear);
    
    const salaryRecords = (salaryRecordsData || []) as SalaryRecordDb[];

    // Fetch completed sessions with booking details + rating fallback
    const { data: sessionsData } = await supabase
      .from('session_logs')
      .select('id, completed_by_ktv_id, status, is_confirmed, rating, bookings(ktv_commission), session_reviews(rating, status)')
      .eq('status', 'completed')
      .gte('completed_date', startOfMonthStr)
      .lt('completed_date', endOfMonthStr);

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
    }[];
    const leaderboardByKtv = new Map<string, typeof leaderboard[number]>(
      leaderboard.map((row) => [row.ktv_id, row])
    );

    // Fetch all attendance logs this month
    const { data: attendanceLogs } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', startOfMonthStr)
      .lt('date', endOfMonthStr);

    const attendanceLogsTyped = (attendanceLogs || []) as unknown as AttendanceLogDb[];

    const ktvSalaries = await Promise.all(realKtvs.map(async (ktv) => {
        const record = salaryRecords.find((r) => r.ktv_id === ktv.id);
        
        const ktvCompletedSessions = sessions.filter((s) => s.completed_by_ktv_id === ktv.id);
        // Use confirmed count from record if available, otherwise use live count
        const ktvSessionsCount = record?.total_sessions || ktvCompletedSessions.length;
        
        // Blended composite rating + attendance breakdown from RPC.
        const ktvLb = leaderboardByKtv.get(ktv.id);
        const avgRating: number | null = ktvLb?.average_rating ?? null;
        const lateDays   = ktvLb?.late_days   ?? 0;
        const absentDays = ktvLb?.absent_days ?? 0;
        const autoAttendancePenalty = (lateDays * penaltyLate) + (absentDays * penaltyAbsent);

        let bonusPerSession = 0;
        if (avgRating !== null) {
          if (avgRating === 5.0) bonusPerSession = salaryConfig.bonus_5_star;
          else if (avgRating >= 4.5) bonusPerSession = salaryConfig.bonus_4_5_star;
          else if (avgRating >= 4.0) bonusPerSession = salaryConfig.bonus_4_star;
        }

        const ratingBonus = ktvSessionsCount * bonusPerSession;
        const status = record?.status || 'draft';

        const sessionBonus = ktvCompletedSessions.reduce((acc: number, s) => {
          return acc + (s.bookings?.ktv_commission || 150000);
        }, 0);

        // Attendance tracking
        const ktvAttendance = attendanceLogsTyped.filter((a) => a.ktv_id === ktv.id);
        let actualDays = 0;
        ktvAttendance.forEach((att) => {
          if (att.status === 'present' || att.status === 'late') {
            actualDays += 1.0;
          } else if (att.status === 'half_day') {
            actualDays += 0.5;
          }
        });

        const rawBaseSalary = record?.base_salary ?? ktv.base_salary ?? 6000000;
        let baseSalary = rawBaseSalary;
        if (record?.base_salary !== undefined && record.base_salary !== null) {
          baseSalary = record.base_salary;
        } else if (ktvAttendance.length > 0) {
          baseSalary = Math.round((rawBaseSalary / 26) * actualDays);
        } else {
          baseSalary = rawBaseSalary;
        }

        // Cap by resignation date in draft if resignation is active
        if ((record?.base_salary === undefined || record?.base_salary === null) && ktv.resignation_date) {
          const resignDate = new Date(ktv.resignation_date);
          const monthDate = new Date(currentMonthYear);
          if (resignDate.getFullYear() === now.getFullYear() && resignDate.getMonth() === now.getMonth()) {
            const resignCap = await calcProRataBaseSalary(rawBaseSalary, resignDate, monthDate);
            if (baseSalary > resignCap) {
              baseSalary = resignCap;
            }
          }
        }

        const kpiBonus = record?.kpi_bonus ?? (ktvSessionsCount > salaryConfig.kpi_target_sessions ? salaryConfig.kpi_bonus_amount : 0);
        // Deductions priority:
        //  1. Admin đã chốt manual (record.violations_deduction !== null) → giữ nguyên (đã review)
        //  2. Chưa có record → auto-compute từ attendance (late × X + absent × Y)
        const deductions = record?.violations_deduction ?? autoAttendancePenalty;
        const advances = record?.service_percentage_bonus || 0;
        const totalSalary = baseSalary + sessionBonus + kpiBonus + ratingBonus - deductions - advances;

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
          actualDays: ktvAttendance.length > 0 ? actualDays : 26,
        };
    }));

    return ktvSalaries;
  } catch (error) {
    console.error('Error in getSalaryData:', error);
    return [];
  }
}

export async function getKtvSessionMatrix(): Promise<KtvSessionMatrix> {
  const { unstable_noStore: noStore } = await import('next/cache');
  noStore();
  
  const supabase = await createClient();
  
  try {
    // 1. Fetch all KTVs
    const { data: ktvs } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'ktv');

    const realKtvs = (ktvs || []) as MatrixKtvUser[];

    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endOfMonthStr = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));

    // 2. Fetch salary records for confirmation status
    const { data: salaryRecordsData } = await supabase
      .from('salary_records')
      .select('ktv_id, total_sessions, status')
      .eq('month_year', currentMonthYear);

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
            name
          )
        )
      `)
      .eq('status', 'completed')
      .gte('completed_date', currentMonthYear)
      .lt('completed_date', endOfMonthStr);

    if (sessionsError) console.error('Error fetching sessions:', sessionsError);

    const sessionsTyped = (sessions || []) as unknown as MatrixSessionLogDb[];

    // 4. Group sessions by KTV and package
    const matrix: Record<string, Record<string, number>> = {};
    
    // Fetch all available packages from the database to ensure all columns are shown
    const { data: allPackages } = await supabase.from('packages').select('name');
    const packagesTyped = (allPackages || []) as PackageNameDb[];
    
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
        matrix[ktvId][pkgName] = (matrix[ktvId][pkgName] || 0) + 1;
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
    return { ktvs: [], packageNames: [] };
  }
}
