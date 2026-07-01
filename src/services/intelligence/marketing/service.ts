/**
 * Marketing Intelligence Service
 * 
 * Service layer for Marketing Intelligence module providing:
 * - External ads data synchronization (Facebook, Google, TikTok, Zalo)
 * - Cache management
 * - Health checks
 * 
 * NOTE: This is a simplified version focusing on sync operations.
 * Full service implementation with cache-first queries will be added later.
 */

import { createClient } from '@/lib/supabase-server';
import type { ExternalAdsDataRow } from './types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SyncPlatformResult {
  success: boolean;
  recordsInserted?: number;
  recordsUpdated?: number;
  recordsFailed?: number;
  error?: string;
}

export interface TenantSyncResult {
  facebook: SyncPlatformResult;
  google: SyncPlatformResult;
  tiktok: SyncPlatformResult;
  zalo: SyncPlatformResult;
  totalRecords: number;
  duration: number; // milliseconds
}

export interface TenantAdsCredentials {
  facebook_access_token?: string;
  facebook_ad_account_id?: string;
  google_access_token?: string;
  google_customer_id?: string;
  google_developer_token?: string;
  tiktok_access_token?: string;
  tiktok_advertiser_id?: string;
  zalo_access_token?: string;
  zalo_oa_id?: string;
}

interface ExternalAdsDataInsert {
  tenant_id: string;
  platform: 'facebook' | 'google' | 'tiktok' | 'zalo';
  date: string;
  external_campaign_id: string;
  external_ad_id: string;
  internal_campaign_id?: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr?: number | null;
  cpc?: number | null;
  cpa?: number | null;
  roas?: number | null;
  roi?: number | null;
  raw_data?: Record<string, any>;
  sync_status: 'pending' | 'success' | 'failed';
  synced_at: string;
}

// ─── Service Class ──────────────────────────────────────────────────────────

export class MarketingIntelligenceService {
  readonly moduleName = 'marketing';

  /**
   * Sync ad data from all external platforms for a tenant
   * 
   * This method orchestrates the sync process:
   * 1. Fetch tenant credentials from database
   * 2. For each platform with credentials:
   *    - Call platform connector to fetch latest data
   *    - Upsert data into external_ads_data table
   *    - Track success/failure metrics
   * 3. Return aggregated sync results
   * 
   * @param tenantId - UUID of the tenant
   * @param platforms - Optional array of platforms to sync (defaults to all)
   * @returns SyncResult with platform-level details
   */
  async syncExternalAds(
    tenantId: string,
    platforms?: Array<'facebook' | 'google' | 'tiktok' | 'zalo'>
  ): Promise<TenantSyncResult> {
    const startTime = Date.now();
    
    const result: TenantSyncResult = {
      facebook: { success: false },
      google: { success: false },
      tiktok: { success: false },
      zalo: { success: false },
      totalRecords: 0,
      duration: 0,
    };

    try {
      // Step 1: Fetch tenant and credentials
      const credentials = await this.getTenantAdsCredentials(tenantId);
      if (!credentials) {
        throw new Error(`Tenant not found or has no ad credentials: ${tenantId}`);
      }

      // Step 2: Determine which platforms to sync
      const platformsToSync = platforms || ['facebook', 'google', 'tiktok', 'zalo'];

      // Step 3: Sync each platform sequentially (to avoid rate limits)
      for (const platform of platformsToSync) {
        try {
          const platformResult = await this.syncPlatform(tenantId, platform, credentials);
          result[platform] = platformResult;
          
          if (platformResult.success) {
            result.totalRecords += (platformResult.recordsInserted || 0) + (platformResult.recordsUpdated || 0);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[MarketingIntelligence] Failed to sync ${platform}:`, errorMsg);
          result[platform] = { success: false, error: errorMsg };
        }
      }

      result.duration = Date.now() - startTime;
      return result;

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[MarketingIntelligence] Sync failed:', errorMsg);
      
      // Return failed result for all platforms
      result.duration = Date.now() - startTime;
      result.facebook = { success: false, error: errorMsg };
      result.google = { success: false, error: errorMsg };
      result.tiktok = { success: false, error: errorMsg };
      result.zalo = { success: false, error: errorMsg };
      
      return result;
    }
  }

  /**
   * Sync a single platform
   */
  private async syncPlatform(
    tenantId: string,
    platform: 'facebook' | 'google' | 'tiktok' | 'zalo',
    credentials: TenantAdsCredentials
  ): Promise<SyncPlatformResult> {
    // Check if credentials exist for this platform
    const hasCredentials = this.hasCredentialsForPlatform(platform, credentials);
    if (!hasCredentials) {
      return {
        success: false,
        error: `No credentials configured for ${platform}`,
      };
    }

    // NOTE: Actual connector implementations will be added in future tasks
    // For now, return placeholder results
    console.log(`[MarketingIntelligence] Syncing ${platform} for tenant ${tenantId}`);
    
    // TODO: Implement actual connectors
    // - FacebookAdsConnector: fetch last 7 days of ad data
    // - GoogleAdsConnector: fetch reports using GAQL
    // - TikTokAdsConnector: fetch integrated reports
    // - ZaloOAConnector: fetch message stats
    
    // For now, return success with 0 records (placeholder)
    return {
      success: true,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
    };
  }

  /**
   * Check if tenant has credentials for a platform
   */
  private hasCredentialsForPlatform(
    platform: 'facebook' | 'google' | 'tiktok' | 'zalo',
    credentials: TenantAdsCredentials
  ): boolean {
    switch (platform) {
      case 'facebook':
        return !!(credentials.facebook_access_token && credentials.facebook_ad_account_id);
      case 'google':
        return !!(credentials.google_access_token && credentials.google_customer_id);
      case 'tiktok':
        return !!(credentials.tiktok_access_token && credentials.tiktok_advertiser_id);
      case 'zalo':
        return !!(credentials.zalo_access_token && credentials.zalo_oa_id);
      default:
        return false;
    }
  }

  /**
   * Get tenant ad credentials from database
   */
  private async getTenantAdsCredentials(tenantId: string): Promise<TenantAdsCredentials | null> {
    const supabase = await createClient();
    
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('metadata')
      .eq('id', tenantId)
      .maybeSingle();

    if (error) {
      console.error('[MarketingIntelligence] Failed to fetch tenant:', error);
      throw new Error(`Failed to fetch tenant: ${error.message}`);
    }

    if (!tenant || !tenant.metadata) {
      return null;
    }

    // Extract ads_credentials from tenant metadata
    const metadata = tenant.metadata as any;
    return metadata.ads_credentials as TenantAdsCredentials || null;
  }

  /**
   * Upsert external ads data into database
   * 
   * Uses ON CONFLICT to handle duplicates:
   * - If record exists (same platform, campaign, ad, date, tenant): UPDATE
   * - If record is new: INSERT
   */
  async upsertExternalAdsData(
    tenantId: string,
    platform: 'facebook' | 'google' | 'tiktok' | 'zalo',
    records: ExternalAdsDataInsert[]
  ): Promise<{ inserted: number; updated: number; failed: number }> {
    const supabase = await createClient();

    let inserted = 0;
    let updated = 0;
    let failed = 0;

    // Process records in batches of 100 (Supabase limit)
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      try {
        // Use upsert (will update if exists, insert if new)
        const { error, count } = await supabase
          .from('external_ads_data' as any)
          .upsert(batch, {
            onConflict: 'platform,external_campaign_id,external_ad_id,date,tenant_id',
            // @ts-ignore - count option exists
            count: 'exact',
          });

        if (error) {
          console.error(`[MarketingIntelligence] Failed to upsert batch:`, error);
          failed += batch.length;
        } else {
          // Count is total affected rows (both inserted and updated)
          // We can't distinguish between insert/update with upsert, so estimate
          const affected = count || batch.length;
          inserted += affected;
        }
      } catch (error) {
        console.error(`[MarketingIntelligence] Batch upsert error:`, error);
        failed += batch.length;
      }
    }

    return { inserted, updated, failed };
  }

  /**
   * Health check for marketing intelligence service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const supabase = await createClient();
      
      // Test database connection by querying external_ads_data
      const { error } = await supabase
        .from('external_ads_data' as any)
        .select('id')
        .limit(1);

      if (error) {
        console.error('[MarketingIntelligence] Health check failed:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[MarketingIntelligence] Health check error:', error);
      return false;
    }
  }

  /**
   * Clear all cached data for marketing intelligence
   * 
   * NOTE: Cache implementation will be added in future task
   */
  async clearCache(): Promise<void> {
    console.log('[MarketingIntelligence] Cache clear requested (not implemented yet)');
    // TODO: Implement cache clearing when cache layer is added
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────

let serviceInstance: MarketingIntelligenceService | null = null;

/**
 * Get the singleton instance of MarketingIntelligenceService
 */
export function getMarketingIntelligenceService(): MarketingIntelligenceService {
  if (!serviceInstance) {
    serviceInstance = new MarketingIntelligenceService();
  }
  return serviceInstance;
}
