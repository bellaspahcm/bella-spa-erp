/**
 * ICU Engine Service (Application Service Orchestrator)
 * 
 * Healthcare Platform Engine for ICU Continuous Critical Care.
 * 
 * Constitution Compliance:
 * - Law 1: Encounter is aggregate root reference
 * - Law 5: Domain events published downstream (Event-After-Persistence)
 * - Law 6: Capability reuse, 0 vertical duplicate engines
 * - Law 11: Strictly typed, zero `any` types allowed
 * - ADR-012: Strategy Pattern for clinical scoring, Decoupled observation reading, Atomic conditional resource lock
 * 
 * @module platform/healthcare/engines/icu-engine
 */

import type { EngineResponse } from '../../shared-kernel/types';
import { IcuStay } from './domain/icu-stay.entity';
import { VentilatorSession, VentilatorSafetyViolationError } from './domain/ventilator-session.entity';
import { SofaScoringStrategy } from './domain/scoring/sofa-scoring.strategy';
import { ApacheIIScoringStrategy } from './domain/scoring/apache-ii-scoring.strategy';
import type { IScoringStrategy, ScoringResult } from './domain/scoring/scoring-strategy.interface';
import type { IIcuStayRepository } from './repositories/icu-stay.repository';
import type { ICriticalObservationContract } from './contracts/critical-observation.contract';
import type {
  IIcuEngineService,
  AdmitToIcuRequest,
  StartVentilatorSessionRequest,
  StopVentilatorSessionRequest,
  RecordIcuObservationRequest,
  CalculateClinicalScoreRequest,
  TransitionIcuStatusRequest,
  IcuStayDTO,
} from './contracts/icu-engine.contract';
import { ICU_EVENT_TYPES } from './events/icu.events';
import { eventBus } from '@/platform/host/event-bus';

export interface IcuEngineServiceConfig {
  readonly repository: IIcuStayRepository;
  readonly criticalObservationContract?: ICriticalObservationContract;
}

export class IcuEngineService implements IIcuEngineService {
  readonly engineName = 'icu-engine';
  readonly engineVersion = '2.0.0';
  readonly contractVersion = '2.0.0';

  private readonly repository: IIcuStayRepository;
  private readonly criticalObservationContract?: ICriticalObservationContract;
  private readonly sofaStrategy = new SofaScoringStrategy();
  private readonly apacheStrategy = new ApacheIIScoringStrategy();

  constructor(config: IcuEngineServiceConfig) {
    this.repository = config.repository;
    this.criticalObservationContract = config.criticalObservationContract;
  }

  async admitToIcu(request: AdmitToIcuRequest): Promise<EngineResponse<IcuStayDTO>> {
    try {
      const existing = await this.repository.findByEncounterId(request.tenantId, request.encounterId);
      if (existing && existing.status !== 'DISCHARGED' && existing.status !== 'STEPPED_DOWN') {
        return {
          success: false,
          error: {
            code: 'ACTIVE_ICU_STAY_EXISTS',
            message: `Encounter ${request.encounterId} already has an active ICU stay (${existing.id})`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const stayId = `icu-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const stay = IcuStay.create({
        id: stayId,
        tenantId: request.tenantId,
        encounterId: request.encounterId,
        patientId: request.patientId,
        bedId: request.bedId,
        wardId: request.wardId,
      });

      const saved = await this.repository.allocateConditional(stay);

      // Event-After-Persistence
      await eventBus.publish({
        eventType: ICU_EVENT_TYPES.ICU_ADMITTED,
        tenantId: saved.tenantId,
        aggregateId: saved.id,
        aggregateType: 'IcuStay',
        payload: {
          icuStayId: saved.id,
          tenantId: saved.tenantId,
          encounterId: saved.encounterId,
          patientId: saved.patientId,
          bedId: saved.bedId,
          wardId: saved.wardId,
          admittedAt: saved.admittedAt.toISOString(),
        },
        userId: request.admittedBy,
      });

      return { success: true, data: this.mapToDTO(saved) };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'ADMIT_TO_ICU_FAILED',
          message: err instanceof Error ? err.message : 'Failed to admit patient to ICU',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async startVentilatorSession(request: StartVentilatorSessionRequest): Promise<EngineResponse<{ sessionId: string; status: string }>> {
    try {
      const stay = await this.repository.findById(request.tenantId, request.icuStayId);
      if (!stay) {
        return {
          success: false,
          error: {
            code: 'ICU_STAY_NOT_FOUND',
            message: `ICU Stay ${request.icuStayId} not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const sessionId = `vent-${Date.now()}`;

      try {
        const session = stay.startVentilatorSession({
          sessionId,
          mode: request.mode,
          settings: request.settings,
          safetyRules: request.safetyRules,
        });

        const saved = await this.repository.save(stay);

        await eventBus.publish({
          eventType: ICU_EVENT_TYPES.VENTILATOR_STARTED,
          tenantId: saved.tenantId,
          aggregateId: saved.id,
          aggregateType: 'IcuStay',
          payload: {
            sessionId: session.id,
            icuStayId: saved.id,
            tenantId: saved.tenantId,
            encounterId: saved.encounterId,
            mode: session.mode,
            settings: session.settings,
            startedAt: session.startedAt.toISOString(),
          },
          userId: request.initiatedBy,
        });

        return {
          success: true,
          data: { sessionId: session.id, status: session.status },
        };
      } catch (domainErr: unknown) {
        if (domainErr instanceof VentilatorSafetyViolationError) {
          // Safety Barrier Event emission
          await eventBus.publish({
            eventType: ICU_EVENT_TYPES.VENTILATOR_SAFETY_BLOCKED,
            tenantId: request.tenantId,
            aggregateId: request.icuStayId,
            aggregateType: 'IcuStay',
            payload: {
              icuStayId: request.icuStayId,
              tenantId: request.tenantId,
              encounterId: stay.encounterId,
              mode: request.mode,
              violations: domainErr.violations,
              attemptedSettings: request.settings,
            },
            userId: request.initiatedBy,
          });
        }
        throw domainErr;
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'VENTILATOR_START_FAILED',
          message: err instanceof Error ? err.message : 'Failed to start ventilator session',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async stopVentilatorSession(request: StopVentilatorSessionRequest): Promise<EngineResponse<void>> {
    try {
      const stay = await this.repository.findById(request.tenantId, request.icuStayId);
      if (!stay) {
        return {
          success: false,
          error: {
            code: 'ICU_STAY_NOT_FOUND',
            message: `ICU Stay ${request.icuStayId} not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      stay.stopVentilatorSession(request.sessionId);
      const saved = await this.repository.save(stay);

      await eventBus.publish({
        eventType: ICU_EVENT_TYPES.VENTILATOR_STOPPED,
        tenantId: saved.tenantId,
        aggregateId: saved.id,
        aggregateType: 'IcuStay',
        payload: {
          sessionId: request.sessionId,
          icuStayId: saved.id,
        },
        userId: request.stoppedBy,
      });

      return { success: true };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'VENTILATOR_STOP_FAILED',
          message: err instanceof Error ? err.message : 'Failed to stop ventilator session',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async recordObservation(request: RecordIcuObservationRequest): Promise<EngineResponse<{ observationId: string; isCritical: boolean }>> {
    try {
      const stay = await this.repository.findById(request.tenantId, request.icuStayId);
      if (!stay) {
        return {
          success: false,
          error: {
            code: 'ICU_STAY_NOT_FOUND',
            message: `ICU Stay ${request.icuStayId} not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      let isCritical = false;
      let breaches: string[] = [];

      if (this.criticalObservationContract) {
        const evalRes = this.criticalObservationContract.evaluateCriticalThresholds(request.vitals);
        isCritical = evalRes.isCritical;
        breaches = evalRes.breaches;
      } else {
        if (request.vitals.spo2 < 90 || request.vitals.heartRate > 140 || request.vitals.meanArterialPressure < 65) {
          isCritical = true;
          breaches.push('Critical vitals threshold breached');
        }
      }

      const obsId = `obs-${Date.now()}`;
      stay.recordObservation({
        id: obsId,
        recordedAt: new Date(),
        vitals: request.vitals,
        isCritical,
      });

      const saved = await this.repository.save(stay);

      if (isCritical) {
        await eventBus.publish({
          eventType: ICU_EVENT_TYPES.MONITORING_ALERT,
          tenantId: saved.tenantId,
          aggregateId: saved.id,
          aggregateType: 'IcuStay',
          payload: {
            icuStayId: saved.id,
            tenantId: saved.tenantId,
            encounterId: saved.encounterId,
            patientId: saved.patientId,
            observationId: obsId,
            breaches,
            vitals: request.vitals,
            recordedAt: new Date().toISOString(),
          },
          userId: request.recordedBy,
        });
      }

      return {
        success: true,
        data: { observationId: obsId, isCritical },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'RECORD_OBSERVATION_FAILED',
          message: err instanceof Error ? err.message : 'Failed to record ICU observation',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async calculateClinicalScore(request: CalculateClinicalScoreRequest): Promise<EngineResponse<ScoringResult>> {
    try {
      const stay = await this.repository.findById(request.tenantId, request.icuStayId);
      if (!stay) {
        return {
          success: false,
          error: {
            code: 'ICU_STAY_NOT_FOUND',
            message: `ICU Stay ${request.icuStayId} not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      const strategy: IScoringStrategy = request.strategyName === 'SOFA' ? this.sofaStrategy : this.apacheStrategy;
      const scoreResult = stay.calculateClinicalScore(strategy, {
        vitals: request.vitals,
        labs: request.labs,
        clinical: request.clinical,
        patientAge: request.patientAge,
        hasChronicOrganFailure: request.hasChronicOrganFailure,
      });

      const saved = await this.repository.save(stay);

      await eventBus.publish({
        eventType: ICU_EVENT_TYPES.SCORE_CALCULATED,
        tenantId: saved.tenantId,
        aggregateId: saved.id,
        aggregateType: 'IcuStay',
        payload: {
          icuStayId: saved.id,
          strategyName: request.strategyName,
          scoreValue: scoreResult.scoreValue,
          severityGrade: scoreResult.severityGrade,
        },
      });

      return { success: true, data: scoreResult };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'SCORE_CALCULATION_FAILED',
          message: err instanceof Error ? err.message : 'Failed to calculate clinical score',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  async transitionStatus(request: TransitionIcuStatusRequest): Promise<EngineResponse<IcuStayDTO>> {
    try {
      const stay = await this.repository.findById(request.tenantId, request.icuStayId);
      if (!stay) {
        return {
          success: false,
          error: {
            code: 'ICU_STAY_NOT_FOUND',
            message: `ICU Stay ${request.icuStayId} not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (request.action === 'STABILIZE') {
        stay.markStabilized();
      } else if (request.action === 'STEP_DOWN') {
        stay.stepDown();
      } else if (request.action === 'DISCHARGE') {
        stay.discharge();
      }

      const saved = await this.repository.save(stay);

      return { success: true, data: this.mapToDTO(saved) };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'STATUS_TRANSITION_FAILED',
          message: err instanceof Error ? err.message : 'Failed to transition ICU stay status',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private mapToDTO(stay: IcuStay): IcuStayDTO {
    const activeVent = stay.ventilatorSessions.find(s => s.status === 'ACTIVE');
    const latestScore = stay.scoreHistory.length > 0 ? stay.scoreHistory[stay.scoreHistory.length - 1] : null;

    return {
      id: stay.id,
      tenantId: stay.tenantId,
      encounterId: stay.encounterId,
      patientId: stay.patientId,
      bedId: stay.bedId,
      wardId: stay.wardId,
      status: stay.status,
      admittedAt: stay.admittedAt.toISOString(),
      stabilizedAt: stay.stabilizedAt ? stay.stabilizedAt.toISOString() : null,
      dischargedAt: stay.dischargedAt ? stay.dischargedAt.toISOString() : null,
      version: stay.version,
      activeVentilatorSessionId: activeVent ? activeVent.id : null,
      latestScore,
    };
  }
}

