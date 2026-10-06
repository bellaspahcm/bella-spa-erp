import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { POST as createPreschoolEnrollment } from '@/app/api/education/enrollments/route';
import {
  getSupabaseAdminKey,
  getSupabaseAdminUrl,
  requireSupabaseAdminEnv,
} from '@/lib/supabase-admin-env';
import { PreschoolChainService } from '@/products/bella-education/services/preschool-chain.service';
import type { Database } from '@/types/database.types';

let supabase: SupabaseClient<Database>;

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => supabase,
}));

jest.setTimeout(120_000);

const dbUrl =
  process.env.DATABASE_URL
  || process.env.SUPABASE_DATABASE_URL
  || process.env.SUPABASE_DB_URL
  || '';
const educationSystemUserId = '00000000-0000-0000-0000-000000000001';

function isRunnableDbUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.hostname && parsed.hostname !== 'base');
  } catch {
    return false;
  }
}

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

function hasRealSupabaseAdminEnv(): boolean {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key',
  );
}

interface PreschoolEnrollmentResponse {
  readonly success: boolean;
  readonly error?: string;
  readonly student: {
    readonly partyId: string;
    readonly studentCode: string;
    readonly guardianPartyId: string;
  };
  readonly enrollment: {
    readonly id: string;
    readonly courseId: string;
    readonly status: string;
  };
  readonly chain: {
    readonly tenantId: string;
    readonly courseId: string;
    readonly enrollmentId: string;
    readonly branchId: string;
    readonly requestId: string;
    readonly assignedBy: string | null;
  } | null;
}

type CountRow = {
  count: number;
};

type EnrollmentReadBackRow = {
  id: string;
  tenant_id: string;
  student_party_id: string;
  course_id: string;
  request_id: string;
  status: string;
};

type ChainReadBackRow = {
  tenant_id: string;
  enrollment_id: string;
  course_id: string;
  branch_id: string;
  request_id: string;
  assigned_by: string | null;
};

describe('Preschool Chain real DB E2E proof', () => {
  const marker = `preschool-chain-real-db-${Date.now()}`;
  const ids = {
    tenant: randomUUID(),
    otherTenant: randomUUID(),
    branchA: randomUUID(),
    branchB: randomUUID(),
    otherTenantBranch: randomUUID(),
    person: randomUUID(),
    course: randomUUID(),
  };

  let pg: Client;
  let actorUserId = '';
  let authUserId = '';
  const actorEmail = `${marker}-admission-operator@example.test`;

  beforeAll(async () => {
    if (!isRunnableDbUrl(dbUrl)) {
      throw new Error('PRESCHOOL_CHAIN_REAL_DB_REQUIRES_DATABASE_URL_OR_SUPABASE_DB_URL');
    }
    if (!hasRealSupabaseAdminEnv()) {
      throw new Error('PRESCHOOL_CHAIN_REAL_DB_REQUIRES_REAL_SUPABASE_ADMIN_ENV');
    }

    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authUser = await supabase.auth.admin.createUser({
      email: actorEmail,
      password: `${randomUUID()}A1!`,
      email_confirm: true,
    });
    if (authUser.error || !authUser.data.user) {
      throw new Error(`Failed to seed Preschool auth user: ${authUser.error?.message ?? 'missing user'}`);
    }
    authUserId = authUser.data.user.id;
    actorUserId = authUser.data.user.id;
    const routeUser = authUser.data.user;
    supabase.auth.getUser = async () => ({ data: { user: routeUser }, error: null });

    pg = new Client({
      connectionString: dbUrl,
      ssl: sslConfig(),
    });
    await pg.connect();
    await cleanupDatabaseRows();
    await seedPreschoolChainFixture();
  });

  afterAll(async () => {
    let cleanupError: unknown = null;
    try {
      if (pg) {
        try {
          await cleanupDatabaseRows();
          await assertNoPreschoolChainRowsRemain();
        } catch (error) {
          cleanupError = error;
        } finally {
          await pg.end();
        }
      }
    } finally {
      if (authUserId && supabase) {
        const { error } = await supabase.auth.admin.deleteUser(authUserId);
        if (error && !error.message.toLowerCase().includes('user not found')) {
          cleanupError = cleanupError ?? error;
        }
      }
      if (cleanupError) {
        throw cleanupError;
      }
    }
  });

  async function cleanupDatabaseRows(): Promise<void> {
    await pg.query('SET row_security = off');
    await pg.query(
      `
        DELETE FROM public.preschool_chain_enrollment_branch_assignments
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.tenant, ids.otherTenant]],
    );
    await pg.query(
      `
        DELETE FROM public.preschool_chain_course_branch_assignments
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.tenant, ids.otherTenant]],
    );
    await pg.query(
      `
        DELETE FROM public.edu_preschool_pickup_authorizations
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.tenant, ids.otherTenant]],
    );
    await pg.query(
      `
        DELETE FROM public.edu_enrollments
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.tenant, ids.otherTenant]],
    );
    await pg.query(
      `
        DELETE FROM public.students
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.tenant, ids.otherTenant]],
    );
    await pg.query(
      `
        DELETE FROM public.party_relationships
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.tenant, ids.otherTenant]],
    );
    await pg.query(
      `
        DELETE FROM public.party_identifiers
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.tenant, ids.otherTenant]],
    );
    await pg.query(
      `
        DELETE FROM public.edu_courses
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.tenant, ids.otherTenant]],
    );
    await pg.query(
      `
        DELETE FROM public.org_relationships
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.tenant, ids.otherTenant]],
    );
    await pg.query(
      `
        DELETE FROM public.people_directory
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.tenant, ids.otherTenant]],
    );
    if (actorUserId) {
      await pg.query(
        `
          DELETE FROM public.users
          WHERE id = $1::uuid
        `,
        [actorUserId],
      );
    }
    await pg.query(
      `
        DELETE FROM public.org_units
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.tenant, ids.otherTenant]],
    );

    console.warn(
      `[Preschool Chain real DB cleanup] retained tenant and Party shells because public.timeline_events is append-only and may hold tenant/party FK rows: ${ids.tenant}, ${ids.otherTenant}`,
    );
  }

  async function assertNoPreschoolChainRowsRemain(): Promise<void> {
    const checks = [
      'preschool_chain_enrollment_branch_assignments',
      'preschool_chain_course_branch_assignments',
      'edu_enrollments',
    ] as const;

    for (const tableName of checks) {
      const result = await pg.query<CountRow>(
        `SELECT COUNT(*)::int AS count FROM public.${tableName} WHERE tenant_id = ANY($1::uuid[])`,
        [[ids.tenant, ids.otherTenant]],
      );
      expect(result.rows[0]?.count).toBe(0);
    }
  }

  async function seedPreschoolChainFixture(): Promise<void> {
    await pg.query(
      `
        INSERT INTO public.tenants (id, name, status, product_key, enabled_modules)
        VALUES
          ($1::uuid, $2, 'active', 'bella_education', '{"education": true}'::jsonb),
          ($3::uuid, $4, 'active', 'bella_education', '{"education": true}'::jsonb)
      `,
      [
        ids.tenant,
        `${marker} Tenant`,
        ids.otherTenant,
        `${marker} Other Tenant`,
      ],
    );

    await pg.query(
      `
        INSERT INTO public.users (id, tenant_id, email, full_name, role, status)
        VALUES
          ($1::uuid, $2::uuid, $3, $4, 'admin_staff', 'active'),
          ($5::uuid, $2::uuid, $6, $7, 'admin_staff', 'active')
        ON CONFLICT (id) DO NOTHING
      `,
      [
        actorUserId,
        ids.tenant,
        actorEmail,
        `${marker} Admission Operator`,
        educationSystemUserId,
        `${marker}-education-system@example.test`,
        `${marker} Education System Actor`,
      ],
    );

    await pg.query(
      `
        INSERT INTO public.edu_courses (
          id,
          tenant_id,
          course_code,
          title,
          status,
          max_students,
          current_enrollment,
          prerequisite_course_codes
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3,
          $4,
          'active',
          25,
          0,
          '{}'::text[]
        )
      `,
      [
        ids.course,
        ids.tenant,
        `${marker}-CLASS-01`,
        `${marker} Preschool Class`,
      ],
    );

    await pg.query(
      `
        INSERT INTO public.org_units (id, tenant_id, unit_type, name, code, is_active, metadata)
        VALUES
          ($1::uuid, $4::uuid, 'branch', $5, $8, TRUE, '{"proof":"preschool-chain-real-db"}'::jsonb),
          ($2::uuid, $4::uuid, 'branch', $6, $9, TRUE, '{"proof":"preschool-chain-real-db"}'::jsonb),
          ($3::uuid, $10::uuid, 'branch', $7, $11, TRUE, '{"proof":"preschool-chain-real-db"}'::jsonb)
      `,
      [
        ids.branchA,
        ids.branchB,
        ids.otherTenantBranch,
        ids.tenant,
        `${marker} Branch A`,
        `${marker} Branch B`,
        `${marker} Other Tenant Branch`,
        `${marker}-A`,
        `${marker}-B`,
        ids.otherTenant,
        `${marker}-OT`,
      ],
    );

    await pg.query(
      `
        INSERT INTO public.people_directory (id, tenant_id, user_id, person_type, display_name, is_active, metadata)
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'employee', $4, TRUE, '{"proof":"preschool-chain-real-db"}'::jsonb)
      `,
      [
        ids.person,
        ids.tenant,
        actorUserId,
        `${marker} Admission Operator`,
      ],
    );

    await pg.query(
      `
        INSERT INTO public.org_relationships (
          tenant_id,
          from_id,
          from_type,
          to_id,
          to_type,
          rel_type,
          role,
          since,
          metadata
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          'person',
          $3::uuid,
          'unit',
          'belongs_to',
          'admission_operator',
          CURRENT_DATE,
          '{"proof":"preschool-chain-real-db"}'::jsonb
        )
      `,
      [ids.tenant, ids.person, ids.branchA],
    );
  }

  function buildAdmissionRequest(): Request {
    return new Request('http://localhost/api/education/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: ids.tenant,
        childName: `${marker} Student`,
        nickname: 'Proof',
        dateOfBirth: '2023-06-15',
        gender: 'Nam',
        guardianName: `${marker} Guardian`,
        guardianPhone: '0909123456',
        medicalNote: 'Real DB chain proof',
        courseId: ids.course,
        branchId: ids.branchA,
      }),
    });
  }

  it('proves Preschool Chain migration tables, RLS, and policy surface exist in the real database', async () => {
    const tables = await pg.query<{ table_name: string }>(
      `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1::text[])
        ORDER BY table_name
      `,
      [[
        'preschool_chain_course_branch_assignments',
        'preschool_chain_enrollment_branch_assignments',
      ]],
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      'preschool_chain_course_branch_assignments',
      'preschool_chain_enrollment_branch_assignments',
    ]);

    const rls = await pg.query<{ relname: string; relrowsecurity: boolean }>(
      `
        SELECT c.relname, c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = ANY($1::text[])
        ORDER BY c.relname
      `,
      [[
        'preschool_chain_course_branch_assignments',
        'preschool_chain_enrollment_branch_assignments',
      ]],
    );
    expect(rls.rows).toHaveLength(2);
    expect(rls.rows.every((row) => row.relrowsecurity)).toBe(true);

    const policies = await pg.query<{ policyname: string }>(
      `
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND policyname = ANY($1::text[])
        ORDER BY policyname
      `,
      [[
        'preschool_chain_course_branch_assignments_tenant_isolation',
        'preschool_chain_enrollment_branch_assignments_tenant_isolation',
      ]],
    );
    expect(policies.rows.map((row) => row.policyname)).toEqual([
      'preschool_chain_course_branch_assignments_tenant_isolation',
      'preschool_chain_enrollment_branch_assignments_tenant_isolation',
    ]);
  });

  it('proves admission branch assignment persists through edu_enrollments, chain tables, read-back, tenant isolation, authorization, and idempotency', async () => {
    const chainService = new PreschoolChainService(supabase);
    const accessibleBranches = await chainService.listAccessibleBranches(ids.tenant, actorUserId);
    expect(accessibleBranches.map((branch) => branch.id)).toEqual([ids.branchA]);

    const response = await createPreschoolEnrollment(buildAdmissionRequest());
    const body: PreschoolEnrollmentResponse = await response.json();

    if (response.status !== 201) {
      throw new Error(`Expected Preschool admission 201, received ${response.status}: ${JSON.stringify(body)}`);
    }
    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.enrollment.courseId).toBe(ids.course);
    expect(body.enrollment.status).toBe('active');
    expect(body.chain).toEqual(expect.objectContaining({
      tenantId: ids.tenant,
      courseId: ids.course,
      enrollmentId: body.enrollment.id,
      branchId: ids.branchA,
      assignedBy: actorUserId,
    }));

    expect(body.chain).not.toBeNull();
    const chain = body.chain;
    if (!chain) {
      throw new Error('Expected Preschool chain assignment in admission response');
    }

    const enrollmentReadBack = await pg.query<EnrollmentReadBackRow>(
      `
        SELECT id::text, tenant_id::text, student_party_id::text, course_id::text, request_id, status
        FROM public.edu_enrollments
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
      `,
      [body.enrollment.id, ids.tenant],
    );
    expect(enrollmentReadBack.rows[0]).toEqual({
      id: body.enrollment.id,
      tenant_id: ids.tenant,
      student_party_id: body.student.partyId,
      course_id: ids.course,
      request_id: chain.requestId,
      status: 'active',
    });

    const courseChain = await pg.query<ChainReadBackRow>(
      `
        SELECT tenant_id::text, $1::uuid::text AS enrollment_id, course_id::text, branch_id::text, $2::uuid::text AS request_id, assigned_by::text
        FROM public.preschool_chain_course_branch_assignments
        WHERE tenant_id = $3::uuid
          AND course_id = $4::uuid
      `,
      [body.enrollment.id, chain.requestId, ids.tenant, ids.course],
    );
    expect(courseChain.rows[0]).toEqual({
      tenant_id: ids.tenant,
      enrollment_id: body.enrollment.id,
      course_id: ids.course,
      branch_id: ids.branchA,
      request_id: chain.requestId,
      assigned_by: actorUserId,
    });

    const enrollmentChain = await pg.query<ChainReadBackRow>(
      `
        SELECT tenant_id::text, enrollment_id::text, course_id::text, branch_id::text, request_id::text, assigned_by::text
        FROM public.preschool_chain_enrollment_branch_assignments
        WHERE tenant_id = $1::uuid
          AND enrollment_id = $2::uuid
      `,
      [ids.tenant, body.enrollment.id],
    );
    expect(enrollmentChain.rows[0]).toEqual({
      tenant_id: ids.tenant,
      enrollment_id: body.enrollment.id,
      course_id: ids.course,
      branch_id: ids.branchA,
      request_id: chain.requestId,
      assigned_by: actorUserId,
    });

    await expect(chainService.getEnrollmentChain(ids.tenant, body.enrollment.id))
      .resolves
      .toEqual(expect.objectContaining({
        tenantId: ids.tenant,
        enrollmentId: body.enrollment.id,
        branchId: ids.branchA,
      }));
    await expect(chainService.getEnrollmentChain(ids.otherTenant, body.enrollment.id))
      .resolves
      .toBeNull();
    await expect(chainService.listAccessibleBranches(ids.otherTenant, actorUserId))
      .resolves
      .toEqual([]);

    await expect(chainService.assignEnrollmentToBranch({
      tenantId: ids.tenant,
      courseId: ids.course,
      enrollmentId: body.enrollment.id,
      branchId: ids.branchB,
      actorUserId,
      requestId: randomUUID(),
    })).rejects.toThrow('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED');

    await expect(chainService.assignEnrollmentToBranch({
      tenantId: ids.tenant,
      courseId: ids.course,
      enrollmentId: body.enrollment.id,
      branchId: ids.branchA,
      actorUserId,
      requestId: chain.requestId,
    })).resolves.toEqual(expect.objectContaining({
      tenantId: ids.tenant,
      enrollmentId: body.enrollment.id,
      branchId: ids.branchA,
      requestId: chain.requestId,
    }));

    const chainCount = await pg.query<CountRow>(
      `
        SELECT COUNT(*)::int AS count
        FROM public.preschool_chain_enrollment_branch_assignments
        WHERE tenant_id = $1::uuid
          AND enrollment_id = $2::uuid
      `,
      [ids.tenant, body.enrollment.id],
    );
    expect(chainCount.rows[0]?.count).toBe(1);
  });
});
