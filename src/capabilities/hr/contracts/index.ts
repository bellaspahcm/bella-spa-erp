/**
 * @module capabilities/hr/contracts
 *
 * HR Capability TypeScript contracts — Layer 2.
 *
 * Design principles:
 * - HR Capability MUST NEVER import from Foundation.people directly to get display names.
 *   Instead, it uses `personId` and resolves display names via PeopleQueryService.
 * - EmployeeProfile is purely "employment context" — not "who exists" (that's Foundation).
 * - Contracts are immutable snapshots: once 'active', financial terms don't change on contract.
 *   Changes require an Amendment contract.
 *
 * @layer Capability (Layer 2) — depends on Foundation; never imports from Modules.
 * @see src/foundation/contracts/people.ts for PersonProfile and AssignableReference
 */

// ─── Employment Classification ───────────────────────────────────────────────

export type EmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'probation'
  | 'intern'
  | 'freelance';

export type EmploymentStatus =
  | 'active'
  | 'on_leave'
  | 'probation'
  | 'suspended'
  | 'terminated'
  | 'resigned';

export type WorkSchedule =
  | 'mon_fri'
  | 'mon_sat'
  | 'shift'
  | 'flexible';

// ─── Contract Classification ──────────────────────────────────────────────────

export type ContractType =
  | 'probation'
  | 'fixed_term_1y'
  | 'fixed_term_3y'
  | 'indefinite'
  | 'freelance'
  | 'service_contract'
  | 'amendment'
  | 'termination';

export type ContractStatus =
  | 'draft'
  | 'pending'
  | 'active'
  | 'expired'
  | 'terminated'
  | 'superseded';

// ─── Department ───────────────────────────────────────────────────────────────

/**
 * HR Department — administrative grouping for payroll, leave, headcount.
 * NOT the same as org_units (Foundation structural graph).
 */
export interface HRDepartment {
  id: string;
  tenantId: string;
  name: string;
  code?: string;
  description?: string;
  /** Optional link to Foundation org_unit for cross-reference */
  orgUnitId?: string;
  /** Person ID of department head — resolved via PeopleQueryService */
  headPersonId?: string;
  /** Display name cached for UI — always re-fetch from PeopleQueryService */
  headDisplayName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Employee Profile ─────────────────────────────────────────────────────────

/**
 * Employment context for a person in people_directory.
 * Contains ONLY HR-specific fields — never duplicates display_name (use personId + PeopleQueryService).
 *
 * Example: Two employees can share the same display_name (common in VN — e.g. Nguyễn Văn A).
 * The system distinguishes them by personId, never by display_name.
 */
export interface HREmployeeProfile {
  id: string;
  tenantId: string;

  /** Stable identity anchor — resolves to people_directory.id */
  personId: string;

  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;

  positionTitle?: string;
  grade?: string;
  salaryBand?: string;

  departmentId?: string;
  /** Resolved by joining with hr_departments — not persisted */
  departmentName?: string;

  /** Manager's person ID — resolves via PeopleQueryService */
  managerPersonId?: string;
  /** Resolved display name for UI — not persisted */
  managerDisplayName?: string;

  hireDate?: string;       // ISO date
  probationEnd?: string;   // ISO date
  confirmationDate?: string;
  terminationDate?: string;

  /** Base salary at current grade/position */
  baseSalary?: number;
  currency: string;

  bhxhNumber?: string;
  taxCode?: string;
  bankAccount?: string;
  bankName?: string;

  workSchedule?: WorkSchedule;

  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Enriched view: HREmployeeProfile + display name from people_directory.
 * Only used in UI components — never persisted or sent to engines.
 */
export interface HREmployeeProfileView extends HREmployeeProfile {
  /** From people_directory.display_name (resolved live) */
  displayName: string;
  personType: string;
  /** From people_profiles.email */
  email?: string;
  phone?: string;
  avatarUrl?: string;
}

// ─── Employment Contract ──────────────────────────────────────────────────────

export interface ContractAllowances {
  transport?: number;
  lunch?: number;
  phone?: number;
  housing?: number;
  responsibility?: number;
  [key: string]: number | undefined;
}

export interface HRContract {
  id: string;
  tenantId: string;
  profileId: string;

  contractType: ContractType;
  contractNumber?: string;
  contractTitle?: string;

  startDate: string;   // ISO date
  endDate?: string;    // ISO date — null for indefinite

  agreedBaseSalary?: number;
  agreedAllowances: ContractAllowances;

  status: ContractStatus;
  documentUrl?: string;

  signedByEmployee: boolean;
  signedByCompany: boolean;
  signedAt?: string;

  notes?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── HR Summary (from RPC) ────────────────────────────────────────────────────

/** Lightweight row returned by get_hr_employee_summary RPC */
export interface HREmployeeSummaryRow {
  personId: string;
  displayName: string;
  personType: string;
  positionTitle?: string;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  departmentName?: string;
  hireDate?: string;
  baseSalary?: number;
}

// ─── HR Service Interface ─────────────────────────────────────────────────────

/**
 * HRQueryService — read-only interface for HR data.
 * Mutations go through separate HRMutationService (not implemented yet).
 *
 * @note This interface lives in contracts; implementations live in capabilities/hr/
 */
export interface HRQueryService {
  /**
   * List all active employees with their HR profiles.
   * Uses get_hr_employee_summary RPC.
   */
  listActiveEmployees(tenantId: string): Promise<HREmployeeSummaryRow[]>;

  /**
   * Get enriched profile for a specific employee.
   * Joins: people_directory + hr_employee_profiles + hr_departments + people_profiles
   */
  getEmployeeProfile(personId: string, tenantId: string): Promise<HREmployeeProfileView | null>;

  /**
   * Get all contracts for an employee.
   */
  getEmployeeContracts(personId: string, tenantId: string): Promise<HRContract[]>;

  /**
   * Get the currently active contract for an employee.
   * Returns null if no active contract exists.
   */
  getActiveContract(personId: string, tenantId: string): Promise<HRContract | null>;

  /**
   * List all HR departments.
   */
  listDepartments(tenantId: string): Promise<HRDepartment[]>;

  /**
   * Check if a person is currently on leave (HR leave — not the same as staff_leaves for KTV).
   * Used by Assignment Capability to filter eligible assignees.
   */
  isOnLeave(personId: string, tenantId: string): Promise<boolean>;
}
