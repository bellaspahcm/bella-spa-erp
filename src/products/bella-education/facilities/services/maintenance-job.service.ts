/**
 * Bella Preschool OS — Maintenance Job Lifecycle Service
 * File: src/products/bella-education/facilities/services/maintenance-job.service.ts
 *
 * Manages Maintenance Job progression: SUBMITTED → IN_PROGRESS → COMPLETED → VERIFIED.
 *
 * SUPREME SAFETY LAW:
 * Job verification (VERIFIED) confirms technician labor was verified, BUT DOES NOT RESTORE
 * asset or zone operational status. Operational status strictly remains OUT_OF_SERVICE until
 * an independent P9 safety re-inspection yields PASS!
 */

import { PreschoolFacilitiesRepository } from '../repositories/preschool-facilities.repository';
import { 
  MaintenanceJob, 
  JobPriority, 
  JobStatus 
} from '../domain/facilities.types';

export class MaintenanceJobService {
  constructor(private readonly repo: PreschoolFacilitiesRepository) {}

  async createJob(params: {
    tenantId: string;
    zoneId: string;
    assetId?: string;
    title: string;
    priority: JobPriority;
    reportedByPartyId: string;
  }): Promise<MaintenanceJob> {
    const { data, error } = await (this.repo as any).supabase
      .from('edu_fac_maintenance_jobs')
      .insert({
        tenant_id: params.tenantId,
        zone_id: params.zoneId,
        asset_id: params.assetId,
        title: params.title,
        priority: params.priority,
        status: 'SUBMITTED',
        reported_by_party_id: params.reportedByPartyId,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to create maintenance job: ${error?.message}`);
    }

    return this.mapJob(data);
  }

  async assignTechnician(tenantId: string, jobId: string, technicianPartyId: string): Promise<MaintenanceJob> {
    const { data, error } = await (this.repo as any).supabase
      .from('edu_fac_maintenance_jobs')
      .update({
        assigned_technician_party_id: technicianPartyId,
        status: 'IN_PROGRESS',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', jobId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to assign technician to maintenance job: ${error?.message}`);
    }

    return this.mapJob(data);
  }

  async completeJob(tenantId: string, jobId: string, completionNotes: string): Promise<MaintenanceJob> {
    const { data, error } = await (this.repo as any).supabase
      .from('edu_fac_maintenance_jobs')
      .update({
        completion_notes: completionNotes,
        status: 'COMPLETED',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', jobId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to complete maintenance job: ${error?.message}`);
    }

    return this.mapJob(data);
  }

  /**
   * Verifies maintenance job completion by a manager.
   * NOTE: This marks the job as VERIFIED, but DOES NOT alter asset/zone operational status!
   */
  async verifyJob(tenantId: string, jobId: string, verifiedByPartyId: string): Promise<MaintenanceJob> {
    const { data, error } = await (this.repo as any).supabase
      .from('edu_fac_maintenance_jobs')
      .update({
        verified_by_party_id: verifiedByPartyId,
        status: 'VERIFIED',
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('id', jobId)
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to verify maintenance job: ${error?.message}`);
    }

    return this.mapJob(data);
  }

  async getJob(tenantId: string, jobId: string): Promise<MaintenanceJob | null> {
    const { data } = await (this.repo as any).supabase
      .from('edu_fac_maintenance_jobs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', jobId)
      .maybeSingle();

    return data ? this.mapJob(data) : null;
  }

  private mapJob(d: any): MaintenanceJob {
    return {
      id: d.id,
      tenantId: d.tenant_id,
      zoneId: d.zone_id,
      assetId: d.asset_id,
      title: d.title,
      priority: d.priority,
      status: d.status,
      reportedByPartyId: d.reported_by_party_id,
      assignedTechnicianPartyId: d.assigned_technician_party_id,
      completionNotes: d.completion_notes,
      verifiedByPartyId: d.verified_by_party_id,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    };
  }
}
