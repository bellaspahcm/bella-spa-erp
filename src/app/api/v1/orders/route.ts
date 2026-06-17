/**
 * API v1: Orders Endpoint
 * 
 * Example implementation using API Key + Scope middleware
 * 
 * Security:
 * - Requires valid API key
 * - Requires 'order:read' scope for GET
 * - Requires 'order:write' scope for POST
 * - Tenant is resolved from API key (not from request body)
 * 
 * @endpoint GET /api/v1/orders - List orders
 * @endpoint POST /api/v1/orders - Create order
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAPIKeyAndScope } from '@/lib/middleware/scope.middleware';
import { RequestWithPartner } from '@/lib/middleware/api-key.middleware';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/v1/orders
 * 
 * List orders for the authenticated partner's tenant
 * 
 * Required scope: 'order:read'
 */
export async function GET(req: NextRequest) {
  // Authenticate and validate scope
  const { partner, error } = await withAPIKeyAndScope(
    req as RequestWithPartner,
    'order:read'
  );
  
  if (error) return error;
  
  // ✅ Partner authenticated and has 'order:read' scope
  // ✅ Tenant is resolved from API key (cannot be injected by client)
  const tenantId = partner!.tenant_id;
  const isSandbox = partner!.is_sandbox;
  
  try {
    const supabase = createClient();
    
    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');
    
    // Query orders - automatically filtered by tenant_id via RLS
    let query = supabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId) // Explicit tenant filter (redundant with RLS, but safe)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: orders, count, error: dbError } = await query;
    
    if (dbError) {
      throw dbError;
    }
    
    return NextResponse.json({
      success: true,
      data: orders,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
      meta: {
        timestamp: new Date().toISOString(),
        tenant_id: tenantId,
        is_sandbox: isSandbox,
        request_id: (req as RequestWithPartner).request_id,
      },
    });
  } catch (error) {
    console.error('[GET /api/v1/orders] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_002',
          message: 'Failed to fetch orders',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/orders
 * 
 * Create a new order
 * 
 * Required scope: 'order:write'
 * 
 * **CRITICAL SECURITY:**
 * - tenant_id is resolved from API key
 * - Client CANNOT provide tenant_id in body
 * - If client tries to inject tenant_id, request is rejected by middleware
 */
export async function POST(req: NextRequest) {
  // Authenticate and validate scope
  const { partner, error } = await withAPIKeyAndScope(
    req as RequestWithPartner,
    'order:write'
  );
  
  if (error) return error;
  
  // ✅ Partner authenticated and has 'order:write' scope
  const tenantId = partner!.tenant_id;
  const partnerId = partner!.partner_id;
  const isSandbox = partner!.is_sandbox;
  
  try {
    const body = await req.json();
    
    // Validate required fields
    if (!body.customer_id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VAL_002',
            message: 'Missing required field: customer_id',
          },
        },
        { status: 400 }
      );
    }
    
    if (!body.service_items || !Array.isArray(body.service_items)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VAL_002',
            message: 'Missing required field: service_items (array)',
          },
        },
        { status: 400 }
      );
    }
    
    // ============================================================
    // CRITICAL: Inject tenant_id from API key (not from body)
    // ============================================================
    const orderData = {
      ...body,
      tenant_id: tenantId, // ← Resolved from API key, NOT from body
      metadata: {
        ...(body.metadata || {}),
        created_via_api: true,
        api_partner_id: partnerId,
        is_sandbox: isSandbox,
      },
    };
    
    // If sandbox mode, add sandbox indicator
    if (isSandbox) {
      orderData.notes = `[SANDBOX] ${orderData.notes || ''}`;
    }
    
    const supabase = createClient();
    
    // Create order
    const { data: order, error: dbError } = await supabase
      .from('bookings')
      .insert(orderData)
      .select()
      .single();
    
    if (dbError) {
      throw dbError;
    }
    
    return NextResponse.json(
      {
        success: true,
        data: order,
        meta: {
          timestamp: new Date().toISOString(),
          tenant_id: tenantId,
          is_sandbox: isSandbox,
          request_id: (req as RequestWithPartner).request_id,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/v1/orders] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_002',
          message: 'Failed to create order',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}

