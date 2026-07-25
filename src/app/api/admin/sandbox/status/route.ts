/**
 * Admin API: Get Sandbox Status
 * 
 * GET /api/admin/sandbox/status
 * 
 * Returns sandbox metadata and statistics for a partner.
 * Requires admin or super admin role.
 * 
 * @module api/admin/sandbox/status
 */

import { NextRequest } from 'next/server';

/**
 * Get sandbox status for a partner
 * 
 * @route GET /api/admin/sandbox/status?partner_id=uuid
 * @access Admin, Super Admin
 * 
 * NOTE: This endpoint is temporarily disabled pending database type regeneration.
 * The sandbox_metadata table exists in the database (created in migration
 * 20260617010000_api_gateway_sandbox_environment.sql) but the TypeScript types
 * have not been regenerated yet.
 * 
 * To enable this endpoint:
 * 1. Run: npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts
 * 2. Verify sandbox_metadata table appears in generated types
 * 3. Uncomment the implementation below
 * 
 * @example
 * ```bash
 * curl https://api.bella.vn/api/admin/sandbox/status?partner_id=uuid-here \
 *   -H "Authorization: Bearer <session_token>"
 * ```
 */
export async function GET(_req: NextRequest) {
  // Temporarily return "not implemented" until database types are regenerated
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Sandbox status endpoint is temporarily disabled',
        details: 'The sandbox_metadata table exists but TypeScript types need to be regenerated. Run: npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts',
      },
    }),
    {
      status: 501,
      headers: { 'Content-Type': 'application/json' },
    }
  );

  /* IMPLEMENTATION - Uncomment after regenerating database types
  try {
    // TODO: Add authentication check (admin/super admin only)

    // Get partner_id from query params
    const { searchParams } = new URL(req.url);
    const partner_id = searchParams.get('partner_id');

    if (!partner_id) {
      return errorResponse(req, 'INVALID_INPUT', 'partner_id query parameter is required', 400);
    }

    // Create Supabase client
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get partner info
    const { data: partner, error: partnerError } = await supabase
      .from('api_partners')
      .select('id, name, api_key, tenant_id, is_active')
      .eq('id', partner_id)
      .single();

    if (partnerError || !partner) {
      return notFound(req, 'Partner');
    }

    // Detect environment
    const environment = partner.api_key.startsWith('pk_test_') ? 'sandbox' : 'production';

    // Get sandbox metadata
    const { data: metadata, error: metadataError } = await supabase
      .from('sandbox_metadata')
      .select('*')
      .eq('partner_id', partner_id)
      .single();

    // Get sandbox data counts (if sandbox mode)
    let dataCounts: Record<string, number> | null = null;
    if (environment === 'sandbox') {
      const schema = 'sandbox';
      
      const [customers, products, services, orders, payments] = await Promise.all([
        supabase.schema(schema).from('customers').select('id', { count: 'exact', head: true }).eq('tenant_id', partner.tenant_id),
        supabase.schema(schema).from('products').select('id', { count: 'exact', head: true }).eq('tenant_id', partner.tenant_id),
        supabase.schema(schema).from('services').select('id', { count: 'exact', head: true }).eq('tenant_id', partner.tenant_id),
        supabase.schema(schema).from('orders').select('id', { count: 'exact', head: true }).eq('tenant_id', partner.tenant_id),
        supabase.schema(schema).from('payments').select('id', { count: 'exact', head: true }).eq('tenant_id', partner.tenant_id),
      ]);

      dataCounts = {
        customers: customers.count || 0,
        products: products.count || 0,
        services: services.count || 0,
        orders: orders.count || 0,
        payments: payments.count || 0,
      };
    }

    // Return status
    return success(req, {
      partner: {
        id: partner.id,
        name: partner.name,
        tenant_id: partner.tenant_id,
        is_active: partner.is_active,
      },
      environment,
      api_key_prefix: partner.api_key.substring(0, 10) + '...',
      metadata: metadata || null,
      data_counts: dataCounts,
      sandbox_available: environment === 'sandbox',
    });

  } catch (err: unknown) {
    console.error('Sandbox status error:', err);
    return errorResponse(req, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'An error occurred', 500);
  }
  */
}
