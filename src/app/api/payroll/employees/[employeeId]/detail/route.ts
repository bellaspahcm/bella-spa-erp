import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { buildPackageMultiplierMap, calculateWeightedSessionCount } from '@/modules/hr-salary/actions/salary-attendance-calculation';
import { getLocalDateString } from '@bella/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

interface SalaryAdvanceRow {
  id: string;
  ktv_id: string;
  tenant_id: string;
  advance_date: string;
  amount: number;
  reason: string | null;
  created_at?: string;
}

interface RouteContext {
  params: Promise<{
    employeeId: string;
  }>;
}

interface SessionWithBooking {
  id: string;
  completed_by_ktv_id: string | null;
  status: string | null;
  completed_date: string | null;
  bookings: {
    id: string;
    package_name: string | null;
    packages: {
      name: string | null;
      session_multiplier: number | null;
    } | null;
  } | null;
}

interface TenantSalaryConfigDb {
  penalty_late_per_day?: number;
  penalty_absent_per_day?: number;
  bonus_5_star?: number;
  bonus_4_5_star?: number;
  bonus_4_star?: number;
  [key: string]: unknown;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { employeeId } = await context.params;
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month'); // Format: YYYY-MM

    // Use provided month or current month
    const now = new Date();
    const targetMonth = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthYearDate = `${targetMonth}-01`;
    
    const supabase = await createClient();
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = currentUser.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    // Authorization: Admin can see all, KTV can only see their own
    if (currentUser.role?.toLowerCase() === 'ktv' && currentUser.id !== employeeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 1. Fetch employee info
    const { data: employee, error: employeeError } = await supabase
      .from('users')
      .select('id, full_name, role, base_salary, hire_date, resignation_date, status, position_tier')
      .eq('id', employeeId)
      .eq('tenant_id', tenantId)
      .single();

    if (employeeError || !employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // 2. Fetch salary record for the month
    const { data: salaryRecord } = await supabase
      .from('salary_records')
      .select('*')
      .eq('ktv_id', employeeId)
      .eq('month_year', monthYearDate)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // 3. Calculate date range for the month
    const [year, month] = targetMonth.split('-').map(Number);
    const startOfMonth = monthYearDate;
    const endOfMonth = getLocalDateString(new Date(year, month, 1));

    // 4. Fetch completed sessions with booking and package details
    const { data: sessions, error: sessionsError } = await supabase
      .from('session_logs')
      .select(`
        id,
        completed_by_ktv_id,
        status,
        completed_date,
        bookings!inner (
          id,
          package_name,
          packages (
            name,
            session_multiplier
          )
        )
      `)
      .eq('completed_by_ktv_id', employeeId)
      .eq('status', 'completed')
      .gte('completed_date', startOfMonth)
      .lt('completed_date', endOfMonth)
      .eq('tenant_id', tenantId);

    if (sessionsError) {
      console.error('Sessions query error:', sessionsError);
    }

    // 5. Fetch packages for multiplier mapping
    const { data: packages } = await supabase
      .from('packages')
      .select('name, session_multiplier')
      .eq('tenant_id', tenantId);

    const packageMultiplierMap = buildPackageMultiplierMap(packages || []);

    // 6. Calculate weighted session count
    const sessionsList = (sessions || []) as SessionWithBooking[];
    const weightedSessions = calculateWeightedSessionCount(sessionsList as unknown as Parameters<typeof calculateWeightedSessionCount>[0], packageMultiplierMap);

    // 7. Group sessions by package for breakdown
    const sessionBreakdown: Record<string, { count: number; multiplier: number; weighted: number }> = {};
    
    sessionsList.forEach((session) => {
      const booking = session.bookings;
      const packageName = booking?.packages?.name || booking?.package_name || 'Dịch vụ lẻ';
      const multiplier = booking?.packages?.session_multiplier || 1.0;
      
      if (!sessionBreakdown[packageName]) {
        sessionBreakdown[packageName] = { count: 0, multiplier, weighted: 0 };
      }
      
      sessionBreakdown[packageName].count += 1;
      sessionBreakdown[packageName].weighted += multiplier;
    });

    // 8. Fetch attendance logs for the month
    const { data: attendance } = await supabase
      .from('attendance')
      .select('*')
      .eq('ktv_id', employeeId)
      .gte('date', startOfMonth)
      .lt('date', endOfMonth)
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true });

    const attendanceLogs = attendance || [];
    const workingDays = attendanceLogs.filter(a => a.status !== 'absent').length;
    const absentDates = attendanceLogs
      .filter(a => a.status === 'absent')
      .map(a => a.date);
    const lateDays = attendanceLogs.filter(a => a.status === 'late').length;
    const lateDates = attendanceLogs
      .filter(a => a.status === 'late')
      .map(a => {
        let minutes = 15; // Fallback
        if (a.checkin_time) {
          try {
            const checkinLocalTime = new Date(a.checkin_time).toLocaleTimeString('en-US', {
              hour12: false,
              timeZone: 'Asia/Ho_Chi_Minh'
            });
            const parts = checkinLocalTime.split(':').map(Number);
            const checkinMin = (parts[0] || 0) * 60 + (parts[1] || 0);
            const cutoffMin = 8 * 60 + 30; // 08:30
            const diff = checkinMin - cutoffMin;
            if (diff > 0) {
              minutes = diff;
            }
          } catch (e) {
            console.error('Error parsing checkin_time:', a.checkin_time, e);
          }
        }
        return { date: a.date, minutes };
      });

    // 9. Fetch salary advances for the month
    const { data: advances } = await (supabase as unknown as SupabaseClient)
      .from('salary_advances')
      .select('*')
      .eq('ktv_id', employeeId)
      .gte('advance_date', startOfMonth)
      .lt('advance_date', endOfMonth)
      .eq('tenant_id', tenantId) as unknown as { data: SalaryAdvanceRow[] | null };

    const advancesList = advances || [];
    const totalAdvances = advancesList.reduce((sum, adv) => sum + Number(adv.amount || 0), 0);

    // 10. Calculate average rating from session reviews
    const { data: reviews } = await supabase
      .from('session_reviews')
      .select('rating')
      .in('session_log_id', sessionsList.map((s) => s.id))
      .eq('status', 'active');

    const reviewsList = reviews || [];
    const avgRating = reviewsList.length > 0
      ? reviewsList.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsList.length
      : null;

    // 11. Fetch product sales commission for the month
    const { data: productSales } = await supabase
      .from('product_sales')
      .select('product_name, quantity, calculated_commission, sale_date, status')
      .eq('ktv_id', employeeId)
      .in('status', ['completed', 'pending'])
      .gte('sale_date', startOfMonth)
      .lt('sale_date', endOfMonth)
      .eq('tenant_id', tenantId);

    const productSalesList = productSales || [];
    const liveProductSalesCommission = productSalesList.reduce((sum, sale) => sum + Number(sale.calculated_commission || 0), 0);
    const productSalesCommission = salaryRecord?.product_sales_commission !== null && salaryRecord?.product_sales_commission !== undefined
      ? Number(salaryRecord.product_sales_commission)
      : liveProductSalesCommission;

    // 12. Get tenant salary config for calculations
    const { data: tenant } = await supabase
      .from('tenants')
      .select('salary_config')
      .eq('id', tenantId)
      .single();

    const salaryConfig = (tenant?.salary_config as TenantSalaryConfigDb) || {};
    const penaltyLatePerDay = salaryConfig.penalty_late_per_day || 50000;
    const penaltyAbsentPerDay = salaryConfig.penalty_absent_per_day || 200000;
    const ratePerSession = 150000; // TODO: Make this configurable

    // 13. Calculate salary components
    const contractSalary = employee.base_salary || 6000000;
    const standardDays = 26;
    const baseSalary = Math.round((contractSalary / standardDays) * workingDays);

    const serviceCommission = Math.round(weightedSessions * ratePerSession);
    
    // Position bonus (only for Senior/Lead positions)
    const positionMultiplier = employee.position_tier === 'Senior' ? 1.2 : employee.position_tier === 'Lead' ? 1.5 : 1.0;
    const positionBonus = positionMultiplier > 1.0 ? Math.round(serviceCommission * (positionMultiplier - 1.0)) : 0;

    // Rating bonus
    let bonusPerSession = 0;
    if (avgRating !== null) {
      if (avgRating >= 4.8) bonusPerSession = 50000;
      else if (avgRating >= 4.5) bonusPerSession = 30000;
      else if (avgRating >= 4.0) bonusPerSession = 10000;
    }
    const ratingBonus = Math.round(weightedSessions * bonusPerSession);

    // Attendance penalty
    const attendancePenalty = -(lateDays * penaltyLatePerDay + absentDates.length * penaltyAbsentPerDay);

    const totalSalary = baseSalary + serviceCommission + positionBonus + ratingBonus + productSalesCommission + attendancePenalty - totalAdvances;

    // 14. Fetch previous month for comparison
    const prevMonth = new Date(year, month - 2, 1);
    const prevMonthYear = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
    
    const { data: prevSalaryRecord } = await supabase
      .from('salary_records')
      .select('total_salary')
      .eq('ktv_id', employeeId)
      .eq('month_year', prevMonthYear)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const totalLastMonth = prevSalaryRecord?.total_salary || totalSalary;
    const changePercent = totalLastMonth > 0 
      ? Number((((totalSalary - totalLastMonth) / totalLastMonth) * 100).toFixed(1))
      : 0;

    // 14. Build response
    const response = {
      employee: {
        id: employee.id,
        name: employee.full_name || 'Unknown',
        position: employee.position_tier || 'Junior KTV',
        hireDate: employee.hire_date,
        yearsOfService: employee.hire_date 
          ? Number(((now.getTime() - new Date(employee.hire_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1))
          : 0,
      },
      month: targetMonth,
      salary: {
        total: salaryRecord?.total_salary || totalSalary,
        totalLastMonth,
        changePercent,
      },
      breakdown: {
        baseSalary: {
          amount: salaryRecord?.base_salary || baseSalary,
          contractSalary,
          workingDays,
          standardDays,
          absentDates,
        },
        serviceCommission: {
          amount: salaryRecord?.session_bonus || serviceCommission,
          sessions: salaryRecord?.total_sessions || weightedSessions,
          ratePerSession,
          sessionBreakdown: Object.entries(sessionBreakdown).map(([packageName, data]) => ({
            packageName,
            count: data.count,
            multiplier: data.multiplier,
            weighted: data.weighted,
          })),
        },
        positionBonus: {
          amount: positionBonus,
          baseCommission: serviceCommission,
          multiplier: positionMultiplier,
          positionTier: employee.position_tier || 'Junior',
        },
        ratingBonus: {
          amount: salaryRecord?.rating_bonus || ratingBonus,
          weightedSessions,
          bonusPerSession,
          averageRating: avgRating ? Number(avgRating.toFixed(1)) : null,
        },
        attendancePenalty: {
          amount: attendancePenalty,
          lateDays,
          lateAmount: penaltyLatePerDay,
          lateDates,
        },
        advances: {
          amount: -totalAdvances,
          records: advancesList.map(adv => ({
            date: adv.advance_date,
            amount: adv.amount,
            reason: adv.reason || 'Không có lý do',
          })),
        },
        productSalesCommission: {
          amount: productSalesCommission,
          records: productSalesList.map(sale => ({
            productName: sale.product_name,
            quantity: sale.quantity,
            amount: sale.calculated_commission,
            date: sale.sale_date,
            status: sale.status,
          })),
        },
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in employee detail API:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
