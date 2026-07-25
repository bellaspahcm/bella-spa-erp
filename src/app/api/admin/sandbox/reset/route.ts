/**
 * Admin API: Reset Sandbox Data
 * 
 * DELETE /api/admin/sandbox/reset
 * 
 * Resets all sandbox data for a partner and re-seeds with test data.
 * Requires admin or super admin role.
 * 
 * @module api/admin/sandbox/reset
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Reset sandbox data for a partner
 * 
 * @route DELETE /api/admin/sandbox/reset
 * @access Admin, Super Admin
 * 
 * NOTE: This endpoint is temporarily disabled pending database type regeneration.
 * The reset_sandbox_data RPC function exists in the database (created in migration
 * 20260617010000_api_gateway_sandbox_environment.sql) but the TypeScript types
 * have not been regenerated yet.
 * 
 * To enable this endpoint:
 * 1. Run: npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts
 * 2. Verify reset_sandbox_data and seed_test_data RPCs appear in generated types
 * 3. Uncomment the implementation below
 * 
 * @example
 * ```bash
 * curl -X DELETE https://api.bella.vn/api/admin/sandbox/reset \
 *   -H "Authorization: Bearer <session_token>" \
 *   -H "Content-Type: application/json" \
 *   -d '{"partner_id": "uuid-here"}'
 * ```
 */
export async function DELETE(_req: NextRequest) {
  // Temporarily return "not implemented" until database types are regenerated
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Sandbox reset endpoint is temporarily disabled',
        details: 'The reset_sandbox_data RPC function exists but TypeScript types need to be regenerated. Run: npx supabase gen types typescript --project-id <project-id> > src/types/database.types.ts',
      },
    },
    { status: 501 }
  );

  /* IMPLEMENTATION - Uncomment after regenerating database types
  try {
    // TODO: Add authentication check (admin/super admin only)
    // const session = await getServerSession(req);
    // if (!session || !['admin', 'super_admin'].includes(session.user.role)) {
    //   return unauthorized(req, 'Admin access required');
    // }

    // Parse request body
    const body = await req.json();
    const { partner_id } = body;

    if (!partner_id) {
      return badRequest(req, 'partner_id is required');
    }

    // Create Supabase client
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Call reset function
    const { data: resetResult, error: resetError } = await supabase
      .rpc('reset_sandbox_data', {
        p_partner_id: partner_id,
        p_user_id: null, // TODO: Pass actual user ID from session
      });

    if (resetError) {
      console.error('Failed to reset sandbox data:', resetError);
      return errorResponse(req, 'INTERNAL_ERROR', 'Failed to reset sandbox data', 500, {
        error: resetError.message,
      });
    }

    // Seed test data
    const { data: seedResult, error: seedError } = await supabase
      .rpc('seed_test_data', {
        p_partner_id: partner_id,
      });

    if (seedError) {
      console.error('Failed to seed test data:', seedError);
      return errorResponse(req, 'INTERNAL_ERROR', 'Data reset succeeded but seeding failed', 500, {
        error: seedError.message,
        reset_result: resetResult,
      });
    }

    // Return combined result
    return success(req, {
      reset: resetResult,
      seed: seedResult,
      message: 'Sandbox data reset and re-seeded successfully',
    });

  } catch (err: any) {
    console.error('Sandbox reset error:', err);
    return errorResponse(req, 'INTERNAL_ERROR', err.message || 'An error occurred', 500);
  }
  */
}
