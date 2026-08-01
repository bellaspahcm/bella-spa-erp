'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { BIReportService, type BIReportSnapshot } from '../services/BIReportService';

export interface BIReportResult {
  success: boolean;
  data?: BIReportSnapshot;
  error?: string;
}

export async function fetchBIReportAction(periodMonth?: string): Promise<BIReportResult> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUser();

    if (!user || !user.tenant_id) {
      return { success: false, error: 'Unauthorized: Missing tenant context' };
    }

    const data = await BIReportService.buildSnapshot(supabase, user.tenant_id, periodMonth);
    return { success: true, data };
  } catch (error) {
    console.error('[biReportActions] Error building BI snapshot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'System error',
    };
  }
}
