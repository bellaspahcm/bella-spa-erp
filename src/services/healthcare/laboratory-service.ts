import { createBrowserClient } from '@/lib/supabase-browser-client';

// Get browser client for client-side calls
const getBrowserSupabase = () => {
  return createBrowserClient();
};

export interface LaboratoryStats {
  totalOrders: number;
  sampleReceived: number;
  inProgress: number;
  completed: number;
  urgent: number;
  avgTurnaroundTime: number; // minutes
}

export interface ImagingStats {
  totalOrders: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  urgent: number;
  pacsAlerts: number;
}

export class LaboratoryService {
  /**
   * Get Laboratory (LIS) statistics
   */
  static async getLabStats(tenantId: string): Promise<LaboratoryStats> {
    // Return mock data immediately (database tables not ready yet)
    return {
      totalOrders: 34,
      sampleReceived: 28,
      inProgress: 4,
      completed: 22,
      urgent: 2,
      avgTurnaroundTime: 45
    };
  }

  /**
   * Get Radiology/Imaging (RIS) statistics
   */
  static async getImagingStats(tenantId: string): Promise<ImagingStats> {
    // Return mock data immediately (database tables not ready yet)
    return {
      totalOrders: 18,
      scheduled: 12,
      inProgress: 3,
      completed: 3,
      urgent: 1,
      pacsAlerts: 1
    };
  }
}
