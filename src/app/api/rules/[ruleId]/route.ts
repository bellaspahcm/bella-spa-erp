/**
 * Rule Management UI - Rule Detail API
 * 
 * GET    /api/rules/[ruleId] - Get rule with history
 * PATCH  /api/rules/[ruleId] - Update rule
 * DELETE /api/rules/[ruleId] - Archive rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

interface RouteParams {
  params: Promise<{
    ruleId: string;
  }>;
}

export interface UpdateRuleRequest {
  name?: string;
  description?: string;
  category?: string;
  conditions?: Array<{
    field: string;
    operator: string;
    value: unknown;
    logicalOperator?: 'AND' | 'OR';
  }>;
  actions?: Array<{
    type: string;
    field?: string;
    operation?: string;
    value?: unknown;
    reason?: string;
  }>;
  priority?: number;
  status?: 'draft' | 'pending_approval' | 'approved' | 'active' | 'disabled' | 'archived';
}

/**
 * GET /api/rules/[ruleId]
 * Get rule by ID
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

    // Get rule directly from table
    const { data, error } = await supabase
      .from('rules')
      .select('*')
      .eq('id', ruleId)
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: 'Rule not found'
          },
          { status: 404 }
        );
      }
      throw new Error(`Failed to get rule: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rule not found'
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('[API] Get rule failed:', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/rules/[ruleId]
 * Update rule (increments version, creates version snapshot)
 * 
 * Body (all optional):
 * - name: string
 * - description: string
 * - category: string
 * - conditions: array
 * - actions: array
 * - priority: number
 * - status: string
 */
export async function PATCH(
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

    // Parse request body
    const body: UpdateRuleRequest = await request.json();

    // Get current rule
    const { data: currentRule, error: getRuleError } = await supabase
      .from('rules')
      .select('*')
      .eq('id', ruleId)
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (getRuleError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rule not found'
        },
        { status: 404 }
      );
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString()
    };

    // Check if any significant fields changed (requires version increment)
    let versionChanged = false;

    if (body.conditions !== undefined) {
      updatePayload.conditions = body.conditions;
      versionChanged = true;
    }
    if (body.actions !== undefined) {
      updatePayload.actions = body.actions;
      versionChanged = true;
    }
    if (body.priority !== undefined && body.priority !== currentRule.priority) {
      updatePayload.priority = body.priority;
      versionChanged = true;
    }
    if (body.status !== undefined && body.status !== currentRule.status) {
      updatePayload.status = body.status;
      versionChanged = true;
    }

    // Metadata changes don't require version increment
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.description !== undefined) updatePayload.description = body.description;
    if (body.category !== undefined) updatePayload.category = body.category;

    // Increment version if significant changes
    if (versionChanged) {
      updatePayload.version = currentRule.version + 1;
    }

    // Update rule
    const { data, error } = await supabase
      .from('rules')
      .update(updatePayload)
      .eq('id', ruleId)
      .eq('tenant_id', userData.tenant_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update rule: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data,
      meta: {
        versionIncremented: versionChanged,
        newVersion: versionChanged ? currentRule.version + 1 : currentRule.version
      }
    });

  } catch (error) {
    console.error('[API] Update rule failed:', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/rules/[ruleId]
 * Archive rule (soft delete - sets status to 'archived')
 */
export async function DELETE(
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

    // Soft delete by setting status to archived
    const { data, error } = await supabase
      .from('rules')
      .update({
        status: 'archived',
        updated_by: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', ruleId)
      .eq('tenant_id', userData.tenant_id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: 'Rule not found'
          },
          { status: 404 }
        );
      }
      throw new Error(`Failed to archive rule: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: ruleId,
        archived: true,
        archivedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[API] Archive rule failed:', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
