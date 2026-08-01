'use server';

/**
 * @module modules/real_estate/actions/hrActions
 *
 * Server Actions wrapping HR Capability for Real Estate module UI.
 *
 * Architectural rules:
 * - Uses HR Capability (Layer 2) via SupabaseHRQueryService — never raw DB
 * - createServerClient for proper RLS context (not service role)
 * - All DB errors are re-thrown — Rule #1: Zero Silent Database Failures
 *
 * @layer Module (Layer 3) — allowed to import from Capabilities
 */

import { createClient } from '@/lib/supabase-server';
import { SupabaseHRQueryService } from '@/capabilities/hr/SupabaseHRQueryService';
import type {
  HREmployeeSummaryRow,
  HREmployeeProfileView,
  HRContract,
  HRDepartment,
} from '@/capabilities/hr/contracts';

// ─── Helper: build HR service with server cookies ────────────────────────────

function buildHRService(): SupabaseHRQueryService {
  const db = createClient();
  return new SupabaseHRQueryService(db);
}

// ─── Action: List Active Employees ───────────────────────────────────────────

export async function listActiveEmployeesAction(params: {
  tenantId: string;
}): Promise<{ success: true; employees: HREmployeeSummaryRow[] } | { success: false; error: string }> {
  try {
    const service = buildHRService();
    const employees = await service.listActiveEmployees(params.tenantId);
    return { success: true, employees };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[hrActions.listActiveEmployees] Error: %s', msg);
    return { success: false, error: msg };
  }
}

// ─── Action: Get Employee Profile ─────────────────────────────────────────────

export async function getEmployeeProfileAction(params: {
  personId: string;
  tenantId: string;
}): Promise<{ success: true; profile: HREmployeeProfileView } | { success: false; error: string }> {
  try {
    const service = buildHRService();
    const profile = await service.getEmployeeProfile(params.personId, params.tenantId);
    if (!profile) {
      return { success: false, error: `Employee profile not found for person ${params.personId}` };
    }
    return { success: true, profile };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[hrActions.getEmployeeProfile] Error: %s', msg);
    return { success: false, error: msg };
  }
}

// ─── Action: Get Employee Contracts ──────────────────────────────────────────

export async function getEmployeeContractsAction(params: {
  personId: string;
  tenantId: string;
}): Promise<{ success: true; contracts: HRContract[] } | { success: false; error: string }> {
  try {
    const service = buildHRService();
    const contracts = await service.getEmployeeContracts(params.personId, params.tenantId);
    return { success: true, contracts };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[hrActions.getEmployeeContracts] Error: %s', msg);
    return { success: false, error: msg };
  }
}

// ─── Action: Get Active Contract ──────────────────────────────────────────────

export async function getActiveContractAction(params: {
  personId: string;
  tenantId: string;
}): Promise<{ success: true; contract: HRContract | null } | { success: false; error: string }> {
  try {
    const service = buildHRService();
    const contract = await service.getActiveContract(params.personId, params.tenantId);
    return { success: true, contract };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[hrActions.getActiveContract] Error: %s', msg);
    return { success: false, error: msg };
  }
}

// ─── Action: List Departments ─────────────────────────────────────────────────

export async function listDepartmentsAction(params: {
  tenantId: string;
}): Promise<{ success: true; departments: HRDepartment[] } | { success: false; error: string }> {
  try {
    const service = buildHRService();
    const departments = await service.listDepartments(params.tenantId);
    return { success: true, departments };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[hrActions.listDepartments] Error: %s', msg);
    return { success: false, error: msg };
  }
}
