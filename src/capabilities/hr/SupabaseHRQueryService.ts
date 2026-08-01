/**
 * @module capabilities/hr/SupabaseHRQueryService
 *
 * Supabase implementation of HRQueryService.
 *
 * Architectural rules:
 * - NEVER import from src/modules/* or src/platform/*
 * - NEVER expose raw Supabase types to callers — always return typed contracts
 * - MUST re-throw DB errors (Rule #1: Zero Silent Database Failures)
 * - Joins people_directory for display_name — never stores it in HR tables
 *
 * @layer Capability (Layer 2)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  HREmployeeSummaryRow,
  HREmployeeProfileView,
  HRContract,
  HRDepartment,
  HRQueryService,
  EmploymentType,
  EmploymentStatus,
  ContractType,
  ContractStatus,
} from './contracts';

// ─── Supabase row types (raw, before mapping) ─────────────────────────────────

interface RawHRDeptRow {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  description: string | null;
  org_unit_id: string | null;
  head_person_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RawHRProfileRow {
  id: string;
  tenant_id: string;
  person_id: string;
  employment_type: string;
  employment_status: string;
  position_title: string | null;
  grade: string | null;
  salary_band: string | null;
  department_id: string | null;
  manager_person_id: string | null;
  hire_date: string | null;
  probation_end: string | null;
  confirmation_date: string | null;
  termination_date: string | null;
  base_salary: number | null;
  currency: string;
  bhxh_number: string | null;
  tax_code: string | null;
  bank_account: string | null;
  bank_name: string | null;
  work_schedule: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined fields
  people_directory?: { display_name: string; person_type: string } | null;
  people_profiles?: { email: string | null; phone: string | null; avatar_url: string | null } | null;
  hr_departments?: { name: string } | null;
  manager?: { display_name: string } | null;
}

interface RawHRContractRow {
  id: string;
  tenant_id: string;
  profile_id: string;
  contract_type: string;
  contract_number: string | null;
  contract_title: string | null;
  start_date: string;
  end_date: string | null;
  agreed_base_salary: number | null;
  agreed_allowances: Record<string, number>;
  status: string;
  document_url: string | null;
  signed_by_employee: boolean;
  signed_by_company: boolean;
  signed_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface RawSummaryRow {
  person_id: string;
  display_name: string;
  person_type: string;
  position_title: string | null;
  employment_type: string;
  employment_status: string;
  department_name: string | null;
  hire_date: string | null;
  base_salary: number | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapDept(row: RawHRDeptRow): HRDepartment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    code: row.code ?? undefined,
    description: row.description ?? undefined,
    orgUnitId: row.org_unit_id ?? undefined,
    headPersonId: row.head_person_id ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProfileView(row: RawHRProfileRow): HREmployeeProfileView {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    personId: row.person_id,
    employmentType: row.employment_type as EmploymentType,
    employmentStatus: row.employment_status as EmploymentStatus,
    positionTitle: row.position_title ?? undefined,
    grade: row.grade ?? undefined,
    salaryBand: row.salary_band ?? undefined,
    departmentId: row.department_id ?? undefined,
    departmentName: row.hr_departments?.name ?? undefined,
    managerPersonId: row.manager_person_id ?? undefined,
    managerDisplayName: row.manager?.display_name ?? undefined,
    hireDate: row.hire_date ?? undefined,
    probationEnd: row.probation_end ?? undefined,
    confirmationDate: row.confirmation_date ?? undefined,
    terminationDate: row.termination_date ?? undefined,
    baseSalary: row.base_salary ?? undefined,
    currency: row.currency,
    bhxhNumber: row.bhxh_number ?? undefined,
    taxCode: row.tax_code ?? undefined,
    bankAccount: row.bank_account ?? undefined,
    bankName: row.bank_name ?? undefined,
    workSchedule: (row.work_schedule as HREmployeeProfileView['workSchedule']) ?? undefined,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Enriched from joins
    displayName: row.people_directory?.display_name ?? '(Unknown)',
    personType: row.people_directory?.person_type ?? 'employee',
    email: row.people_profiles?.email ?? undefined,
    phone: row.people_profiles?.phone ?? undefined,
    avatarUrl: row.people_profiles?.avatar_url ?? undefined,
  };
}

function mapContract(row: RawHRContractRow): HRContract {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    profileId: row.profile_id,
    contractType: row.contract_type as ContractType,
    contractNumber: row.contract_number ?? undefined,
    contractTitle: row.contract_title ?? undefined,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    agreedBaseSalary: row.agreed_base_salary ?? undefined,
    agreedAllowances: row.agreed_allowances ?? {},
    status: row.status as ContractStatus,
    documentUrl: row.document_url ?? undefined,
    signedByEmployee: row.signed_by_employee,
    signedByCompany: row.signed_by_company,
    signedAt: row.signed_at ?? undefined,
    notes: row.notes ?? undefined,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSummary(row: RawSummaryRow): HREmployeeSummaryRow {
  return {
    personId: row.person_id,
    displayName: row.display_name,
    personType: row.person_type,
    positionTitle: row.position_title ?? undefined,
    employmentType: row.employment_type as EmploymentType,
    employmentStatus: row.employment_status as EmploymentStatus,
    departmentName: row.department_name ?? undefined,
    hireDate: row.hire_date ?? undefined,
    baseSalary: row.base_salary ?? undefined,
  };
}

// ─── Service Implementation ───────────────────────────────────────────────────

export class SupabaseHRQueryService implements HRQueryService {
  constructor(private readonly supabase: SupabaseClient) {}

  // ── listActiveEmployees ─────────────────────────────────────────────────────

  async listActiveEmployees(tenantId: string): Promise<HREmployeeSummaryRow[]> {
    const { data, error } = await this.supabase
      .rpc('get_hr_employee_summary', {
        p_tenant_id: tenantId,
        p_status: 'active',
      });

    if (error) {
      throw new Error(`[HRQueryService.listActiveEmployees] DB error: ${error.message}`);
    }

    return (data as RawSummaryRow[] ?? []).map(mapSummary);
  }

  // ── getEmployeeProfile ──────────────────────────────────────────────────────

  async getEmployeeProfile(personId: string, tenantId: string): Promise<HREmployeeProfileView | null> {
    const { data, error } = await this.supabase
      .from('hr_employee_profiles')
      .select(`
        *,
        people_directory!inner (display_name, person_type),
        people_profiles (email, phone, avatar_url),
        hr_departments (name),
        manager:people_directory!hr_employee_profiles_manager_person_id_fkey (display_name)
      `)
      .eq('person_id', personId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`[HRQueryService.getEmployeeProfile] DB error: ${error.message}`);
    }

    return mapProfileView(data as RawHRProfileRow);
  }

  // ── getEmployeeContracts ────────────────────────────────────────────────────

  async getEmployeeContracts(personId: string, tenantId: string): Promise<HRContract[]> {
    // First resolve profile_id from person_id
    const { data: profile, error: profileErr } = await this.supabase
      .from('hr_employee_profiles')
      .select('id')
      .eq('person_id', personId)
      .eq('tenant_id', tenantId)
      .single();

    if (profileErr) {
      if (profileErr.code === 'PGRST116') return [];
      throw new Error(`[HRQueryService.getEmployeeContracts] Profile lookup error: ${profileErr.message}`);
    }

    const { data: contracts, error: contractErr } = await this.supabase
      .from('hr_contracts')
      .select('*')
      .eq('profile_id', profile.id)
      .eq('tenant_id', tenantId)
      .order('start_date', { ascending: false });

    if (contractErr) {
      throw new Error(`[HRQueryService.getEmployeeContracts] DB error: ${contractErr.message}`);
    }

    return (contracts as RawHRContractRow[] ?? []).map(mapContract);
  }

  // ── getActiveContract ───────────────────────────────────────────────────────

  async getActiveContract(personId: string, tenantId: string): Promise<HRContract | null> {
    const contracts = await this.getEmployeeContracts(personId, tenantId);
    return contracts.find(c => c.status === 'active') ?? null;
  }

  // ── listDepartments ─────────────────────────────────────────────────────────

  async listDepartments(tenantId: string): Promise<HRDepartment[]> {
    const { data, error } = await this.supabase
      .from('hr_departments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name');

    if (error) {
      throw new Error(`[HRQueryService.listDepartments] DB error: ${error.message}`);
    }

    return (data as RawHRDeptRow[] ?? []).map(mapDept);
  }

  // ── isOnLeave ───────────────────────────────────────────────────────────────

  async isOnLeave(personId: string, tenantId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('hr_employee_profiles')
      .select('employment_status')
      .eq('person_id', personId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return false; // No HR profile = not on leave
      throw new Error(`[HRQueryService.isOnLeave] DB error: ${error.message}`);
    }

    return data?.employment_status === 'on_leave' || data?.employment_status === 'suspended';
  }
}
