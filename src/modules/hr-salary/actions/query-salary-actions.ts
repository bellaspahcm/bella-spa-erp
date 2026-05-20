'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { resolvePackageName, getLocalDateString } from '@/lib/utils';
import { calcProRataBaseSalary } from './base-salary-actions';
import { getMonthStart } from '@/lib/utils';

export async function getSalaryData() {
  try {
    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const supabase = (await createClient()) as any;
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;
    if (!tenantId) {
      console.warn('[getSalaryData] Không tìm thấy tenantId cho người dùng hiện tại');
      return [];
    }

    const { data: tenantData } = await supabase.from('tenants').select('salary_config').eq('id', tenantId).single();
    const salaryConfig = tenantData?.salary_config || {
      bonus_5_star: 50000,
      bonus_4_5_star: 30000,
      bonus_4_star: 10000,
      kpi_target_sessions: 30,
      kpi_bonus_amount: 1000000
    };

    // Fetch KTVs
    const ktvQuery = supabase
      .from('users')
      .select('id, full_name, role, base_salary, hire_date, resignation_date, status')
      .eq('role', 'ktv');

    // If current user is KTV, they can only see their own data
    if (currentUser?.role?.toLowerCase() === 'ktv') {
      ktvQuery.eq('id', currentUser.id);
    }

    const { data: ktvs, error: ktvError } = await ktvQuery;

    const realKtvs = ktvs || [];

    const startOfMonthStr = currentMonthYear;
    const endOfMonthStr = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));

    const { data: salaryRecords, error: salaryError } = await supabase
      .from('salary_records')
      .select('*')
      .eq('month_year', currentMonthYear);

    // Fetch completed sessions with booking details + rating fallback
    // IMPORTANT: include session_reviews joined by session_log_id (mirrors get_ktv_leaderboard RPC)
    const { data: sessions, error: sessionsError } = await supabase
      .from('session_logs')
      .select('id, completed_by_ktv_id, status, is_confirmed, rating, bookings(ktv_commission), session_reviews(rating, status)')
      .eq('status', 'completed')
      .gte('completed_date', startOfMonthStr)
      .lt('completed_date', endOfMonthStr);

    // Fetch all attendance logs this month
    const { data: attendanceLogs } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', startOfMonthStr)
      .lt('date', endOfMonthStr);

    const ktvSalaries = await Promise.all(realKtvs.map(async (ktv: any) => {
        const record = salaryRecords?.find((r: any) => r.ktv_id === ktv.id);
        
        const ktvCompletedSessions = sessions?.filter((s: any) => s.completed_by_ktv_id === ktv.id) || [];
        // Use confirmed count from record if available, otherwise use live count
        const ktvSessionsCount = record?.total_sessions || ktvCompletedSessions.length;
        
        // Calculate Average Rating — aligned with get_ktv_leaderboard RPC:
        // COALESCE(AVG(COALESCE(sr.rating, sl.rating)), 5.0)
        // Join reviews via session_log_id (approved only), fallback to session.rating, then 5.0
        const ktvSessionsForRating = sessions?.filter((s: any) => s.completed_by_ktv_id === ktv.id) || [];
        const ratingValues: number[] = ktvSessionsForRating.map((s: any) => {
          const approvedReview = (s.session_reviews as any[])?.find((sr: any) => sr.status === 'approved');
          if (approvedReview?.rating) return approvedReview.rating as number;
          if (s.rating) return s.rating as number;
          return null;
        }).filter((v: number | null): v is number => v !== null);
        const avgRating = ratingValues.length > 0
          ? ratingValues.reduce((acc, v) => acc + v, 0) / ratingValues.length
          : 5.0;

        let bonusPerSession = 0;
        if (avgRating === 5.0) bonusPerSession = salaryConfig.bonus_5_star;
        else if (avgRating >= 4.5) bonusPerSession = salaryConfig.bonus_4_5_star;
        else if (avgRating >= 4.0) bonusPerSession = salaryConfig.bonus_4_star;

        const ratingBonus = ktvSessionsCount * bonusPerSession;

        let status = record?.status || 'draft';

        const sessionBonus = ktvCompletedSessions.reduce((acc: number, s: any) => {
          return acc + (s.bookings?.ktv_commission || 150000);
        }, 0);

        // Attendance tracking
        const ktvAttendance = attendanceLogs?.filter((a: any) => a.ktv_id === ktv.id) || [];
        let actualDays = 0;
        ktvAttendance.forEach((att: any) => {
          if (att.status === 'present' || att.status === 'late') {
            actualDays += 1.0;
          } else if (att.status === 'half_day') {
            actualDays += 0.5;
          }
        });

        const rawBaseSalary = record?.base_salary ?? ktv.base_salary ?? 6000000;
        let baseSalary = rawBaseSalary;
        if (record?.base_salary !== undefined) {
          baseSalary = record.base_salary;
        } else if (ktvAttendance.length > 0) {
          baseSalary = Math.round((rawBaseSalary / 26) * actualDays);
        } else {
          baseSalary = rawBaseSalary;
        }

        // Cap by resignation date in draft if resignation is active
        if (!record?.base_salary && ktv.resignation_date) {
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
        const deductions = record?.violations_deduction || 0;
        const advances = record?.service_percentage_bonus || 0; 
        const totalSalary = baseSalary + sessionBonus + kpiBonus + ratingBonus - deductions - advances;

        return {
          id: ktv.id,
          name: ktv.full_name,
          sessions: ktvSessionsCount,
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
          ktvStatus: ktv.status,
          actualDays: ktvAttendance.length > 0 ? actualDays : 26,
        };
    }));

    return ktvSalaries;
  } catch (error) {
    console.error('Error in getSalaryData:', error);
    return [];
  }
}

export async function getKtvSessionMatrix() {
  const { unstable_noStore: noStore } = await import('next/cache');
  noStore();
  
  const supabase = (await createClient()) as any;
  
  try {
    // 1. Fetch all KTVs
    const { data: ktvs } = await supabase
      .from('users')
      .select('id, full_name')
      .eq('role', 'ktv');

    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endOfMonthStr = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));

    // 2. Fetch salary records for confirmation status
    const { data: salaryRecords } = await supabase
      .from('salary_records')
      .select('ktv_id, total_sessions, status')
      .eq('month_year', currentMonthYear);

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

    // 4. Group sessions by KTV and package
    const matrix: Record<string, Record<string, number>> = {};
    
    // Fetch all available packages from the database to ensure all columns are shown
    const { data: allPackages, error: allPackagesError } = await supabase.from('packages').select('name');
    
    // Build list of package names from sessions AND available packages
    const dynamicPackageNames = new Set<string>();
    
    // Add all existing packages to the columns list
    if (allPackages) {
      allPackages.forEach((pkg: any) => {
        if (pkg.name) dynamicPackageNames.add(pkg.name);
      });
    }

    if (sessions) {
      sessions.forEach((s: any) => {
        const pkgName = s.bookings ? resolvePackageName(s.bookings) : 'Dịch vụ lẻ';
        dynamicPackageNames.add(pkgName);
      });
    }
    const packageNames = Array.from(dynamicPackageNames);
    if (!packageNames.includes('Dịch vụ lẻ')) packageNames.push('Dịch vụ lẻ');
    
    if (sessions && sessions.length > 0) {
      sessions.forEach((s: any) => {
        const ktvId = s.completed_by_ktv_id;
        if (!ktvId) return;

        const pkgName = s.bookings ? resolvePackageName(s.bookings) : 'Dịch vụ lẻ';
        
        if (!matrix[ktvId]) matrix[ktvId] = {};
        matrix[ktvId][pkgName] = (matrix[ktvId][pkgName] || 0) + 1;
      });
    }

    const hasAnyRealData = sessions && sessions.length > 0;
    
    const rows = (ktvs || []).map((ktv: any) => {
      const row: any = { id: ktv.id, name: ktv.full_name, isConfirmed: false };
      
      // Determine if this KTV's sessions are confirmed
      const salaryRecord = salaryRecords?.find((r: any) => r.ktv_id === ktv.id);
      
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
