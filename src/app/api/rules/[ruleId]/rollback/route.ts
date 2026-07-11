/**
 * Rule Management UI - Rule Rollback API
 * 
 * POST /api/rules/[ruleId]/rollback - Rollback rule to previous version
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{
    ruleId: string;
  }>;
}

export interface RollbackRequest {
  targetVersion: number;
}

/**
 * POST /api/rules/[ruleId]/rollback
 * Rollback rule to a previous version
 * 
 * Body:
 * - targetVersion: number (required) - version number to rollback to
 */
export async function POST(
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

    if (userError || !userData || !userData.tenant_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'User tenant not found'
        },
        { status: 404 }
      );
    }

    // Parse request body
    const body: RollbackRequest = await request.json();

    if (!body.targetVersion || typeof body.targetVersion !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid required field: targetVersion (must be a number)'
        },
        { status: 400 }
      );
    }

    // Verify rule exists and belongs to tenant
    const { data: rule, error: ruleError } = await supabase
      .from('rules')
      .select('id, name, version, status')
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

    // Validate target version
    if (body.targetVersion < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Target version must be >= 1'
        },
        { status: 400 }
      );
    }

    if (body.targetVersion >= rule.version) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot rollback to version ${body.targetVersion}. Current version is ${rule.version}. Target must be less than current.`
        },
        { status: 400 }
      );
    }

    // Check if rule is active (prevent rolling back active rules without confirmation)
    if (rule.status === 'active') {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot rollback active rule. Please disable the rule first.'
        },
        { status: 400 }
      );
    }

    // Use RPC to rollback
    const { data, error } = await supabase
      .rpc('rollback_rule_to_version', {
        p_rule_id: ruleId,
        p_target_version: body.targetVersion,
        p_user_id: user.id
      });

    if (error) {
      throw new Error(`Failed to rollback rule: ${error.message}`);
    }

    // Parse RPC result
    const result = data as { success: boolean; error?: string; rolledBackToVersion?: number; newVersion?: number };

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Rollback failed'
        },
        { status: 500 }
      );
    }

    // Get updated rule
    const { data: updatedRule, error: getUpdatedError } = await supabase
      .from('rules')
      .select('*')
      .eq('id', ruleId)
      .single();

    if (getUpdatedError) {
      console.error('[API] Failed to get updated rule after rollback:', getUpdatedError);
    }

    return NextResponse.json({
      success: true,
      data: {
        ruleId,
        ruleName: rule.name,
        rolledBackToVersion: result.rolledBackToVersion,
        newVersion: result.newVersion,
        previousVersion: rule.version,
        updatedRule
      },
      message: `Successfully rolled back to version ${result.rolledBackToVersion}. New version is ${result.newVersion}.`
    });

  } catch (error) {
    console.error('[API] Rollback rule failed: %s', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

