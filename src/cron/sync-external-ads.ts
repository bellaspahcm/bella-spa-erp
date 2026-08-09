/**
 * Cron Job: Sync External Ads Data
 * 
 * Scheduled daily at 3:00 AM (Vietnam time) to:
 * 1. Fetch latest ad data from external platforms (Facebook, Google, TikTok, Zalo)
 * 2. Sync data to external_ads_data table
 * 3. Log results and send alerts on failure
 * 
 * Execution:
 * - Triggered by Vercel Cron (production)
 * - Can be manually triggered via POST /api/cron/sync-external-ads
 * 
 * Duration: ~10-15 minutes (depends on number of tenants and platforms)
 */

import { createClient } from '@/lib/supabase-server';
import { getMarketingIntelligenceService } from '@/services/intelligence/marketing/service';
import type { TenantSyncResult as ServiceSyncResult } from '@/services/intelligence/marketing/service';

// ─── Types ──────────────────────────────────────────────────────────────────

interface TenantSyncResult {
  tenantId: string;
  tenantName?: string;
  success: boolean;
  syncResult?: ServiceSyncResult;
  error?: string;
}

interface JobResult {
  success: boolean;
  startTime: string;
  endTime: string;
  duration: number; // milliseconds
  tenantsProcessed: number;
  tenantsSucceeded: number;
  tenantsFailed: number;
  totalRecordsSynced: number;
  results: TenantSyncResult[];
  errors: string[];
}

// ─── Helper Functions ───────────────────────────────────────────────────────

interface AdsCredentials {
  facebook_access_token?: string;
  google_access_token?: string;
  tiktok_access_token?: string;
  zalo_access_token?: string;
}

interface TenantMetadata {
  ads_credentials?: AdsCredentials;
  [key: string]: unknown;
}

/**
 * Get all active tenants with ad credentials
 */
async function getTenantsWithAdsCredentials(): Promise<Array<{ id: string; name: string; metadata: unknown }>> {
  const supabase = await createClient();

  const { data: tenants, error } = await supabase
    .from('tenants')
    .select('id, name, metadata')
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to fetch tenants: ${error.message}`);
  }

  if (!tenants || tenants.length === 0) {
    return [];
  }

  // Filter tenants that have at least one ad platform credential
  const tenantsWithAds = tenants.filter(tenant => {
    const metadata = tenant.metadata as TenantMetadata | null;
    if (!metadata || !metadata.ads_credentials) {
      return false;
    }

    const creds = metadata.ads_credentials;
    return !!(
      creds.facebook_access_token ||
      creds.google_access_token ||
      creds.tiktok_access_token ||
      creds.zalo_access_token
    );
  });

  return tenantsWithAds;
}

/**
 * Log sync job result to database
 * 
 * NOTE: Requires a cron_job_logs table to be created
 */
async function logJobResult(result: JobResult): Promise<void> {
  try {
    const supabase = await createClient();

    // Check if cron_job_logs table exists
    const { error } = await supabase
      .from('cron_job_logs' as unknown)
      .insert({
        job_name: 'sync-external-ads',
        status: result.success ? 'success' : 'failed',
        started_at: result.startTime,
        finished_at: result.endTime,
        duration_ms: result.duration,
        details: {
          tenantsProcessed: result.tenantsProcessed,
          tenantsSucceeded: result.tenantsSucceeded,
          tenantsFailed: result.tenantsFailed,
          totalRecordsSynced: result.totalRecordsSynced,
          results: result.results,
          errors: result.errors,
        },
      });

    if (error) {
      // Table might not exist yet, just log to console
      console.warn('[CRON] Could not save job log to database:', error.message);
    }
  } catch (error) {
    console.error('[CRON] Failed to log job result:', error);
  }
}

/**
 * Send alert on sync failure
 * 
 * TODO: Implement Slack/email notifications
 */
async function sendFailureAlert(result: JobResult): Promise<void> {
  console.error('[CRON] ⚠️ SYNC JOB FAILED ⚠️');
  console.error(`  - Duration: ${result.duration}ms`);
  console.error(`  - Tenants Processed: ${result.tenantsProcessed}`);
  console.error(`  - Tenants Failed: ${result.tenantsFailed}`);
  console.error(`  - Errors:`, result.errors);

  // TODO: Send Slack notification
  // TODO: Send email to admin

  // For now, just log to console
}

// ─── Main Sync Job ──────────────────────────────────────────────────────────

/**
 * Execute the external ads sync job
 * 
 * This is the main entry point for the cron job.
 * It processes all active tenants sequentially.
 */
export async function syncExternalAdsJob(): Promise<JobResult> {
  const startTime = new Date();
  console.log('[CRON] 🚀 Starting external ads sync job...');
  console.log(`[CRON] Start Time: ${startTime.toISOString()}`);

  const result: JobResult = {
    success: true,
    startTime: startTime.toISOString(),
    endTime: '',
    duration: 0,
    tenantsProcessed: 0,
    tenantsSucceeded: 0,
    tenantsFailed: 0,
    totalRecordsSynced: 0,
    results: [],
    errors: [],
  };

  try {
    // Step 1: Get all active tenants with ad credentials
    const tenants = await getTenantsWithAdsCredentials();
    console.log(`[CRON] Found ${tenants.length} tenants with ad credentials`);

    if (tenants.length === 0) {
      console.log('[CRON] No tenants to process. Exiting.');
      result.endTime = new Date().toISOString();
      result.duration = Date.now() - startTime.getTime();
      return result;
    }

    // Step 2: Sync each tenant sequentially
    const service = getMarketingIntelligenceService();

    for (const tenant of tenants) {
      result.tenantsProcessed++;
      
      console.log(`[CRON] Processing tenant ${result.tenantsProcessed}/${tenants.length}: ${tenant.name} (${tenant.id})`);

      try {
        // Sync all platforms for this tenant
        const syncResult = await service.syncExternalAds(tenant.id);

        // Check if sync was successful
        const hasAnySuccess = 
          syncResult.facebook.success ||
          syncResult.google.success ||
          syncResult.tiktok.success ||
          syncResult.zalo.success;

        if (hasAnySuccess) {
          result.tenantsSucceeded++;
          result.totalRecordsSynced += syncResult.totalRecords;
          
          console.log(`[CRON] ✅ Tenant ${tenant.name} synced successfully`);
          console.log(`[CRON]    - Facebook: ${syncResult.facebook.success ? 'OK' : 'FAILED'}`);
          console.log(`[CRON]    - Google: ${syncResult.google.success ? 'OK' : 'FAILED'}`);
          console.log(`[CRON]    - TikTok: ${syncResult.tiktok.success ? 'OK' : 'FAILED'}`);
          console.log(`[CRON]    - Zalo: ${syncResult.zalo.success ? 'OK' : 'FAILED'}`);
          console.log(`[CRON]    - Records Synced: ${syncResult.totalRecords}`);
          console.log(`[CRON]    - Duration: ${syncResult.duration}ms`);
        } else {
          result.tenantsFailed++;
          result.errors.push(`Tenant ${tenant.name}: All platforms failed`);
          
          console.error(`[CRON] ❌ Tenant ${tenant.name} failed: All platforms failed`);
        }

        result.results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          success: hasAnySuccess,
          syncResult,
        });

      } catch (error) {
        result.tenantsFailed++;
        
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push(`Tenant ${tenant.name}: ${errorMsg}`);
        
        console.error(`[CRON] ❌ Tenant ${tenant.name} failed:`, errorMsg);

        result.results.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          success: false,
          error: errorMsg,
        });
      }

      // Add small delay between tenants to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 3: Determine overall success
    if (result.tenantsFailed > 0) {
      result.success = false;
    }

    // Step 4: Log summary
    const endTime = new Date();
    result.endTime = endTime.toISOString();
    result.duration = endTime.getTime() - startTime.getTime();

    console.log('[CRON] ✅ Sync job completed');
    console.log(`[CRON] End Time: ${result.endTime}`);
    console.log(`[CRON] Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log(`[CRON] Tenants Processed: ${result.tenantsProcessed}`);
    console.log(`[CRON] Tenants Succeeded: ${result.tenantsSucceeded}`);
    console.log(`[CRON] Tenants Failed: ${result.tenantsFailed}`);
    console.log(`[CRON] Total Records Synced: ${result.totalRecordsSynced}`);

    // Step 5: Save log to database
    await logJobResult(result);

    // Step 6: Send alert if there were failures
    if (!result.success) {
      await sendFailureAlert(result);
    }

    return result;

  } catch (error) {
    // Critical error - job failed to complete
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[CRON] ❌ CRITICAL ERROR:', errorMsg);
    
    result.success = false;
    result.errors.push(`Critical error: ${errorMsg}`);
    result.endTime = new Date().toISOString();
    result.duration = Date.now() - startTime.getTime();

    await sendFailureAlert(result);

    return result;
  }
}
