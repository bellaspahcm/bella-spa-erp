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
    return this.repo.createMaintenanceJob(params);
  }

  async assignTechnician(tenantId: string, jobId: string, technicianPartyId: string): Promise<MaintenanceJob> {
    return this.repo.assignMaintenanceTechnician(tenantId, jobId, technicianPartyId);
  }

  async completeJob(tenantId: string, jobId: string, completionNotes: string): Promise<MaintenanceJob> {
    return this.repo.completeMaintenanceJob(tenantId, jobId, completionNotes);
  }

  /**
   * Verifies maintenance job completion by a manager.
   * NOTE: This marks the job as VERIFIED, but DOES NOT alter asset/zone operational status!
   */
  async verifyJob(tenantId: string, jobId: string, verifiedByPartyId: string): Promise<MaintenanceJob> {
    return this.repo.verifyMaintenanceJob(tenantId, jobId, verifiedByPartyId);
  }

  async getJob(tenantId: string, jobId: string): Promise<MaintenanceJob | null> {
    return this.repo.getMaintenanceJob(tenantId, jobId);
  }
}
