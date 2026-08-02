import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { Database } from '@/types/database.types';

type LeadRow = Database['public']['Tables']['re_partner_leads']['Row'];
type LeadUpdate = Database['public']['Tables']['re_partner_leads']['Update'];

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  'registered': ['interested', 'lost'],
  'interested': ['booking', 'lost'],
  'booking': ['deposited', 'lost'],
  'deposited': ['contracted', 'lost'],
  'contracted': [], // Terminal state
  'lost': [], // Terminal state
};

/**
 * PATCH /api/partner/leads/[id]
 * Update lead status with validation
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    // Get user's tenant_id
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return NextResponse.json(
        { error: 'User profile not found or missing tenant' },
        { status: 400 }
      );
    }

    const leadId = params.id;

    // Parse request body
    const body = await req.json();
    const { status, notes, budget, email } = body;

    // Fetch existing lead to verify ownership and current status
    const { data: existingLead, error: fetchError } = await supabase
      .from('re_partner_leads')
      .select('*')
      .eq('id', leadId)
      .eq('tenant_id', profile.tenant_id)
      .eq('user_id', user.id) // Verify ownership
      .single();

    if (fetchError || !existingLead) {
      return NextResponse.json(
        { error: 'Lead not found or you do not have permission to update it' },
        { status: 404 }
      );
    }

    // Validate status transition if status is being updated
    if (status && status !== existingLead.status) {
      const currentStatus = existingLead.status;
      const allowedTransitions = VALID_TRANSITIONS[currentStatus] || [];
      
      if (!allowedTransitions.includes(status)) {
        return NextResponse.json(
          { 
            error: `Invalid status transition from '${currentStatus}' to '${status}'`,
            allowedTransitions,
          },
          { status: 400 }
        );
      }
    }

    // Build update payload
    const updatePayload: LeadUpdate = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    if (status) updatePayload.status = status;
    if (notes !== undefined) updatePayload.notes = notes;
    if (budget !== undefined) updatePayload.budget = budget;
    if (email !== undefined) updatePayload.email = email;

    // Update lead
    const { data: updatedLead, error: updateError } = await supabase
      .from('re_partner_leads')
      .update(updatePayload)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('[API /partner/leads/[id]] Failed to update lead:', updateError);
      return NextResponse.json(
        { error: 'Failed to update lead', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lead updated successfully',
      data: updatedLead,
    });

  } catch (error) {
    console.error('[API /partner/leads/[id]] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/partner/leads/[id]
 * Delete a lead (soft delete by setting status to 'lost')
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login' },
        { status: 401 }
      );
    }

    // Get user's tenant_id
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      return NextResponse.json(
        { error: 'User profile not found or missing tenant' },
        { status: 400 }
      );
    }

    const leadId = params.id;

    // Verify ownership before deleting
    const { data: existingLead, error: fetchError } = await supabase
      .from('re_partner_leads')
      .select('id, status')
      .eq('id', leadId)
      .eq('tenant_id', profile.tenant_id)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !existingLead) {
      return NextResponse.json(
        { error: 'Lead not found or you do not have permission to delete it' },
        { status: 404 }
      );
    }

    // Soft delete: set status to 'lost'
    const { error: deleteError } = await supabase
      .from('re_partner_leads')
      .update({ 
        status: 'lost',
        updated_by: user.id,
        updated_at: new Date().toISOString(),
        notes: existingLead.status === 'lost' 
          ? null 
          : `Deleted by user at ${new Date().toLocaleString('vi-VN')}`
      })
      .eq('id', leadId);

    if (deleteError) {
      console.error('[API /partner/leads/[id]] Failed to delete lead:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete lead', details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lead deleted successfully',
    });

  } catch (error) {
    console.error('[API /partner/leads/[id]] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
