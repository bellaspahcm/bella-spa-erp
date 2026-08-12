import { Specimen } from './specimen.entity';
import { LabResult } from './lab-result.entity';
import { RangeAssessmentStrategy, type TestDefinition } from './test-definition';

export type LabOrderStatus = 
  | 'ORDERED'
  | 'COLLECTED'
  | 'RECEIVED'
  | 'PROCESSING'
  | 'RESULTED'
  | 'VERIFIED';

export type SafetyState = 
  | 'NORMAL'
  | 'ESCALATION_REQUIRED'
  | 'ACKNOWLEDGED';

export interface LabOrderProps {
  id: string;
  tenantId: string;
  encounterId: string;
  clinicalOrderId: string;
  patientId: string;
  testCode: string;
  testName: string;
  status: LabOrderStatus;
  safetyState: SafetyState;
  specimen?: Specimen;
  result?: LabResult;
  version: number;
  
  // Safety escalation / acknowledgment details
  escalationRequired?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export class LabOrder {
  private constructor(private readonly props: LabOrderProps) {}

  public static create(props: LabOrderProps): LabOrder {
    return new LabOrder(props);
  }

  // Getters
  public get id(): string {
    return this.props.id;
  }

  public get tenantId(): string {
    return this.props.tenantId;
  }

  public get encounterId(): string {
    return this.props.encounterId;
  }

  public get clinicalOrderId(): string {
    return this.props.clinicalOrderId;
  }

  public get patientId(): string {
    return this.props.patientId;
  }

  public get testCode(): string {
    return this.props.testCode;
  }

  public get testName(): string {
    return this.props.testName;
  }

  public get status(): LabOrderStatus {
    return this.props.status;
  }

  public get safetyState(): SafetyState {
    return this.props.safetyState;
  }

  public get specimen(): Specimen | undefined {
    return this.props.specimen;
  }

  public get result(): LabResult | undefined {
    return this.props.result;
  }

  public get version(): number {
    return this.props.version;
  }

  public get escalationRequired(): boolean {
    return !!this.props.escalationRequired;
  }

  public get acknowledgedBy(): string | undefined {
    return this.props.acknowledgedBy;
  }

  public get acknowledgedAt(): Date | undefined {
    return this.props.acknowledgedAt;
  }

  // =========================================================================
  // State Transitions
  // =========================================================================

  /**
   * Transition: ORDERED -> COLLECTED
   */
  public collectSpecimen(sampleType: string, tubeColor: string, collectedAt: Date = new Date()): void {
    if (this.props.status !== 'ORDERED') {
      throw new Error(`Invalid state transition: Cannot collect specimen in status ${this.props.status}`);
    }

    this.props.specimen = Specimen.create({
      sampleType,
      tubeColor,
      collectedAt,
    });
    this.props.status = 'COLLECTED';
    this.incrementVersion();
  }

  /**
   * Transition: COLLECTED -> RECEIVED
   */
  public receiveSpecimen(receivedAt: Date = new Date()): void {
    if (this.props.status !== 'COLLECTED') {
      throw new Error(`Invalid state transition: Cannot receive specimen in status ${this.props.status}`);
    }
    if (!this.props.specimen) {
      throw new Error('Invariant failure: Specimen details are missing');
    }

    this.props.specimen.markReceived(receivedAt);
    this.props.status = 'RECEIVED';
    this.incrementVersion();
  }

  /**
   * Transition: RECEIVED -> PROCESSING
   */
  public startProcessing(processingAt: Date = new Date()): void {
    if (this.props.status !== 'RECEIVED') {
      throw new Error(`Invalid state transition: Cannot process specimen in status ${this.props.status}`);
    }
    if (!this.props.specimen) {
      throw new Error('Invariant failure: Specimen details are missing');
    }

    this.props.specimen.markProcessing(processingAt);
    this.props.status = 'PROCESSING';
    this.incrementVersion();
  }

  /**
   * Transition: PROCESSING -> RESULTED
   */
  public recordResult(value: string, unit: string, testDefinition: TestDefinition): void {
    if (this.props.status !== 'PROCESSING') {
      throw new Error(`Invalid state transition: Cannot record result in status ${this.props.status}`);
    }

    // Dynamic assessment using RangeAssessmentStrategy (Directives 2 & 5)
    const assessment = RangeAssessmentStrategy.assess(value, testDefinition);

    this.props.result = LabResult.create({
      value,
      unit,
      referenceRange: testDefinition.referenceRange,
      assessment,
    });
    this.props.status = 'RESULTED';
    this.incrementVersion();
  }

  /**
   * Transition: RESULTED -> VERIFIED
   */
  public verify(verifiedBy: string, verifiedAt: Date = new Date()): void {
    if (this.props.status !== 'RESULTED') {
      throw new Error(`Invalid state transition: Cannot verify results in status ${this.props.status}`);
    }
    if (!this.props.result) {
      throw new Error('Invariant failure: Lab results are missing');
    }

    // Mark verification on the internal entity
    this.props.result.verify(verifiedBy, verifiedAt);
    this.props.status = 'VERIFIED';

    // Safety-state transitions (Directives 1 & 4)
    if (this.props.result.isPanicValue) {
      this.props.safetyState = 'ESCALATION_REQUIRED';
      this.props.escalationRequired = true;
    } else {
      this.props.safetyState = 'NORMAL';
      this.props.escalationRequired = false;
    }

    this.incrementVersion();
  }

  /**
   * Safety Transition: ESCALATION_REQUIRED -> ACKNOWLEDGED
   */
  public acknowledgeCritical(acknowledgedBy: string, acknowledgedAt: Date = new Date()): void {
    if (this.props.safetyState !== 'ESCALATION_REQUIRED') {
      throw new Error('Invalid action: Only results in ESCALATION_REQUIRED state can be acknowledged');
    }

    this.props.safetyState = 'ACKNOWLEDGED';
    this.props.escalationRequired = false;
    this.props.acknowledgedBy = acknowledgedBy;
    this.props.acknowledgedAt = acknowledgedAt;
    
    this.incrementVersion();
  }

  private incrementVersion(): void {
    this.props.version += 1;
  }
}
