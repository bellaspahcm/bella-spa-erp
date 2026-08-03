/**
 * POST /api/bella-auto/marketplace/install - Install a capability
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryClient } from '../../../../../lib/database/read-replica';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const supabase = getPrimaryClient();
    const body = await request.json();
    const { tenantId, capabilityId, userId } = body;

    if (!tenantId || !capabilityId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if already installed
    const { data: existing } = await supabase
      .from('auto_installed_capabilities')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('capability_id', capabilityId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Capability already installed' },
        { status: 409 }
      );
    }

    // Get latest version
    const { data: latestVersion, error: versionError } = await supabase
      .from('auto_capability_versions')
      .select('id, version_number')
      .eq('capability_id', capabilityId)
      .eq('is_stable', true)
      .order('released_at', { ascending: false })
      .limit(1)
      .single();

    if (versionError || !latestVersion) {
      return NextResponse.json(
        { error: 'No stable version found' },
        { status: 404 }
      );
    }

    // Create installation
    const { data: installation, error: installError } = await supabase
      .from('auto_installed_capabilities')
      .insert({
        tenant_id: tenantId,
        capability_id: capabilityId,
        version_id: latestVersion.id,
        status: 'installing',
        installed_by: userId,
      })
      .select()
      .single();

    if (installError) {
      return NextResponse.json(
        { error: 'Failed to install capability', details: installError.message },
        { status: 500 }
      );
    }

    // TODO: Trigger background job to run migration_script from capability_versions
    // For now, mark as active immediately
    await supabase
      .from('auto_installed_capabilities')
      .update({
        status: 'active',
        installed_at: new Date().toISOString(),
      })
      .eq('id', installation.id);

    // Increment install count
    await supabase.rpc('increment', {
      table_name: 'auto_capabilities',
      row_id: capabilityId,
      column_name: 'install_count',
    }).catch(() => {
      // Fallback: manual increment
      supabase
        .from('auto_capabilities')
        .update({ install_count: supabase.sql`install_count + 1` })
        .eq('id', capabilityId);
    });

    return NextResponse.json({
      installation: { ...installation, status: 'active' },
      message: 'Capability installed successfully',
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
