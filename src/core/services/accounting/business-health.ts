'use server';

import invariantModule from '../../../../scripts/check-business-invariants.cjs';
import { enqueueWithAutoClient } from '@/lib/accounting-outbox';
import {
  buildInventoryConsumedOutboxEvent,
  buildPackageSaleOutboxEvent,
  buildSalaryPaidOutboxEvent,
  buildSessionDoneOutboxEvent,
  isPackageSaleRevenueType,
} from '@/lib/business-rules/accounting-outbox';
import {
  calculateConfirmedPaidAmount,
  calculateSessionRevenueRecognition,
  type PaymentRevenueLike,
} from '@/lib/business-rules/payment';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from '@/services/audit-actions';
import { autoConsumeForSession } from '@/services/inventory-actions';
import { getCurrentUser } from '@/services/user-actions';
import { createAccountingDataClient, type AccountingSupabaseClient } from './client';
import { replayOutboxEvent } from './journals';
import { runAccountingMetadataBackfill } from './templates';
import type { Database, Json } from '@/types/database.types';
import type {
  BusinessHealthDatasetCounts,
  BusinessHealthFinding,
  BusinessHealthFindingDetail,
  BusinessHealthGroup,
  BusinessHealthRepairAction,
  BusinessHealthRepairResult,
  BusinessHealthSummary,
} from './types';

type SupabaseClient = AccountingSupabaseClient;
type QueryError = { message: string };
type QueryResponse<T> = PromiseLike<{ data: T[] | null; error: QueryError | null }>;

type BookingRow = Pick<
  Database['public']['Tables']['bookings']['Row'],
  | 'id'
  | 'booking_number'
  | 'status'
  | 'deposit_amount'
  | 'full_price'
  | 'discount_percent'
  | 'total_sessions'
  | 'completed_sessions'
  | 'tenant_id'
  | 'customer_id'
  | 'package_id'
  | 'package_name'
>;
type RevenueRow = Pick<
  Database['public']['Tables']['revenue']['Row'],
  | 'id'
  | 'booking_id'
  | 'amount'
  | 'status'
  | 'revenue_type'
  | 'tenant_id'
  | 'received_date'
  | 'notes'
  | 'payment_method'
  | 'business_event_type'
  | 'accounting_review_status'
  | 'accounting_metadata'
>;
type BookingStatusRepairRow = Pick<
  Database['public']['Tables']['bookings']['Row'],
  | 'id'
  | 'booking_number'
  | 'status'
  | 'deposit_amount'
  | 'full_price'
  | 'discount_percent'
  | 'tenant_id'
  | 'customer_id'
>;
type BookingProgressRepairRow = Pick<
  Database['public']['Tables']['bookings']['Row'],
  | 'id'
  | 'booking_number'
  | 'status'
  | 'completed_sessions'
  | 'total_sessions'
  | 'tenant_id'
  | 'customer_id'
>;
type InventorySessionRepairRow = Pick<
  Database['public']['Tables']['session_logs']['Row'],
  'id' | 'booking_id' | 'status' | 'completed_date' | 'tenant_id' | 'session_number'
>;
type BookingInventoryRepairRow = Pick<
  Database['public']['Tables']['bookings']['Row'],
  'id' | 'booking_number' | 'package_id' | 'package_name' | 'tenant_id' | 'customer_id'
>;
type BookingPackageSaleRepairRow = Pick<
  Database['public']['Tables']['bookings']['Row'],
  'id' | 'booking_number' | 'package_name' | 'tenant_id' | 'customer_id'
>;
type SessionAccountingRepairRow = Pick<
  Database['public']['Tables']['session_logs']['Row'],
  'id' | 'booking_id' | 'status' | 'completed_date' | 'completed_by_ktv_id' | 'tenant_id' | 'session_number'
>;
type BookingAccountingRepairRow = Pick<
  Database['public']['Tables']['bookings']['Row'],
  | 'id'
  | 'booking_number'
  | 'total_sessions'
  | 'status'
  | 'package_name'
  | 'ktv_commission'
  | 'assigned_ktv_id'
  | 'tenant_id'
  | 'full_price'
  | 'deposit_amount'
  | 'discount_percent'
  | 'customer_id'
>;
type SessionLogRow = Pick<
  Database['public']['Tables']['session_logs']['Row'],
  | 'id'
  | 'booking_id'
  | 'status'
  | 'completed_date'
  | 'completed_by_ktv_id'
  | 'tenant_id'
  | 'session_number'
  | 'business_event_type'
  | 'accounting_review_status'
>;
type SalaryRecordRow = Pick<
  Database['public']['Tables']['salary_records']['Row'],
  | 'id'
  | 'ktv_id'
  | 'month_year'
  | 'tenant_id'
  | 'status'
  | 'paid_date'
  | 'paid_method'
  | 'notes'
  | 'total_sessions'
  | 'base_salary'
  | 'session_bonus'
  | 'rating_bonus'
  | 'kpi_bonus'
  | 'violations_deduction'
  | 'service_percentage_bonus'
  | 'total_salary'
  | 'business_event_type'
  | 'accounting_review_status'
>;
type PackageRow = Pick<
  Database['public']['Tables']['packages']['Row'],
  'id' | 'name' | 'tenant_id' | 'session_multiplier' | 'total_sessions'
>;
type PackageMaterialRow = Pick<
  Database['public']['Tables']['package_materials']['Row'],
  'id' | 'tenant_id' | 'package_id' | 'item_id' | 'quantity_per_session'
>;
type InventoryItemRow = Pick<
  Database['public']['Tables']['inventory_items']['Row'],
  'id' | 'tenant_id' | 'name' | 'stock_level' | 'min_stock_level' | 'unit' | 'price_per_unit'
>;
type InventoryLogRow = Pick<
  Database['public']['Tables']['inventory_logs']['Row'],
  | 'id'
  | 'tenant_id'
  | 'item_id'
  | 'change_amount'
  | 'reason'
  | 'session_log_id'
  | 'created_at'
  | 'business_event_type'
  | 'accounting_review_status'
>;
type JournalEntryRow = Pick<
  Database['public']['Tables']['journal_entries']['Row'],
  'id' | 'tenant_id' | 'entry_date' | 'reference_type' | 'reference_id' | 'status' | 'description'
>;
type JournalLineRow = Pick<
  Database['public']['Tables']['journal_lines']['Row'],
  'id' | 'entry_id' | 'account_id' | 'debit_amount' | 'credit_amount'
>;
type AccountingOutboxRow = Pick<
  Database['public']['Tables']['accounting_outbox']['Row'],
  'id' | 'tenant_id' | 'event_type' | 'reference_type' | 'reference_id' | 'status' | 'retry_count' | 'max_retries' | 'last_error' | 'created_at'
>;
type CustomerRow = Pick<
  Database['public']['Tables']['customers']['Row'],
  'id' | 'tenant_id' | 'name_mother' | 'phone'
>;
type TenantRow = Pick<
  Database['public']['Tables']['tenants']['Row'],
  'id' | 'enabled_modules'
>;

type BusinessHealthDataset = {
  bookings: BookingRow[];
  revenue: RevenueRow[];
  sessionLogs: SessionLogRow[];
  salaryRecords: SalaryRecordRow[];
  packages: PackageRow[];
  packageMaterials: PackageMaterialRow[];
  inventoryItems: InventoryItemRow[];
  inventoryLogs: InventoryLogRow[];
  journalEntries: JournalEntryRow[];
  journalLines: JournalLineRow[];
  accountingOutbox: AccountingOutboxRow[];
  customers: CustomerRow[];
  tenants: TenantRow[];
};

type InvariantFinding = {
  severity: 'critical' | 'warning';
  code: string;
  message: string;
  recordId?: string;
  bookingId?: string;
  bookingNumber?: string;
  bookingTenantId?: string;
  customerId?: string;
  customerTenantId?: string;
  sessionTenantId?: string;
  sourceTable?: string;
  recordKey?: string;
  ktvId?: string;
  outboxId?: string;
  entryId?: string;
  referenceType?: string;
  referenceId?: string;
  eventType?: string;
  status?: string;
  createdAt?: string;
  retryCount?: number;
  maxRetries?: number;
  savedSessions?: number;
  liveSessions?: number;
  savedCompleted?: number;
  completedSessionLogs?: number;
  sessionLogId?: string;
  packageId?: string;
  packageName?: string;
  materialCount?: number;
  materialSummary?: string;
  revenueType?: string;
  revenueAmount?: number;
  receivedDate?: string;
  salaryAmount?: number;
  salaryMonth?: string;
  paidDate?: string;
  paymentMethod?: string;
  inventoryLogCount?: number;
  consumptionSummary?: string;
  consumptionCost?: number;
  totalPaid?: number;
  bookingPaidAmount?: number;
  depositTarget?: number;
  depositDue?: number;
  remainingDebt?: number;
  portalAmountToPay?: number;
  portalMode?: string;
  priceAfterDiscount?: number;
  overpaidAmount?: number;
  revenueIds?: string[];
  missingLedgerCount?: number;
};
type InvariantResult = {
  name: string;
  ok: boolean;
  criticalCount: number;
  warningCount: number;
  findings: InvariantFinding[];
};
type BusinessInvariantModule = {
  calculateBookingPaymentState: (input: {
    fullPrice: number | null;
    discountPercent: number | null;
    depositAmount: number | null;
    bookingStatus: string | null;
    revenues: Pick<RevenueRow, 'amount' | 'status' | 'revenue_type'>[];
  }) => {
    priceAfterDiscount: number;
    totalPaid: number;
    remainingDebt: number;
    depositTarget: number;
    depositDue: number;
    overpaidAmount: number;
    hasOutstandingDebt: boolean;
    showDepositRequest: boolean;
  };
  runBusinessInvariantChecksOnDataset: (
    dataset: BusinessHealthDataset,
    options?: { context?: { monthDate: string; nextMonthDate: string }; now?: Date }
  ) => InvariantResult[];
  summarizeBusinessInvariantResults: (
    results: InvariantResult[],
    options?: { failOnWarning?: boolean }
  ) => { checked: number; criticalCount: number; warningCount: number; isHealthy: boolean };
};

const checks = invariantModule as BusinessInvariantModule;
const MAX_ROWS = 20000;

const GROUP_META: Record<string, Pick<BusinessHealthGroup, 'label' | 'description' | 'href' | 'action_label'>> = {
  tenant_data_isolation: {
    label: 'Cách ly dữ liệu chi nhánh',
    description: 'Kiểm tra booking, khách hàng và ca liệu trình không bị lẫn dữ liệu giữa Bella Spa và Beauty Spa.',
    href: '/dashboard/accounting/health#unresolved-findings',
    action_label: 'Xem lỗi dữ liệu',
  },
  booking_package_scope: {
    label: 'Phạm vi gói dịch vụ của booking',
    description: 'Kiểm tra gói dịch vụ của booking thuộc đúng chi nhánh và phân hệ được kích hoạt.',
    href: '/dashboard/accounting/health#unresolved-findings',
    action_label: 'Xem chi tiết',
  },
  payment_booking_revenue: {
    label: 'Thanh toán, booking & doanh thu',
    description: 'Đối chiếu tiền khách đã trả, trạng thái booking, công nợ và ghi nhận doanh thu.',
    href: '/dashboard/finance/reconciliation',
    action_label: 'Mở đối soát',
  },
  booking_financial_integrity: {
    label: 'Toàn vẹn tiền booking',
    description: 'Đối chiếu 4 lớp booking, revenue, QR portal và side-effect hạch toán theo từng booking.',
    href: '/dashboard/finance/reconciliation',
    action_label: 'Mở đối soát',
  },
  ledger: {
    label: 'Sổ cái & bút toán',
    description: 'Kiểm tra bút toán đã post, cân Nợ/Có và trạng thái hàng chờ hạch toán.',
    href: '/dashboard/accounting/journals',
    action_label: 'Mở sổ cái',
  },
  salary: {
    label: 'Lương KTV',
    description: 'Đối chiếu thành phần lương, số ca quy đổi và bản ghi lương theo kỳ.',
    href: '/dashboard/salary',
    action_label: 'Mở bảng lương',
  },
  inventory: {
    label: 'Kho & vật tư',
    description: 'Kiểm tra tồn kho âm, trừ vật tư theo ca và log tiêu hao.',
    href: '/dashboard/inventory',
    action_label: 'Mở kho',
  },
  cross_module_side_effects: {
    label: 'Liên kết dữ liệu liên module',
    description: 'Đảm bảo thanh toán, ca làm, kho, lương có side-effect kế toán hoặc bút toán tương ứng.',
    href: '/dashboard/accounting/outbox',
    action_label: 'Mở hàng chờ',
  },
  accounting_readiness_metadata: {
    label: 'Readiness metadata',
    description: 'Kiểm tra phân loại nghiệp vụ và trạng thái review trước khi tự động hóa sâu hơn.',
    href: '/dashboard/accounting/readiness',
    action_label: 'Mở readiness',
  },
};

const FINDING_TITLE: Record<string, string> = {
  booking_customer_missing_customer: 'Booking không tìm thấy hồ sơ khách hàng',
  booking_customer_tenant_mismatch: 'Booking và khách hàng khác chi nhánh',
  booking_package_missing_package: 'Booking tham chiếu gói không tồn tại',
  booking_package_tenant_mismatch: 'Gói dịch vụ và booking khác chi nhánh',
  booking_package_module_disabled: 'Phân hệ của gói dịch vụ chưa được kích hoạt cho chi nhánh',
  session_booking_missing_booking: 'Ca liệu trình không tìm thấy booking',
  session_booking_tenant_mismatch: 'Ca liệu trình và booking khác chi nhánh',
  confirmed_revenue_non_positive: 'Khoản thu đã xác nhận nhưng số tiền không hợp lệ',
  package_revenue_missing_booking: 'Khoản thu gói dịch vụ chưa gắn với booking',
  revenue_booking_tenant_mismatch: 'Khoản thu và booking khác chi nhánh',
  deposit_paid_but_booking_still_pending: 'Khách đã cọc nhưng booking vẫn chờ cọc',
  booking_overpaid: 'Khách đang trả vượt giá trị gói sau giảm giá',
  booking_payment_amount_drift: 'Số tiền đã thu trên booking lệch revenue xác nhận',
  portal_deposit_qr_should_be_closed: 'Portal phải đóng QR cọc của booking này',
  booking_revenue_ledger_gap: 'Booking có doanh thu nhưng thiếu side-effect hạch toán',
  booking_paid_in_full_but_status_open: 'Booking đã thu đủ nhưng trạng thái thanh toán còn mở',
  posted_journal_too_few_lines: 'Bút toán đã post thiếu dòng Nợ/Có',
  posted_journal_unbalanced: 'Bút toán đã post không cân Nợ/Có',
  invalid_journal_line_amounts: 'Dòng bút toán có số tiền không hợp lệ',
  dead_accounting_outbox: 'Sự kiện hạch toán đã vào trạng thái chết',
  exhausted_accounting_outbox: 'Sự kiện hạch toán đã hết lượt thử lại',
  stale_accounting_outbox: 'Sự kiện hạch toán chờ quá lâu',
  negative_salary_component: 'Thành phần lương bị âm',
  salary_total_component_mismatch: 'Tổng lương không khớp các thành phần',
  draft_salary_session_count_drift: 'Lương nháp lệch số ca quy đổi thực tế',
  duplicate_salary_record: 'Một KTV có nhiều bản ghi lương trong cùng kỳ',
  negative_inventory_stock: 'Tồn kho bị âm',
  consumption_log_not_negative: 'Log tiêu hao vật tư không trừ kho',
  orphan_consumption_log: 'Log tiêu hao không gắn với ca đã hoàn thành',
  duplicate_session_item_consumption: 'Một ca trừ cùng một vật tư nhiều lần',
  completed_session_missing_inventory_consumption: 'Ca hoàn thành thiếu log trừ vật tư',
  confirmed_package_revenue_missing_accounting_side_effect: 'Doanh thu đã xác nhận thiếu side-effect hạch toán',
  confirmed_refund_missing_accounting_side_effect: 'Hoàn tiền đã xác nhận thiếu side-effect hạch toán',
  completed_session_missing_session_done_side_effect: 'Ca hoàn thành thiếu side-effect SESSION_DONE',
  inventory_consumption_missing_accounting_side_effect: 'Tiêu hao vật tư thiếu side-effect hạch toán',
  booking_completed_sessions_drift: 'Số buổi hoàn thành trên booking lệch với log ca',
  paid_salary_missing_accounting_side_effect: 'Lương đã trả thiếu side-effect hạch toán',
  accounting_posting_failed: 'Nguồn nghiệp vụ bị lỗi ghi sổ',
  missing_business_event_type: 'Nguồn nghiệp vụ thiếu phân loại hạch toán',
  accounting_needs_review: 'Nguồn nghiệp vụ cần kế toán rà soát',
};

const OUTBOX_REPAIR_CODES = new Set([
  'dead_accounting_outbox',
  'exhausted_accounting_outbox',
  'stale_accounting_outbox',
]);

const METADATA_BACKFILL_CODES = new Set([
  'missing_business_event_type',
]);

const BOOKING_STATUS_REPAIR_CODES = new Set([
  'deposit_paid_but_booking_still_pending',
  'portal_deposit_qr_should_be_closed',
  'booking_paid_in_full_but_status_open',
]);

const BOOKING_PROGRESS_REPAIR_CODES = new Set([
  'booking_completed_sessions_drift',
]);

const INVENTORY_CONSUMPTION_REPAIR_CODES = new Set([
  'completed_session_missing_inventory_consumption',
]);

const SESSION_DONE_ACCOUNTING_REPAIR_CODES = new Set([
  'completed_session_missing_session_done_side_effect',
]);

const INVENTORY_ACCOUNTING_REPAIR_CODES = new Set([
  'inventory_consumption_missing_accounting_side_effect',
]);

const PACKAGE_SALE_ACCOUNTING_REPAIR_CODES = new Set([
  'confirmed_package_revenue_missing_accounting_side_effect',
  'booking_revenue_ledger_gap',
]);

const SALARY_PAID_ACCOUNTING_REPAIR_CODES = new Set([
  'paid_salary_missing_accounting_side_effect',
]);

function rowsOrEmpty<T>(rows: T[] | null | undefined) {
  return rows ?? [];
}

async function queryRows<T>(query: QueryResponse<T>, label: string): Promise<T[]> {
  const { data, error } = await query;

  if (error) {
    throw new Error(`[businessHealth] Failed to load ${label}: ${error.message}`);
  }

  const rows = rowsOrEmpty(data);
  if (rows.length >= MAX_ROWS) {
    throw new Error(`[businessHealth] ${label} reached maxRows=${MAX_ROWS}; narrow the scan before trusting results.`);
  }

  return rows;
}

function getMonthScope(month?: string | null) {
  const rawMonth = month?.slice(0, 7) || new Date().toISOString().slice(0, 7);
  const [yearPart, monthPart] = rawMonth.split('-');
  const year = Number(yearPart);
  const monthNumber = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error('Thang kiem tra suc khoe du lieu khong hop le.');
  }

  const nextMonth = monthNumber === 12
    ? { year: year + 1, monthNumber: 1 }
    : { year, monthNumber: monthNumber + 1 };

  return {
    monthLabel: `${year}-${String(monthNumber).padStart(2, '0')}`,
    monthDate: `${year}-${String(monthNumber).padStart(2, '0')}-01`,
    nextMonthDate: `${nextMonth.year}-${String(nextMonth.monthNumber).padStart(2, '0')}-01`,
  };
}

async function resolveTenantContext() {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: chi admin moi duoc xem suc khoe du lieu van hanh.');
  }

  const supabase = await createAccountingDataClient();
  return { supabase, tenantId: user.tenant_id };
}

async function loadJournalLines(supabase: SupabaseClient, journalEntries: JournalEntryRow[]) {
  const entryIds = journalEntries.map((entry) => entry.id);
  if (entryIds.length === 0) return [];

  return queryRows<JournalLineRow>(
    supabase
      .from('journal_lines')
      .select('id, entry_id, account_id, debit_amount, credit_amount')
      .in('entry_id', entryIds)
      .limit(MAX_ROWS),
    'journal_lines'
  );
}

async function loadBusinessHealthDataset(supabase: SupabaseClient, tenantId: string): Promise<BusinessHealthDataset> {
  const [
    bookings,
    revenue,
    sessionLogs,
    salaryRecords,
    packages,
    packageMaterials,
    inventoryItems,
    inventoryLogs,
    journalEntries,
    accountingOutbox,
    customers,
    tenants,
  ] = await Promise.all([
    queryRows<BookingRow>(
      supabase
        .from('bookings')
        .select('id, booking_number, status, deposit_amount, full_price, discount_percent, total_sessions, completed_sessions, tenant_id, customer_id, package_id, package_name')
        .eq('tenant_id', tenantId)
        .limit(MAX_ROWS),
      'bookings'
    ),
    queryRows<RevenueRow>(
      supabase
        .from('revenue')
        .select('id, booking_id, amount, status, revenue_type, tenant_id, received_date, notes, payment_method, business_event_type, accounting_review_status, accounting_metadata')
        .eq('tenant_id', tenantId)
        .limit(MAX_ROWS),
      'revenue'
    ),
    queryRows<SessionLogRow>(
      supabase
        .from('session_logs')
        .select('id, booking_id, status, completed_date, completed_by_ktv_id, tenant_id, session_number, business_event_type, accounting_review_status')
        .eq('tenant_id', tenantId)
        .limit(MAX_ROWS),
      'session_logs'
    ),
    queryRows<SalaryRecordRow>(
      supabase
        .from('salary_records')
        .select('id, ktv_id, month_year, tenant_id, status, paid_date, paid_method, notes, total_sessions, base_salary, session_bonus, rating_bonus, kpi_bonus, violations_deduction, service_percentage_bonus, total_salary, business_event_type, accounting_review_status')
        .eq('tenant_id', tenantId)
        .limit(MAX_ROWS),
      'salary_records'
    ),
    queryRows<PackageRow>(
      supabase
        .from('packages')
        .select('id, name, tenant_id, session_multiplier, total_sessions')
        .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
        .limit(MAX_ROWS),
      'packages'
    ),
    queryRows<PackageMaterialRow>(
      supabase
        .from('package_materials')
        .select('id, tenant_id, package_id, item_id, quantity_per_session')
        .eq('tenant_id', tenantId)
        .limit(MAX_ROWS),
      'package_materials'
    ),
    queryRows<InventoryItemRow>(
      supabase
        .from('inventory_items')
        .select('id, tenant_id, name, stock_level, min_stock_level, unit, price_per_unit')
        .eq('tenant_id', tenantId)
        .limit(MAX_ROWS),
      'inventory_items'
    ),
    queryRows<InventoryLogRow>(
      supabase
        .from('inventory_logs')
        .select('id, tenant_id, item_id, change_amount, reason, session_log_id, created_at, business_event_type, accounting_review_status')
        .eq('tenant_id', tenantId)
        .limit(MAX_ROWS),
      'inventory_logs'
    ),
    queryRows<JournalEntryRow>(
      supabase
        .from('journal_entries')
        .select('id, tenant_id, entry_date, reference_type, reference_id, status, description')
        .eq('tenant_id', tenantId)
        .limit(MAX_ROWS),
      'journal_entries'
    ),
    queryRows<AccountingOutboxRow>(
      supabase
        .from('accounting_outbox')
        .select('id, tenant_id, event_type, reference_type, reference_id, status, retry_count, max_retries, last_error, created_at')
        .eq('tenant_id', tenantId)
        .limit(MAX_ROWS),
      'accounting_outbox'
    ),
    queryRows<CustomerRow>(
      supabase
        .from('customers')
        .select('id, tenant_id, name_mother, phone')
        .eq('tenant_id', tenantId)
        .limit(MAX_ROWS),
      'customers'
    ),
    queryRows<TenantRow>(
      supabase
        .from('tenants')
        .select('id, enabled_modules')
        .limit(MAX_ROWS),
      'tenants'
    ),
  ]);

  const journalLines = await loadJournalLines(supabase, journalEntries);

  return {
    bookings,
    revenue,
    sessionLogs,
    salaryRecords,
    packages,
    packageMaterials,
    inventoryItems,
    inventoryLogs,
    journalEntries,
    journalLines,
    accountingOutbox,
    customers,
    tenants,
  };
}

function getDatasetCounts(dataset: BusinessHealthDataset): BusinessHealthDatasetCounts {
  return {
    bookings: dataset.bookings.length,
    revenue: dataset.revenue.length,
    session_logs: dataset.sessionLogs.length,
    salary_records: dataset.salaryRecords.length,
    packages: dataset.packages.length,
    package_materials: dataset.packageMaterials.length,
    inventory_items: dataset.inventoryItems.length,
    inventory_logs: dataset.inventoryLogs.length,
    journal_entries: dataset.journalEntries.length,
    journal_lines: dataset.journalLines.length,
    accounting_outbox: dataset.accountingOutbox.length,
  };
}

function getGroupMeta(groupName: string) {
  return GROUP_META[groupName] ?? {
    label: groupName,
    description: 'Nhóm kiểm tra dữ liệu vận hành.',
    href: '/dashboard/accounting/health',
    action_label: 'Xem chi tiết',
  };
}

function formatMoney(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `${Math.round(value).toLocaleString('vi-VN')}đ`;
}

function isConsumptionLogReason(reason: string | null | undefined) {
  return ['session_consumption', 'session_consumed', 'consume', 'consumed', 'used'].includes(
    String(reason ?? '').trim().toLowerCase()
  );
}

function addDetail(details: BusinessHealthFindingDetail[], label: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return;
  details.push({ label, value: String(value) });
}

function buildDetails(finding: InvariantFinding): BusinessHealthFindingDetail[] {
  const details: BusinessHealthFindingDetail[] = [];

  addDetail(details, 'Bảng', finding.sourceTable);
  addDetail(details, 'Mã bản ghi', finding.recordId);
  addDetail(details, 'Booking', finding.bookingNumber ?? finding.bookingId);
  addDetail(details, 'Tenant booking', finding.bookingTenantId);
  addDetail(details, 'Khách hàng', finding.customerId);
  addDetail(details, 'Tenant khách hàng', finding.customerTenantId);
  addDetail(details, 'Tenant ca', finding.sessionTenantId);
  addDetail(details, 'KTV', finding.ktvId);
  addDetail(details, 'Khóa dữ liệu', finding.recordKey);
  addDetail(details, 'Outbox', finding.outboxId);
  addDetail(details, 'Sự kiện', finding.eventType);
  addDetail(details, 'Trạng thái', finding.status);
  addDetail(details, 'Ngày tạo', finding.createdAt);
  addDetail(details, 'Lần thử', typeof finding.retryCount === 'number' && typeof finding.maxRetries === 'number' ? `${finding.retryCount}/${finding.maxRetries}` : finding.retryCount);
  addDetail(details, 'Bút toán', finding.entryId);
  addDetail(details, 'Reference', finding.referenceType && finding.referenceId ? `${finding.referenceType}:${finding.referenceId}` : null);
  addDetail(details, 'Ca', finding.sessionLogId);
  addDetail(details, 'Gói', finding.packageName ?? finding.packageId);
  addDetail(details, 'Số vật tư', finding.materialCount);
  addDetail(details, 'Vật tư cần trừ', finding.materialSummary);
  addDetail(details, 'Loại thu', finding.revenueType);
  addDetail(details, 'Số tiền thu', formatMoney(finding.revenueAmount));
  addDetail(details, 'Ngày thu', finding.receivedDate);
  addDetail(details, 'Kỳ lương', finding.salaryMonth);
  addDetail(details, 'Lương đã trả', formatMoney(finding.salaryAmount));
  addDetail(details, 'Ngày trả lương', finding.paidDate);
  addDetail(details, 'Phương thức trả', finding.paymentMethod);
  addDetail(details, 'Log kho', finding.inventoryLogCount);
  addDetail(details, 'Vật tư đã trừ', finding.consumptionSummary);
  addDetail(details, 'Giá trị tiêu hao', formatMoney(finding.consumptionCost));
  addDetail(details, 'Đã thu', formatMoney(finding.totalPaid));
  addDetail(details, 'Booking ghi nhận đã thu', formatMoney(finding.bookingPaidAmount));
  addDetail(details, 'Mức cọc', formatMoney(finding.depositTarget));
  addDetail(details, 'Cọc còn phải thu', formatMoney(finding.depositDue));
  addDetail(details, 'Còn nợ', formatMoney(finding.remainingDebt));
  addDetail(details, 'QR/Portal yêu cầu', formatMoney(finding.portalAmountToPay));
  addDetail(details, 'Chế độ QR/Portal', finding.portalMode);
  addDetail(details, 'Giá sau giảm', formatMoney(finding.priceAfterDiscount));
  addDetail(details, 'Trả vượt', formatMoney(finding.overpaidAmount));
  addDetail(details, 'Revenue thiếu ledger', finding.revenueIds?.join(', '));
  addDetail(details, 'Số revenue thiếu ledger', finding.missingLedgerCount);
  addDetail(details, 'Số ca lưu', finding.savedSessions);
  addDetail(details, 'Số ca thực tế', finding.liveSessions);
  addDetail(details, 'Buổi lưu', finding.savedCompleted);
  addDetail(details, 'Log hoàn thành', finding.completedSessionLogs);

  return details;
}

function getRepairAction(finding: InvariantFinding): Pick<
  BusinessHealthFinding,
  'repair_action' | 'repair_target_id' | 'repair_label' | 'repair_requires_confirmation'
> {
  if (OUTBOX_REPAIR_CODES.has(finding.code) && finding.recordId) {
    return {
      repair_action: 'replay_outbox',
      repair_target_id: finding.recordId,
      repair_label: 'Chạy lại',
    };
  }

  if (METADATA_BACKFILL_CODES.has(finding.code)) {
    return {
      repair_action: 'run_metadata_backfill',
      repair_label: 'Backfill',
    };
  }

  if (BOOKING_STATUS_REPAIR_CODES.has(finding.code) && finding.recordId) {
    return {
      repair_action: 'sync_paid_deposit_booking_status',
      repair_target_id: finding.recordId,
      repair_label: 'Xác nhận cọc',
      repair_requires_confirmation: true,
    };
  }

  if (BOOKING_PROGRESS_REPAIR_CODES.has(finding.code) && finding.recordId) {
    return {
      repair_action: 'sync_booking_completed_sessions',
      repair_target_id: finding.recordId,
      repair_label: 'Đồng bộ số buổi',
      repair_requires_confirmation: true,
    };
  }

  if (INVENTORY_CONSUMPTION_REPAIR_CODES.has(finding.code) && finding.recordId) {
    return {
      repair_action: 'create_missing_inventory_consumption',
      repair_target_id: finding.recordId,
      repair_label: 'Tạo log trừ kho',
      repair_requires_confirmation: true,
    };
  }

  if (SESSION_DONE_ACCOUNTING_REPAIR_CODES.has(finding.code) && finding.recordId) {
    return {
      repair_action: 'enqueue_missing_session_done_accounting',
      repair_target_id: finding.recordId,
      repair_label: 'Tạo SESSION_DONE',
      repair_requires_confirmation: true,
    };
  }

  if (INVENTORY_ACCOUNTING_REPAIR_CODES.has(finding.code) && finding.recordId) {
    return {
      repair_action: 'enqueue_missing_inventory_consumed_accounting',
      repair_target_id: finding.recordId,
      repair_label: 'Tạo INVENTORY_CONSUMED',
      repair_requires_confirmation: true,
    };
  }

  if (PACKAGE_SALE_ACCOUNTING_REPAIR_CODES.has(finding.code) && finding.recordId) {
    return {
      repair_action: 'enqueue_missing_package_sale_accounting',
      repair_target_id: finding.recordId,
      repair_label: 'Tạo PACKAGE_SALE',
      repair_requires_confirmation: true,
    };
  }

  if (SALARY_PAID_ACCOUNTING_REPAIR_CODES.has(finding.code) && finding.recordId) {
    return {
      repair_action: 'enqueue_missing_salary_paid_accounting',
      repair_target_id: finding.recordId,
      repair_label: 'Tạo SALARY_PAID',
      repair_requires_confirmation: true,
    };
  }

  return {};
}

function getFindingHref(groupName: string, code: string) {
  if (code.includes('salary')) return '/dashboard/salary';
  if (code.includes('inventory') || code.includes('consumption')) return '/dashboard/inventory';
  if (code.includes('booking_completed_sessions')) return '/dashboard/sessions';
  if (code.includes('booking_package')) return '/dashboard/bookings';
  if (code.includes('booking') || code.includes('revenue') || code.includes('deposit') || code.includes('overpaid')) {
    return '/dashboard/finance/reconciliation';
  }
  if (code.includes('outbox') || code.includes('side_effect')) return '/dashboard/accounting/outbox';
  if (code.includes('business_event') || code.includes('review') || code.includes('posting')) return '/dashboard/accounting/readiness';

  return getGroupMeta(groupName).href;
}

function getActionLabel(groupName: string, code: string) {
  if (code.includes('salary')) return 'Kiểm tra lương';
  if (code.includes('inventory') || code.includes('consumption')) return 'Kiểm tra kho';
  if (code.includes('booking_completed_sessions')) return 'Kiểm tra ca';
  if (code.includes('booking_package')) return 'Kiểm tra booking';
  if (code.includes('booking') || code.includes('revenue') || code.includes('deposit') || code.includes('overpaid')) {
    return 'Đối soát tài chính';
  }
  if (code.includes('outbox') || code.includes('side_effect')) return 'Kiểm tra hàng chờ';
  return getGroupMeta(groupName).action_label;
}

function mapFinding(result: InvariantResult, finding: InvariantFinding, index: number): BusinessHealthFinding {
  const groupMeta = getGroupMeta(result.name);
  const recordRef = finding.recordId ?? finding.bookingId ?? finding.recordKey ?? finding.outboxId ?? finding.entryId ?? index;

  return {
    id: `${result.name}:${finding.code}:${recordRef}`,
    group: result.name,
    group_label: groupMeta.label,
    severity: finding.severity,
    code: finding.code,
    title: FINDING_TITLE[finding.code] ?? finding.code,
    message: finding.message,
    action_label: getActionLabel(result.name, finding.code),
    href: getFindingHref(result.name, finding.code),
    details: buildDetails(finding),
    ...getRepairAction(finding),
  };
}

function buildGroups(results: InvariantResult[]): BusinessHealthGroup[] {
  return results.map((result) => {
    const meta = getGroupMeta(result.name);
    const status = result.criticalCount > 0 ? 'fail' : result.warningCount > 0 ? 'warn' : 'pass';

    return {
      id: result.name,
      label: meta.label,
      description: meta.description,
      status,
      critical_count: result.criticalCount,
      warning_count: result.warningCount,
      checked_count: result.findings.length,
      href: meta.href,
      action_label: meta.action_label,
    };
  });
}

function calculateHealthScore(criticalCount: number, warningCount: number) {
  return Math.max(0, 100 - criticalCount * 12 - warningCount * 3);
}

export async function getBusinessHealthSummary(month?: string | null): Promise<BusinessHealthSummary> {
  const { supabase, tenantId } = await resolveTenantContext();
  const scope = getMonthScope(month);
  const dataset = await loadBusinessHealthDataset(supabase, tenantId);
  const results = checks.runBusinessInvariantChecksOnDataset(dataset, {
    context: {
      monthDate: scope.monthDate,
      nextMonthDate: scope.nextMonthDate,
    },
  });
  const aggregate = checks.summarizeBusinessInvariantResults(results);
  const findings = results.flatMap((result) => result.findings.map((finding, index) => mapFinding(result, finding, index)));
  const blockers = findings.filter((finding) => finding.severity === 'critical');
  const warnings = findings.filter((finding) => finding.severity === 'warning');

  return {
    generated_at: new Date().toISOString(),
    month: scope.monthLabel,
    severity: aggregate.criticalCount > 0 ? 'critical' : aggregate.warningCount > 0 ? 'warning' : 'healthy',
    score: calculateHealthScore(aggregate.criticalCount, aggregate.warningCount),
    checked_groups: aggregate.checked,
    critical_count: aggregate.criticalCount,
    warning_count: aggregate.warningCount,
    can_operate_cleanly: aggregate.isHealthy,
    dataset_counts: getDatasetCounts(dataset),
    groups: buildGroups(results),
    findings,
    blockers,
    warnings,
  };
}

export async function runBusinessHealthRepairAction(params: {
  action: BusinessHealthRepairAction;
  targetId?: string;
}): Promise<BusinessHealthRepairResult> {
  if (params.action === 'replay_outbox') {
    if (!params.targetId) {
      throw new Error('Thiếu mã sự kiện outbox cần chạy lại.');
    }

    await replayOutboxEvent(params.targetId);
    await safeRevalidatePath('/dashboard/accounting/health');

    return {
      success: true,
      action: params.action,
      message: 'Đã đưa sự kiện hạch toán về hàng chờ để worker xử lý lại.',
    };
  }

  if (params.action === 'run_metadata_backfill') {
    const result = await runAccountingMetadataBackfill({ limit: 500 });
    if (!result.success) {
      throw new Error(result.error);
    }
    const data = result.data;
    await safeRevalidatePath('/dashboard/accounting/health');
    const scanned = data.reduce((sum, row) => sum + row.scanned_records, 0);
    const review = data.reduce((sum, row) => sum + row.review_created, 0);

    return {
      success: true,
      action: params.action,
      message: `Đã quét ${scanned} dòng dữ liệu; ${review} dòng cần kế toán review.`,
    };
  }

  if (params.action === 'sync_paid_deposit_booking_status') {
    if (!params.targetId) {
      throw new Error('Thiếu mã booking cần đồng bộ trạng thái cọc.');
    }

    const message = await syncPaidDepositBookingStatus(params.targetId);
    await safeRevalidatePath('/dashboard/accounting/health');

    return {
      success: true,
      action: params.action,
      message,
    };
  }

  if (params.action === 'sync_booking_completed_sessions') {
    if (!params.targetId) {
      throw new Error('Thiếu mã booking cần đồng bộ số buổi hoàn thành.');
    }

    const message = await syncBookingCompletedSessions(params.targetId);
    await safeRevalidatePath('/dashboard/accounting/health');

    return {
      success: true,
      action: params.action,
      message,
    };
  }

  if (params.action === 'create_missing_inventory_consumption') {
    if (!params.targetId) {
      throw new Error('Thiếu mã ca cần tạo log trừ kho.');
    }

    const message = await createMissingInventoryConsumption(params.targetId);
    await safeRevalidatePath('/dashboard/accounting/health');

    return {
      success: true,
      action: params.action,
      message,
    };
  }

  if (params.action === 'enqueue_missing_session_done_accounting') {
    if (!params.targetId) {
      throw new Error('Thiếu mã ca cần tạo side-effect kế toán SESSION_DONE.');
    }

    const message = await enqueueMissingSessionDoneAccounting(params.targetId);
    await safeRevalidatePath('/dashboard/accounting/health');

    return {
      success: true,
      action: params.action,
      message,
    };
  }

  if (params.action === 'enqueue_missing_inventory_consumed_accounting') {
    if (!params.targetId) {
      throw new Error('Thiếu mã ca cần tạo side-effect kế toán INVENTORY_CONSUMED.');
    }

    const message = await enqueueMissingInventoryConsumedAccounting(params.targetId);
    await safeRevalidatePath('/dashboard/accounting/health');

    return {
      success: true,
      action: params.action,
      message,
    };
  }

  if (params.action === 'enqueue_missing_package_sale_accounting') {
    if (!params.targetId) {
      throw new Error('Thiếu mã khoản thu cần tạo side-effect kế toán PACKAGE_SALE.');
    }

    const message = await enqueueMissingPackageSaleAccounting(params.targetId);
    await safeRevalidatePath('/dashboard/accounting/health');

    return {
      success: true,
      action: params.action,
      message,
    };
  }

  if (params.action === 'enqueue_missing_salary_paid_accounting') {
    if (!params.targetId) {
      throw new Error('Thiếu mã bản ghi lương cần tạo side-effect kế toán SALARY_PAID.');
    }

    const message = await enqueueMissingSalaryPaidAccounting(params.targetId);
    await safeRevalidatePath('/dashboard/accounting/health');

    return {
      success: true,
      action: params.action,
      message,
    };
  }

  throw new Error('Thao tác xử lý sức khỏe dữ liệu không được hỗ trợ.');
}

async function syncPaidDepositBookingStatus(bookingId: string): Promise<string> {
  const { supabase, tenantId } = await resolveTenantContext();
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, booking_number, status, deposit_amount, full_price, discount_percent, tenant_id, customer_id')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .single();

  if (bookingError || !booking) {
    throw new Error(bookingError?.message ?? 'Không tìm thấy booking cần đồng bộ trạng thái cọc.');
  }

  const currentBooking = booking as BookingStatusRepairRow;
  if (currentBooking.status !== 'deposit_pending') {
    throw new Error('Booking không còn ở trạng thái chờ cọc, không cần đồng bộ.');
  }

  const revenues = await queryRows<RevenueRow>(
    supabase
      .from('revenue')
      .select('id, booking_id, amount, status, revenue_type, tenant_id, received_date, notes, payment_method, business_event_type, accounting_review_status, accounting_metadata')
      .eq('booking_id', currentBooking.id)
      .eq('tenant_id', tenantId)
      .limit(MAX_ROWS),
    'booking revenue'
  );

  const paymentState = checks.calculateBookingPaymentState({
    fullPrice: currentBooking.full_price,
    discountPercent: currentBooking.discount_percent,
    depositAmount: currentBooking.deposit_amount,
    bookingStatus: currentBooking.status,
    revenues,
  });

  if (paymentState.depositTarget <= 0 || paymentState.depositDue > 1) {
    throw new Error('Booking chưa đủ điều kiện xác nhận cọc theo dữ liệu thanh toán hiện tại.');
  }

  const updatePayload: Database['public']['Tables']['bookings']['Update'] = {
    status: 'booked',
    updated_at: new Date().toISOString(),
  };
  const { data: updated, error: updateError } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', currentBooking.id)
    .eq('tenant_id', tenantId)
    .eq('status', 'deposit_pending')
    .select('id, booking_number, status')
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? 'Không thể cập nhật trạng thái booking.');
  }

  try {
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'bookings',
      record_id: currentBooking.id,
      old_data: {
        status: currentBooking.status,
        booking_number: currentBooking.booking_number,
      },
      new_data: {
        status: 'booked',
        booking_number: currentBooking.booking_number,
        reason: 'business_health_sync_paid_deposit',
        total_paid: paymentState.totalPaid,
        deposit_target: paymentState.depositTarget,
        remaining_debt: paymentState.remainingDebt,
      },
    });
  } catch (auditError) {
    const rollbackPayload: Database['public']['Tables']['bookings']['Update'] = {
      status: currentBooking.status,
      updated_at: new Date().toISOString(),
    };
    const { error: rollbackError } = await supabase
      .from('bookings')
      .update(rollbackPayload)
      .eq('id', currentBooking.id)
      .eq('tenant_id', tenantId);

    if (rollbackError) {
      throw new Error(
        `Đã cập nhật booking nhưng ghi audit thất bại và rollback cũng thất bại: ${rollbackError.message}`
      );
    }

    const message = auditError instanceof Error ? auditError.message : 'Audit log failed';
    throw new Error(`Đã rollback trạng thái booking vì ghi audit thất bại: ${message}`);
  }

  await safeRevalidatePath('/dashboard/finance/reconciliation');
  await safeRevalidatePath('/dashboard/customers');
  await safeRevalidatePath(`/dashboard/customers/${currentBooking.customer_id}`);

  return `Đã chuyển booking ${currentBooking.booking_number} sang trạng thái đã cọc/đã đặt lịch.`;
}

async function syncBookingCompletedSessions(bookingId: string): Promise<string> {
  const { supabase, tenantId } = await resolveTenantContext();
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, booking_number, status, completed_sessions, total_sessions, tenant_id, customer_id')
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .single();

  if (bookingError || !booking) {
    throw new Error(bookingError?.message ?? 'Không tìm thấy booking cần đồng bộ số buổi hoàn thành.');
  }

  const currentBooking = booking as BookingProgressRepairRow;
  if (currentBooking.status === 'cancelled' || currentBooking.status === 'completed') {
    throw new Error('Booking đã hủy hoặc đã hoàn tất, không được đồng bộ số buổi tự động.');
  }

  const completedSessions = await queryRows<Pick<SessionLogRow, 'id' | 'booking_id' | 'status' | 'tenant_id'>>(
    supabase
      .from('session_logs')
      .select('id, booking_id, status, tenant_id')
      .eq('booking_id', currentBooking.id)
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .limit(MAX_ROWS),
    'completed session logs'
  );

  const savedCompleted = Number(currentBooking.completed_sessions ?? 0);
  const liveCompleted = completedSessions.length;

  if (savedCompleted === liveCompleted) {
    throw new Error('Số buổi hoàn thành trên booking đã khớp với log ca mới nhất.');
  }

  const updatePayload: Database['public']['Tables']['bookings']['Update'] = {
    completed_sessions: liveCompleted,
    updated_at: new Date().toISOString(),
  };
  const { data: updated, error: updateError } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', currentBooking.id)
    .eq('tenant_id', tenantId)
    .select('id, booking_number, completed_sessions')
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? 'Không thể cập nhật số buổi hoàn thành trên booking.');
  }

  try {
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'bookings',
      record_id: currentBooking.id,
      old_data: {
        booking_number: currentBooking.booking_number,
        status: currentBooking.status,
        completed_sessions: savedCompleted,
        total_sessions: currentBooking.total_sessions,
      },
      new_data: {
        booking_number: currentBooking.booking_number,
        status: currentBooking.status,
        completed_sessions: liveCompleted,
        total_sessions: currentBooking.total_sessions,
        completed_session_logs: liveCompleted,
        reason: 'business_health_sync_completed_sessions',
      },
    });
  } catch (auditError) {
    const rollbackPayload: Database['public']['Tables']['bookings']['Update'] = {
      completed_sessions: savedCompleted,
      updated_at: new Date().toISOString(),
    };
    const { error: rollbackError } = await supabase
      .from('bookings')
      .update(rollbackPayload)
      .eq('id', currentBooking.id)
      .eq('tenant_id', tenantId);

    if (rollbackError) {
      throw new Error(
        `Đã cập nhật số buổi booking nhưng ghi audit thất bại và rollback cũng thất bại: ${rollbackError.message}`
      );
    }

    const message = auditError instanceof Error ? auditError.message : 'Audit log failed';
    throw new Error(`Đã rollback số buổi booking vì ghi audit thất bại: ${message}`);
  }

  await safeRevalidatePath('/dashboard/sessions');
  await safeRevalidatePath('/dashboard/bookings');
  await safeRevalidatePath('/dashboard/customers');
  await safeRevalidatePath(`/dashboard/customers/${currentBooking.customer_id}`);

  return `Đã đồng bộ booking ${currentBooking.booking_number}: ${savedCompleted} -> ${liveCompleted} buổi hoàn thành.`;
}

async function createMissingInventoryConsumption(sessionLogId: string): Promise<string> {
  const { supabase, tenantId } = await resolveTenantContext();
  const { data: session, error: sessionError } = await supabase
    .from('session_logs')
    .select('id, booking_id, status, completed_date, tenant_id, session_number')
    .eq('id', sessionLogId)
    .eq('tenant_id', tenantId)
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? 'Không tìm thấy ca cần tạo log trừ kho.');
  }

  const currentSession = session as InventorySessionRepairRow;
  if (currentSession.status !== 'completed') {
    throw new Error('Chỉ ca đã hoàn thành mới được tạo log trừ kho.');
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, booking_number, package_id, package_name, tenant_id, customer_id')
    .eq('id', currentSession.booking_id)
    .eq('tenant_id', tenantId)
    .single();

  if (bookingError || !booking) {
    throw new Error(bookingError?.message ?? 'Không tìm thấy booking của ca cần tạo log trừ kho.');
  }

  const currentBooking = booking as BookingInventoryRepairRow;
  if (!currentBooking.package_id) {
    throw new Error('Booking chưa gắn gói dịch vụ nên không thể xác định định mức vật tư.');
  }

  const existingLogs = await queryRows<InventoryLogRow>(
    supabase
      .from('inventory_logs')
      .select('id, tenant_id, item_id, change_amount, reason, session_log_id, created_at, business_event_type, accounting_review_status')
      .eq('session_log_id', currentSession.id)
      .eq('tenant_id', tenantId)
      .limit(MAX_ROWS),
    'session inventory logs'
  );

  const existingConsumptionLogs = existingLogs.filter((log) => isConsumptionLogReason(log.reason));
  if (existingConsumptionLogs.length > 0) {
    throw new Error('Ca này đã có log trừ kho, không tạo trùng.');
  }

  const packageMaterials = await queryRows<PackageMaterialRow>(
    supabase
      .from('package_materials')
      .select('id, tenant_id, package_id, item_id, quantity_per_session')
      .eq('package_id', currentBooking.package_id)
      .eq('tenant_id', tenantId)
      .limit(MAX_ROWS),
    'package materials'
  );
  const requiredMaterials = packageMaterials.filter((material) => Number(material.quantity_per_session ?? 0) > 0);

  if (requiredMaterials.length === 0) {
    throw new Error('Gói dịch vụ chưa cấu hình định mức vật tư để trừ kho.');
  }

  const itemIds = Array.from(new Set(requiredMaterials.map((material) => material.item_id)));
  const inventoryItems = await queryRows<InventoryItemRow>(
    supabase
      .from('inventory_items')
      .select('id, tenant_id, name, stock_level, min_stock_level, unit, price_per_unit')
      .eq('tenant_id', tenantId)
      .in('id', itemIds)
      .limit(MAX_ROWS),
    'inventory items for repair preview'
  );
  const itemById = new Map(inventoryItems.map((item) => [item.id, item]));
  const missingItemIds = itemIds.filter((itemId) => !itemById.has(itemId));

  if (missingItemIds.length > 0) {
    throw new Error(`Định mức vật tư đang tham chiếu mặt hàng không tồn tại: ${missingItemIds.join(', ')}`);
  }

  const plannedMaterials = requiredMaterials.map((material) => {
    const item = itemById.get(material.item_id);
    return {
      item_id: material.item_id,
      item_name: item?.name ?? material.item_id,
      quantity_per_session: Number(material.quantity_per_session ?? 0),
      unit: item?.unit ?? null,
      stock_level: item?.stock_level ?? null,
    };
  });

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'inventory_logs',
    record_id: currentSession.id,
    old_data: {
      session_log_id: currentSession.id,
      existing_consumption_logs: 0,
    },
    new_data: {
      reason: 'business_health_create_missing_inventory_consumption',
      session_log_id: currentSession.id,
      booking_id: currentBooking.id,
      booking_number: currentBooking.booking_number,
      package_id: currentBooking.package_id,
      package_name: currentBooking.package_name,
      planned_materials: plannedMaterials,
    },
  });

  const consumeResult = await autoConsumeForSession(currentBooking.package_id, currentSession.id, {
    force: true,
    source: 'business_health_repair',
  });

  if (!consumeResult.success) {
    throw new Error(`Không thể tạo log trừ kho cho ca ${currentSession.id}: ${consumeResult.error || 'engine trả về lỗi không xác định'}`);
  }

  await safeRevalidatePath('/dashboard/inventory');
  await safeRevalidatePath('/dashboard/sessions');
  await safeRevalidatePath('/dashboard/accounting/outbox');
  await safeRevalidatePath('/dashboard/customers');
  await safeRevalidatePath(`/dashboard/customers/${currentBooking.customer_id}`);

  return `Đã tạo log trừ kho cho ca ${currentSession.session_number || currentSession.id} của booking ${currentBooking.booking_number}.`;
}

function hasActiveSessionDoneJournal(entries: JournalEntryRow[], sessionLogId: string) {
  return entries.some((entry) =>
    entry.reference_type === 'SESSION_DONE' &&
    entry.reference_id === sessionLogId &&
    String(entry.status ?? '').trim().toLowerCase() !== 'canceled'
  );
}

function hasActiveInventoryConsumedJournal(entries: JournalEntryRow[], sessionLogId: string) {
  return entries.some((entry) =>
    entry.reference_type === 'INVENTORY_CONSUMPTION' &&
    entry.reference_id === sessionLogId &&
    String(entry.status ?? '').trim().toLowerCase() !== 'canceled'
  );
}

function hasActivePackageSaleJournal(entries: JournalEntryRow[], revenueId: string) {
  return entries.some((entry) =>
    entry.reference_type === 'PACKAGE_SALE' &&
    entry.reference_id === revenueId &&
    String(entry.status ?? '').trim().toLowerCase() !== 'canceled'
  );
}

function hasActiveSalaryPaidJournal(entries: JournalEntryRow[], salaryRecordId: string) {
  return entries.some((entry) =>
    entry.reference_type === 'SALARY_PAYMENT' &&
    entry.reference_id === salaryRecordId &&
    String(entry.status ?? '').trim().toLowerCase() !== 'canceled'
  );
}

async function enqueueMissingSalaryPaidAccounting(salaryRecordId: string): Promise<string> {
  const { supabase, tenantId } = await resolveTenantContext();
  const { data: salaryRecord, error: salaryError } = await supabase
    .from('salary_records')
    .select('id, ktv_id, month_year, tenant_id, status, paid_date, paid_method, notes, total_sessions, base_salary, session_bonus, rating_bonus, kpi_bonus, violations_deduction, service_percentage_bonus, total_salary, business_event_type, accounting_review_status')
    .eq('id', salaryRecordId)
    .eq('tenant_id', tenantId)
    .single();

  if (salaryError || !salaryRecord) {
    throw new Error(salaryError?.message ?? 'Không tìm thấy bản ghi lương cần tạo side-effect SALARY_PAID.');
  }

  const currentSalary = salaryRecord as SalaryRecordRow;
  if (String(currentSalary.status ?? '').trim().toLowerCase() !== 'paid') {
    throw new Error('Chỉ bản ghi lương đã trả mới được tạo side-effect kế toán SALARY_PAID.');
  }

  const totalSalary = Number(currentSalary.total_salary ?? 0);
  if (!Number.isFinite(totalSalary) || totalSalary <= 0) {
    throw new Error('Bản ghi lương đã trả phải có tổng lương dương trước khi tạo side-effect kế toán.');
  }

  if (!currentSalary.ktv_id) {
    throw new Error('Bản ghi lương thiếu KTV nên không thể tạo side-effect SALARY_PAID.');
  }

  const existingOutbox = await queryRows<AccountingOutboxRow>(
    supabase
      .from('accounting_outbox')
      .select('id, tenant_id, event_type, reference_type, reference_id, status, retry_count, max_retries, last_error, created_at')
      .eq('tenant_id', tenantId)
      .eq('event_type', 'SALARY_PAID')
      .eq('reference_type', 'SALARY_RECORD')
      .eq('reference_id', currentSalary.id)
      .limit(MAX_ROWS),
    'existing SALARY_PAID outbox'
  );

  if (existingOutbox.length > 0) {
    throw new Error('Bản ghi lương này đã có outbox SALARY_PAID, không tạo trùng.');
  }

  const existingJournals = await queryRows<JournalEntryRow>(
    supabase
      .from('journal_entries')
      .select('id, tenant_id, entry_date, reference_type, reference_id, status, description')
      .eq('tenant_id', tenantId)
      .eq('reference_type', 'SALARY_PAYMENT')
      .eq('reference_id', currentSalary.id)
      .limit(MAX_ROWS),
    'existing SALARY_PAID journals'
  );

  if (hasActiveSalaryPaidJournal(existingJournals, currentSalary.id)) {
    throw new Error('Bản ghi lương này đã có bút toán SALARY_PAYMENT active, không tạo outbox trùng.');
  }

  const paymentMethod = currentSalary.paid_method || 'bank_transfer';
  const outboxEvent = buildSalaryPaidOutboxEvent({
    tenantId,
    salaryRecordId: currentSalary.id,
    amount: totalSalary,
    paymentMethod,
    description: currentSalary.notes ||
      `Đối soát bổ sung: thanh toán lương kỳ ${currentSalary.month_year} cho KTV ${currentSalary.ktv_id}`,
    ktvId: currentSalary.ktv_id,
  });

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'accounting_outbox',
    record_id: currentSalary.id,
    old_data: {
      salary_record_id: currentSalary.id,
      existing_salary_paid_outbox: 0,
      existing_active_journal: false,
    },
    new_data: {
      reason: 'business_health_enqueue_missing_salary_paid',
      event_type: outboxEvent.eventType,
      reference_type: outboxEvent.referenceType,
      reference_id: outboxEvent.referenceId,
      payload: outboxEvent.payload as Json,
      ktv_id: currentSalary.ktv_id,
      month_year: currentSalary.month_year,
      paid_date: currentSalary.paid_date,
      paid_method: paymentMethod,
      total_salary: totalSalary,
    },
  });

  const outboxEnqueued = await enqueueWithAutoClient(
    supabase,
    outboxEvent,
    '[businessHealth.salaryPaidRepair]'
  );

  if (!outboxEnqueued) {
    throw new Error('Không thể tạo outbox SALARY_PAID cho bản ghi lương đã trả.');
  }

  await safeRevalidatePath('/dashboard/accounting/outbox');
  await safeRevalidatePath('/dashboard/accounting/journals');
  await safeRevalidatePath('/dashboard/accounting/salary-reconciliation');
  await safeRevalidatePath('/dashboard/salary');
  await safeRevalidatePath('/dashboard/finance');

  return `Đã tạo outbox SALARY_PAID ${Math.round(totalSalary).toLocaleString('vi-VN')}đ cho KTV ${currentSalary.ktv_id}, kỳ ${currentSalary.month_year}.`;
}

async function enqueueMissingPackageSaleAccounting(revenueId: string): Promise<string> {
  const { supabase, tenantId } = await resolveTenantContext();
  const { data: revenue, error: revenueError } = await supabase
    .from('revenue')
    .select('id, booking_id, amount, status, revenue_type, tenant_id, received_date, notes, payment_method, business_event_type, accounting_review_status, accounting_metadata')
    .eq('id', revenueId)
    .eq('tenant_id', tenantId)
    .single();

  if (revenueError || !revenue) {
    throw new Error(revenueError?.message ?? 'Không tìm thấy khoản thu cần tạo side-effect PACKAGE_SALE.');
  }

  const currentRevenue = revenue as RevenueRow;
  if (String(currentRevenue.status ?? '').trim().toLowerCase() !== 'confirmed') {
    throw new Error('Chỉ khoản thu đã xác nhận mới được tạo side-effect kế toán PACKAGE_SALE.');
  }

  if (!isPackageSaleRevenueType(currentRevenue.revenue_type)) {
    throw new Error('Khoản thu này không thuộc nhóm doanh thu gói/cọc/thanh toán gói nên không tạo PACKAGE_SALE.');
  }

  const totalAmount = Number(currentRevenue.amount ?? 0);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error('Khoản thu PACKAGE_SALE phải có số tiền dương trước khi tạo side-effect kế toán.');
  }

  if (!currentRevenue.booking_id) {
    throw new Error('Khoản thu PACKAGE_SALE chưa gắn với booking, cần đối soát booking trước khi hạch toán.');
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, booking_number, package_name, tenant_id, customer_id')
    .eq('id', currentRevenue.booking_id)
    .eq('tenant_id', tenantId)
    .single();

  if (bookingError || !booking) {
    throw new Error(bookingError?.message ?? 'Không tìm thấy booking của khoản thu PACKAGE_SALE.');
  }

  const currentBooking = booking as BookingPackageSaleRepairRow;
  const existingOutbox = await queryRows<AccountingOutboxRow>(
    supabase
      .from('accounting_outbox')
      .select('id, tenant_id, event_type, reference_type, reference_id, status, retry_count, max_retries, last_error, created_at')
      .eq('tenant_id', tenantId)
      .eq('event_type', 'PACKAGE_SALE')
      .eq('reference_type', 'REVENUE')
      .eq('reference_id', currentRevenue.id)
      .limit(MAX_ROWS),
    'existing PACKAGE_SALE outbox'
  );

  if (existingOutbox.length > 0) {
    throw new Error('Khoản thu này đã có outbox PACKAGE_SALE, không tạo trùng.');
  }

  const existingJournals = await queryRows<JournalEntryRow>(
    supabase
      .from('journal_entries')
      .select('id, tenant_id, entry_date, reference_type, reference_id, status, description')
      .eq('tenant_id', tenantId)
      .eq('reference_type', 'PACKAGE_SALE')
      .eq('reference_id', currentRevenue.id)
      .limit(MAX_ROWS),
    'existing PACKAGE_SALE journals'
  );

  if (hasActivePackageSaleJournal(existingJournals, currentRevenue.id)) {
    throw new Error('Khoản thu này đã có bút toán PACKAGE_SALE active, không tạo outbox trùng.');
  }

  const outboxEvent = buildPackageSaleOutboxEvent({
    tenantId,
    revenueId: currentRevenue.id,
    totalAmount,
    description: currentRevenue.notes ||
      `Đối soát bổ sung: ghi nhận ${currentRevenue.revenue_type || 'thanh toán gói'} cho booking ${currentBooking.booking_number}`,
  });

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'accounting_outbox',
    record_id: currentRevenue.id,
    old_data: {
      revenue_id: currentRevenue.id,
      existing_package_sale_outbox: 0,
      existing_active_journal: false,
    },
    new_data: {
      reason: 'business_health_enqueue_missing_package_sale',
      event_type: outboxEvent.eventType,
      reference_type: outboxEvent.referenceType,
      reference_id: outboxEvent.referenceId,
      payload: outboxEvent.payload as Json,
      booking_id: currentBooking.id,
      booking_number: currentBooking.booking_number,
      package_name: currentBooking.package_name,
      revenue_type: currentRevenue.revenue_type,
      received_date: currentRevenue.received_date,
      amount: totalAmount,
    },
  });

  const outboxEnqueued = await enqueueWithAutoClient(
    supabase,
    outboxEvent,
    '[businessHealth.packageSaleRepair]'
  );

  if (!outboxEnqueued) {
    throw new Error('Không thể tạo outbox PACKAGE_SALE cho khoản thu đã xác nhận.');
  }

  await safeRevalidatePath('/dashboard/accounting/outbox');
  await safeRevalidatePath('/dashboard/accounting/journals');
  await safeRevalidatePath('/dashboard/finance');
  await safeRevalidatePath('/dashboard/finance/reconciliation');
  await safeRevalidatePath('/dashboard/customers');
  await safeRevalidatePath(`/dashboard/customers/${currentBooking.customer_id}`);

  return `Đã tạo outbox PACKAGE_SALE ${Math.round(totalAmount).toLocaleString('vi-VN')}đ cho booking ${currentBooking.booking_number}.`;
}

function calculateConsumptionCost(
  consumptionLogs: InventoryLogRow[],
  itemById: Map<string, InventoryItemRow>
) {
  const missingItemIds = Array.from(new Set(
    consumptionLogs
      .map((log) => log.item_id)
      .filter((itemId): itemId is string => typeof itemId === 'string' && itemId.length > 0)
      .filter((itemId) => !itemById.has(itemId))
  ));

  if (missingItemIds.length > 0) {
    throw new Error(`Log trừ kho đang tham chiếu vật tư không tồn tại: ${missingItemIds.join(', ')}`);
  }

  const items = consumptionLogs.map((log) => {
    const item = itemById.get(log.item_id);
    const quantity = Math.abs(Number(log.change_amount ?? 0));
    const unitCost = Number(item?.price_per_unit ?? 0);
    const cost = quantity * unitCost;

    return {
      log_id: log.id,
      item_id: log.item_id,
      item_name: item?.name ?? log.item_id,
      quantity,
      unit: item?.unit ?? null,
      unit_cost: unitCost,
      cost,
    };
  });

  const invalidPriceItems = items.filter((item) => item.quantity > 0 && item.unit_cost <= 0);
  if (invalidPriceItems.length > 0) {
    const names = invalidPriceItems.map((item) => item.item_name).join(', ');
    throw new Error(`Không xác định được giá trị tiêu hao kho cho vật tư: ${names}. Cần cập nhật đơn giá vật tư trước.`);
  }

  const totalCost = items.reduce((sum, item) => sum + item.cost, 0);
  if (totalCost <= 0) {
    throw new Error('Không xác định được giá trị tiêu hao kho để tạo INVENTORY_CONSUMED. Cần cập nhật đơn giá vật tư trước.');
  }

  const summary = items
    .map((item) => `${item.item_name}: ${item.quantity}${item.unit ? ` ${item.unit}` : ''}`)
    .join('; ');

  return { items, totalCost, summary };
}

async function enqueueMissingInventoryConsumedAccounting(sessionLogId: string): Promise<string> {
  const { supabase, tenantId } = await resolveTenantContext();
  const { data: session, error: sessionError } = await supabase
    .from('session_logs')
    .select('id, booking_id, status, completed_date, tenant_id, session_number')
    .eq('id', sessionLogId)
    .eq('tenant_id', tenantId)
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? 'Không tìm thấy ca cần tạo side-effect INVENTORY_CONSUMED.');
  }

  const currentSession = session as InventorySessionRepairRow;
  if (currentSession.status !== 'completed') {
    throw new Error('Chỉ ca đã hoàn thành mới được tạo side-effect kế toán INVENTORY_CONSUMED.');
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, booking_number, package_id, package_name, tenant_id, customer_id')
    .eq('id', currentSession.booking_id)
    .eq('tenant_id', tenantId)
    .single();

  if (bookingError || !booking) {
    throw new Error(bookingError?.message ?? 'Không tìm thấy booking của ca cần tạo side-effect INVENTORY_CONSUMED.');
  }

  const currentBooking = booking as BookingInventoryRepairRow;
  const existingOutbox = await queryRows<AccountingOutboxRow>(
    supabase
      .from('accounting_outbox')
      .select('id, tenant_id, event_type, reference_type, reference_id, status, retry_count, max_retries, last_error, created_at')
      .eq('tenant_id', tenantId)
      .eq('event_type', 'INVENTORY_CONSUMED')
      .eq('reference_type', 'SESSION_LOG')
      .eq('reference_id', currentSession.id)
      .limit(MAX_ROWS),
    'existing INVENTORY_CONSUMED outbox'
  );

  if (existingOutbox.length > 0) {
    throw new Error('Ca này đã có outbox INVENTORY_CONSUMED, không tạo trùng.');
  }

  const existingJournals = await queryRows<JournalEntryRow>(
    supabase
      .from('journal_entries')
      .select('id, tenant_id, entry_date, reference_type, reference_id, status, description')
      .eq('tenant_id', tenantId)
      .eq('reference_type', 'INVENTORY_CONSUMPTION')
      .eq('reference_id', currentSession.id)
      .limit(MAX_ROWS),
    'existing INVENTORY_CONSUMED journals'
  );

  if (hasActiveInventoryConsumedJournal(existingJournals, currentSession.id)) {
    throw new Error('Ca này đã có bút toán INVENTORY_CONSUMPTION active, không tạo outbox trùng.');
  }

  const inventoryLogs = await queryRows<InventoryLogRow>(
    supabase
      .from('inventory_logs')
      .select('id, tenant_id, item_id, change_amount, reason, session_log_id, created_at, business_event_type, accounting_review_status')
      .eq('session_log_id', currentSession.id)
      .eq('tenant_id', tenantId)
      .limit(MAX_ROWS),
    'session inventory logs for INVENTORY_CONSUMED'
  );
  const consumptionLogs = inventoryLogs.filter((log) => isConsumptionLogReason(log.reason));

  if (consumptionLogs.length === 0) {
    throw new Error('Ca này chưa có log trừ kho nên không thể tạo outbox INVENTORY_CONSUMED.');
  }

  const itemIds = Array.from(new Set(
    consumptionLogs
      .map((log) => log.item_id)
      .filter((itemId): itemId is string => typeof itemId === 'string' && itemId.length > 0)
  ));

  if (itemIds.length === 0) {
    throw new Error('Log trừ kho không có mã vật tư hợp lệ để tính giá trị tiêu hao.');
  }

  const inventoryItems = await queryRows<InventoryItemRow>(
    supabase
      .from('inventory_items')
      .select('id, tenant_id, name, stock_level, min_stock_level, unit, price_per_unit')
      .eq('tenant_id', tenantId)
      .in('id', itemIds)
      .limit(MAX_ROWS),
    'inventory items for INVENTORY_CONSUMED'
  );
  const itemById = new Map(inventoryItems.map((item) => [item.id, item]));
  const consumption = calculateConsumptionCost(consumptionLogs, itemById);
  const outboxEvent = buildInventoryConsumedOutboxEvent({
    tenantId,
    sessionLogId: currentSession.id,
    amount: consumption.totalCost,
    description: `Đối soát bổ sung: vật tư tiêu hao ca ${currentSession.session_number || currentSession.id} - ${currentBooking.package_name || 'Gói dịch vụ'}`,
  });

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'accounting_outbox',
    record_id: currentSession.id,
    old_data: {
      session_log_id: currentSession.id,
      existing_inventory_consumed_outbox: 0,
      existing_active_journal: false,
      inventory_log_count: consumptionLogs.length,
    },
    new_data: {
      reason: 'business_health_enqueue_missing_inventory_consumed',
      event_type: outboxEvent.eventType,
      reference_type: outboxEvent.referenceType,
      reference_id: outboxEvent.referenceId,
      payload: outboxEvent.payload as Json,
      booking_id: currentBooking.id,
      booking_number: currentBooking.booking_number,
      consumption_summary: consumption.summary,
      consumption_items: consumption.items as Json,
      total_cost: consumption.totalCost,
    },
  });

  const outboxEnqueued = await enqueueWithAutoClient(
    supabase,
    outboxEvent,
    '[businessHealth.inventoryConsumedRepair]'
  );

  if (!outboxEnqueued) {
    throw new Error('Không thể tạo outbox INVENTORY_CONSUMED cho ca đã trừ kho.');
  }

  await safeRevalidatePath('/dashboard/accounting/outbox');
  await safeRevalidatePath('/dashboard/accounting/journals');
  await safeRevalidatePath('/dashboard/inventory');
  await safeRevalidatePath('/dashboard/sessions');
  await safeRevalidatePath('/dashboard/customers');
  await safeRevalidatePath(`/dashboard/customers/${currentBooking.customer_id}`);

  return `Đã tạo outbox INVENTORY_CONSUMED ${Math.round(consumption.totalCost).toLocaleString('vi-VN')}đ cho ca ${currentSession.session_number || currentSession.id} của booking ${currentBooking.booking_number}.`;
}

async function enqueueMissingSessionDoneAccounting(sessionLogId: string): Promise<string> {
  const { supabase, tenantId } = await resolveTenantContext();
  const { data: session, error: sessionError } = await supabase
    .from('session_logs')
    .select('id, booking_id, status, completed_date, completed_by_ktv_id, tenant_id, session_number')
    .eq('id', sessionLogId)
    .eq('tenant_id', tenantId)
    .single();

  if (sessionError || !session) {
    throw new Error(sessionError?.message ?? 'Không tìm thấy ca cần tạo side-effect SESSION_DONE.');
  }

  const currentSession = session as SessionAccountingRepairRow;
  if (currentSession.status !== 'completed') {
    throw new Error('Chỉ ca đã hoàn thành mới được tạo side-effect kế toán SESSION_DONE.');
  }

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, booking_number, total_sessions, status, package_name, ktv_commission, assigned_ktv_id, tenant_id, full_price, deposit_amount, discount_percent, customer_id')
    .eq('id', currentSession.booking_id)
    .eq('tenant_id', tenantId)
    .single();

  if (bookingError || !booking) {
    throw new Error(bookingError?.message ?? 'Không tìm thấy booking của ca cần tạo side-effect SESSION_DONE.');
  }

  const currentBooking = booking as BookingAccountingRepairRow;
  const existingOutbox = await queryRows<AccountingOutboxRow>(
    supabase
      .from('accounting_outbox')
      .select('id, tenant_id, event_type, reference_type, reference_id, status, retry_count, max_retries, last_error, created_at')
      .eq('tenant_id', tenantId)
      .eq('event_type', 'SESSION_DONE')
      .eq('reference_type', 'SESSION_LOG')
      .eq('reference_id', currentSession.id)
      .limit(MAX_ROWS),
    'existing SESSION_DONE outbox'
  );

  if (existingOutbox.length > 0) {
    throw new Error('Ca này đã có outbox SESSION_DONE, không tạo trùng.');
  }

  const existingJournals = await queryRows<JournalEntryRow>(
    supabase
      .from('journal_entries')
      .select('id, tenant_id, entry_date, reference_type, reference_id, status, description')
      .eq('tenant_id', tenantId)
      .eq('reference_type', 'SESSION_DONE')
      .eq('reference_id', currentSession.id)
      .limit(MAX_ROWS),
    'existing SESSION_DONE journals'
  );

  if (hasActiveSessionDoneJournal(existingJournals, currentSession.id)) {
    throw new Error('Ca này đã có bút toán SESSION_DONE active, không tạo outbox trùng.');
  }

  const revenues = await queryRows<RevenueRow>(
    supabase
      .from('revenue')
      .select('id, booking_id, amount, status, revenue_type, tenant_id, received_date, notes, payment_method, business_event_type, accounting_review_status, accounting_metadata')
      .eq('booking_id', currentBooking.id)
      .eq('tenant_id', tenantId)
      .limit(MAX_ROWS),
    'booking revenue for SESSION_DONE'
  );
  const totalPaid = calculateConfirmedPaidAmount(revenues as PaymentRevenueLike[]);
  const totalSessions = Number(currentBooking.total_sessions || 1);
  const currentSessionNumber = Math.max(1, Number(currentSession.session_number || 1));
  const revenueRecognition = calculateSessionRevenueRecognition({
    fullPrice: currentBooking.full_price,
    discountPercent: currentBooking.discount_percent,
    totalSessions,
    currentSessionNumber,
    totalPaid,
  });
  const commissionAmount = Number(currentBooking.ktv_commission) || 0;
  const ktvId = currentSession.completed_by_ktv_id || currentBooking.assigned_ktv_id || null;
  const outboxEvent = buildSessionDoneOutboxEvent({
    tenantId,
    sessionLogId: currentSession.id,
    bookingId: currentBooking.id,
    ktvId,
    earnedRevenueAmount: revenueRecognition.earnedRevenueAmount,
    deferredRevenueAmount: revenueRecognition.deferredRevenueAmount,
    receivableAmount: revenueRecognition.receivableAmount,
    commissionAmount,
    description: `Đối soát bổ sung: hoàn thành buổi ${currentSession.session_number || '--'}/${totalSessions} - ${currentBooking.package_name || 'Gói dịch vụ'}`,
  });

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'accounting_outbox',
    record_id: currentSession.id,
    old_data: {
      session_log_id: currentSession.id,
      existing_session_done_outbox: 0,
      existing_active_journal: false,
    },
    new_data: {
      reason: 'business_health_enqueue_missing_session_done',
      event_type: outboxEvent.eventType,
      reference_type: outboxEvent.referenceType,
      reference_id: outboxEvent.referenceId,
      payload: outboxEvent.payload as Json,
      booking_id: currentBooking.id,
      booking_number: currentBooking.booking_number,
    },
  });

  const outboxEnqueued = await enqueueWithAutoClient(
    supabase,
    outboxEvent,
    '[businessHealth.sessionDoneRepair]'
  );

  if (!outboxEnqueued) {
    throw new Error('Không thể tạo outbox SESSION_DONE cho ca đã hoàn thành.');
  }

  await safeRevalidatePath('/dashboard/accounting/outbox');
  await safeRevalidatePath('/dashboard/accounting/journals');
  await safeRevalidatePath('/dashboard/sessions');
  await safeRevalidatePath('/dashboard/customers');
  await safeRevalidatePath(`/dashboard/customers/${currentBooking.customer_id}`);

  return `Đã tạo outbox SESSION_DONE cho ca ${currentSession.session_number || currentSession.id} của booking ${currentBooking.booking_number}.`;
}
