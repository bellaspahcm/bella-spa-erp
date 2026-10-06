import { randomUUID } from 'node:crypto';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { createBookingServiceItems } from '@/core/services/order/create-booking-service-items-helper';
import { createServiceItem } from '@/modules/bookings/actions/service-items-actions';
import { recalculateAndSaveSalaryRecordEngine } from '@/modules/hr-salary/actions/salary-recalculation-engine';
import { COMMISSION_BRANCH_MAPPING_ERRORS } from '@/modules/hr-salary/lib/salary-branch-mapping';
import { createProductSale } from '@/modules/product-sales/actions/product-sales-actions';
import { ktvCheckIn } from '@/services/attendance-actions';
import { assignBeautyStaffToBranch, createBeautyBranch, createBeautyCompany } from '@/services/beauty-chain-actions';
import { selectBeautyRuntimeBranch } from '@/services/beauty-runtime-branch-actions';
import { getSupabaseAdminKey, getSupabaseAdminUrl, requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));
jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('@/modules/hr-salary/actions/admin-salary-actions', () => ({
  recalculateAndSaveSalaryRecord: jest.fn().mockResolvedValue({ success: true }),
}));

type CurrentUserStub = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  tenant_id: string;
};

let supabase: SupabaseClient<Database>;
let adminSupabase: SupabaseClient<Database>;
let ktvSupabase: SupabaseClient<Database>;
let mockCurrentUser: CurrentUserStub | null = null;

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: jest.fn(async () => mockCurrentUser),
}));
jest.mock('@/lib/supabase-server', () => ({
  createClient: () => supabase,
}));
jest.mock('@/lib/supabase-dev-bypass-server', () => ({
  createDevelopmentBypassClient: () => supabase,
}));

jest.setTimeout(120_000);

const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

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

function createRuntimeWriterClient(): SupabaseClient<Database> {
  const client = {
    auth: ktvSupabase.auth,
    from: (table: string) => (
      table === 'user_org_unit_access' ? ktvSupabase : adminSupabase
    ).from(table as keyof Database['public']['Tables'] & keyof Database['public']['Views']),
    rpc: (...args: Parameters<SupabaseClient<Database>['rpc']>) => adminSupabase.rpc(...args),
  };

  return client as unknown as SupabaseClient<Database>;
}

describeWithRealSupabase('Beauty V2 Branch Runtime Operational Real DB verification', () => {
  const marker = `beauty-v2-branch-runtime-${Date.now()}`;
  const tenantId = randomUUID();
  const adminEmail = `${marker}-admin@example.test`;
  const ktvEmail = `${marker}-ktv@example.test`;
  const adminPassword = `${randomUUID()}A1!`;
  const ktvPassword = `${randomUUID()}A1!`;
  const customerId = randomUUID();
  const bookingId = randomUUID();
  const mismatchBookingId = randomUUID();
  let adminUserId = '';
  let ktvUserId = '';
  let branchAId = '';
  let branchBId = '';

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const monthYear = `${today.slice(0, 7)}-01`;

  async function cleanup() {
    const currentTenantId = requireUuid(tenantId, 'tenant cleanup id');
    const userIds = [adminUserId, ktvUserId]
      .filter(Boolean)
      .map((id, index) => requireUuid(id, `user cleanup id ${index}`));

    await adminSupabase.from('salary_records').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('product_sales').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('booking_service_items').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('session_logs').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('attendance').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('bookings').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('customers').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('org_relationships').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('people_directory').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('users').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('org_units').delete().eq('tenant_id', currentTenantId);
    await adminSupabase.from('tenants').delete().eq('id', currentTenantId);

    for (const userId of userIds) {
      const { error } = await adminSupabase.auth.admin.deleteUser(userId);
      if (error && !error.message.toLowerCase().includes('user not found')) {
        throw new Error(`auth user cleanup failed: ${error.message}`);
      }
    }
  }

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY is required for runtime auth proof');
    }

    adminSupabase = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    supabase = adminSupabase;

    const [adminAuth, ktvAuth] = await Promise.all([
      adminSupabase.auth.admin.createUser({ email: adminEmail, password: adminPassword, email_confirm: true }),
      adminSupabase.auth.admin.createUser({ email: ktvEmail, password: ktvPassword, email_confirm: true }),
    ]);
    if (adminAuth.error || !adminAuth.data.user) {
      throw new Error(`admin auth user fixture failed: ${adminAuth.error?.message ?? 'missing auth user'}`);
    }
    if (ktvAuth.error || !ktvAuth.data.user) {
      throw new Error(`ktv auth user fixture failed: ${ktvAuth.error?.message ?? 'missing auth user'}`);
    }

    adminUserId = adminAuth.data.user.id;
    ktvUserId = ktvAuth.data.user.id;

    const { error: tenantError } = await adminSupabase.from('tenants').insert({
      id: tenantId,
      name: `${marker} tenant`,
      status: 'active',
      product_key: 'beauty_spa_v2',
      enabled_modules: { beauty_spa: true, payroll: true },
      salary_config: {
        bonus_5_star: 50000,
        bonus_4_5_star: 30000,
        bonus_4_star: 10000,
        kpi_target_sessions: 30,
        kpi_bonus_amount: 1000000,
        penalty_late_per_day: 50000,
        penalty_absent_per_day: 200000,
      },
    });
    if (tenantError) throw new Error(`tenant fixture failed: ${tenantError.message}`);

    const { error: usersError } = await adminSupabase.from('users').insert([
      {
        id: adminUserId,
        tenant_id: tenantId,
        email: adminEmail,
        full_name: 'Beauty Branch Runtime Admin',
        role: 'admin',
        status: 'active',
        position_tier: 'junior',
      },
      {
        id: ktvUserId,
        tenant_id: tenantId,
        email: ktvEmail,
        full_name: 'Beauty Branch Runtime KTV',
        role: 'ktv',
        status: 'active',
        base_salary: 6000000,
        position_tier: 'junior',
        hire_date: `${today.slice(0, 4)}-01-01`,
      },
    ]);
    if (usersError) throw new Error(`users fixture failed: ${usersError.message}`);

    ktvSupabase = createSupabaseClient<Database>(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ktvSignIn = await ktvSupabase.auth.signInWithPassword({
      email: ktvEmail,
      password: ktvPassword,
    });
    if (ktvSignIn.error) throw new Error(`ktv auth sign-in failed: ${ktvSignIn.error.message}`);
  });

  afterAll(async () => {
    await cleanup();
    mockCurrentUser = null;
  });

  it('proves Booking, Inventory, Payroll, and Commission use canonical runtime branch access', async () => {
    mockCurrentUser = {
      id: adminUserId,
      tenant_id: tenantId,
      email: adminEmail,
      full_name: 'Beauty Branch Runtime Admin',
      role: 'admin',
      status: 'active',
    };
    supabase = adminSupabase;

    const companyResult = await createBeautyCompany({ name: `${marker} company`, code: `${marker}-co` });
    expect(companyResult.success).toBe(true);
    if (!companyResult.success) throw new Error(companyResult.error);

    const branchAResult = await createBeautyBranch({
      companyId: companyResult.data.id,
      name: `${marker} Branch A`,
      code: `${marker}-a`,
    });
    expect(branchAResult.success).toBe(true);
    if (!branchAResult.success) throw new Error(branchAResult.error);
    branchAId = branchAResult.data.id;

    const branchBResult = await createBeautyBranch({
      companyId: companyResult.data.id,
      name: `${marker} Branch B`,
      code: `${marker}-b`,
    });
    expect(branchBResult.success).toBe(true);
    if (!branchBResult.success) throw new Error(branchBResult.error);
    branchBId = branchBResult.data.id;

    const assignmentResult = await assignBeautyStaffToBranch({ userId: ktvUserId, branchId: branchAId });
    expect(assignmentResult.success).toBe(true);

    supabase = ktvSupabase;
    const writerSupabase = createRuntimeWriterClient();
    mockCurrentUser = {
      id: ktvUserId,
      tenant_id: tenantId,
      email: ktvEmail,
      full_name: 'Beauty Branch Runtime KTV',
      role: 'ktv',
      status: 'active',
    };

    await expect(selectBeautyRuntimeBranch(branchAId)).resolves.toEqual({
      success: true,
      data: { activeBranchId: branchAId },
    });
    await expect(selectBeautyRuntimeBranch(branchBId)).resolves.toEqual({
      success: false,
      error: 'Không có quyền thao tác tại chi nhánh này.',
    });

    await expect(ktvCheckIn(branchBId)).resolves.toEqual({
      success: false,
      error: 'Không có quyền chấm công tại chi nhánh này',
    });

    const allowedAttendance = await ktvCheckIn(branchAId);
    expect(allowedAttendance.success).toBe(true);

    const branchBAttendance = await adminSupabase
      .from('attendance')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvUserId)
      .eq('branch_id', branchBId);
    expect(branchBAttendance.error).toBeNull();
    expect(branchBAttendance.data).toEqual([]);

    const customerInsert = await adminSupabase.from('customers').insert({
      id: customerId,
      tenant_id: tenantId,
      name_mother: `${marker} customer`,
      phone: `09${Date.now().toString().slice(-8)}`,
      status: 'active',
    });
    if (customerInsert.error) throw new Error(`customer fixture failed: ${customerInsert.error.message}`);

    const bookingInsert = await adminSupabase.from('bookings').insert([
      {
        id: bookingId,
        tenant_id: tenantId,
        booking_number: `${marker}-booking-a`,
        customer_id: customerId,
        package_name: `${marker} service`,
        assigned_ktv_id: ktvUserId,
        start_date: today,
        end_date: today,
        branch_id: branchAId,
        full_price: 1200000,
        deposit_amount: 0,
        discount_percent: 0,
        status: 'completed',
        total_sessions: 1,
        completed_sessions: 1,
        ktv_commission: 120000,
      },
      {
        id: mismatchBookingId,
        tenant_id: tenantId,
        booking_number: `${marker}-booking-b`,
        customer_id: customerId,
        package_name: `${marker} denied service`,
        assigned_ktv_id: ktvUserId,
        start_date: today,
        end_date: today,
        branch_id: branchBId,
        full_price: 1200000,
        deposit_amount: 0,
        discount_percent: 0,
        status: 'completed',
        total_sessions: 1,
        completed_sessions: 1,
        ktv_commission: 120000,
      },
    ]);
    if (bookingInsert.error) throw new Error(`booking fixture failed: ${bookingInsert.error.message}`);

    const serviceItemResult = await createBookingServiceItems({
      supabase: writerSupabase,
      booking: {
        id: bookingId,
        tenant_id: tenantId,
        assigned_ktv_id: ktvUserId,
        status: 'completed',
        start_date: today,
        end_date: today,
      } as Database['public']['Tables']['bookings']['Row'],
      tenantId,
      serviceItems: [{
        serviceName: `${marker} runtime service`,
        quantity: 1,
        unitPrice: 150000,
        ktvId: ktvUserId,
        overrideType: 'fixed',
        overrideValue: 150000,
      }],
    });
    expect(serviceItemResult.success).toBe(true);

    const branchBServiceItemResult = await createServiceItem({
      bookingId: mismatchBookingId,
      tenantId,
      serviceName: `${marker} denied runtime service`,
      quantity: 1,
      unitPrice: 150000,
      ktvId: ktvUserId,
      branchId: branchBId,
      completedDate: today,
      overrideType: 'fixed',
      overrideValue: 150000,
    });
    expect(branchBServiceItemResult).toEqual({
      success: false,
      error: 'KTV không thuộc chi nhánh của dịch vụ phát sinh commission này',
    });

    const serviceRows = await adminSupabase
      .from('booking_service_items')
      .select('service_name, branch_id')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvUserId)
      .order('service_name');
    expect(serviceRows.error).toBeNull();
    expect(serviceRows.data).toEqual([{ service_name: `${marker} runtime service`, branch_id: branchAId }]);

    supabase = writerSupabase;
    const productSaleResult = await createProductSale({
      tenantId,
      ktvId: ktvUserId,
      productName: `${marker} product`,
      quantity: 1,
      unitPrice: 25000,
      totalSalesAmount: 25000,
      overrideCommissionType: 'fixed',
      overrideCommissionValue: 25000,
      paymentMethod: 'cash',
      saleDate: today,
      branchId: branchAId,
    });
    expect(productSaleResult.success).toBe(true);

    const deniedProductSaleResult = await createProductSale({
      tenantId,
      ktvId: ktvUserId,
      productName: `${marker} denied product`,
      quantity: 1,
      unitPrice: 25000,
      totalSalesAmount: 25000,
      overrideCommissionType: 'fixed',
      overrideCommissionValue: 25000,
      paymentMethod: 'cash',
      saleDate: today,
      branchId: branchBId,
    });
    expect(deniedProductSaleResult).toEqual({
      success: false,
      error: 'KTV không thuộc chi nhánh bán sản phẩm này',
    });

    const productRows = await adminSupabase
      .from('product_sales')
      .select('product_name, branch_id')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvUserId)
      .like('product_name', `${marker}%`);
    expect(productRows.error).toBeNull();
    expect(productRows.data).toEqual([{ product_name: `${marker} product`, branch_id: branchAId }]);

    const payrollResult = await recalculateAndSaveSalaryRecordEngine(
      adminSupabase,
      ktvUserId,
      monthYear,
      tenantId,
      { expectedBranchId: branchAId },
      branchAId,
    );
    expect(payrollResult.success).toBe(true);

    const salaryReadback = await adminSupabase
      .from('salary_records')
      .select('tenant_id, ktv_id, month_year, branch_id, service_commission, product_sales_commission, status')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvUserId)
      .eq('month_year', monthYear)
      .single();
    expect(salaryReadback.error).toBeNull();
    expect(salaryReadback.data).toMatchObject({
      tenant_id: tenantId,
      ktv_id: ktvUserId,
      month_year: monthYear,
      branch_id: branchAId,
      service_commission: 150000,
      product_sales_commission: 25000,
      status: 'draft',
    });

    await expect(recalculateAndSaveSalaryRecordEngine(
      adminSupabase,
      ktvUserId,
      monthYear,
      tenantId,
      { expectedBranchId: branchBId },
      branchBId,
    )).rejects.toThrow(COMMISSION_BRANCH_MAPPING_ERRORS.ATTENDANCE_BRANCH_MISMATCH);

    const salaryAfterDenied = await adminSupabase
      .from('salary_records')
      .select('branch_id, service_commission, product_sales_commission')
      .eq('tenant_id', tenantId)
      .eq('ktv_id', ktvUserId)
      .eq('month_year', monthYear)
      .single();
    expect(salaryAfterDenied.error).toBeNull();
    expect(salaryAfterDenied.data).toEqual({
      branch_id: branchAId,
      service_commission: 150000,
      product_sales_commission: 25000,
    });
  });
});
