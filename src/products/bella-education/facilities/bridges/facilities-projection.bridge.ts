/**
 * Bella Preschool OS — Facilities Cross-Domain Projection Bridge
 * File: src/products/bella-education/facilities/bridges/facilities-projection.bridge.ts
 *
 * Projects P9 Facilities Safety Hazards & Overdue Inspections to the Reusable Exception Work Queue Candidate (#3 Reuse).
 *
 * SUPREME INVARIANT:
 * Exception Work Queue resolution DOES NOT alter facility or asset operational status!
 * Work Queue RESOLVED ≠ Asset OPERATIONAL.
 */

import { CommunicationExceptionService } from '@/products/bella-education/parent-engagement/services/communication-exception.service';
import { ParentCommunicationRepository } from '@/products/bella-education/parent-engagement/repositories/parent-communication.repository';

export class FacilitiesProjectionBridge {
  constructor(
    private readonly commRepo: ParentCommunicationRepository,
    private readonly exceptionService: CommunicationExceptionService
  ) {}

  /**
   * Projects a SAFETY_DEFECT exception into the Staff Exception Work Queue when an asset or zone fails a safety inspection.
   */
  async projectSafetyDefectException(params: {
    tenantId: string;
    zoneId: string;
    assetId?: string;
    remarks: string;
  }): Promise<any> {
    const existing = await this.exceptionService.getStaffWorkQueueExceptions(params.tenantId);
    const activeDefect = existing.find(
      e => e.exception_type === 'SAFETY_DEFECT' && e.student_id === (params.assetId || params.zoneId) && e.status === 'OPEN'
    );

    if (activeDefect) {
      return activeDefect;
    }

    const { data, error } = await (this.commRepo as any).supabase
      .from('edu_comm_exceptions')
      .insert({
        tenant_id: params.tenantId,
        notice_id: null,
        student_id: params.assetId || params.zoneId, // Used as entity reference
        exception_type: 'SAFETY_DEFECT',
        assigned_role: 'FACILITY_MANAGER',
        status: 'OPEN',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to project SAFETY_DEFECT exception: ${error?.message}`);
    }

    return data;
  }

  /**
   * Projects an OVERDUE_INSPECTION exception into the Staff Exception Work Queue for overdue inspection schedules.
   */
  async projectOverdueInspectionException(params: {
    tenantId: string;
    scheduleId: string;
    zoneId: string;
    title: string;
  }): Promise<any> {
    const existing = await this.exceptionService.getStaffWorkQueueExceptions(params.tenantId);
    const activeOverdue = existing.find(
      e => e.exception_type === 'OVERDUE_INSPECTION' && e.student_id === params.scheduleId && e.status === 'OPEN'
    );

    if (activeOverdue) {
      return activeOverdue;
    }

    const { data, error } = await (this.commRepo as any).supabase
      .from('edu_comm_exceptions')
      .insert({
        tenant_id: params.tenantId,
        notice_id: null,
        student_id: params.scheduleId,
        exception_type: 'OVERDUE_INSPECTION',
        assigned_role: 'SAFETY_OFFICER',
        status: 'OPEN',
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new Error(`Failed to project OVERDUE_INSPECTION exception: ${error?.message}`);
    }

    return data;
  }
}
