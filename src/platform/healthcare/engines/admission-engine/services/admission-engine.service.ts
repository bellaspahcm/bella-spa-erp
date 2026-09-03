/**
 * Admission Engine Service
 *
 * Coordinates Admission aggregate creation, discharge, and event publishing.
 * Invariants:
 * - Admission belongs to exact tenantId.
 * - encounterId must exist and belong to the same tenant.
 * - An encounter cannot have two active admissions simultaneously.
 * - Cannot transfer a discharged admission.
 * - Cannot discharge an admission twice.
 *
 * @module platform/healthcare/engines/admission-engine/services
 */

import type {
  AdmissionEngineContract,
  CreateAdmissionRequest,
  DischargeAdmissionRequest,
  AdmissionDTO,
} from '../contracts/admission-engine.contract';
import type { IEncounterReader } from '../contracts/encounter-reader.interface';
import type { EngineResponse } from '../../../shared-kernel/types';
import { InpatientAdmission } from '../domain/inpatient-admission.entity';
import { IAdmissionRepository } from '../repositories/supabase-admission.repository';
import { ADMISSION_EVENT_TYPES } from '../events/admission.events';
import { eventBus } from '@/platform/host/event-bus';

import { randomUUID } from 'crypto';

export class AdmissionEngineService implements AdmissionEngineContract {
  readonly engineName = 'admission-engine';
  readonly engineVersion = '1.0.0';
  readonly contractVersion = '1.0.0';

  constructor(
    private readonly repository: IAdmissionRepository,
    private readonly encounterReader?: IEncounterReader
  ) {}

  async createAdmission(request: CreateAdmissionRequest): Promise<EngineResponse<AdmissionDTO>> {
    try {
      // 1. Verify Encounter existence and tenant boundary via Reader contract
      if (this.encounterReader) {
        const encounter = await this.encounterReader.getEncounterSummary(request.tenantId, request.encounterId);
        if (!encounter) {
          return {
            success: false,
            error: {
              code: 'ENCOUNTER_NOT_FOUND',
              message: `Encounter ${request.encounterId} not found for tenant ${request.tenantId}`,
              timestamp: new Date().toISOString(),
            },
          };
        }
      }

      // 2. Invariant Guard: Check if encounter already has an active admission
      const existing = await this.repository.findByEncounterId(request.tenantId, request.encounterId);
      if (existing && existing.status !== 'discharged' && existing.status !== 'cancelled') {
        return {
          success: false,
          error: {
            code: 'ACTIVE_ADMISSION_EXISTS',
            message: `Encounter ${request.encounterId} already has an active admission (${existing.id})`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // 3. Create Aggregate Root
      const admissionId = randomUUID();

      const admission = InpatientAdmission.create({
        id: admissionId,
        tenantId: request.tenantId,
        encounterId: request.encounterId,
        patientPartyId: request.patientPartyId,
        wardId: request.wardId,
        bedId: request.bedId,
        admittingDoctorId: request.admittingDoctorId,
        attendingDoctorId: request.attendingDoctorId,
        admissionDiagnosis: request.admissionDiagnosis,
      });

      const saved = await this.repository.save(admission);

      // 4. Event-After-Persistence Pattern
      await eventBus.publish({
        eventType: ADMISSION_EVENT_TYPES.ADMISSION_CREATED,
        tenantId: saved.tenantId,
        aggregateId: saved.id,
        aggregateType: 'InpatientAdmission',
        payload: {
          admissionId: saved.id,
          tenantId: saved.tenantId,
          encounterId: saved.encounterId,
          patientPartyId: saved.patientPartyId,
          wardId: saved.wardId,
          bedId: saved.bedId,
          admittingDoctorId: saved.admittingDoctorId,
          attendingDoctorId: saved.attendingDoctorId,
          admittedAt: saved.admittedAt,
        },
        userId: request.userId,
      });

      return {
        success: true,
        data: this.mapToDTO(saved),
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'ADMISSION_CREATION_FAILED',
          message: err instanceof Error ? err.message : 'Failed to create admission',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async dischargeAdmission(request: DischargeAdmissionRequest): Promise<EngineResponse<AdmissionDTO>> {
    try {
      const admission = await this.repository.findById(request.tenantId, request.admissionId);
      if (!admission) {
        return {
          success: false,
          error: {
            code: 'ADMISSION_NOT_FOUND',
            message: `Admission with ID ${request.admissionId} not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Domain invariant check happens inside discharge() method (throws if already discharged)
      admission.discharge(request.dischargeSummary);
      const saved = await this.repository.save(admission);

      await eventBus.publish({
        eventType: ADMISSION_EVENT_TYPES.ADMISSION_DISCHARGED,
        tenantId: saved.tenantId,
        aggregateId: saved.id,
        aggregateType: 'InpatientAdmission',
        payload: {
          admissionId: saved.id,
          tenantId: saved.tenantId,
          encounterId: saved.encounterId,
          patientPartyId: saved.patientPartyId,
          wardId: saved.wardId,
          bedId: saved.bedId,
          dischargeSummary: saved.dischargeSummary!,
          dischargedAt: saved.dischargedAt!,
        },
        userId: request.userId,
      });

      return {
        success: true,
        data: this.mapToDTO(saved),
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'ADMISSION_DISCHARGE_FAILED',
          message: err instanceof Error ? err.message : 'Failed to discharge admission',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async getAdmissionById(tenantId: string, admissionId: string): Promise<EngineResponse<AdmissionDTO>> {
    try {
      const admission = await this.repository.findById(tenantId, admissionId);
      if (!admission) {
        return {
          success: false,
          error: {
            code: 'ADMISSION_NOT_FOUND',
            message: `Admission with ID ${admissionId} not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }
      return { success: true, data: this.mapToDTO(admission) };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: err instanceof Error ? err.message : 'Error fetching admission',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async getAdmissionByEncounterId(tenantId: string, encounterId: string): Promise<EngineResponse<AdmissionDTO>> {
    try {
      const admission = await this.repository.findByEncounterId(tenantId, encounterId);
      if (!admission) {
        return {
          success: false,
          error: {
            code: 'ADMISSION_NOT_FOUND',
            message: `Admission for encounter ${encounterId} not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }
      return { success: true, data: this.mapToDTO(admission) };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: err instanceof Error ? err.message : 'Error fetching admission',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private mapToDTO(admission: InpatientAdmission): AdmissionDTO {
    return {
      id: admission.id,
      tenantId: admission.tenantId,
      encounterId: admission.encounterId,
      patientPartyId: admission.patientPartyId,
      wardId: admission.wardId,
      bedId: admission.bedId,
      admittingDoctorId: admission.admittingDoctorId,
      attendingDoctorId: admission.attendingDoctorId,
      status: admission.status,
      admissionDiagnosis: admission.admissionDiagnosis,
      dischargeSummary: admission.dischargeSummary,
      admittedAt: admission.admittedAt,
      dischargedAt: admission.dischargedAt,
      version: admission.version,
    };
  }
}
