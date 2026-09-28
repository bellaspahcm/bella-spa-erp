import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';
import { AttendanceContractImpl } from '@/platform/education/contracts/attendance.contract.impl';
import type { EducationAttendanceStatus } from '@/platform/education/contracts/attendance.contract';
import { AttendanceProductService } from '@/products/bella-education/services/attendance.service';
import { PreschoolGuardianAuthorizationService } from '@/products/bella-education/services/preschool-guardian-authorization.service';
import { PreschoolSafePickupHandoverService } from '@/products/bella-education/services/preschool-safe-pickup-handover.service';
import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import { getCurrentUser } from '@/services/user-actions';
import type { Database } from '@/types/database.types';

type EducationAttendanceClient = SupabaseClient<Database>;

function isAttendanceStatus(value: unknown): value is EducationAttendanceStatus {
  return value === 'present' || value === 'absent' || value === 'excused';
}

function isSchoolDay(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function resolveRollCallTime(schoolDay: string, explicitRollCallTime?: unknown): string {
  if (typeof explicitRollCallTime === 'string' && explicitRollCallTime.trim()) {
    const date = new Date(explicitRollCallTime);
    if (Number.isNaN(date.getTime())) {
      throw new Error('INVALID_ROLL_CALL_TIME');
    }

    return date.toISOString();
  }

  return new Date(`${schoolDay}T05:00:00.000Z`).toISOString();
}

function createDevMockClient(mockEmail: string): EducationAttendanceClient | null {
  if (!mockEmail) return null;
  return createAdminOperationClient();
}

function createAdminOperationClient(): EducationAttendanceClient | null {
  if (process.env.NODE_ENV === 'test') return null;

  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) return null;

  return createSupabaseClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function resolveTenantId(request: Request): Promise<string | null> {
  const mockEmail = process.env.NODE_ENV === 'development'
    ? request.headers.get('x-mock-user-email')?.trim()
    : '';

  if (mockEmail) {
    const supabase = createClient();
    const { data: user } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('email', mockEmail)
      .maybeSingle();

    if (user?.tenant_id) return user.tenant_id;
  }

  const currentUser = await getCurrentUser();
  return currentUser?.tenant_id ?? null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const schoolDay = searchParams.get('date');
    const mockEmail = request.headers.get('x-mock-user-email')?.trim() ?? '';

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'courseId is required' }, { status: 400 });
    }
    if (!isSchoolDay(schoolDay)) {
      return NextResponse.json({ success: false, error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    const tenantId = await resolveTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Authenticated tenant is required' }, { status: 401 });
    }

    const supabase = createDevMockClient(mockEmail) ?? createAdminOperationClient() ?? createClient();
    const service = new AttendanceProductService(new AttendanceContractImpl(supabase));
    const roster = await service.getCourseDailyAttendance({ tenantId, courseId, schoolDay });
    const guardianService = new PreschoolGuardianAuthorizationService(supabase);
    const guardiansByStudent = await guardianService.getAuthorizedGuardians(
      tenantId,
      roster.map((student) => student.studentPartyId),
    );
    const handoverService = new PreschoolSafePickupHandoverService(supabase);
    const handoversByStudent = await handoverService.getLatestHandovers(
      tenantId,
      roster.map((student) => student.studentPartyId),
    );
    const rosterWithGuardians = roster.map((student) => ({
      ...student,
      authorizedGuardians: guardiansByStudent.get(student.studentPartyId) ?? [],
      safePickupHandover: handoversByStudent.get(student.studentPartyId) ?? null,
    }));

    return NextResponse.json({ success: true, roster: rosterWithGuardians });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const mockEmail = request.headers.get('x-mock-user-email')?.trim() ?? '';
    const tenantId = await resolveTenantId(request);
    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Authenticated tenant is required' }, { status: 401 });
    }

    if (typeof body.enrollmentId !== 'string' || !body.enrollmentId.trim()) {
      return NextResponse.json({ success: false, error: 'enrollmentId is required' }, { status: 400 });
    }
    if (!isAttendanceStatus(body.status)) {
      return NextResponse.json({ success: false, error: 'status must be present, absent, or excused' }, { status: 400 });
    }
    if (!isSchoolDay(typeof body.date === 'string' ? body.date : null)) {
      return NextResponse.json({ success: false, error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    const supabase = createDevMockClient(mockEmail) ?? createAdminOperationClient() ?? createClient();
    const service = new AttendanceProductService(new AttendanceContractImpl(supabase));
    const attendance = await service.setDailyAttendance({
      tenantId,
      enrollmentId: body.enrollmentId,
      status: body.status,
      rollCallTime: resolveRollCallTime(body.date, body.rollCallTime),
    });

    return NextResponse.json({ success: true, attendance });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'INVALID_ROLL_CALL_TIME' ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
