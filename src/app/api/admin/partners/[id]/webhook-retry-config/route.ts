/**
 * GET/PUT /api/admin/partners/[id]/webhook-retry-config
 * 
 * Get and update webhook retry configuration for a partner
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { z } from 'zod';
import type { APIErrorCode } from '@/types/api-gateway';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface PartnerData {
  id: string;
  metadata?: {
    webhook_retry_config?: {
      enabled: boolean;
      max_attempts: number;
      retry_delay_seconds: number;
      backoff_multiplier: number;
    };
  };
}

const retryConfigSchema = z.object({
  enabled: z.boolean(),
  max_attempts: z.number().int().min(1).max(10),
  retry_delay_seconds: z.number().int().min(10).max(3600),
  backoff_multiplier: z.number().min(1).max(10),
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: partnerId } = await context.params;
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Unauthorized',
            code: 'AUTH_001' as APIErrorCode,
          },
        },
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
            code: 'TENANT_001' as APIErrorCode,
          },
        },
        { status: 404 }
      );
    }

    // Verify partner belongs to tenant
    const { data: partner } = await supabase
      .from('api_partners' as never)
      .select('id, metadata')
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
            code: 'VAL_001' as APIErrorCode,
          },
        },
        { status: 404 }
      );
    }

    // Get retry config from partner metadata or use defaults
    const retryConfig = partnerData.metadata?.webhook_retry_config || {
      enabled: true,
      max_attempts: 3,
      retry_delay_seconds: 60,
      backoff_multiplier: 2,
    };

    return NextResponse.json({
      success: true,
      data: retryConfig,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Get retry config API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Internal server error',
          code: 'SERVER_001' as APIErrorCode,
        },
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id: partnerId } = await context.params;
    const supabase = await createClient();

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Unauthorized',
            code: 'AUTH_001' as APIErrorCode,
          },
        },
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
            code: 'TENANT_001' as APIErrorCode,
          },
        },
        { status: 404 }
      );
    }

    // Role check
    if (profile.role !== 'admin' && profile.role !== 'owner') {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Forbidden',
            code: 'AUTHZ_001' as APIErrorCode,
          },
        },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = retryConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Invalid request body',
            code: 'VAL_001' as APIErrorCode,
            details: parsed.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const retryConfig = parsed.data;

    // Verify partner belongs to tenant and get current metadata
    const { data: partner } = (await supabase
      .from('api_partners' as never)
      .select('id, metadata')
      .eq('id', partnerId)
      .eq('tenant_id', profile.tenant_id)
      .single()) as { data: PartnerData | null };

    if (!partner) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Partner not found',
            code: 'VAL_001' as APIErrorCode,
          },
        },
        { status: 404 }
      );
    }

    // Update metadata with new retry config
    const updatedMetadata = {
      ...(partner.metadata || {}),
      webhook_retry_config: retryConfig,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    const { error: updateError } = await supabase
      .from('api_partners' as never)
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      } as never)
      .eq('id', partnerId)
      .eq('tenant_id', profile.tenant_id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      data: retryConfig,
      meta: {
        timestamp: new Date().toISOString(),
        message: 'Retry configuration updated successfully',
      },
    });
  } catch (error) {
    console.error('Update retry config API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Internal server error',
          code: 'SERVER_001' as APIErrorCode,
        },
      },
      { status: 500 }
    );
  }
}
