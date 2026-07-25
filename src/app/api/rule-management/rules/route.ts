/**
 * Workflow Rules CRUD API
 * 
 * GET    /api/rule-management/rules - List all rules
 * POST   /api/rule-management/rules - Create new rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-client';
import type { CreateRuleRequest } from '@/types/rule-management.types';
import type { Json } from '@/types/database.types';

/**
 * GET /api/rule-management/rules
 * List all rules for current tenant
 * 
 * Query params:
 * - workflowId: Filter by workflow ID
 * - ruleType: Filter by rule type (condition, action, decision)
 * - status: Filter by status (active, inactive)
 * - limit: Number of results (default: 100, max: 500)
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

    if (userError || !userData || !userData.tenant_id) {
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
    const ruleType = searchParams.get('ruleType') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query rules using RPC
    const { data, error } = await supabase.rpc('get_workflow_rules', {
      p_tenant_id: userData.tenant_id,
      p_workflow_id: workflowId || undefined,
      p_rule_type: ruleType || undefined,
      p_status: status || undefined,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      throw new Error(`Failed to list rules: ${error.message}`);
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
    console.error('[API] List rules failed:', error);

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
 * POST /api/rule-management/rules
 * Create new rule
 * 
 * Body:
 * - workflowId: string (required)
 * - name: string (required)
 * - description: string
 * - ruleType: string (required) - condition, action, decision
 * - priority: number (default: 0)
 * - config: object (required) - rule configuration
 * - metadata: object
 */
export async function POST(request: NextRequest) {
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
    const body: CreateRuleRequest = await request.json();

    // Validate required fields
    if (!body.workflowId || !body.name || !body.ruleType || !body.config) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: workflowId, name, ruleType, config'
        },
        { status: 400 }
      );
    }

    // Validate rule type
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

    // Verify workflow exists and belongs to tenant
    const { error: workflowError } = await supabase
      .from('workflow_definitions')
      .select('id')
      .eq('id', body.workflowId)
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (workflowError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Workflow not found or access denied'
        },
        { status: 404 }
      );
    }

    // Create rule
    const { data, error } = await supabase
      .from('workflow_rules')
      .insert({
        workflow_id: body.workflowId,
        tenant_id: userData.tenant_id,
        name: body.name,
        description: body.description || null,
        rule_type: body.ruleType,
        priority: body.priority || 0,
        config: body.config as unknown as Json,
        metadata: (body.metadata || {}) as unknown as Json,
        is_active: true, // New rules are active by default
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create rule: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data
    }, { status: 201 });

  } catch (error) {
    console.error('[API] Create rule failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
