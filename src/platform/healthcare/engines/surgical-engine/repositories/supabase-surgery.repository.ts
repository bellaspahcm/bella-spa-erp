/**
 * SupabaseSurgeryRepository Implementation
 * 
 * Extends BaseSupabaseRepositoryPrimitive for database error mapping.
 * Enforces database-level exclusion constraint error mappings (Postgres 23P01).
 * Encapsulates multi-table persistence (hc_surgical_cases + hc_surgical_safety_checklists)
 * behind a unified domain aggregate root boundary.
 * 
 * @module platform/healthcare/engines/surgical-engine/repositories/supabase-surgery.repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BaseSupabaseRepositoryPrimitive } from '../../../../core/repository/base-supabase-repository.primitive';
import { SurgicalCase, SurgicalCaseStatus } from '../domain/surgical-case.entity';
import { ISurgeryRepository } from './surgery-repository.interface';

export class SurgicalResourceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SurgicalResourceConflictError';
  }
}

export class SupabaseSurgeryRepository extends BaseSupabaseRepositoryPrimitive implements ISurgeryRepository {
  constructor(private readonly supabase: SupabaseClient<Record<string, unknown>>) {
    super();
  }

  public async save(sCase: SurgicalCase): Promise<SurgicalCase> {
    const snap = sCase.toJSON();
    let dbStatus: string = snap.status;
    if (snap.status === 'PREOP_READY' || snap.status === 'ANESTHETIZED') {
      dbStatus = 'ready';
    } else if (snap.status === 'PROCEDURE_IN_PROGRESS' || snap.status === 'RECOVERY_PACU') {
      dbStatus = 'in_progress';
    } else if (snap.status === 'POSTOP_COMPLETED') {
      dbStatus = 'completed';
    } else {
      dbStatus = snap.status.toLowerCase();
    }

    const dbRow = {
      id: snap.id,
      tenant_id: snap.tenantId,
      encounter_id: snap.encounterId,
      patient_id: snap.patientId,
      or_id: snap.orId,
      surgeon_id: snap.surgeonId,
      status: dbStatus,
      scheduled_start: snap.scheduledStart.toISOString(),
      scheduled_end: snap.scheduledEnd.toISOString(),
      preop_checklist_completed: snap.preopChecklistCompleted,
      anesthesia_consent_signed: snap.anesthesiaConsentSigned,
      cssd_token_id: snap.cssdTokenId,
      cssd_verified_at: snap.cssdVerifiedAt ? snap.cssdVerifiedAt.toISOString() : null,
      version: snap.version,
      updated_at: new Date().toISOString(),
    };

    let persistedRow: Record<string, unknown>;

    const { data: existing } = await this.supabase
      .from('hc_surgical_cases')
      .select('id')
      .eq('id', snap.id)
      .maybeSingle();



    if (existing) {
      const { data, error } = await this.supabase
        .from('hc_surgical_cases')
        .update(dbRow)
        .eq('id', snap.id)
        .eq('tenant_id', snap.tenantId)
        .select()
        .maybeSingle();

      if (error) {
        this.handleError(error);
      }
      if (!data) {
        throw new Error(`Failed to update surgical case`);
      }
      persistedRow = data;
    } else {
      // Insert new scheduled case
      const { data, error } = await this.supabase
        .from('hc_surgical_cases')
        .insert({
          ...dbRow,
          created_at: snap.createdAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        this.handleError(error);
      }

      if (!data) {
        throw new Error('Surgical case was not persisted');
      }
      persistedRow = data;
    }

    // Persist safety checklist table for backwards compatibility and queries
    const { data: existingChecklist } = await this.supabase
      .from('hc_surgical_safety_checklists')
      .select('*')
      .eq('tenant_id', snap.tenantId)
      .eq('surgical_case_id', snap.id)
      .maybeSingle();



    const checklistRow = {
      tenant_id: snap.tenantId,
      surgical_case_id: snap.id,
      signin_completed: snap.signinCompleted,
      signin_completed_at: snap.signinCompletedAt ? snap.signinCompletedAt.toISOString() : null,
      signin_completed_by: snap.signinCompletedBy,
      timeout_completed: snap.timeoutCompleted,
      timeout_completed_at: snap.timeoutCompletedAt ? snap.timeoutCompletedAt.toISOString() : null,
      timeout_completed_by: snap.timeoutCompletedBy,
      signout_completed: snap.signoutCompleted,
      signout_completed_at: snap.signoutCompletedAt ? snap.signoutCompletedAt.toISOString() : null,
      signout_completed_by: snap.signoutCompletedBy,
      updated_at: new Date().toISOString(),
    };

    if (existingChecklist) {

      await this.supabase
        .from('hc_surgical_safety_checklists')
        .update(checklistRow)
        .eq('tenant_id', snap.tenantId)
        .eq('surgical_case_id', snap.id);
    } else {

      await this.supabase
        .from('hc_surgical_safety_checklists')
        .insert({
          ...checklistRow,
          created_at: new Date().toISOString(),
        });
    }

    return this.mapToEntity(persistedRow, {
      ...checklistRow,
      id: existingChecklist?.id || `chk-${snap.id}`,
    });
  }

  public async findById(tenantId: string, id: string): Promise<SurgicalCase | null> {
    const { data: caseData, error: caseError } = await this.supabase
      .from('hc_surgical_cases')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', id)
      .maybeSingle();

    if (caseError || !caseData) return null;

    const { data: checklistData } = await this.supabase
      .from('hc_surgical_safety_checklists')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('surgical_case_id', id)
      .maybeSingle();



    return this.mapToEntity(caseData, checklistData || undefined);
  }

  public async findByEncounterId(tenantId: string, encounterId: string): Promise<SurgicalCase | null> {
    const { data: caseData, error: caseError } = await this.supabase
      .from('hc_surgical_cases')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('encounter_id', encounterId)
      .maybeSingle();

    if (caseError || !caseData) return null;

    const { data: checklistData } = await this.supabase
      .from('hc_surgical_safety_checklists')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('surgical_case_id', caseData.id)
      .maybeSingle();

    return this.mapToEntity(caseData, checklistData || undefined);
  }

  public async checkOverlap(
    tenantId: string,
    orId: string,
    surgeonId: string,
    start: Date,
    end: Date,
    excludeCaseId?: string
  ): Promise<{ orOverlaps: boolean; surgeonOverlaps: boolean }> {
    let query = this.supabase
      .from('hc_surgical_cases')
      .select('id, or_id, surgeon_id')
      .eq('tenant_id', tenantId)
      .in('status', ['SCHEDULED', 'PREOP_READY', 'ANESTHETIZED', 'PROCEDURE_IN_PROGRESS', 'RECOVERY_PACU'])
      .lt('scheduled_start', end.toISOString())
      .gt('scheduled_end', start.toISOString());

    if (excludeCaseId) {
      query = query.neq('id', excludeCaseId);
    }

    const { data, error } = await query;
    if (error || !data) {
      return { orOverlaps: false, surgeonOverlaps: false };
    }

    const orOverlaps = data.some(r => r.or_id === orId);
    const surgeonOverlaps = data.some(r => r.surgeon_id === surgeonId);

    return { orOverlaps, surgeonOverlaps };
  }

  private handleError(error: Record<string, unknown>): never {
    const code = String(error.code || '');
    const message = String(error.message || '');

    if (code === '23P01') {
      if (message.includes('exclude_or_overlap')) {
        throw new SurgicalResourceConflictError(`Operating Room overlap: OR is already occupied during this time range`);
      }
      if (message.includes('exclude_surgeon_overlap')) {
        throw new SurgicalResourceConflictError(`Surgeon overlap: Surgeon is already scheduled for another surgery during this time range`);
      }
      throw new SurgicalResourceConflictError(`Scheduling overlap conflict: ${message}`);
    }

    throw this.mapDatabaseError(error, 'Surgical repository error');
  }

  private mapToEntity(caseRow: Record<string, unknown>, checklistRow?: Record<string, unknown>): SurgicalCase {
    const dbStatus = String(caseRow.status || '');
    let status: SurgicalCaseStatus = 'SCHEDULED';

    if (['SCHEDULED', 'PREOP_READY', 'ANESTHETIZED', 'PROCEDURE_IN_PROGRESS', 'RECOVERY_PACU', 'POSTOP_COMPLETED'].includes(dbStatus)) {
      status = dbStatus as SurgicalCaseStatus;
    } else {
      const lower = dbStatus.toLowerCase();
      if (lower === 'scheduled' || lower === 'planned') {
        status = 'SCHEDULED';
      } else if (lower === 'ready') {
        status = Boolean(caseRow.anesthesia_consent_signed) ? 'ANESTHETIZED' : 'PREOP_READY';
      } else if (lower === 'in_progress') {
        status = 'PROCEDURE_IN_PROGRESS';
      } else if (lower === 'completed') {
        status = 'POSTOP_COMPLETED';
      }
    }

    return SurgicalCase.reconstitute({
      id: String(caseRow.id || ''),
      tenantId: String(caseRow.tenant_id || ''),
      encounterId: String(caseRow.encounter_id || ''),
      patientId: String(caseRow.patient_id || ''),
      orId: String(caseRow.or_id || ''),
      surgeonId: String(caseRow.surgeon_id || ''),
      status,
      scheduledStart: caseRow.scheduled_start ? new Date(String(caseRow.scheduled_start)) : new Date(),
      scheduledEnd: caseRow.scheduled_end ? new Date(String(caseRow.scheduled_end)) : new Date(Date.now() + 3600 * 1000),
      preopChecklistCompleted: Boolean(caseRow.preop_checklist_completed),
      anesthesiaConsentSigned: Boolean(caseRow.anesthesia_consent_signed),
      cssdTokenId: caseRow.cssd_token_id ? String(caseRow.cssd_token_id) : null,
      cssdVerifiedAt: caseRow.cssd_verified_at ? new Date(String(caseRow.cssd_verified_at)) : null,
      
      signinCompleted: checklistRow ? Boolean(checklistRow.signin_completed) : false,
      signinCompletedAt: checklistRow?.signin_completed_at ? new Date(String(checklistRow.signin_completed_at)) : null,
      signinCompletedBy: checklistRow?.signin_completed_by ? String(checklistRow.signin_completed_by) : null,
      timeoutCompleted: checklistRow ? Boolean(checklistRow.timeout_completed) : false,
      timeoutCompletedAt: checklistRow?.timeout_completed_at ? new Date(String(checklistRow.timeout_completed_at)) : null,
      timeoutCompletedBy: checklistRow?.timeout_completed_by ? String(checklistRow.timeout_completed_by) : null,
      signoutCompleted: checklistRow ? Boolean(checklistRow.signout_completed) : false,
      signoutCompletedAt: checklistRow?.signout_completed_at ? new Date(String(checklistRow.signout_completed_at)) : null,
      signoutCompletedBy: checklistRow?.signout_completed_by ? String(checklistRow.signout_completed_by) : null,

      version: Number(caseRow.version) || 1,
      createdAt: caseRow.created_at ? new Date(String(caseRow.created_at)) : new Date(),
      updatedAt: caseRow.updated_at ? new Date(String(caseRow.updated_at)) : new Date(),
    });
  }
}
