// Test Case 3: Platform contract (part of coupled change)
export interface BranchTestContract {
  id: string;
  name: string;
  branchCode: string;
}

export function validateBranchContract(data: BranchTestContract): boolean {
  return !!(data.id && data.name && data.branchCode);
}
