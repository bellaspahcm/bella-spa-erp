/**
 * Rule Management UI - Rules API
 * 
 * GET    /api/rules - List all business rules
 * POST   /api/rules - Create new business rule
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import type { Json } from '@/types/database.types';

export interface CreateRuleRequest {
  name: string;
  description?: string;
  provider: 'booking' | 'discount' | 'payroll' | 'commission' | 'inventory';
  category?: string;
  conditions: Array<{
    field: string;
    operator: string;
    value: unknown;
    logicalOperator?: 'AND' | 'OR';
  }>;
  actions: Array<{
    type: string;
    field?: string;
    operation?: string;
    value?: unknown;
    reason?: string;
  }>;
  priority?: number;
  approvalRequired?: boolean;
}

/**
 * GET /api/rules
 * List all business rules for current tenant
 * 
 * Query params:
 * - provider: Filter by provider (booking, discount, payroll, commission, inventory)
 * - category: Filter by category
 * - status: Filter by status (draft, active, disabled, etc.)
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
    const provider = searchParams.get('provider') || undefined;
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('rules')
      .select('*', { count: 'exact' })
      .eq('tenant_id', userData.tenant_id)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (provider) {
      query = query.eq('provider', provider);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to list rules: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      meta: {
        limit,
        offset,
        total: count || 0,
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
 * POST /api/rules
 * Create new business rule
 * 
 * Body:
 * - name: string (required)
 * - description: string
 * - provider: string (required) - booking, discount, payroll, commission, inventory
 * - category: string
 * - conditions: array (required) - condition objects
 * - actions: array (required) - action objects
 * - priority: number (default: 100)
 * - approvalRequired: boolean (default: false)
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
    if (!body.name || !body.provider || !body.conditions || !body.actions) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name, provider, conditions, actions'
        },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders = ['booking', 'discount', 'payroll', 'commission', 'inventory'];
    if (!validProviders.includes(body.provider)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid provider. Must be one of: ${validProviders.join(', ')}`
        },
        { status: 400 }
      );
    }

    // Validate conditions array
    if (!Array.isArray(body.conditions) || body.conditions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Conditions must be a non-empty array'
        },
        { status: 400 }
      );
    }

    // Validate actions array
    if (!Array.isArray(body.actions) || body.actions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Actions must be a non-empty array'
        },
        { status: 400 }
      );
    }

    // Create rule
    const { data, error } = await supabase
      .from('rules')
      .insert({
        tenant_id: userData.tenant_id,
        name: body.name,
        description: body.description || null,
        provider: body.provider,
        category: body.category || null,
        conditions: body.conditions as unknown as Json,
        actions: body.actions as unknown as Json,
        priority: body.priority || 100,
        approval_required: body.approvalRequired || false,
        status: 'draft', // New rules start as draft
        version: 1,
        created_by: user.id,
        updated_by: user.id
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

