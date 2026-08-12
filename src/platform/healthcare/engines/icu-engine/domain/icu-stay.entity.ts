/**
 * ICU Stay Aggregate Root
 * 
 * Constitution Compliance:
 * - Law 1: Encounter is aggregate root (references encounterId)
 * - Law 11: Strictly typed, zero `any` types allowed
 * - Strategy Pattern: Accepts IScoringStrategy without coupling to SOFA/APACHE II implementations
 * - Encapsulation: VentilatorSession as an internal entity belonging to IcuStay Aggregate Root
 * 
 * @module platform/healthcare/engines/icu-engine/domain
 */

import { VentilatorSession, VentilatorSettings, VentilatorSafetyRules } from './ventilator-session.entity';
import type { IScoringStrategy, ScoringInput, ScoringResult } from './scoring/scoring-strategy.interface';

export type IcuStayStatus = 'ADMITTED' | 'STABILIZING' | 'STABILIZED' | 'STEPPED_DOWN' | 'DISCHARGED';

export interface ObservationRecord {
  readonly id: string;
  readonly recordedAt: Date;
  readonly vitals: {
    readonly heartRate: number;
    readonly meanArterialPressure: number;
    readonly temperature: number;
    readonly respiratoryRate: number;
    readonly spo2: number;
  };
  readonly isCritical: boolean;
}

export interface IcuStayProps {
  readonly id: string;
  readonly tenantId: string;
  readonly encounterId: string;
  readonly patientId: string;
  readonly bedId: string;
  readonly wardId: string;
  readonly status: IcuStayStatus;
  readonly admittedAt: Date;
  readonly stabilizedAt?: Date | null;
  readonly dischargedAt?: Date | null;
  readonly version: number;
  readonly ventilatorSessions?: VentilatorSession[];
  readonly observations?: ObservationRecord[];
  readonly scoreHistory?: ScoringResult[];
}

export class IcuStay {
  private _status: IcuStayStatus;
  private _stabilizedAt: Date | null;
  private _dischargedAt: Date | null;
  private _version: number;
  private _ventilatorSessions: VentilatorSession[];
  private _observations: ObservationRecord[];
  private _scoreHistory: ScoringResult[];

  private constructor(private readonly props: IcuStayProps) {
    this._status = props.status;
    this._stabilizedAt = props.stabilizedAt || null;
    this._dischargedAt = props.dischargedAt || null;
    this._version = props.version;
    this._ventilatorSessions = props.ventilatorSessions ? [...props.ventilatorSessions] : [];
    this._observations = props.observations ? [...props.observations] : [];
    this._scoreHistory = props.scoreHistory ? [...props.scoreHistory] : [];
  }

  get id(): string { return this.props.id; }
  get tenantId(): string { return this.props.tenantId; }
  get encounterId(): string { return this.props.encounterId; }
  get patientId(): string { return this.props.patientId; }
  get bedId(): string { return this.props.bedId; }
  get wardId(): string { return this.props.wardId; }
  get status(): IcuStayStatus { return this._status; }
  get admittedAt(): Date { return this.props.admittedAt; }
  get stabilizedAt(): Date | null { return this._stabilizedAt; }
  get dischargedAt(): Date | null { return this._dischargedAt; }
  get version(): number { return this._version; }
  get ventilatorSessions(): readonly VentilatorSession[] { return [...this._ventilatorSessions]; }
  get observations(): readonly ObservationRecord[] { return [...this._observations]; }
  get scoreHistory(): readonly ScoringResult[] { return [...this._scoreHistory]; }

  static create(params: {
    id: string;
    tenantId: string;
    encounterId: string;
    patientId: string;
    bedId: string;
    wardId: string;
  }): IcuStay {
    if (!params.tenantId) throw new Error('Tenant ID is required');
    if (!params.encounterId) throw new Error('Encounter ID is required');
    if (!params.patientId) throw new Error('Patient ID is required');
    if (!params.bedId) throw new Error('Bed ID is required');

    return new IcuStay({
      id: params.id,
      tenantId: params.tenantId,
      encounterId: params.encounterId,
      patientId: params.patientId,
      bedId: params.bedId,
      wardId: params.wardId,
      status: 'ADMITTED',
      admittedAt: new Date(),
      version: 1,
    });
  }

  static reconstitute(props: IcuStayProps): IcuStay {
    return new IcuStay(props);
  }

  startVentilatorSession(params: {
    sessionId: string;
    mode: 'AC' | 'SIMV' | 'CPAP' | 'PSV';
    settings: VentilatorSettings;
    safetyRules?: VentilatorSafetyRules;
  }): VentilatorSession {
    if (this._status === 'DISCHARGED' || this._status === 'STEPPED_DOWN') {
      throw new Error(`Cannot start ventilator session when ICU stay is ${this._status}`);
    }

    const activeSession = this._ventilatorSessions.find(s => s.status === 'ACTIVE' || s.status === 'WEANING');
    if (activeSession) {
      throw new Error(`Encounter ${this.encounterId} already has an active ventilator session (${activeSession.id})`);
    }

    const session = VentilatorSession.create({
      id: params.sessionId,
      icuStayId: this.id,
      mode: params.mode,
      settings: params.settings,
      safetyRules: params.safetyRules,
    });

    this._ventilatorSessions.push(session);
    this._version++;
    return session;
  }

  stopVentilatorSession(sessionId: string): void {
    const session = this._ventilatorSessions.find(s => s.id === sessionId);
    if (!session) {
      throw new Error(`Ventilator session ${sessionId} not found in ICU stay ${this.id}`);
    }

    session.discontinue();
    this._version++;
  }

  recordObservation(obs: ObservationRecord): void {
    if (this._status === 'DISCHARGED') {
      throw new Error('Cannot record observation for discharged ICU stay');
    }

    this._observations.push(obs);
    this._version++;
  }

  calculateClinicalScore(strategy: IScoringStrategy, input: ScoringInput): ScoringResult {
    const result = strategy.calculateScore(input);
    this._scoreHistory.push(result);
    this._version++;
    return result;
  }

  markStabilizing(): void {
    if (this._status !== 'ADMITTED') {
      throw new Error(`Cannot transition to STABILIZING from ${this._status}`);
    }
    this._status = 'STABILIZING';
    this._version++;
  }

  markStabilized(): void {
    if (this._status !== 'ADMITTED' && this._status !== 'STABILIZING') {
      throw new Error(`Cannot transition to STABILIZED from ${this._status}`);
    }
    this._status = 'STABILIZED';
    this._stabilizedAt = new Date();
    this._version++;
  }

  stepDown(): void {
    if (this._status !== 'STABILIZED') {
      throw new Error('Patient must be STABILIZED before stepping down from ICU');
    }
    const activeVent = this._ventilatorSessions.find(s => s.status === 'ACTIVE');
    if (activeVent) {
      throw new Error('Cannot step down patient while actively on mechanical ventilation');
    }

    this._status = 'STEPPED_DOWN';
    this._dischargedAt = new Date();
    this._version++;
  }

  discharge(): void {
    if (this._status !== 'STABILIZED' && this._status !== 'STEPPED_DOWN') {
      throw new Error('Patient must be STABILIZED or STEPPED_DOWN before ICU discharge');
    }
    this._status = 'DISCHARGED';
    this._dischargedAt = new Date();
    this._version++;
  }
}
