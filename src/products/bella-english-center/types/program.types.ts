/**
 * E3 — English Center Program Types
 */

export interface EnglishCenterProgram {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string | null;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: 'active' | 'inactive';
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateProgramInput {
  readonly code: string;
  readonly name: string;
  readonly description?: string;
  readonly branchId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateProgramInput {
  readonly name?: string;
  readonly description?: string;
  readonly status?: 'active' | 'inactive';
  readonly metadata?: Record<string, unknown>;
}

export interface ProgramRow {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  code: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
