import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPartnerApplicationId(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function getInternalAppBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3000';
  const parsedUrl = new URL(configuredUrl);

  if (parsedUrl.protocol !== 'https:' && parsedUrl.hostname !== 'localhost') {
    throw new Error('NEXT_PUBLIC_APP_URL must use HTTPS outside localhost.');
  }

  parsedUrl.pathname = '';
  parsedUrl.search = '';
  parsedUrl.hash = '';

  return parsedUrl.toString().replace(/\/$/, '');
}

/**
 * POST /api/admin/partner-applications/batch
 * 
 * Batch approve/reject applications
 * 
 * Body:
 * {
 *   action: 'approve' | 'reject';
 *   applicationIds: string[];
 *   reason?: string; (for reject)
 *   notes?: string; (for approve)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();
    const { action, applicationIds, reason, notes } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      );
    }

    if (!applicationIds || !Array.isArray(applicationIds) || applicationIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Application IDs required' },
        { status: 400 }
      );
    }

    if (!applicationIds.every(isPartnerApplicationId)) {
      return NextResponse.json(
        { success: false, error: 'Application IDs must be valid UUIDs' },
        { status: 400 }
      );
    }

    if (applicationIds.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Max 50 applications per batch' },
        { status: 400 }
      );
    }

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Role check
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role_name')
      .eq('user_id', user.id)
      .in('role_name', ['admin', 'super_admin']);

    if (!userRoles || userRoles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Admin role required' },
        { status: 403 }
      );
    }

    const appBaseUrl = getInternalAppBaseUrl();

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    // Process each application
    for (const id of applicationIds) {
      try {
        const encodedApplicationId = encodeURIComponent(id);
        if (action === 'approve') {
          const response = await fetch(`${appBaseUrl}/api/admin/partner-applications/${encodedApplicationId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes }),
          });

          if (response.ok) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push({ id, error: 'Approve failed' });
          }
        } else {
          const response = await fetch(`${appBaseUrl}/api/admin/partner-applications/${encodedApplicationId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reason || 'Batch rejection' }),
          });

          if (response.ok) {
            results.success++;
          } else {
            results.failed++;
            results.errors.push({ id, error: 'Reject failed' });
          }
        }
      } catch (_error: unknown) {
        results.failed++;
        results.errors.push({ id, error: 'Exception' });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      message: `Processed ${results.success} successfully, ${results.failed} failed`,
    });

  } catch (error: unknown) {
    console.error('[batch] Exception:', error);
    return NextResponse.json(
      { success: false, error: 'Internal error' },
      { status: 500 }
    );
  }
}
