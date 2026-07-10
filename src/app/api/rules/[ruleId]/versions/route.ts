/**
 * Rule Management UI - Rule Versions API
 * 
 * GET /api/rules/[ruleId]/versions - Get version history for rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{
    ruleId: string;
  }>;
}

/**
 * GET /api/rules/[ruleId]/versions
 * Get version history for rule
 * 
 * Query params:
 * - limit: Number of versions to return (default: 20, max: 100)
 * - offset: Pagination offset (default: 0)
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { ruleId } = await params;

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
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Verify rule exists and belongs to tenant
    const { data: rule, error: ruleError } = await supabase
      .from('rules')
      .select('id, name')
      .eq('id', ruleId)
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (ruleError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rule not found'
        },
        { status: 404 }
      );
    }

    // Get version history
    const { data: versions, error, count } = await supabase
      .from('rule_versions')
      .select(`
        id,
        version,
        snapshot,
        change_type,
        change_summary,
        diff,
        changed_at,
        changed_by,
        users!rule_versions_changed_by_fkey (
          id,
          full_name,
          email
        )
      `, { count: 'exact' })
      .eq('rule_id', ruleId)
      .eq('tenant_id', userData.tenant_id)
      .order('version', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get version history: ${error.message}`);
    }

    // Transform response to flatten user data
    const transformedVersions = versions?.map(v => ({
      id: v.id,
      version: v.version,
      snapshot: v.snapshot,
      changeType: v.change_type,
      changeSummary: v.change_summary,
      diff: v.diff,
      changedAt: v.changed_at,
      changedBy: {
        id: v.changed_by,
        name: (v.users as { full_name?: string } | null)?.full_name || 'Unknown',
        email: (v.users as { email?: string } | null)?.email || null
      }
    })) || [];

    return NextResponse.json({
      success: true,
      data: {
        ruleId,
        ruleName: rule.name,
        versions: transformedVersions,
        meta: {
          limit,
          offset,
          total: count || 0,
          count: transformedVersions.length
        }
      }
    });

  } catch (error) {
    console.error('[API] Get rule versions failed: %s', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

