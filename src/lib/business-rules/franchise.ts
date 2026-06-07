export type RoyaltyType = 'fixed' | 'percentage';
export type InterBranchClearingRole = 'debtor' | 'creditor';

export type ClearingRecordLike = {
  id?: string | null;
  clearing_number: string;
  month_year: string;
  session_count: number | string | null;
  clearing_rate: number | string | null;
  calculated_amount: number | string | null;
};

function toFiniteNumber(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export function resolveRoyaltyType(value: string | null | undefined): RoyaltyType {
  return value === 'fixed' ? 'fixed' : 'percentage';
}

export function calculateRoyaltyAmount(input: {
  grossRevenue: number | string | null | undefined;
  royaltyType?: string | null;
  royaltyRate?: number | string | null;
  royaltyFixedAmount?: number | string | null;
}) {
  const royaltyType = resolveRoyaltyType(input.royaltyType);
  if (royaltyType === 'fixed') {
    return Math.max(0, toFiniteNumber(input.royaltyFixedAmount));
  }

  const grossRevenue = Math.max(0, toFiniteNumber(input.grossRevenue));
  const royaltyRate = Math.max(0, toFiniteNumber(input.royaltyRate));
  return (grossRevenue * royaltyRate) / 100;
}

export function calculateInterBranchClearingAmount(input: {
  sessionCount: number | string | null | undefined;
  clearingRate: number | string | null | undefined;
}) {
  return Math.max(0, toFiniteNumber(input.sessionCount)) * Math.max(0, toFiniteNumber(input.clearingRate));
}

export function getClearingAmount(record: Pick<ClearingRecordLike, 'calculated_amount'>) {
  return Math.max(0, toFiniteNumber(record.calculated_amount));
}

export function isValidClearingAmount(record: Pick<ClearingRecordLike, 'calculated_amount'>) {
  return getClearingAmount(record) > 0;
}

export function buildBranchAbbreviation(name: string | null | undefined, fallback: string) {
  const source = name?.trim() || fallback;
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 5);
}

export function buildInterBranchClearingAccountingPayload(input: {
  record: ClearingRecordLike;
  debtorTenantId: string;
  creditorTenantId: string;
  paymentMethod: string;
  role: InterBranchClearingRole;
}) {
  const amount = getClearingAmount(input.record);
  return {
    amount,
    paymentMethod: input.paymentMethod,
    role: input.role,
    debtorTenantId: input.debtorTenantId,
    creditorTenantId: input.creditorTenantId,
    debtor_tenant_id: input.debtorTenantId,
    creditor_tenant_id: input.creditorTenantId,
    clearingNumber: input.record.clearing_number,
    monthYear: input.record.month_year,
    sessionCount: toFiniteNumber(input.record.session_count),
    clearingRate: toFiniteNumber(input.record.clearing_rate),
    description: `Bù trừ liên chi nhánh ${input.record.clearing_number} (${input.record.month_year})`,
  };
}
