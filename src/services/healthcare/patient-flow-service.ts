import { createBrowserClient } from '@/lib/supabase-browser-client';

// Get browser client for client-side calls
const getBrowserSupabase = () => {
  return createBrowserClient();
};

export interface PatientFlowStats {
  emergency: { count: number; badge: string; badgeColor: string };
  triage: { count: number; badge: string; badgeColor: string };
  outpatient: { count: number; badge: string; badgeColor: string };
  diagnostics: { count: number; badge: string; badgeColor: string };
  admissionProcess: { count: number; badge: string; badgeColor: string };
  inpatient: { count: number; badge: string; badgeColor: string };
  surgery: { count: number; badge: string; badgeColor: string };
  discharge: { count: number; badge: string; badgeColor: string };
}

export class PatientFlowService {
  /**
   * Get patient flow statistics across all departments
   */
  static async getFlowStats(tenantId: string): Promise<PatientFlowStats> {
    // Return mock data immediately (database tables not ready yet)
    return {
      emergency: { count: 24, badge: '2 Nguy Kịch', badgeColor: 'bg-rose-100 text-rose-800 border-rose-200' },
      triage: { count: 18, badge: '3 Đang Chờ', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
      outpatient: { count: 42, badge: 'Đang Khám', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
      diagnostics: { count: 34, badge: '2 K.Quả Khẩn', badgeColor: 'bg-rose-100 text-rose-800 border-rose-200' },
      admissionProcess: { count: 12, badge: '1 Chờ Giường', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
      inpatient: { count: 86, badge: '12 Giường ICU', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' },
      surgery: { count: 3, badge: '1 Trễ Ca', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
      discharge: { count: 9, badge: '2 Chờ Thanh Toán', badgeColor: 'bg-slate-100 text-slate-700 border-slate-200' }
    };
  }
}
