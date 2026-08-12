import type { RangeAssessment } from './test-definition';

export interface LabResultProps {
  value: string;
  unit: string;
  referenceRange: string;
  assessment: RangeAssessment;
  verifiedAt?: Date;
  verifiedBy?: string;
}

export class LabResult {
  private constructor(private readonly props: LabResultProps) {}

  public static create(props: LabResultProps): LabResult {
    return new LabResult(props);
  }

  // Getters
  public get value(): string {
    return this.props.value;
  }

  public get unit(): string {
    return this.props.unit;
  }

  public get referenceRange(): string {
    return this.props.referenceRange;
  }

  public get assessment(): RangeAssessment {
    return this.props.assessment;
  }

  public get isAbnormal(): boolean {
    return this.props.assessment === 'ABNORMAL' || this.props.assessment === 'CRITICAL';
  }

  public get isPanicValue(): boolean {
    return this.props.assessment === 'CRITICAL';
  }

  public get verifiedAt(): Date | undefined {
    return this.props.verifiedAt;
  }

  public get verifiedBy(): string | undefined {
    return this.props.verifiedBy;
  }

  // Verification transition
  public verify(verifiedBy: string, verifiedAt: Date = new Date()): void {
    this.props.verifiedBy = verifiedBy;
    this.props.verifiedAt = verifiedAt;
  }
}
