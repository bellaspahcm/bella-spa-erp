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
  zalo_secret_key?: string;
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

    console.log(`[MarketingIntelligence] Syncing ${platform} for tenant ${tenantId}`);
    
    try {
      // Dispatch to platform-specific connector
      switch (platform) {
        case 'facebook':
          return await this.syncFacebookAds(tenantId, credentials);
        case 'google':
          return await this.syncGoogleAds(tenantId, credentials);
        case 'tiktok':
          return await this.syncTikTokAds(tenantId, credentials);
        case 'zalo':
          return await this.syncZaloOA(tenantId, credentials);
        default:
          return {
            success: false,
            error: `Unknown platform: ${platform}`,
          };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Sync Facebook Ads data
   */
  private async syncFacebookAds(
    tenantId: string,
    credentials: TenantAdsCredentials
  ): Promise<SyncPlatformResult> {
    const { createFacebookAdsConnector } = await import('./connectors/facebook-ads');
    
    const connector = createFacebookAdsConnector({
      accessToken: credentials.facebook_access_token || '',
      adAccountId: credentials.facebook_ad_account_id || '',
    });
    
    // Fetch last 7 days of data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const insights = await connector.fetchInsights(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    
    // Upsert data into external_ads_data table
    const supabase = await createClient();
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    
    for (const insight of insights) {
      try {
        const record: ExternalAdsDataInsert = {
          tenant_id: tenantId,
          platform: 'facebook',
          date: insight.date,
          external_campaign_id: insight.campaignId,
          external_ad_id: insight.adId,
          internal_campaign_id: null, // TODO: Map to internal campaign if exists
          impressions: insight.impressions,
          clicks: insight.clicks,
          spend: insight.spend,
          conversions: insight.conversions,
          revenue: insight.revenue,
          ctr: insight.ctr,
          cpc: insight.cpc,
          cpa: insight.cpa,
          roas: insight.roas,
          roi: insight.roas > 0 ? (insight.roas - 1) * 100 : null,
          raw_data: insight.rawData,
          sync_status: 'success',
          synced_at: new Date().toISOString(),
        };
        
        // Upsert (insert or update if exists)
        const { error } = await supabase
          .from('external_ads_data')
          .upsert(record, {
            onConflict: 'tenant_id,platform,date,external_campaign_id,external_ad_id',
          });
        
        if (error) {
          console.error(`[FacebookAds] Failed to upsert record:`, error);
          failed++;
        } else {
          // Assume update if no error (Supabase doesn't distinguish insert vs update in upsert)
          inserted++;
        }
      } catch (error) {
        console.error(`[FacebookAds] Error processing insight:`, error);
        failed++;
      }
    }
    
    return {
      success: true,
      recordsInserted: inserted,
      recordsUpdated: 0, // Supabase upsert doesn't distinguish
      recordsFailed: failed,
    };
  }

  /**
   * Sync Google Ads data (placeholder)
   */
  private async syncGoogleAds(
    tenantId: string,
    credentials: TenantAdsCredentials
  ): Promise<SyncPlatformResult> {
    // TODO: Implement Google Ads connector
    console.log('[MarketingIntelligence] Google Ads sync not implemented yet');
    return {
      success: false,
      error: 'Google Ads connector not implemented',
    };
  }

  /**
   * Sync TikTok Ads data (placeholder)
   */
  private async syncTikTokAds(
    tenantId: string,
    credentials: TenantAdsCredentials
  ): Promise<SyncPlatformResult> {
    // TODO: Implement TikTok Ads connector
    console.log('[MarketingIntelligence] TikTok Ads sync not implemented yet');
    return {
      success: false,
      error: 'TikTok Ads connector not implemented',
    };
  }

  /**
   * Sync Zalo OA data
   */
  private async syncZaloOA(
    tenantId: string,
    credentials: TenantAdsCredentials
  ): Promise<SyncPlatformResult> {
    const { createZaloOAConnector } = await import('./connectors/zalo-oa');
    
    const connector = createZaloOAConnector({
      accessToken: credentials.zalo_access_token || '',
      oaId: credentials.zalo_oa_id || '',
      secretKey: credentials.zalo_secret_key || '',
    });
    
    // Fetch last 7 days of data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const insights = await connector.fetchOAInsights(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    
    // Upsert data into external_ads_data table
    const supabase = await createClient();
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    
    for (const insight of insights) {
      try {
        // Map Zalo OA metrics to external_ads_data schema
        // Note: Zalo OA has different metrics than traditional ads platforms
        // We'll map the closest equivalents:
        // - impressions: messagesSent + articleViews (total reach)
        // - clicks: messageClicks + articleInteractions
        // - conversions: miniProgramConversions + transactions
        // - spend: 0 (Zalo OA doesn't have direct ad spend, but could track cost per message)
        // - revenue: transaction revenue
        const record: ExternalAdsDataInsert = {
          tenant_id: tenantId,
          platform: 'zalo',
          date: insight.date,
          external_campaign_id: `oa_${insight.oaId}`, // OA ID as campaign ID
          external_ad_id: `oa_${insight.oaId}_${insight.date}`, // Unique per day
          internal_campaign_id: null, // TODO: Map to internal campaign if exists
          
          // Map Zalo OA metrics to ads schema
          impressions: insight.messagesSent + insight.articleViews,
          clicks: insight.messageClicks + insight.articleInteractions,
          spend: 0, // Zalo OA typically doesn't have direct spend (organic reach)
          conversions: insight.miniProgramConversions + insight.transactions,
          revenue: insight.revenue,
          
          // Calculated metrics
          ctr: insight.clickThroughRate,
          cpc: null, // N/A for organic reach
          cpa: insight.transactions > 0 ? 0 : null, // N/A for organic
          roas: null, // N/A for organic (infinite ROAS if revenue > 0 and spend = 0)
          roi: null, // N/A for organic
          
          // Store full Zalo OA data in raw_data for detailed analysis
          raw_data: {
            oaName: insight.oaName,
            totalFollowers: insight.totalFollowers,
            newFollowers: insight.newFollowers,
            unfollowers: insight.unfollowers,
            messagesSent: insight.messagesSent,
            messagesDelivered: insight.messagesDelivered,
            messagesRead: insight.messagesRead,
            messageClicks: insight.messageClicks,
            articlesPublished: insight.articlesPublished,
            articleViews: insight.articleViews,
            articleShares: insight.articleShares,
            articleInteractions: insight.articleInteractions,
            miniProgramVisits: insight.miniProgramVisits,
            miniProgramConversions: insight.miniProgramConversions,
            transactions: insight.transactions,
            engagementRate: insight.engagementRate,
            clickThroughRate: insight.clickThroughRate,
            conversionRate: insight.conversionRate,
          },
          
          sync_status: 'success',
          synced_at: new Date().toISOString(),
        };
        
        // Upsert (insert or update if exists)
        const { error } = await supabase
          .from('external_ads_data')
          .upsert(record, {
            onConflict: 'tenant_id,platform,date,external_campaign_id,external_ad_id',
          });
        
        if (error) {
          console.error(`[ZaloOA] Failed to upsert record:`, error);
          failed++;
        } else {
          inserted++;
        }
      } catch (error) {
        console.error(`[ZaloOA] Error processing insight:`, error);
        failed++;
      }
    }
    
    return {
      success: true,
      recordsInserted: inserted,
      recordsUpdated: 0, // Supabase upsert doesn't distinguish
      recordsFailed: failed,
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
   */
  async clearCache(): Promise<void> {
    const { marketingCache } = await import('./cache');
    marketingCache.clear();
    console.log('[MarketingIntelligence] Cache cleared');
  }
  
  /**
   * Clear cache for a specific tenant
   * 
   * @param tenantId - Tenant UUID
   */
  async clearTenantCache(tenantId: string): Promise<void> {
    const { marketingCache } = await import('./cache');
    const pattern = `*:${tenantId}:*`;
    const deleted = marketingCache.invalidatePattern(pattern);
    console.log(`[MarketingIntelligence] Cleared ${deleted} cache entries for tenant ${tenantId}`);
  }
  
  /**
   * Get cache statistics
   * 
   * @returns Cache stats (hits, misses, evictions, size)
   */
  async getCacheStats() {
    const { marketingCache } = await import('./cache');
    return marketingCache.getStats();
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
