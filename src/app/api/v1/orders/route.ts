/**
 * Orders API - v1
 * 
 * Example implementation with:
 * - API key authentication
 * - Scope-based authorization
 * - Rate limiting
 * - Tenant isolation
 * 
 * @module api/v1/orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAPIKey } from '@/lib/middleware/api-key.middleware';
import { requireScope } from '@/lib/middleware/scope.middleware';
import { rateLimitMiddleware, addRateLimitHeaders } from '@/lib/middleware/rate-limit.middleware';
import { APIError } from '@/lib/errors/api-error';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/v1/orders
 * List orders for authenticated partner's tenant
 * 
 * Required scope: order:read
 * Rate limit: Per partner tier
 */
export async function GET(req: NextRequest) {
  try {
    // Layer 1: API Key Authentication
    await withAPIKey(req);
    
    // Layer 2: Rate Limiting
    await rateLimitMiddleware(req);
    
    // Layer 3: Scope Authorization
    requireScope(req, 'order:read');
    
    // Layer 4: Business Logic
    const partner = (req as any).partner;
    const tenantId = partner.tenant_id;
    
    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = Math.min(parseInt(url.searchParams.get('per_page') || '20'), 100);
    const status = url.searchParams.get('status');
    
    // Query orders with RLS (automatically filtered by tenant)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Set tenant context for RLS
    await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
    
    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId) // Explicit tenant filter
      .order('created_at', { ascending: false })
      .range((page - 1) * perPage, page * perPage - 1);
    
    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      throw new APIError('INTERNAL_ERROR', {
        message: 'Failed to fetch orders',
        details: error.message,
      });
    }
    
    // Build response
    const response = NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        per_page: perPage,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / perPage),
      },
      meta: {
        request_id: req.headers.get('x-request-id') || crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        version: 'v1',
      },
    });
    
    // Add rate limit headers
    return addRateLimitHeaders(req, response);
    
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
          meta: {
            request_id: req.headers.get('x-request-id') || crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            version: 'v1',
          },
        },
        { status: error.statusCode }
      );
    }
    
    // Unexpected error
    console.error('Unexpected error in GET /api/v1/orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        meta: {
          request_id: req.headers.get('x-request-id') || crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          version: 'v1',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/orders
 * Create a new order
 * 
 * Required scope: order:write
 * Rate limit: Per partner tier
 */
export async function POST(req: NextRequest) {
  try {
    // Layer 1: API Key Authentication
    await withAPIKey(req);
    
    // Layer 2: Rate Limiting
    await rateLimitMiddleware(req);
    
    // Layer 3: Scope Authorization
    requireScope(req, 'order:write');
    
    // Layer 4: Business Logic
    const partner = (req as any).partner;
    const tenantId = partner.tenant_id;
    
    // Parse request body
    const body = await req.json();
    
    // Validate required fields
    if (!body.customer_id || !body.items || !Array.isArray(body.items)) {
      throw new APIError('INVALID_INPUT', {
        message: 'Missing required fields: customer_id, items',
      });
    }
    
    // Block tenant injection attempts
    if ('tenant_id' in body || 'tenantId' in body) {
      throw new APIError('TENANT_INJECTION_ATTEMPT', {
        message: 'tenant_id cannot be provided by client',
        provided: body.tenant_id || body.tenantId,
      });
    }
    
    // Create order
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data, error } = await supabase
      .from('orders')
      .insert({
        tenant_id: tenantId, // Resolved from API key
        customer_id: body.customer_id,
        items: body.items,
        notes: body.notes,
        status: 'pending',
        created_by: partner.id,
      })
      .select()
      .single();
    
    if (error) {
      throw new APIError('INTERNAL_ERROR', {
        message: 'Failed to create order',
        details: error.message,
      });
    }
    
    // Build response
    const response = NextResponse.json(
      {
        success: true,
        data,
        meta: {
          request_id: req.headers.get('x-request-id') || crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          version: 'v1',
        },
      },
      { status: 201 }
    );
    
    // Add rate limit headers
    return addRateLimitHeaders(req, response);
    
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
          meta: {
            request_id: req.headers.get('x-request-id') || crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            version: 'v1',
          },
        },
        { status: error.statusCode }
      );
    }
    
    // Unexpected error
    console.error('Unexpected error in POST /api/v1/orders:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        meta: {
          request_id: req.headers.get('x-request-id') || crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          version: 'v1',
        },
      },
      { status: 500 }
    );
  }
}
