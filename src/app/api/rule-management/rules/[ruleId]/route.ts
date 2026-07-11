/**
 * Workflow Rule Detail API
 * 
 * GET    /api/rule-management/rules/[ruleId] - Get rule
 * PATCH  /api/rule-management/rules/[ruleId] - Update rule
 * DELETE /api/rule-management/rules/[ruleId] - Delete rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-client';
import type { UpdateRuleRequest } from '@/types/rule-management.types';
import type { Database } from '@/types/database.types';
import type { Json } from '@/types/database.types';

interface RouteParams {
  params: Promise<{
    ruleId: string;
  }>;
}

/**
 * GET /api/rule-management/rules/[ruleId]
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

    if (userError || !userData || !userData.tenant_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'User tenant not found'
        },
        { status: 404 }
      );
    }

    // Get rule
    const { data, error } = await supabase
      .from('workflow_rules')
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

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('[API] Get rule failed:', error);

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
 * PATCH /api/rule-management/rules/[ruleId]
 * Update rule
 * 
 * Body (all optional):
 * - name: string
 * - description: string
 * - ruleType: string
 * - priority: number
 * - config: object
 * - metadata: object
 * - isActive: boolean
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
    const body: UpdateRuleRequest = await request.json();

    // Validate rule type if provided
    if (body.ruleType) {
      const validRuleTypes = ['condition', 'action', 'decision'];
      if (!validRuleTypes.includes(body.ruleType)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid rule type. Must be one of: ${validRuleTypes.join(', ')}`
          },
          { status: 400 }
        );
      }
    }

    // Build update payload
    const updatePayload: Database['public']['Tables']['workflow_rules']['Update'] = {
      updated_at: new Date().toISOString()
    };

    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.description !== undefined) updatePayload.description = body.description;
    if (body.ruleType !== undefined) updatePayload.rule_type = body.ruleType;
    if (body.priority !== undefined) updatePayload.priority = body.priority;
    if (body.config !== undefined) updatePayload.config = body.config as unknown as Json;
    if (body.metadata !== undefined) updatePayload.metadata = body.metadata as unknown as Json;
    if (body.isActive !== undefined) updatePayload.is_active = body.isActive;

    // Update rule
    const { data, error } = await supabase
      .from('workflow_rules')
      .update(updatePayload)
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
      throw new Error(`Failed to update rule: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('[API] Update rule failed:', error);

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
 * DELETE /api/rule-management/rules/[ruleId]
 * Delete rule (hard delete)
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

    if (userError || !userData || !userData.tenant_id) {
      return NextResponse.json(
        {
          success: false,
          error: 'User tenant not found'
        },
        { status: 404 }
      );
    }

    // Delete rule (hard delete)
    const { error } = await supabase
      .from('workflow_rules')
      .delete()
      .eq('id', ruleId)
      .eq('tenant_id', userData.tenant_id);

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
      throw new Error(`Failed to delete rule: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: ruleId,
        deleted: true
      }
    });

  } catch (error) {
    console.error('[API] Delete rule failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
