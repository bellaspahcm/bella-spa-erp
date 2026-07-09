/**
 * Rule Simulation History API
 * 
 * GET /api/rule-management/simulations - List saved simulation results
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-client';

/**
 * GET /api/rule-management/simulations
 * List saved simulation results
 * 
 * Query params:
 * - workflowId: Filter by workflow ID
 * - limit: Number of results (default: 20, max: 100)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized'
        },
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        {
          success: false,
          error: 'User tenant not found'
        },
        { status: 404 }
      );
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const workflowId = searchParams.get('workflowId') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query simulations
    let query = supabase
      .from('rule_simulations')
      .select(`
        *,
        workflow_definitions!inner(id, name, category)
      `)
      .eq('tenant_id', userData.tenant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (workflowId) {
      query = query.eq('workflow_id', workflowId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list simulations: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        limit,
        offset,
        count: data?.length || 0
      }
    });

  } catch (error) {
    console.error('[API] List simulations failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
