// Test Case 3: Product using Platform contract (part of coupled change)
import { BranchTestContract, validateBranchContract } from '@/platform/org-unit/test-contract';

export function createTestBranch(data: BranchTestContract) {
  if (!validateBranchContract(data)) {
    throw new Error('Invalid branch data');
  }
  
  return {
    ...data,
    createdAt: new Date().toISOString()
  };
}
