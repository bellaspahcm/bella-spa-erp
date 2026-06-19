/**
 * API Route: /api/admin/partners/[id]/regenerate-key
 * 
 * POST: Regenerate API key for a partner
 * 
 * ⚠️ CRITICAL: Old API key will be invalidated immediately
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import {
  getPartnerById,
  regenerateApiKey,
} from '@/services/api-gateway/partner.service';
import { APIError } from '@/types/api-gateway';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/admin/partners/[id]/regenerate-key
 * 
 * Regenerate API key for partner
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Unauthorized', code: 'AUTH_001' } },
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.tenant_id) {
      return NextResponse.json(
        { success: false, error: { message: 'Tenant not found', code: 'TENANT_001' } },
        { status: 404 }
      );
    }

    // Verify partner belongs to user's tenant
    const existingPartner = await getPartnerById(id, profile.tenant_id);
    if (!existingPartner) {
      return NextResponse.json(
        { success: false, error: { message: 'Partner not found', code: 'VAL_001' } },
        { status: 404 }
      );
    }

    // Regenerate API key
    const { partner, new_api_key } = await regenerateApiKey(id, user.id);

    return NextResponse.json({
      success: true,
      data: {
        partner,
        new_api_key,
        message: 'API key regenerated successfully. The old key is now invalid.',
      },
    });
  } catch (error: unknown) {
    console.error('Error regenerating API key:', error);

    if (error instanceof APIError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: error.message,
            code: error.code,
            details: error.details,
          },
        },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Internal server error',
          code: 'SERVER_001',
        },
      },
      { status: 500 }
    );
  }
}
