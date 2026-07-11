/**
 * Workflow Definition Detail API
 * 
 * GET    /api/rule-management/workflows/[workflowId] - Get workflow definition
 * PATCH  /api/rule-management/workflows/[workflowId] - Update workflow definition
 * DELETE /api/rule-management/workflows/[workflowId] - Delete workflow definition
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-client';
import type { UpdateWorkflowRequest } from '@/types/rule-management.types';
import type { Database, Json } from '@/types/database.types';

interface RouteParams {
  params: Promise<{
    workflowId: string;
  }>;
}

/**
 * GET /api/rule-management/workflows/[workflowId]
 * Get workflow definition by ID
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { workflowId } = await params;

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

    // Get workflow definition
    const { data, error } = await supabase
      .from('workflow_definitions')
      .select('*')
      .eq('id', workflowId)
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: 'Workflow not found'
          },
          { status: 404 }
        );
      }
      throw new Error(`Failed to get workflow: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('[API] Get workflow failed:', error);

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
 * PATCH /api/rule-management/workflows/[workflowId]
 * Update workflow definition
 * 
 * Body (all optional):
 * - name: string
 * - description: string
 * - category: string
 * - status: string
 * - config: object
 * - metadata: object
 * - changeSummary: string (required if config changed)
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { workflowId } = await params;

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
    const body: UpdateWorkflowRequest = await request.json();

    // Get current workflow
    const { data: currentWorkflow, error: getError } = await supabase
      .from('workflow_definitions')
      .select('*')
      .eq('id', workflowId)
      .eq('tenant_id', userData.tenant_id)
      .single();

    if (getError) {
      if (getError.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: 'Workflow not found'
          },
          { status: 404 }
        );
      }
      throw new Error(`Failed to get workflow: ${getError.message}`);
    }

    // Build update payload
    const updatePayload: Database['public']['Tables']['workflow_definitions']['Update'] = {
      updated_at: new Date().toISOString()
    };

    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.description !== undefined) updatePayload.description = body.description;
    if (body.category !== undefined) updatePayload.category = body.category;
    if (body.status !== undefined) updatePayload.status = body.status;
    if (body.config !== undefined) updatePayload.config = body.config as unknown as Json;
    if (body.metadata !== undefined) updatePayload.metadata = body.metadata as unknown as Json;

    // Update workflow definition
    const { data, error } = await supabase
      .from('workflow_definitions')
      .update(updatePayload)
      .eq('id', workflowId)
      .eq('tenant_id', userData.tenant_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update workflow: ${error.message}`);
    }

    // If config changed, create new version
    if (body.config !== undefined) {
      if (!body.changeSummary) {
        return NextResponse.json(
          {
            success: false,
            error: 'changeSummary is required when updating config'
          },
          { status: 400 }
        );
      }

      // Get latest version number
      const { data: versions, error: versionsError } = await supabase
        .from('workflow_versions')
        .select('version')
        .eq('workflow_id', workflowId)
        .order('version', { ascending: false })
        .limit(1);

      if (versionsError) {
        console.error('[API] Failed to get latest version:', versionsError);
      }

      const latestVersion = versions && versions.length > 0 ? versions[0].version : 0;

      // Create new version
      const { error: versionError } = await supabase
        .from('workflow_versions')
        .insert({
          workflow_id: workflowId,
          tenant_id: userData.tenant_id,
          version: latestVersion + 1,
          config: body.config as unknown as Database['public']['Tables']['workflow_versions']['Insert']['config'],
          change_summary: body.changeSummary,
          created_by: user.id
        });

      if (versionError) {
        console.error('[API] Failed to create workflow version:', versionError);
        // Non-critical error, workflow already updated
      }
    }

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('[API] Update workflow failed:', error);

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
 * DELETE /api/rule-management/workflows/[workflowId]
 * Delete workflow definition (soft delete by archiving)
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { workflowId } = await params;

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

    // Soft delete by archiving
    const { data, error } = await supabase
      .from('workflow_definitions')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('id', workflowId)
      .eq('tenant_id', userData.tenant_id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: 'Workflow not found'
          },
          { status: 404 }
        );
      }
      throw new Error(`Failed to delete workflow: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: data.id,
        status: data.status
      }
    });

  } catch (error) {
    console.error('[API] Delete workflow failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
