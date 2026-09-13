export interface EnglishCenterTeacher {
  readonly id: string;
  readonly tenantId: string;
  readonly partyId: string;
  readonly employeeCode: string | null;
  readonly certifications: Record<string, unknown>[];
  readonly specializations: string[] | null;
  readonly languages: string[] | null;
  readonly status: 'active' | 'inactive' | 'on_leave';
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateTeacherInput {
  readonly partyId: string;
  readonly employeeCode?: string;
  readonly certifications?: Record<string, unknown>[];
  readonly specializations?: string[];
  readonly languages?: string[];
  readonly metadata?: Record<string, unknown>;
}

export interface UpdateTeacherInput {
  readonly employeeCode?: string;
  readonly certifications?: Record<string, unknown>[];
  readonly specializations?: string[];
  readonly languages?: string[];
  readonly status?: 'active' | 'inactive' | 'on_leave';
  readonly metadata?: Record<string, unknown>;
}

export interface TeacherBranchAssignment {
  readonly id: string;
  readonly tenantId: string;
  readonly teacherId: string;
  readonly branchId: string;
  readonly isPrimary: boolean;
  readonly status: 'active' | 'inactive';
  readonly assignedAt: string;
  readonly createdAt: string;
}

export interface TeacherRow {
  id: string;
  tenant_id: string;
  party_id: string;
  employee_code: string | null;
  certifications: Record<string, unknown>[];
  specializations: string[] | null;
  languages: string[] | null;
  status: 'active' | 'inactive' | 'on_leave';
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TeacherBranchRow {
  id: string;
  tenant_id: string;
  teacher_id: string;
  branch_id: string;
  is_primary: boolean;
  status: 'active' | 'inactive';
  assigned_at: string;
  created_at: string;
}
