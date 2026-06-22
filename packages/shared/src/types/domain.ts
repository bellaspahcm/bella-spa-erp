/**
 * Domain types - KHÔNG import database.types.ts
 * Chỉ export types cần thiết cho mobile
 */

export interface TenantInfo {
  id: string;
  name: string;
  status: string | null;
  logo_url?: string | null;
}

export interface BookingSummary {
  id: string;
  customer_name: string | null;
  service_name: string | null;
  scheduled_at: string;
  status: string;
}

export interface StaffRecord {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  sessions_count?: number;
  avg_rating?: string | number;
}
