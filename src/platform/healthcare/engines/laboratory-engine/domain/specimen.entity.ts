export interface SpecimenProps {
  sampleType: string;
  tubeColor: string;
  collectedAt?: Date;
  receivedAt?: Date;
  processingAt?: Date;
}

export class Specimen {
  private constructor(private readonly props: SpecimenProps) {}

  public static create(props: SpecimenProps): Specimen {
    return new Specimen(props);
  }

  // Getters
  public get sampleType(): string {
    return this.props.sampleType;
  }

  public get tubeColor(): string {
    return this.props.tubeColor;
  }

  public get collectedAt(): Date | undefined {
    return this.props.collectedAt;
  }

  public get receivedAt(): Date | undefined {
    return this.props.receivedAt;
  }

  public get processingAt(): Date | undefined {
    return this.props.processingAt;
  }

  // State transitions (called inside LabOrder aggregate root to maintain invariants)
  public markCollected(collectedAt: Date = new Date()): void {
    this.props.collectedAt = collectedAt;
  }

  public markReceived(receivedAt: Date = new Date()): void {
    this.props.receivedAt = receivedAt;
  }

  public markProcessing(processingAt: Date = new Date()): void {
    this.props.processingAt = processingAt;
  }
}
