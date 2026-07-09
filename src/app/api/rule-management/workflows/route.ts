/**
 * Workflow Definitions CRUD API
 * 
 * GET    /api/rule-management/workflows - List all workflow definitions
 * POST   /api/rule-management/workflows - Create new workflow definition
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-client';
import type { CreateWorkflowRequest } from '@/types/rule-management.types';

/**
 * GET /api/rule-management/workflows
 * List all workflow definitions for current tenant
 * 
 * Query params:
 * - status: Filter by status (draft, active, archived)
 * - category: Filter by category
 * - limit: Number of results (default: 50, max: 100)
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
    const status = searchParams.get('status') || undefined;
    const category = searchParams.get('category') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Query workflows using RPC
    const { data, error } = await supabase.rpc('get_workflow_definitions', {
      p_tenant_id: userData.tenant_id,
      p_status: status || null,
      p_category: category || null,
      p_limit: limit,
      p_offset: offset
    });

    if (error) {
      throw new Error(`Failed to list workflows: ${error.message}`);
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
    console.error('[API] List workflow definitions failed:', error);

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
 * POST /api/rule-management/workflows
 * Create new workflow definition
 * 
 * Body:
 * - name: string (required)
 * - description: string
 * - category: string (required)
 * - config: object (workflow definition JSON)
 * - metadata: object (additional metadata)
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
    const body: CreateWorkflowRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.category || !body.config) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: name, category, config'
        },
        { status: 400 }
      );
    }

    // Create workflow definition
    const { data, error } = await supabase
      .from('workflow_definitions')
      .insert({
        tenant_id: userData.tenant_id,
        name: body.name,
        description: body.description || null,
        category: body.category,
        status: 'draft', // New workflows start as draft
        config: body.config,
        metadata: body.metadata || {},
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create workflow: ${error.message}`);
    }

    // Create initial version
    const { error: versionError } = await supabase
      .from('workflow_versions')
      .insert({
        workflow_id: data.id,
        tenant_id: userData.tenant_id,
        version: 1,
        config: body.config,
        change_summary: 'Initial version',
        created_by: user.id
      });

    if (versionError) {
      console.error('[API] Failed to create workflow version:', versionError);
      // Non-critical error, workflow already created
    }

    return NextResponse.json({
      success: true,
      data
    }, { status: 201 });

  } catch (error) {
    console.error('[API] Create workflow failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
