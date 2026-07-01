/**
 * Facebook Ads Connector
 * 
 * Integrates with Facebook Marketing API to fetch ad performance data
 * 
 * API Documentation:
 * - Version: v20.0
 * - Endpoint: https://graph.facebook.com/v20.0
 * - Authentication: OAuth 2.0 Access Token
 * - Rate Limits: 200 calls per hour per user
 * 
 * Features:
 * - Fetch ad insights at campaign/adset/ad levels
 * - Handle pagination with cursor-based navigation
 * - Extract conversions and revenue from actions array
 * - Map Facebook response to internal format
 * - Automatic rate limiting and retry on errors
 */

import { BaseConnector, ConnectorConfig, ConnectorError, SyncParams } from './base';
import type { ExternalAdsDataRow } from '../types';

// ─── Facebook API Types ─────────────────────────────────────────────────────

interface FacebookInsight {
  date_start: string;
  date_stop: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  impressions: string;
  clicks: string;
  spend: string;
  actions?: FacebookAction[];
  action_values?: FacebookAction[];
  ctr?: string;
  cpc?: string;
  cpm?: string;
}

interface FacebookAction {
  action_type: string;
  value: string;
}

interface FacebookInsightsResponse {
  data: FacebookInsight[];
  paging?: {
    cursors?: {
      before: string;
      after: string;
    };
    next?: string;
    previous?: string;
  };
}

// ─── Facebook Ads Connector ─────────────────────────────────────────────────

export class FacebookAdsConnector extends BaseConnector {
  private baseURL = 'https://graph.facebook.com/v20.0';
  private adAccountId: string;

  constructor(config: ConnectorConfig) {
    super({
      ...config,
      platform: 'facebook',
      rateLimit: config.rateLimit || 200, // Facebook limit: 200 calls/hour
    });
    this.adAccountId = config.accountId;
  }

  /**
   * Fetch ad insights from Facebook Marketing API
   */
  protected async fetchInsights(params: SyncParams): Promise<FacebookInsight[]> {
    const allInsights: FacebookInsight[] = [];
    let nextPageUrl: string | null = null;

    do {
      await this.enforceRateLimit();

      const url = nextPageUrl || this.buildInsightsUrl(params);
      
      try {
        const response = await this.retryWithBackoff(async () => {
          const res = await fetch(url);
          
          if (!res.ok) {
            await this.handleHttpError(res);
          }
          
          return res.json();
        });

        const data: FacebookInsightsResponse = response;
        
        if (data.data && data.data.length > 0) {
          allInsights.push(...data.data);
        }

        // Check for next page
        nextPageUrl = data.paging?.next || null;

      } catch (error) {
        if (error instanceof ConnectorError) {
          throw error;
        }
        throw new ConnectorError(
          'API_ERROR',
          `Failed to fetch Facebook insights: ${error instanceof Error ? error.message : 'Unknown error'}`,
          true,
          error
        );
      }

    } while (nextPageUrl);

    return allInsights;
  }


  /**
   * Build Facebook Insights API URL with query parameters
   */
  private buildInsightsUrl(params: SyncParams): string {
    const { startDate, endDate, level, campaignIds } = params;

    const fields = [
      'date_start',
      'date_stop',
      'campaign_id',
      'campaign_name',
      'adset_id',
      'adset_name',
      'ad_id',
      'ad_name',
      'impressions',
      'clicks',
      'spend',
      'actions',
      'action_values',
      'ctr',
      'cpc',
      'cpm',
    ].join(',');

    const queryParams = new URLSearchParams({
      access_token: this.config.accessToken,
      level,
      time_range: JSON.stringify({ since: startDate, until: endDate }),
      fields,
      limit: '100', // Max per page
    });

    // Filter by specific campaigns if provided
    if (campaignIds && campaignIds.length > 0) {
      queryParams.append('filtering', JSON.stringify([
        {
          field: 'campaign.id',
          operator: 'IN',
          value: campaignIds,
        },
      ]));
    }

    return `${this.baseURL}/act_${this.adAccountId}/insights?${queryParams.toString()}`;
  }

  /**
   * Handle HTTP errors from Facebook API
   */
  private async handleHttpError(response: Response): Promise<never> {
    let errorData: any;
    
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }

    const errorMessage = errorData.error?.message || errorData.message || 'Unknown error';
    const errorCode = errorData.error?.code;

    // Map Facebook error codes to connector error codes
    if (response.status === 401 || errorCode === 190) {
      throw new ConnectorError('INVALID_TOKEN', 'Facebook access token is invalid or expired', false);
    }

    if (response.status === 403) {
      throw new ConnectorError('INVALID_ACCOUNT', 'Access denied to Facebook ad account', false);
    }

    if (response.status === 429 || errorCode === 17 || errorCode === 613) {
      throw new ConnectorError(
        'RATE_LIMIT_EXCEEDED',
        'Facebook rate limit exceeded. Please retry later.',
        true
      );
    }

    if (response.status >= 500) {
      throw new ConnectorError('API_ERROR', `Facebook API error: ${errorMessage}`, true);
    }

    throw new ConnectorError('API_ERROR', `Facebook API error: ${errorMessage}`, false);
  }

  /**
   * Map Facebook API response to internal format
   */
  protected mapToInternalFormat(fbData: FacebookInsight): Partial<ExternalAdsDataRow> {
    const impressions = parseInt(fbData.impressions || '0');
    const clicks = parseInt(fbData.clicks || '0');
    const spend = parseFloat(fbData.spend || '0');
    const conversions = this.extractConversions(fbData.actions);
    const revenue = this.extractRevenue(fbData.action_values);

    // Calculate metrics
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
    const cpc = clicks > 0 ? spend / clicks : null;
    const cpa = conversions > 0 ? spend / conversions : null;
    const roas = spend > 0 ? revenue / spend : null;
    const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : null;

    return {
      tenant_id: this.config.tenantId,
      platform: 'facebook',
      date: fbData.date_start,
      external_campaign_id: fbData.campaign_id || '',
      external_ad_id: fbData.ad_id || fbData.adset_id || fbData.campaign_id || '',
      impressions,
      clicks,
      spend,
      conversions,
      revenue,
      ctr,
      cpc,
      cpa,
      roas,
      roi,
      raw_data: fbData as any,
      sync_status: 'success',
      synced_at: new Date().toISOString(),
    };
  }

  /**
   * Extract conversion count from Facebook actions array
   * 
   * Facebook returns actions as array:
   * [{ action_type: 'purchase', value: '5' }, { action_type: 'lead', value: '12' }, ...]
   */
  private extractConversions(actions?: FacebookAction[]): number {
    if (!actions || actions.length === 0) {
      return 0;
    }

    // Look for purchase actions (primary conversion)
    const purchaseAction = actions.find(a => 
      a.action_type === 'purchase' || 
      a.action_type === 'offsite_conversion.fb_pixel_purchase'
    );
    
    if (purchaseAction) {
      return parseInt(purchaseAction.value || '0');
    }

    // Fallback to lead actions
    const leadAction = actions.find(a => 
      a.action_type === 'lead' || 
      a.action_type === 'offsite_conversion.fb_pixel_lead'
    );
    
    if (leadAction) {
      return parseInt(leadAction.value || '0');
    }

    return 0;
  }

  /**
   * Extract revenue from Facebook action_values array
   * 
   * Facebook returns action_values as array:
   * [{ action_type: 'purchase', value: '1250.50' }, ...]
   */
  private extractRevenue(actionValues?: FacebookAction[]): number {
    if (!actionValues || actionValues.length === 0) {
      return 0;
    }

    const purchaseValue = actionValues.find(a => 
      a.action_type === 'purchase' || 
      a.action_type === 'offsite_conversion.fb_pixel_purchase'
    );
    
    return parseFloat(purchaseValue?.value || '0');
  }

  /**
   * Test Facebook API connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseURL}/act_${this.adAccountId}?fields=id,name&access_token=${this.config.accessToken}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return !!data.id;

    } catch (error) {
      console.error('Facebook connection test failed:', error);
      return false;
    }
  }

  /**
   * Fetch available campaigns for this ad account
   * Useful for UI dropdowns and campaign selection
   */
  public async fetchCampaigns(): Promise<Array<{ id: string; name: string; status: string }>> {
    try {
      await this.enforceRateLimit();

      const url = `${this.baseURL}/act_${this.adAccountId}/campaigns?fields=id,name,status&access_token=${this.config.accessToken}&limit=100`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        await this.handleHttpError(response);
      }

      const data = await response.json();
      return data.data || [];

    } catch (error) {
      if (error instanceof ConnectorError) {
        throw error;
      }
      throw new ConnectorError('API_ERROR', 'Failed to fetch campaigns', true, error);
    }
  }
}
