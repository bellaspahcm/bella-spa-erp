/**
 * Orders API - v1
 * 
 * Example implementation with standardized responses:
 * - API key authentication
 * - Scope-based authorization
 * - Rate limiting
 * - Request validation
 * - Standardized response format
 * - Tenant isolation
 * - Sandbox environment support (automatic detection)
 * 
 * @module api/v1/orders
 */

import { NextRequest } from 'next/server';
import { success, paginated, created, notFound, internalError, withAPIMiddleware } from '@/lib/api/response';
import { createOrderSchema, listOrdersQuerySchema } from '@/lib/validation/api-schemas';
import { withSandbox, getSandboxAwareSupabaseClient } from '@/lib/middleware/sandbox.middleware';

/**
 * GET /api/v1/orders
 * List orders for authenticated partner's tenant
 * 
 * Sandbox support: Automatically detects sandbox mode via API key prefix
 * - pk_test_... → queries sandbox.orders
 * - pk_live_... → queries public.orders
 * 
 * Required scope: order:read
 * Rate limit: Per partner tier
 */
export const GET = withSandbox(
  async (req, { sandbox, partner }) => {
    const tenantId = partner.tenant_id;
    
    // Parse query params
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const per_page = parseInt(url.searchParams.get('per_page') || '20');
    const status = url.searchParams.get('status');
    const customer_id = url.searchParams.get('customer_id');
    const from_date = url.searchParams.get('from_date');
    const to_date = url.searchParams.get('to_date');
    const search = url.searchParams.get('search');
    
    // Get sandbox-aware Supabase client (automatically uses correct schema)
    const supabase = getSandboxAwareSupabaseClient(req);
    
    // Log sandbox mode for debugging
    if (sandbox.isSandbox) {
      console.log('🧪 Sandbox mode: Querying sandbox.orders');
    }
    
    // Query orders with RLS (automatically filtered by tenant)
    let dbQuery = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range((page - 1) * per_page, page * per_page - 1);
    
    // Apply filters
    if (status) {
      dbQuery = dbQuery.eq('status', status);
    }
    if (customer_id) {
      dbQuery = dbQuery.eq('customer_id', customer_id);
    }
    if (from_date) {
      dbQuery = dbQuery.gte('created_at', from_date);
    }
    if (to_date) {
      dbQuery = dbQuery.lte('created_at', to_date);
    }
    if (search) {
      dbQuery = dbQuery.ilike('notes', `%${search}%`);
    }
    
    const { data, error, count } = await dbQuery;
    
    if (error) {
      return internalError(req, 'Failed to fetch orders', { error: error.message });
    }
    
    // Return paginated response with standardized format
    // Response headers automatically include X-Environment and X-Sandbox-Mode
    return paginated(req, data || [], {
      page,
      per_page,
      total: count || 0,
    });
  }
);

/**
 * POST /api/v1/orders
 * Create a new order
 * 
 * Sandbox support: Test orders are isolated in sandbox schema
 * 
 * Required scope: order:write
 * Rate limit: Per partner tier
 */
export const POST = withSandbox(
  async (req, { sandbox, partner }) => {
    const tenantId = partner.tenant_id;
    
    // Parse request body
    const body = await req.json();
    
    // Get sandbox-aware Supabase client
    const supabase = getSandboxAwareSupabaseClient(req);
    
    if (sandbox.isSandbox) {
      console.log('🧪 Sandbox mode: Creating test order in sandbox.orders');
    }
    
    // Create order (automatically goes to correct schema)
    const { data, error } = await supabase
      .from('orders')
      .insert({
        tenant_id: tenantId,
        customer_id: body.customer_id,
        items: body.items,
        notes: body.notes,
        scheduled_date: body.scheduled_date,
        status: 'pending',
        created_by: partner.partner_id,
      })
      .select()
      .single();
    
    if (error) {
      return internalError(req, 'Failed to create order', { error: error.message });
    }
    
    // Return created response (201) with Location header
    return created(req, data, `/api/v1/orders/${data.id}`);
  }
);
