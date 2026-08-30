/**
 * DELETE /api/bella-auto/marketplace/uninstall - Uninstall a capability
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryClient } from '../../../../../lib/database/read-replica';

export const runtime = 'nodejs';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getPrimaryClient();
    const { searchParams } = new URL(request.url);
    
    const installationId = searchParams.get('installation_id');
    const userId = searchParams.get('user_id');

    if (!installationId) {
      return NextResponse.json(
        { error: 'Missing installation_id' },
        { status: 400 }
      );
    }

    // Get installation details
    const { data: installation, error: fetchError } = await supabase
      .from('auto_installed_capabilities')
      .select('*')
      .eq('id', installationId)
      .single();

    if (fetchError || !installation) {
      return NextResponse.json(
        { error: 'Installation not found' },
        { status: 404 }
      );
    }

    // Update status to uninstalling
    await supabase
      .from('auto_installed_capabilities')
      .update({
        status: 'uninstalling',
      })
      .eq('id', installationId);

    // TODO: Trigger background job to run rollback_script from capability_versions
    // For now, delete immediately
    const { error: deleteError } = await supabase
      .from('auto_installed_capabilities')
      .delete()
      .eq('id', installationId);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to uninstall capability', details: deleteError.message },
        { status: 500 }
      );
    }

    // Decrement install count without relying on raw SQL through the typed client.
    const { data: capability } = await supabase
      .from('auto_capabilities')
      .select('install_count')
      .eq('id', installation.capability_id)
      .single();

    await supabase
      .from('auto_capabilities')
      .update({ install_count: Math.max(Number(capability?.install_count ?? 0) - 1, 0) })
      .eq('id', installation.capability_id);

    return NextResponse.json({
      message: 'Capability uninstalled successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
