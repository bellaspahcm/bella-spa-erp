/**
 * Bella Preschool OS — Safety Inspection Execution & Audit Service
 * File: src/products/bella-education/facilities/services/safety-inspection.service.ts
 *
 * Manages recurring inspection schedules, audit evidence logging,
 * and automatic transition to OUT_OF_SERVICE on FAIL_CRITICAL results.
 */

import { PreschoolFacilitiesRepository } from '../repositories/preschool-facilities.repository';
import { FacilityZoneService } from './facility-zone.service';
import { 
  InspectionSchedule, 
  InspectionLog, 
  InspectionResult, 
  RestrictionScope 
} from '../domain/facilities.types';

export class SafetyInspectionService {
  constructor(
    private readonly repo: PreschoolFacilitiesRepository,
    private readonly zoneService: FacilityZoneService,
    private readonly bridge?: FacilitiesProjectionBridge
  ) {}

  async createInspectionSchedule(sched: Omit<InspectionSchedule, 'id' | 'createdAt'>): Promise<InspectionSchedule> {
    return this.repo.createInspectionSchedule(sched);
  }

  /**
   * Executes a scheduled or ad-hoc safety inspection.
   * If resultStatus is FAIL_CRITICAL, automatically places the asset/zone OUT_OF_SERVICE
   * and projects a SAFETY_DEFECT exception into the Staff Work Queue.
   */
  async executeInspection(params: {
    tenantId: string;
    scheduleId?: string;
    zoneId: string;
    assetId?: string;
    inspectorPartyId: string;
    inspectionDate: string;
    resultStatus: InspectionResult;
    checklistAnswers: any[];
    remarks?: string;
    restrictionScope: RestrictionScope;
  }): Promise<InspectionLog> {
    // 1. Record immutable inspection log
    const log = await this.repo.recordInspectionLog({
      tenantId: params.tenantId,
      scheduleId: params.scheduleId,
      zoneId: params.zoneId,
      assetId: params.assetId,
      inspectorPartyId: params.inspectorPartyId,
      inspectionDate: params.inspectionDate,
      resultStatus: params.resultStatus,
      checklistAnswers: params.checklistAnswers,
      remarks: params.remarks,
      restrictionScope: params.restrictionScope,
    });

    // 2. Handle critical safety failure transition & projection
    if (params.resultStatus === 'FAIL_CRITICAL') {
      const entityType = params.assetId ? 'ASSET' : 'ZONE';
      const entityId = params.assetId || params.zoneId;
      const reason = `Critical Safety Inspection Failure: ${params.remarks || 'Checklist item failed safety standard'}`;

      await this.zoneService.placeOutOfService(
        params.tenantId,
        entityType,
        entityId,
        reason,
        params.restrictionScope,
        params.inspectorPartyId
      );

      if (this.bridge) {
        await this.bridge.projectSafetyDefectException({
          tenantId: params.tenantId,
          zoneId: params.zoneId,
          assetId: params.assetId,
          remarks: reason,
        });
      }
    }

    return log;
  }

  /**
   * Executes a safety re-inspection for an out-of-service entity.
   * ONLY when resultStatus === 'PASS' will operational status be restored to OPERATIONAL.
   */
  async executeRestorationInspection(params: {
    tenantId: string;
    zoneId: string;
    assetId?: string;
    inspectorPartyId: string;
    inspectionDate: string;
    resultStatus: InspectionResult;
    checklistAnswers: any[];
    remarks?: string;
  }): Promise<{ log: InspectionLog; restored: boolean }> {
    const entityType = params.assetId ? 'ASSET' : 'ZONE';
    const entityId = params.assetId || params.zoneId;

    const log = await this.repo.recordInspectionLog({
      tenantId: params.tenantId,
      zoneId: params.zoneId,
      assetId: params.assetId,
      inspectorPartyId: params.inspectorPartyId,
      inspectionDate: params.inspectionDate,
      resultStatus: params.resultStatus,
      checklistAnswers: params.checklistAnswers,
      remarks: params.remarks,
      restrictionScope: params.assetId ? 'ASSET_ONLY' : 'ZONE',
    });

    let restored = false;
    if (params.resultStatus === 'PASS') {
      await this.zoneService.passRestorationInspection(
        params.tenantId,
        entityType,
        entityId,
        params.inspectorPartyId
      );
      restored = true;
    }

    return { log, restored };
  }
}
