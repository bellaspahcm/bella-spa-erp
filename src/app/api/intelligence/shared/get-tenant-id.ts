/**
 * Helper: Get Tenant ID from Session or Query Param
 * 
 * Intelligence API routes need tenant ID but frontend hooks don't pass it.
 * This helper automatically fetches tenant ID from user session,
 * with fallback to query param for backward compatibility.
 * 
 * @param searchParams - URL searchParams from NextRequest
 * @returns tenantId string or NextResponse error
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/services/user-actions';
import { isValidTenantId } from '@/services/intelligence/shared/helpers';

export async function getTenantIdFromSessionOrParam(
  searchParams: URLSearchParams
): Promise<{ tenantId: string } | NextResponse> {
  const tenantIdParam = searchParams.get('tenantId');

  let tenantId: string;
  
  if (tenantIdParam) {
    // Use query param if provided (Executive Dashboard pattern)
    tenantId = tenantIdParam;
  } else {
    // Get from session (Hook pattern)
    const user = await getCurrentUser();
    if (!user?.tenant_id) {
      return NextResponse.json(
        { error: 'User not authenticated or missing tenant context' },
        { status: 401 }
      );
    }
    tenantId = user.tenant_id;
  }

  // Validate tenantId format
  if (!isValidTenantId(tenantId)) {
    return NextResponse.json(
      { error: 'Invalid tenantId format (must be UUID v4)' },
      { status: 400 }
    );
  }

  return { tenantId };
}
