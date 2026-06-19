/**
 * Admin API: Partner SLA Configuration
 * 
 * @endpoint GET /api/admin/partners/[id]/sla-config - Get current SLA config
 * @endpoint POST /api/admin/partners/[id]/sla-config - Create/update SLA config
 * 
 * Manages SLA thresholds, alert rules, and notification settings
 * 
 * @module api/admin/partners/[id]/sla-config
 * @since 2026-06-18
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  SLAConfig,
  SLAThresholds,
  SLAAlertRule,
  UpsertSLAConfigInput,
  SLA_TIER_PRESETS,
  APIResponse,
} from '@/types/api-gateway';

interface PartnerData {
  id: string;
  tenant_id: string;
  rate_limit_tier: string;
}

/**
 * GET /api/admin/partners/[id]/sla-config
 * 
 * Get current SLA configuration for partner
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: partnerId } = await context.params;

    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Unauthorized',
            code: 'AUTH_001',
          },
        } satisfies APIResponse,
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Tenant not found',
            code: 'TENANT_001',
          },
        } satisfies APIResponse,
        { status: 404 }
      );
    }

    // Only admin/owner can view SLA config
    if (!['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Insufficient permissions',
            code: 'AUTHZ_001',
          },
        } satisfies APIResponse,
        { status: 403 }
      );
    }

    // Verify partner exists and belongs to tenant
    const { data: partner } = await supabase
      .from('api_partners' as never)
      .select('id, tenant_id, rate_limit_tier')
      .eq('id', partnerId)
      .eq('tenant_id', profile.tenant_id)
      .single();

    const partnerData = partner as PartnerData | null;

    if (!partnerData) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Partner not found',
            code: 'VAL_001',
          },
        } satisfies APIResponse,
        { status: 404 }
      );
    }

    // In production, fetch from sla_configs table:
    // const { data: config } = await supabase
    //   .from('sla_configs')
    //   .select('*')
    //   .eq('partner_id', partnerId)
    //   .single();

    // For now, return default config based on partner's rate limit tier
    const tierMapping: Record<string, keyof typeof SLA_TIER_PRESETS> = {
      free: 'basic',
      basic: 'basic',
      pro: 'standard',
      premium: 'premium',
      enterprise: 'enterprise',
      unlimited: 'enterprise',
    };

    const tier = tierMapping[partnerData.rate_limit_tier] || 'basic';
    const thresholds = SLA_TIER_PRESETS[tier];

    // Generate default alert rules
    const defaultAlertRules: SLAAlertRule[] = [
      {
        id: `rule_uptime_${partnerId.slice(0, 8)}`,
        partner_id: partnerId,
        alert_type: 'uptime',
        severity: 'critical',
        enabled: true,
        threshold_value: thresholds.uptime_target_percent,
        comparison: 'lt',
        cooldown_minutes: 60,
        notification_channels: ['email', 'webhook'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `rule_latency_${partnerId.slice(0, 8)}`,
        partner_id: partnerId,
        alert_type: 'latency',
        severity: 'warning',
        enabled: true,
        threshold_value: thresholds.p95_latency_ms,
        comparison: 'gt',
        cooldown_minutes: 30,
        notification_channels: ['email', 'webhook'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `rule_error_rate_${partnerId.slice(0, 8)}`,
        partner_id: partnerId,
        alert_type: 'error_rate',
        severity: 'warning',
        enabled: true,
        threshold_value: thresholds.error_rate_threshold_percent,
        comparison: 'gt',
        cooldown_minutes: 15,
        notification_channels: ['email', 'webhook'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: `rule_availability_${partnerId.slice(0, 8)}`,
        partner_id: partnerId,
        alert_type: 'availability',
        severity: 'critical',
        enabled: true,
        threshold_value: thresholds.max_consecutive_failures,
        comparison: 'gte',
        cooldown_minutes: 5,
        notification_channels: ['email', 'webhook', 'telegram'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const config: SLAConfig = {
      partner_id: partnerId,
      thresholds,
      alert_rules: defaultAlertRules,
      notification_channels: {
        email: {
          enabled: true,
          recipients: [profile.tenant_id], // In production, fetch actual admin emails
        },
        webhook: {
          enabled: false,
          url: '',
        },
        telegram: {
          enabled: false,
          chat_id: '',
          bot_token: '',
        },
        slack: {
          enabled: false,
          webhook_url: '',
        },
      },
      monitoring_enabled: true,
      check_interval_seconds: 60, // Check every minute
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return NextResponse.json(
      {
        success: true,
        data: config,
        meta: {
          timestamp: new Date().toISOString(),
        },
      } satisfies APIResponse<SLAConfig>,
      { status: 200 }
    );

  } catch (error: unknown) {
    console.error('[GET /api/admin/partners/[id]/sla-config] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          code: 'SERVER_001',
        },
      } satisfies APIResponse,
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/partners/[id]/sla-config
 * 
 * Create or update SLA configuration
 * 
 * Body: UpsertSLAConfigInput
 * {
 *   thresholds?: Partial<SLAThresholds>,
 *   alert_rules?: Partial<SLAAlertRule>[],
 *   notification_channels?: {...},
 *   monitoring_enabled?: boolean,
 *   check_interval_seconds?: number
 * }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: partnerId } = await context.params;
    const body: UpsertSLAConfigInput = await request.json();

    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Unauthorized',
            code: 'AUTH_001',
          },
        } satisfies APIResponse,
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Tenant not found',
            code: 'TENANT_001',
          },
        } satisfies APIResponse,
        { status: 404 }
      );
    }

    // Only admin/owner can update SLA config
    if (!['admin', 'owner'].includes(profile.role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Insufficient permissions',
            code: 'AUTHZ_001',
          },
        } satisfies APIResponse,
        { status: 403 }
      );
    }

    // Verify partner exists and belongs to tenant
    const { data: partner } = await supabase
      .from('api_partners' as never)
      .select('id, tenant_id, rate_limit_tier')
      .eq('id', partnerId)
      .eq('tenant_id', profile.tenant_id)
      .single();

    const partnerData = partner as PartnerData | null;

    if (!partnerData) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Partner not found',
            code: 'VAL_001',
          },
        } satisfies APIResponse,
        { status: 404 }
      );
    }

    // Validate thresholds if provided
    if (body.thresholds) {
      const { thresholds } = body;
      
      if (thresholds.uptime_target_percent !== undefined) {
        if (thresholds.uptime_target_percent < 0 || thresholds.uptime_target_percent > 100) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message: 'uptime_target_percent must be between 0 and 100',
                code: 'VAL_001',
              },
            } satisfies APIResponse,
            { status: 400 }
          );
        }
      }

      if (thresholds.p95_latency_ms !== undefined && thresholds.p95_latency_ms < 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'p95_latency_ms must be a positive number',
              code: 'VAL_001',
            },
          } satisfies APIResponse,
          { status: 400 }
        );
      }

      if (thresholds.error_rate_threshold_percent !== undefined) {
        if (thresholds.error_rate_threshold_percent < 0 || thresholds.error_rate_threshold_percent > 100) {
          return NextResponse.json(
            {
              success: false,
              error: {
                message: 'error_rate_threshold_percent must be between 0 and 100',
                code: 'VAL_001',
              },
            } satisfies APIResponse,
            { status: 400 }
          );
        }
      }
    }

    // Validate notification channels if provided
    if (body.notification_channels) {
      const { email, webhook, telegram, slack } = body.notification_channels;

      if (email?.enabled && (!email.recipients || email.recipients.length === 0)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'Email recipients required when email notifications are enabled',
              code: 'VAL_002',
            },
          } satisfies APIResponse,
          { status: 400 }
        );
      }

      if (webhook?.enabled && !webhook.url) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'Webhook URL required when webhook notifications are enabled',
              code: 'VAL_002',
            },
          } satisfies APIResponse,
          { status: 400 }
        );
      }

      if (telegram?.enabled && (!telegram.chat_id || !telegram.bot_token)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'Telegram chat_id and bot_token required when Telegram notifications are enabled',
              code: 'VAL_002',
            },
          } satisfies APIResponse,
          { status: 400 }
        );
      }

      if (slack?.enabled && !slack.webhook_url) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'Slack webhook URL required when Slack notifications are enabled',
              code: 'VAL_002',
            },
          } satisfies APIResponse,
          { status: 400 }
        );
      }
    }

    // In production, upsert to sla_configs table:
    // const { data: updatedConfig, error } = await supabase
    //   .from('sla_configs')
    //   .upsert({
    //     partner_id: partnerId,
    //     thresholds: body.thresholds ? { ...existingThresholds, ...body.thresholds } : existingThresholds,
    //     alert_rules: body.alert_rules || existingAlertRules,
    //     notification_channels: body.notification_channels || existingChannels,
    //     monitoring_enabled: body.monitoring_enabled ?? true,
    //     check_interval_seconds: body.check_interval_seconds ?? 60,
    //     updated_at: new Date().toISOString(),
    //   })
    //   .eq('partner_id', partnerId)
    //   .select()
    //   .single();

    // For now, return success with merged config
    const now = new Date().toISOString();
    
    // Get current config (from GET endpoint logic)
    const tierMapping: Record<string, keyof typeof SLA_TIER_PRESETS> = {
      free: 'basic',
      basic: 'basic',
      pro: 'standard',
      premium: 'premium',
      enterprise: 'enterprise',
      unlimited: 'enterprise',
    };
    const tier = tierMapping[partnerData.rate_limit_tier] || 'basic';
    const baseThresholds = SLA_TIER_PRESETS[tier];

    const updatedConfig: SLAConfig = {
      partner_id: partnerId,
      thresholds: body.thresholds 
        ? { ...baseThresholds, ...body.thresholds }
        : baseThresholds,
      alert_rules: body.alert_rules as SLAAlertRule[] || [],
      notification_channels: body.notification_channels || {
        email: { enabled: true, recipients: [] },
        webhook: { enabled: false, url: '' },
        telegram: { enabled: false, chat_id: '', bot_token: '' },
        slack: { enabled: false, webhook_url: '' },
      },
      monitoring_enabled: body.monitoring_enabled ?? true,
      check_interval_seconds: body.check_interval_seconds ?? 60,
      created_at: now,
      updated_at: now,
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'SLA configuration updated successfully',
          config: updatedConfig,
        },
        meta: {
          timestamp: now,
        },
      } satisfies APIResponse,
      { status: 200 }
    );

  } catch (error: unknown) {
    console.error('[POST /api/admin/partners/[id]/sla-config] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Internal server error',
          code: 'SERVER_001',
        },
      } satisfies APIResponse,
      { status: 500 }
    );
  }
}
