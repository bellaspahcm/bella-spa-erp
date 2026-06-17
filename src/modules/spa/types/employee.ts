/**
 * Spa Employee Types (KTV)
 * 
 * KTV (employee) types specific to the spa module.
 * Includes KTV performance, attendance, and related types.
 */

import type { Database } from '@/types/database.types';

// Database row types
export type UserRow = Database['public']['Tables']['users']['Row'];

// KTV attendance types
export interface KtvAttendanceLog {
  date: string;
  status: 'present' | 'late' | 'absent' | 'half_day';
  checkin_time: string | null;
  checkout_time: string | null;
}

export interface KtvAttendanceSummary {
  id: string;
  name: string;
  role: string;
  totalDays: number;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  baseSalary?: number;
  logs?: KtvAttendanceLog[];
}

// KTV session matrix types
export interface KtvSessionMatrixRecord {
  id: string;
  name: string;
  isConfirmed?: boolean;
  [packageName: string]: string | number | boolean | null | undefined; // For dynamic package columns
}

export interface KtvSessionMatrix {
  ktvs: KtvSessionMatrixRecord[];
  packageNames: string[];
}

// KTV performance types
export interface KtvPerformanceViewModel {
  name: string;
  sessions: number;
  bonus: string; // Formatted KPI bonus amount (e.g., "+1.2M", "+500k")
}

// KTV leaderboard types
export type KtvLeaderboardRow = {
  ktv_id: string;
  ktv_name: string;
  sessions: number;
  avg_rating: number | null;
  base_salary: number;
  kpi_bonus: number;
  late_days?: number;
  absent_days?: number;
  [key: string]: string | number | null | undefined;
};

// KTV option types (for selection dropdowns)
export type KtvOption = Pick<UserRow, 'id' | 'full_name' | 'role'>;

// KTV user types (for session assignment)
export interface KtvUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
}

// Staff record types
export interface StaffRecord {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  sessions_count?: number;
  avg_rating?: string | number;
}

// Database row types for related tables
export interface KtvDBRow {
  id: string;
  base_salary?: number;
  full_name?: string | null;
  role?: string | null;
  status?: string | null;
}
