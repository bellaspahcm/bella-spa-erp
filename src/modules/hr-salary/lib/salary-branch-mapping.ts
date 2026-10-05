export const PAYROLL_BRANCH_MAPPING_ERRORS = {
  BRANCH_NOT_PROVEN: 'PAYROLL_BRANCH_MAPPING_NOT_PROVEN',
  BRANCH_CONTEXT_MISMATCH: 'PAYROLL_BRANCH_CONTEXT_MISMATCH',
  MULTI_BRANCH_PERIOD_NOT_SUPPORTED: 'PAYROLL_MULTI_BRANCH_PERIOD_NOT_SUPPORTED',
} as const;

export const COMMISSION_BRANCH_MAPPING_ERRORS = {
  SOURCE_BRANCH_NOT_PROVEN: 'COMMISSION_SOURCE_BRANCH_NOT_PROVEN',
  SOURCE_BRANCH_CONTEXT_MISMATCH: 'COMMISSION_SOURCE_BRANCH_CONTEXT_MISMATCH',
  MULTI_BRANCH_SOURCE_NOT_SUPPORTED: 'COMMISSION_MULTI_BRANCH_SOURCE_NOT_SUPPORTED',
} as const;

export interface BranchMappedAttendanceRow {
  branch_id: string | null;
}

export interface CommissionSourceBranchRow {
  branch_id: string | null;
}

export function resolvePayrollBranchIdFromAttendance(
  attendanceRows: BranchMappedAttendanceRow[],
  expectedBranchId?: string,
) {
  const distinctBranchIds = new Set<string>();
  let hasNullBranch = false;

  for (const row of attendanceRows) {
    if (!row.branch_id) {
      hasNullBranch = true;
      continue;
    }
    distinctBranchIds.add(row.branch_id);
  }

  if (attendanceRows.length === 0 || hasNullBranch || distinctBranchIds.size === 0) {
    throw new Error(`${PAYROLL_BRANCH_MAPPING_ERRORS.BRANCH_NOT_PROVEN}: Payroll V1 requires branch-aware attendance rows.`);
  }

  if (distinctBranchIds.size > 1) {
    throw new Error(`${PAYROLL_BRANCH_MAPPING_ERRORS.MULTI_BRANCH_PERIOD_NOT_SUPPORTED}: Payroll V1 supports exactly one branch per KTV payroll period.`);
  }

  const [branchId] = Array.from(distinctBranchIds);
  if (expectedBranchId && expectedBranchId !== branchId) {
    throw new Error(`${PAYROLL_BRANCH_MAPPING_ERRORS.BRANCH_CONTEXT_MISMATCH}: Payroll branch context does not match attendance branch.`);
  }

  return branchId;
}

export function assertCommissionSourceBranchesMatchPayroll(
  sourceRows: CommissionSourceBranchRow[],
  payrollBranchId: string,
) {
  if (sourceRows.length === 0) {
    return null;
  }

  const distinctBranchIds = new Set<string>();
  let hasNullBranch = false;

  for (const row of sourceRows) {
    if (!row.branch_id) {
      hasNullBranch = true;
      continue;
    }
    distinctBranchIds.add(row.branch_id);
  }

  if (hasNullBranch || distinctBranchIds.size === 0) {
    throw new Error(`${COMMISSION_BRANCH_MAPPING_ERRORS.SOURCE_BRANCH_NOT_PROVEN}: Commission V1 requires branch-aware source rows.`);
  }

  if (distinctBranchIds.size > 1) {
    throw new Error(`${COMMISSION_BRANCH_MAPPING_ERRORS.MULTI_BRANCH_SOURCE_NOT_SUPPORTED}: Commission V1 supports exactly one source branch per KTV payroll period.`);
  }

  const [sourceBranchId] = Array.from(distinctBranchIds);
  if (sourceBranchId !== payrollBranchId) {
    throw new Error(`${COMMISSION_BRANCH_MAPPING_ERRORS.SOURCE_BRANCH_CONTEXT_MISMATCH}: Commission source branch does not match payroll branch.`);
  }

  return sourceBranchId;
}
