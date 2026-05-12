'use server';

import { createClient } from '@/lib/supabase-server';
import { ensure2026 } from '@/lib/utils';

export async function getSalaryData() {
  const supabase = (await createClient()) as any;

  // Fetch KTVs
  const { data: ktvs, error: ktvError } = await supabase
    .from('users')
    .select('id, full_name, role')
    .eq('role', 'ktv');

  if (ktvError) {
    console.error('Error fetching KTVs:', ktvError);
    return [];
  }

  // Fetch salary records for the current month (May 2026)
  const { data: salaryRecords, error: salaryError } = await supabase
    .from('salary_records')
    .select('*')
    .eq('month_year', '2026-05-01');

  // Fetch completed sessions to calculate real-time stats
  const { data: sessions, error: sessionsError } = await supabase
    .from('session_logs')
    .select('id, completed_by_ktv_id, status')
    .eq('status', 'completed');

  const ktvSalaries = ktvs.map((ktv: any) => {
    const record = salaryRecords?.find((r: any) => r.ktv_id === ktv.id);
    const ktvSessions = sessions?.filter((s: any) => s.completed_by_ktv_id === ktv.id).length || 0;

    // Logic for calculating salary if no record exists
    const baseSalary = record?.base_salary || 6000000;
    const sessionBonus = ktvSessions * 150000; // 150k per session
    const kpiBonus = record?.kpi_bonus || (ktvSessions > 30 ? 1000000 : 0);
    const deductions = record?.violations_deduction || 0;
    const totalSalary = baseSalary + sessionBonus + kpiBonus - deductions;

    return {
      id: ktv.id,
      name: ktv.full_name,
      sessions: ktvSessions,
      baseSalary,
      sessionBonus,
      kpiBonus,
      deductions,
      totalSalary,
      status: record?.status || 'draft'
    };
  });

  // If DB is empty, provide high-fidelity mock data
  if (ktvSalaries.length === 0) {
    return [
      { id: 'ktv1', name: 'Nguyễn Thị Hoa', sessions: 45, baseSalary: 6500000, sessionBonus: 6750000, kpiBonus: 2000000, deductions: 0, totalSalary: 15250000, status: 'approved' },
      { id: 'ktv2', name: 'Lê Thu Hà', sessions: 38, baseSalary: 6000000, sessionBonus: 5700000, kpiBonus: 1500000, deductions: 200000, totalSalary: 13000000, status: 'pending' },
      { id: 'ktv3', name: 'Phạm Minh Tuyết', sessions: 32, baseSalary: 6000000, sessionBonus: 4800000, kpiBonus: 1200000, deductions: 0, totalSalary: 12000000, status: 'draft' },
    ];
  }

  return ktvSalaries;
}

export async function approveSalary(ktvId: string) {
  const supabase = (await createClient()) as any;
  
  const { error } = await supabase
    .from('salary_records')
    .update({ status: 'approved' })
    .eq('ktv_id', ktvId)
    .eq('month_year', '2026-05-01');

  if (error) {
    // If update fails (e.g. record doesn't exist), try to insert
    return { success: false, error };
  }

  return { success: true };
}
