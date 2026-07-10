/**
 * Rule Management UI - Approvals API
 * 
 * GET  /api/rules/approvals - Get pending approvals
 * POST /api/rules/approvals - Submit rule for approval or approve/reject
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

export interface CreateApprovalRequest {
  ruleId: string;
  comments?: string;
}

export interface UpdateApprovalRequest {
  approvalId: string;
  status: 'approved' | 'rejected';
  comments?: string;
  rejectionReason?: string;
}

/**
 * GET /api/rules/approvals
 * Get pending rule approvals for current tenant
 * 
 * Query params:
 * - status: Filter by status (pending, approved, rejected) - default: pending
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
    const status = searchParams.get('status') || 'pending';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Use RPC to get pending approvals with joined data
    const { data, error } = await supabase
      .rpc('get_pending_rule_approvals', {
        p_tenant_id: userData.tenant_id
      });

    if (error) {
      throw new Error(`Failed to get approvals: ${error.message}`);
    }

    // Apply client-side filtering and pagination if needed
    let filteredData = data || [];
    if (status && status !== 'pending') {
      filteredData = filteredData.filter((a: { status: string }) => a.status === status);
    }

    const paginatedData = filteredData.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      data: paginatedData,
      meta: {
        limit,
        offset,
        total: filteredData.length,
        count: paginatedData.length
      }
    });

  } catch (error) {
    console.error('[API] Get approvals failed:', error);

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
 * POST /api/rules/approvals
 * Submit rule for approval OR approve/reject existing approval
 * 
 * Body for submission:
 * - ruleId: string (required)
 * - comments: string
 * 
 * Body for approval/rejection:
 * - approvalId: string (required)
 * - status: 'approved' | 'rejected' (required)
 * - comments: string
 * - rejectionReason: string (required if status = 'rejected')
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
      .select('tenant_id, role')
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
    const body = await request.json() as CreateApprovalRequest | UpdateApprovalRequest;

    // Check if this is a submission or approval/rejection
    if ('ruleId' in body) {
      // SUBMISSION: Create new approval request
      const { ruleId, comments } = body;

      if (!ruleId) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required field: ruleId'
          },
          { status: 400 }
        );
      }

      // Verify rule exists and belongs to tenant
      const { data: rule, error: ruleError } = await supabase
        .from('rules')
        .select('id, name, status')
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

      // Check if rule requires approval
      if (rule.status !== 'draft') {
        return NextResponse.json(
          {
            success: false,
            error: 'Only draft rules can be submitted for approval'
          },
          { status: 400 }
        );
      }

      // Create approval request
      const { data: approval, error } = await supabase
        .from('rule_approvals')
        .insert({
          tenant_id: userData.tenant_id,
          rule_id: ruleId,
          requested_by: user.id,
          requested_at: new Date().toISOString(),
          status: 'pending',
          comments: comments || null
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create approval request: ${error.message}`);
      }

      // Update rule status to pending_approval
      await supabase
        .from('rules')
        .update({
          status: 'pending_approval',
          submitted_for_approval_at: new Date().toISOString(),
          submitted_by: user.id,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', ruleId);

      return NextResponse.json({
        success: true,
        data: approval,
        message: 'Rule submitted for approval'
      }, { status: 201 });

    } else if ('approvalId' in body) {
      // APPROVAL/REJECTION: Update existing approval
      const { approvalId, status, comments, rejectionReason } = body;

      if (!approvalId || !status) {
        return NextResponse.json(
          {
            success: false,
            error: 'Missing required fields: approvalId, status'
          },
          { status: 400 }
        );
      }

      if (!['approved', 'rejected'].includes(status)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid status. Must be "approved" or "rejected"'
          },
          { status: 400 }
        );
      }

      if (status === 'rejected' && !rejectionReason) {
        return NextResponse.json(
          {
            success: false,
            error: 'rejectionReason is required when rejecting'
          },
          { status: 400 }
        );
      }

      // Check user has permission (admin or manager role)
      if (userData.role !== 'admin' && userData.role !== 'manager') {
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient permissions. Only admins and managers can approve/reject rules.'
          },
          { status: 403 }
        );
      }

      // Get approval
      const { data: approval, error: getApprovalError } = await supabase
        .from('rule_approvals')
        .select('*, rules(id, name)')
        .eq('id', approvalId)
        .eq('tenant_id', userData.tenant_id)
        .single();

      if (getApprovalError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Approval not found'
          },
          { status: 404 }
        );
      }

      if (approval.status !== 'pending') {
        return NextResponse.json(
          {
            success: false,
            error: `Approval already ${approval.status}`
          },
          { status: 400 }
        );
      }

      // Update approval
      const { data: updatedApproval, error } = await supabase
        .from('rule_approvals')
        .update({
          status,
          reviewer_id: user.id,
          reviewed_at: new Date().toISOString(),
          comments: comments || null,
          rejection_reason: rejectionReason || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', approvalId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update approval: ${error.message}`);
      }

      // Update rule status based on approval decision
      const newRuleStatus = status === 'approved' ? 'approved' : 'draft';
      await supabase
        .from('rules')
        .update({
          status: newRuleStatus,
          approved_by: status === 'approved' ? user.id : null,
          approved_at: status === 'approved' ? new Date().toISOString() : null,
          approval_comment: comments || rejectionReason || null,
          updated_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', approval.rule_id);

      return NextResponse.json({
        success: true,
        data: updatedApproval,
        message: status === 'approved' 
          ? 'Rule approved successfully' 
          : 'Rule rejected and returned to draft'
      });

    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request body. Must include either ruleId (submission) or approvalId (approval/rejection)'
        },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('[API] Approval operation failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

