import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { PreschoolSafePickupHandoverService } from '@/products/bella-education/services/preschool-safe-pickup-handover.service';
import {
  EducationSecurityGuardService,
  type EducationRole,
  type SecurityUserContext,
} from '@/products/bella-education/security/education-security-guard.service';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';

type EducationAttendanceClient = SupabaseClient<Database>;

interface RequestContext {
  readonly tenantId: string;
  readonly operatorUserId: string;
  readonly role: string;
}

const handoverGuard = new EducationSecurityGuardService();

function createAdminOperationClient(): EducationAttendanceClient | null {
  if (process.env.NODE_ENV === 'test') return null;

  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveRequestContext(request: Request): Promise<RequestContext | null> {
  const mockEmail = process.env.NODE_ENV === 'development'
    ? request.headers.get('x-mock-user-email')?.trim()
    : '';

  if (mockEmail) {
    const supabase = createClient();
    const { data: user } = await supabase
      .from('users')
      .select('id, tenant_id, role')
      .eq('email', mockEmail)
      .maybeSingle();

    if (user?.id && user.tenant_id && user.role) {
      return {
        tenantId: user.tenant_id,
        operatorUserId: user.id,
        role: user.role,
      };
    }
  }

  const currentUser = await getCurrentUser();
  if (!currentUser?.id || !currentUser.tenant_id || !currentUser.role) {
    return null;
  }

  return {
    tenantId: currentUser.tenant_id,
    operatorUserId: currentUser.id,
    role: currentUser.role,
  };
}

function mapBellaAttendanceRole(role: string): EducationRole | null {
  const normalizedRole = role.trim().toLowerCase();
  if (normalizedRole === 'admin' || normalizedRole === 'super_admin') return 'PRINCIPAL';
  if (normalizedRole === 'admin_staff') return 'TEACHER';
  return null;
}

function assertCanRecordHandover(context: RequestContext): void {
  const educationRole = mapBellaAttendanceRole(context.role);
  if (!educationRole) {
    throw new Error(
      `AUTH_ROLE_PERMISSION_ERROR: Role '${context.role || 'unknown'}' is forbidden from modifying class attendance rosters`
    );
  }

  const securityContext: SecurityUserContext = {
    userId: context.operatorUserId,
    tenantId: context.tenantId,
    role: educationRole,
  };

  handoverGuard.assertCanModifyAttendanceRoster(securityContext);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

export async function POST(request: Request) {
  try {
    const context = await resolveRequestContext(request);
    if (!context) {
      return NextResponse.json({ success: false, error: 'Authenticated tenant is required' }, { status: 401 });
    }
    assertCanRecordHandover(context);

    const body = await request.json();
    const studentPartyId = requireString(body.studentPartyId, 'studentPartyId');
    const guardianPartyId = requireString(body.guardianPartyId, 'guardianPartyId');
    const pickupAuthorizationId = requireString(body.pickupAuthorizationId, 'pickupAuthorizationId');

    const supabase = createAdminOperationClient() ?? createClient();
    const handover = await new PreschoolSafePickupHandoverService(supabase).recordHandover({
      tenantId: context.tenantId,
      studentPartyId,
      guardianPartyId,
      pickupAuthorizationId,
      operatorUserId: context.operatorUserId,
    });

    return NextResponse.json({ success: true, handover }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.endsWith(' is required') ? 400 : message.startsWith('AUTH_ROLE_PERMISSION_ERROR') ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
