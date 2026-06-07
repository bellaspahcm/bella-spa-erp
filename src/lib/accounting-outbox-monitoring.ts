import type { Database } from '@/types/database.types';

export type AccountingOutboxStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD';

export type AccountingOutboxErrorCategory =
  | 'none'
  | 'missing_account'
  | 'missing_template'
  | 'invalid_payload'
  | 'stale_reference'
  | 'permission'
  | 'duplicate_journal'
  | 'worker_state'
  | 'unknown';

export type AccountingOutboxReplayState = 'ready' | 'blocked' | 'not_needed';

type OutboxTimingRow = Pick<
  Database['public']['Tables']['accounting_outbox']['Row'],
  'created_at' | 'next_retry_at' | 'status' | 'retry_count' | 'max_retries'
>;

const STALE_PENDING_MINUTES = 15;
const STALE_PROCESSING_MINUTES = 10;
const STALE_FAILED_GRACE_MINUTES = 5;

export function getOutboxJournalReferenceType(eventType: string) {
  switch (eventType) {
    case 'PACKAGE_SALE':
      return 'PACKAGE_SALE';
    case 'SESSION_DONE':
      return 'SESSION_DONE';
    case 'EXPENSE_RECORDED':
      return 'EXPENSE';
    case 'SALARY_PAID':
      return 'SALARY_PAYMENT';
    case 'INVENTORY_CONSUMED':
      return 'INVENTORY_CONSUMPTION';
    case 'REFUND_ISSUED':
      return 'REFUND';
    case 'INTER_BRANCH_CLEARING':
      return 'INTER_BRANCH_CLEARING';
    case 'MANUAL_ENTRY':
      return 'MANUAL';
    default:
      return null;
  }
}

export function getOutboxOriginHref(referenceType: string, referenceId: string) {
  const encodedId = encodeURIComponent(referenceId);

  switch (referenceType) {
    case 'BOOKING':
      return `/dashboard/bookings?search=${encodedId}`;
    case 'REVENUE':
    case 'EXPENSE':
      return `/dashboard/finance?search=${encodedId}`;
    case 'SESSION_LOG':
      return `/dashboard/sessions?search=${encodedId}`;
    case 'SALARY_RECORD':
      return `/dashboard/salary?search=${encodedId}`;
    case 'INVENTORY_LOG':
      return `/dashboard/inventory?search=${encodedId}`;
    case 'INTER_BRANCH_CLEARING_RECORD':
      return `/dashboard/finance/reconciliation?search=${encodedId}`;
    default:
      return null;
  }
}

export function classifyAccountingOutboxError(error: string | null | undefined): {
  category: AccountingOutboxErrorCategory;
  label: string;
} {
  if (!error?.trim()) {
    return { category: 'none', label: 'Khong co loi' };
  }

  const normalized = error.toLowerCase();
  if (normalized.includes('invalid outbox payload') || normalized.includes('payload')) {
    return { category: 'invalid_payload', label: 'Payload sai dinh dang' };
  }
  if (normalized.includes('account') || normalized.includes('coa') || normalized.includes('tai khoan')) {
    return { category: 'missing_account', label: 'Thieu tai khoan ke toan' };
  }
  if (normalized.includes('template')) {
    return { category: 'missing_template', label: 'Thieu mau hach toan' };
  }
  if (normalized.includes('stale') || normalized.includes('no longer') || normalized.includes('not completed')) {
    return { category: 'stale_reference', label: 'Nguon nghiep vu da doi' };
  }
  if (normalized.includes('permission denied') || normalized.includes('unauthorized') || normalized.includes('rls')) {
    return { category: 'permission', label: 'Loi quyen truy cap' };
  }
  if (normalized.includes('existing active journal') || normalized.includes('duplicate')) {
    return { category: 'duplicate_journal', label: 'Co but toan active trung' };
  }
  if (normalized.includes('mark outbox') || normalized.includes('completed-state') || normalized.includes('failed-state')) {
    return { category: 'worker_state', label: 'Loi cap nhat trang thai worker' };
  }

  return { category: 'unknown', label: 'Can kiem tra thu cong' };
}

export function getOutboxAgeMinutes(createdAt: string, now = new Date()) {
  const createdTime = new Date(createdAt).getTime();
  if (!Number.isFinite(createdTime)) return 0;
  return Math.max(0, Math.floor((now.getTime() - createdTime) / 60000));
}

export function isAccountingOutboxStale(row: OutboxTimingRow, now = new Date()) {
  const ageMinutes = getOutboxAgeMinutes(row.created_at, now);

  if (row.status === 'PENDING') {
    return ageMinutes >= STALE_PENDING_MINUTES;
  }
  if (row.status === 'PROCESSING') {
    return ageMinutes >= STALE_PROCESSING_MINUTES;
  }
  if (row.status === 'FAILED' && row.next_retry_at) {
    const retryDueAt = new Date(row.next_retry_at).getTime();
    return Number.isFinite(retryDueAt)
      && now.getTime() - retryDueAt >= STALE_FAILED_GRACE_MINUTES * 60000;
  }
  if (row.status === 'FAILED' && row.retry_count >= row.max_retries) {
    return true;
  }

  return false;
}

export function getOutboxReplayDiagnostics(status: string): {
  state: AccountingOutboxReplayState;
  reason: string;
} {
  if (status === 'FAILED' || status === 'DEAD') {
    return { state: 'ready', reason: 'San sang chay lai sau khi da kiem tra loi.' };
  }
  if (status === 'COMPLETED') {
    return { state: 'not_needed', reason: 'Da hoan tat, khong can replay.' };
  }
  if (status === 'PROCESSING') {
    return { state: 'blocked', reason: 'Worker dang xu ly, khong replay de tranh tranh chap.' };
  }
  if (status === 'PENDING') {
    return { state: 'blocked', reason: 'Dang cho worker xu ly, khong can reset.' };
  }

  return { state: 'blocked', reason: 'Trang thai khong hop le de replay.' };
}
