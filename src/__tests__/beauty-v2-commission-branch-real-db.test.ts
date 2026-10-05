import { randomUUID } from 'node:crypto';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  recalculateAndSaveSalaryRecordEngine,
} from '@/modules/hr-salary/actions/salary-recalculation-engine';
import { COMMISSION_BRANCH_MAPPING_ERRORS } from '@/modules/hr-salary/lib/salary-branch-mapping';
import { createBookingServiceItems } from '@/core/services/order/create-booking-service-items-helper';
import { createProductSale } from '@/modules/product-sales/actions/product-sales-actions';
import { getSupabaseAdminKey, getSupabaseAdminUrl, requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { runRealDbSql } from './utils/real-db-sql';

jest.mock('server-only', () => ({}), { virtual: true });

const mockCreateClient = jest.fn();
const mockRecalculateAndSaveSalaryRecord = jest.fn();
const mockSafeRevalidatePath = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
}));

jest.mock('@/modules/hr-salary/actions/admin-salary-actions', () => ({
  recalculateAndSaveSalaryRecord: (...args: unknown[]) => mockRecalculateAndSaveSalaryRecord(...args),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: (path: string) => mockSafeRevalidatePath(path),
}));

jest.setTimeout(120_000);

type SeedClient = SupabaseClient<Database>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const hasRealSupabaseAdminEnv = () => {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key',
  );
};

const describeWithRealSupabase = hasRealSupabaseAdminEnv() ? describe : describe.skip;

function requireUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  return value;
}

describeWithRealSupabase('Beauty V2 Commission branch Real DB proof', () => {
  const marker = `beauty-v2-commission-branch-${Date.now()}`;
  let tenantId = '';
  let otherTenantId = '';
  const companyId = randomUUID();
  const regionId = randomUUID();
  const branchAId = randomUUID();
  const branchBId = randomUUID();
  const otherTenantBranchId = randomUUID();
  const customerId = randomUUID();
  const successPersonId = randomUUID();
  const mismatchPersonId = randomUUID();
  const nullBranchPersonId = randomUUID();
  const multiBranchPersonId = randomUUID();
  const successKtvEmail = `${marker}-success@example.test`;
  const mismatchKtvEmail = `${marker}-mismatch@example.test`;
  const nullBranchKtvEmail = `${marker}-null@example.test`;
  const multiBranchKtvEmail = `${marker}-multi@example.test`;
  let supabase: SeedClient;
  let successKtvId = '';
  let mismatchKtvId = '';
  let nullBranchKtvId = '';
  let multiBranchKtvId = '';
  let cleaned = false;

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const monthYear = `${today.slice(0, 7)}-01`;

  async function cleanupStep(label: string, result: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await result;
    if (error) throw new Error(`${label} cleanup failed: ${error.message}`);
  }

  async function createAuthUser(email: string) {
    const result = await supabase.auth.admin.createUser({
      email,
      password: randomUUID(),
      email_confirm: true,
    });
    if (result.error || !result.data.user) {
      throw new Error(`auth user fixture failed for ${email}: ${result.error?.message ?? 'missing auth user'}`);
    }

    return result.data.user.id;
  }

  async function selectExistingProofTenants() {
    const result = await supabase
      .from('tenants')
      .select('id, name')
      .limit(100);
    if (result.error) {
      throw new Error(`tenant baseline lookup failed: ${result.error.message}`);
    }

    const candidates = (result.data ?? [])
      .filter((tenant) => !String(tenant.name ?? '').startsWith('beauty-v2-commission-branch-'))
      .map((tenant) => tenant.id)
      .filter((id): id is string => typeof id === 'string' && UUID_PATTERN.test(id));

    const distinctCandidates = [...new Set(candidates)];
    if (distinctCandidates.length < 2) {
      throw new Error('BLOCKED_BY_E2E_TENANT_BASELINE: Commission proof requires two existing tenant shells');
    }

    tenantId = distinctCandidates[0];
    otherTenantId = distinctCandidates[1];
  }

  async function insertAttendance(ktvId: string, branchId: string) {
    await cleanupStep('attendance insert', supabase.from('attendance').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      ktv_id: ktvId,
      date: today,
      branch_id: branchId,
      status: 'present',
      checkin_time: `${today}T08:45:00+07:00`,
      checkout_time: `${today}T18:00:00+07:00`,
    }));
  }

  async function insertBookingFor(ktvId: string) {
    const bookingId = randomUUID();
    await cleanupStep('booking insert', supabase.from('bookings').insert({
      id: bookingId,
      tenant_id: tenantId,
      booking_number: `${marker}-${bookingId.slice(0, 8)}`,
      customer_id: customerId,
      package_name: `${marker} service`,
      assigned_ktv_id: ktvId,
      start_date: today,
      full_price: 1200000,
      deposit_amount: 0,
      discount_percent: 0,
      status: 'booked',
      total_sessions: 1,
      completed_sessions: 0,
      ktv_commission: 120000,
    }));

    return bookingId;
  }

  async function insertSessionSource(ktvId: string, branchId: string | null) {
    const bookingId = await insertBookingFor(ktvId);
    await cleanupStep('session source insert', supabase.from('session_logs').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      booking_id: bookingId,
      branch_id: branchId,
      session_number: 1,
      assigned_date: today,
      completed_date: today,
      completed_by_ktv_id: ktvId,
      rating: 5,
      status: 'completed',
    }));

    return bookingId;
  }

  async function insertServiceSource(ktvId: string, bookingId: string, branchId: string | null, amount: number) {
    await cleanupStep('service commission source insert', supabase.from('booking_service_items').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      booking_id: bookingId,
      branch_id: branchId,
      ktv_id: ktvId,
      service_name: `${marker} service item`,
      quantity: 1,
      unit_price: amount,
      subtotal: amount,
      calculated_commission: amount,
      status: 'completed',
      completed_date: today,
    }));
  }

  async function insertProductSource(ktvId: string, bookingId: string, branchId: string | null, amount: number) {
    await cleanupStep('product commission source insert', supabase.from('product_sales').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      booking_id: bookingId,
      branch_id: branchId,
      ktv_id: ktvId,
      product_name: `${marker} product`,
      quantity: 1,
      unit_price: amount,
      total_sales_amount: amount,
      calculated_commission: amount,
      payment_method: 'cash',
      status: 'completed',
      sale_date: today,
    }));
  }

  async function createServiceSourceViaWriter(ktvId: string, bookingId: string, amount: number) {
    const result = await createBookingServiceItems({
      supabase,
      booking: {
        id: bookingId,
        tenant_id: tenantId,
        assigned_ktv_id: ktvId,
        status: 'completed',
        start_date: today,
        end_date: null,
      } as unknown as Database['public']['Tables']['bookings']['Row'],
      tenantId,
      serviceItems: [
        {
          serviceName: `${marker} service item`,
          quantity: 1,
          unitPrice: amount,
          ktvId,
          overrideType: 'fixed',
          overrideValue: amount,
        },
      ],
    });

    if (!result.success) {
      throw new Error(`service writer failed: ${result.error}`);
    }
  }

  async function createProductSourceViaWriter(ktvId: string, amount: number) {
    const result = await createProductSale({
      tenantId,
      ktvId,
      productName: `${marker} product`,
      quantity: 1,
      unitPrice: amount,
      totalSalesAmount: amount,
      overrideCommissionType: 'fixed',
      overrideCommissionValue: amount,
      paymentMethod: 'cash',
      saleDate: today,
    });

    if (!result.success) {
      throw new Error(`product writer failed: ${result.error}`);
    }
  }

  async function assertWriterBranchReadBack(ktvId: string) {
    const serviceRows = await supabase
      .from('booking_service_items')
      .select('branch_id')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvId)
      .eq('service_name', `${marker} service item`);
    expect(serviceRows.error).toBeNull();
    expect(serviceRows.data).toEqual([
      { branch_id: branchAId },
    ]);

    const productRows = await supabase
      .from('product_sales')
      .select('branch_id')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvId)
      .eq('product_name', `${marker} product`);
    expect(productRows.error).toBeNull();
    expect(productRows.data).toEqual([
      { branch_id: branchAId },
    ]);
  }

  async function salaryRowsFor(ktvId: string) {
    const result = await supabase
      .from('salary_records')
      .select('id, tenant_id, ktv_id, month_year, branch_id, session_bonus, service_commission, product_sales_commission, status')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvId)
      .eq('month_year', monthYear);
    if (result.error) throw new Error(`salary read failed: ${result.error.message}`);

    return result.data ?? [];
  }

  async function cleanup() {
    const authUserIds = [successKtvId, mismatchKtvId, nullBranchKtvId, multiBranchKtvId]
      .filter(Boolean)
      .map((id, index) => requireUuid(id, `auth user cleanup id ${index}`));
    const userIdsSql = authUserIds.map((id) => `'${id}'`).join(', ') || 'NULL';
    const orgUnitIdsSql = [companyId, regionId, branchAId, branchBId, otherTenantBranchId]
      .map((id, index) => requireUuid(id, `org unit cleanup id ${index}`))
      .map((id) => `'${id}'`)
      .join(', ');

    await runRealDbSql('current commission proof SQL cleanup', `
      SET statement_timeout = '120s';
      DELETE FROM public.salary_records
      WHERE ktv_id IN (${userIdsSql});
      DELETE FROM public.product_sales
      WHERE ktv_id IN (${userIdsSql})
         OR product_name LIKE '${marker}%';
      DELETE FROM public.booking_service_items
      WHERE ktv_id IN (${userIdsSql})
         OR service_name LIKE '${marker}%';
      DELETE FROM public.session_logs
      WHERE completed_by_ktv_id IN (${userIdsSql})
         OR booking_id IN (SELECT id FROM public.bookings WHERE booking_number LIKE '${marker}%');
      DELETE FROM public.attendance
      WHERE ktv_id IN (${userIdsSql});
      DELETE FROM public.bookings WHERE booking_number LIKE '${marker}%';
      DELETE FROM public.customers WHERE id = '${requireUuid(customerId, 'customer cleanup id')}';
      DELETE FROM public.org_relationships
      WHERE from_id IN (
        '${requireUuid(successPersonId, 'success person cleanup id')}',
        '${requireUuid(mismatchPersonId, 'mismatch person cleanup id')}',
        '${requireUuid(nullBranchPersonId, 'null branch person cleanup id')}',
        '${requireUuid(multiBranchPersonId, 'multi branch person cleanup id')}'
      );
      DELETE FROM public.people_directory
      WHERE id IN (
        '${requireUuid(successPersonId, 'success person cleanup id')}',
        '${requireUuid(mismatchPersonId, 'mismatch person cleanup id')}',
        '${requireUuid(nullBranchPersonId, 'null branch person cleanup id')}',
        '${requireUuid(multiBranchPersonId, 'multi branch person cleanup id')}'
      );
      DELETE FROM public.users WHERE id IN (${userIdsSql});
      DELETE FROM public.org_units WHERE id IN (${orgUnitIdsSql});
    `);

    for (const userId of authUserIds) {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error && !error.message.toLowerCase().includes('user not found')) {
        throw new Error(`auth user cleanup failed: ${error.message}`);
      }
    }

    cleaned = true;
  }

  async function assertCurrentProofResidualsZero() {
    const salaryRows = await supabase
      .from('salary_records')
      .select('id')
      .in('ktv_id', [successKtvId, mismatchKtvId, nullBranchKtvId, multiBranchKtvId]);
    expect(salaryRows.error).toBeNull();
    expect(salaryRows.data).toEqual([]);

    const productRows = await supabase
      .from('product_sales')
      .select('id')
      .in('ktv_id', [successKtvId, mismatchKtvId, nullBranchKtvId, multiBranchKtvId]);
    expect(productRows.error).toBeNull();
    expect(productRows.data).toEqual([]);

    const serviceRows = await supabase
      .from('booking_service_items')
      .select('id')
      .in('ktv_id', [successKtvId, mismatchKtvId, nullBranchKtvId, multiBranchKtvId]);
    expect(serviceRows.error).toBeNull();
    expect(serviceRows.data).toEqual([]);

    const sessionRows = await supabase
      .from('session_logs')
      .select('id')
      .in('completed_by_ktv_id', [successKtvId, mismatchKtvId, nullBranchKtvId, multiBranchKtvId]);
    expect(sessionRows.error).toBeNull();
    expect(sessionRows.data).toEqual([]);

    const attendanceRows = await supabase
      .from('attendance')
      .select('id')
      .in('ktv_id', [successKtvId, mismatchKtvId, nullBranchKtvId, multiBranchKtvId]);
    expect(attendanceRows.error).toBeNull();
    expect(attendanceRows.data).toEqual([]);

    const bookingRows = await supabase
      .from('bookings')
      .select('id')
      .like('booking_number', `${marker}%`);
    expect(bookingRows.error).toBeNull();
    expect(bookingRows.data).toEqual([]);

    const customerRows = await supabase.from('customers').select('id').eq('id', customerId);
    expect(customerRows.error).toBeNull();
    expect(customerRows.data).toEqual([]);

    const users = await supabase
      .from('users')
      .select('id')
      .in('id', [successKtvId, mismatchKtvId, nullBranchKtvId, multiBranchKtvId]);
    expect(users.error).toBeNull();
    expect(users.data).toEqual([]);

    const orgUnits = await supabase
      .from('org_units')
      .select('id')
      .in('id', [companyId, regionId, branchAId, branchBId, otherTenantBranchId]);
    expect(orgUnits.error).toBeNull();
    expect(orgUnits.data).toEqual([]);

    const tenants = await supabase.from('tenants').select('id').like('name', `${marker}%`);
    expect(tenants.error).toBeNull();
    expect(tenants.data).toEqual([]);

    const people = await supabase
      .from('people_directory')
      .select('id')
      .in('id', [successPersonId, mismatchPersonId, nullBranchPersonId, multiBranchPersonId]);
    expect(people.error).toBeNull();
    expect(people.data).toEqual([]);

    const relationships = await supabase
      .from('org_relationships')
      .select('id')
      .in('from_id', [successPersonId, mismatchPersonId, nullBranchPersonId, multiBranchPersonId]);
    expect(relationships.error).toBeNull();
    expect(relationships.data).toEqual([]);
  }

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    mockCreateClient.mockResolvedValue(supabase);
    mockRecalculateAndSaveSalaryRecord.mockResolvedValue({ success: true });
    mockSafeRevalidatePath.mockResolvedValue(undefined);

    await selectExistingProofTenants();

    successKtvId = await createAuthUser(successKtvEmail);
    mismatchKtvId = await createAuthUser(mismatchKtvEmail);
    nullBranchKtvId = await createAuthUser(nullBranchKtvEmail);
    multiBranchKtvId = await createAuthUser(multiBranchKtvEmail);

    await cleanupStep('org units insert', supabase.from('org_units').insert([
      {
        id: companyId,
        tenant_id: tenantId,
        unit_type: 'company',
        name: `${marker} company`,
        is_active: true,
      },
      {
        id: regionId,
        tenant_id: tenantId,
        unit_type: 'region',
        name: `${marker} region`,
        parent_id: companyId,
        is_active: true,
      },
      {
        id: branchAId,
        tenant_id: tenantId,
        unit_type: 'branch',
        name: `${marker} branch A`,
        parent_id: regionId,
        is_active: true,
      },
      {
        id: branchBId,
        tenant_id: tenantId,
        unit_type: 'branch',
        name: `${marker} branch B`,
        parent_id: regionId,
        is_active: true,
      },
      {
        id: otherTenantBranchId,
        tenant_id: otherTenantId,
        unit_type: 'branch',
        name: `${marker} other tenant branch`,
        is_active: true,
      },
    ]));

    await cleanupStep('customer insert', supabase.from('customers').insert({
      id: customerId,
      tenant_id: tenantId,
      name_mother: `${marker} customer`,
      phone: `09${Date.now().toString().slice(-8)}`,
      status: 'active',
    }));

    await cleanupStep('users insert', supabase.from('users').insert([
      {
        id: successKtvId,
        tenant_id: tenantId,
        email: successKtvEmail,
        full_name: 'Beauty Commission Branch Success KTV',
        role: 'ktv',
        status: 'active',
        base_salary: 6000000,
        position_tier: 'junior',
        hire_date: `${today.slice(0, 4)}-01-01`,
      },
      {
        id: mismatchKtvId,
        tenant_id: tenantId,
        email: mismatchKtvEmail,
        full_name: 'Beauty Commission Mismatch KTV',
        role: 'ktv',
        status: 'active',
        base_salary: 6000000,
        position_tier: 'junior',
        hire_date: `${today.slice(0, 4)}-01-01`,
      },
      {
        id: nullBranchKtvId,
        tenant_id: tenantId,
        email: nullBranchKtvEmail,
        full_name: 'Beauty Commission Null Branch KTV',
        role: 'ktv',
        status: 'active',
        base_salary: 6000000,
        position_tier: 'junior',
        hire_date: `${today.slice(0, 4)}-01-01`,
      },
      {
        id: multiBranchKtvId,
        tenant_id: tenantId,
        email: multiBranchKtvEmail,
        full_name: 'Beauty Commission Multi Branch KTV',
        role: 'ktv',
        status: 'active',
        base_salary: 6000000,
        position_tier: 'junior',
        hire_date: `${today.slice(0, 4)}-01-01`,
      },
    ]));

    await cleanupStep('people directory insert', supabase.from('people_directory').insert([
      {
        id: successPersonId,
        tenant_id: tenantId,
        user_id: successKtvId,
        display_name: 'Beauty Commission Branch Success KTV',
        person_type: 'employee',
        is_active: true,
      },
      {
        id: mismatchPersonId,
        tenant_id: tenantId,
        user_id: mismatchKtvId,
        display_name: 'Beauty Commission Mismatch KTV',
        person_type: 'employee',
        is_active: true,
      },
      {
        id: nullBranchPersonId,
        tenant_id: tenantId,
        user_id: nullBranchKtvId,
        display_name: 'Beauty Commission Null Branch KTV',
        person_type: 'employee',
        is_active: true,
      },
      {
        id: multiBranchPersonId,
        tenant_id: tenantId,
        user_id: multiBranchKtvId,
        display_name: 'Beauty Commission Multi Branch KTV',
        person_type: 'employee',
        is_active: true,
      },
    ]));

    await cleanupStep('org relationships insert', supabase.from('org_relationships').insert([
      {
        tenant_id: tenantId,
        from_id: successPersonId,
        from_type: 'person',
        to_id: branchAId,
        to_type: 'unit',
        rel_type: 'belongs_to',
      },
      {
        tenant_id: tenantId,
        from_id: mismatchPersonId,
        from_type: 'person',
        to_id: branchAId,
        to_type: 'unit',
        rel_type: 'belongs_to',
      },
      {
        tenant_id: tenantId,
        from_id: nullBranchPersonId,
        from_type: 'person',
        to_id: branchAId,
        to_type: 'unit',
        rel_type: 'belongs_to',
      },
      {
        tenant_id: tenantId,
        from_id: multiBranchPersonId,
        from_type: 'person',
        to_id: branchAId,
        to_type: 'unit',
        rel_type: 'belongs_to',
      },
      {
        tenant_id: tenantId,
        from_id: multiBranchPersonId,
        from_type: 'person',
        to_id: branchBId,
        to_type: 'unit',
        rel_type: 'belongs_to',
      },
    ]));
  });

  afterAll(async () => {
    if (!cleaned) {
      await cleanup();
    }
  });

  it('proves branch-aware commission allow and deny-before-write cases on real DB', async () => {
    await insertAttendance(successKtvId, branchAId);
    const successBookingId = await insertSessionSource(successKtvId, branchAId);
    await createServiceSourceViaWriter(successKtvId, successBookingId, 150000);
    await createProductSourceViaWriter(successKtvId, 25000);
    await assertWriterBranchReadBack(successKtvId);

    const success = await recalculateAndSaveSalaryRecordEngine(
      supabase,
      successKtvId,
      monthYear,
      tenantId,
      { expectedBranchId: branchAId },
    );
    expect(success.success).toBe(true);

    const successSalaryRows = await salaryRowsFor(successKtvId);
    expect(successSalaryRows).toHaveLength(1);
    expect(successSalaryRows[0]).toMatchObject({
      tenant_id: tenantId,
      ktv_id: successKtvId,
      month_year: monthYear,
      branch_id: branchAId,
      session_bonus: 120000,
      service_commission: 150000,
      product_sales_commission: 25000,
      status: 'draft',
    });

    await insertAttendance(mismatchKtvId, branchAId);
    await insertSessionSource(mismatchKtvId, otherTenantBranchId);
    await expect(recalculateAndSaveSalaryRecordEngine(
      supabase,
      mismatchKtvId,
      monthYear,
      tenantId,
      { expectedBranchId: branchAId },
    )).rejects.toThrow(COMMISSION_BRANCH_MAPPING_ERRORS.SOURCE_BRANCH_CONTEXT_MISMATCH);
    expect(await salaryRowsFor(mismatchKtvId)).toEqual([]);

    await insertAttendance(nullBranchKtvId, branchAId);
    await insertSessionSource(nullBranchKtvId, null);
    await expect(recalculateAndSaveSalaryRecordEngine(
      supabase,
      nullBranchKtvId,
      monthYear,
      tenantId,
      { expectedBranchId: branchAId },
    )).rejects.toThrow(COMMISSION_BRANCH_MAPPING_ERRORS.SOURCE_BRANCH_NOT_PROVEN);
    expect(await salaryRowsFor(nullBranchKtvId)).toEqual([]);

    await insertAttendance(multiBranchKtvId, branchAId);
    const multiBookingId = await insertSessionSource(multiBranchKtvId, branchAId);
    await insertServiceSource(multiBranchKtvId, multiBookingId, branchAId, 150000);
    await insertServiceSource(multiBranchKtvId, multiBookingId, branchBId, 25000);
    await expect(recalculateAndSaveSalaryRecordEngine(
      supabase,
      multiBranchKtvId,
      monthYear,
      tenantId,
      { expectedBranchId: branchAId },
    )).rejects.toThrow(COMMISSION_BRANCH_MAPPING_ERRORS.MULTI_BRANCH_SOURCE_NOT_SUPPORTED);
    expect(await salaryRowsFor(multiBranchKtvId)).toEqual([]);
  });

  it('cleans up current proof rows with zero residual', async () => {
    await cleanup();
    await assertCurrentProofResidualsZero();
  });
});
