import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';

/**
 * Convert current tenant to franchise mode to enable subscription limits
 * POST /api/admin/tenant/convert-to-franchise
 */
export async function POST() {
  try {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (currentUser.role !== 'admin' && currentUser.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden: Only admin can convert tenant to franchise' }, { status: 403 });
    }

    const tenantId = currentUser.tenant_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant ID not found' }, { status: 400 });
    }

    const supabase = await createClient();

    // Check current tenant status
    const { data: tenant, error: fetchErr } = await supabase
      .from('tenants')
      .select('id, name, franchise_agreement_date, subscription_tier, subscription_expires_at')
      .eq('id', tenantId)
      .single();

    if (fetchErr || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // If already franchise, return current status
    if (tenant.franchise_agreement_date) {
      return NextResponse.json({
        success: true,
        message: 'Tenant is already in franchise mode',
        tenant: {
          id: tenant.id,
          name: tenant.name,
          franchise_agreement_date: tenant.franchise_agreement_date,
          subscription_tier: tenant.subscription_tier,
          subscription_expires_at: tenant.subscription_expires_at,
        },
      });
    }

    // Convert to franchise with free_trial tier
    const { data: updated, error: updateErr } = await supabase
      .from('tenants')
      .update({
        franchise_agreement_date: new Date().toISOString(),
        subscription_tier: 'free_trial',
        subscription_expires_at: null, // Free trial has no expiration
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .select()
      .single();

    if (updateErr || !updated) {
      console.error('[convert-to-franchise] Update failed:', updateErr);
      return NextResponse.json({ error: updateErr?.message || 'Failed to update tenant' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Tenant converted to franchise mode with free_trial tier',
      tenant: {
        id: updated.id,
        name: updated.name,
        franchise_agreement_date: updated.franchise_agreement_date,
        subscription_tier: updated.subscription_tier,
        subscription_expires_at: updated.subscription_expires_at,
      },
    });
  } catch (error) {
    console.error('[convert-to-franchise] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
