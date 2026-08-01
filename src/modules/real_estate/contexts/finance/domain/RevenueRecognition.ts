export type RecognitionMethod = 'percentage_of_completion' | 'handover';

export interface RevenueRecognitionProps {
  readonly id: string;
  readonly tenantId: string;
  readonly contractId: string;
  readonly totalContractPrice: number;
  recognizedAmount: number;
  recognizedPercentage: number; // percentage (0-100)
  readonly method: RecognitionMethod;
}

export class RevenueRecognition {
  constructor(private readonly props: RevenueRecognitionProps) {
    if (!props.id) throw new Error('Revenue recognition ID is required');
    if (!props.tenantId) throw new Error('Tenant ID is required');
    if (!props.contractId) throw new Error('Contract ID is required');
    if (props.totalContractPrice <= 0) throw new Error('Total contract price must be greater than zero');
    if (props.recognizedPercentage < 0 || props.recognizedPercentage > 100) {
      throw new Error('Recognized percentage must be between 0 and 100');
    }
  }

  public get id(): string {
    return this.props.id;
  }

  public get tenantId(): string {
    return this.props.tenantId;
  }

  public get contractId(): string {
    return this.props.contractId;
  }

  public get totalContractPrice(): number {
    return this.props.totalContractPrice;
  }

  public get recognizedAmount(): number {
    return this.props.recognizedAmount;
  }

  public get recognizedPercentage(): number {
    return this.props.recognizedPercentage;
  }

  public get method(): RecognitionMethod {
    return this.props.method;
  }

  /**
   * Recognizes incremental revenue based on updated completion percentage milestone
   */
  public recognizeRevenue(completionPercentage: number): number {
    if (this.props.method === 'handover') {
      throw new Error('Cannot recognize incremental percentage revenue under handover method');
    }
    if (completionPercentage < this.props.recognizedPercentage) {
      throw new Error('New completion percentage cannot be lower than previously recognized percentage');
    }
    if (completionPercentage > 100) {
      throw new Error('Completion percentage cannot exceed 100%');
    }

    const previousAmount = this.props.recognizedAmount;
    const newAmount = Math.round((this.props.totalContractPrice * completionPercentage) / 100);
    const incrementalAmount = newAmount - previousAmount;

    this.props.recognizedPercentage = completionPercentage;
    this.props.recognizedAmount = newAmount;

    return incrementalAmount;
  }

  /**
   * Recognizes full revenue on physical asset handover
   */
  public recognizeFullHandover(): number {
    if (this.props.method !== 'handover') {
      throw new Error('Cannot invoke handover recognition under percentage of completion method');
    }
    if (this.props.recognizedPercentage === 100) {
      return 0; // already fully recognized
    }

    const incrementalAmount = this.props.totalContractPrice - this.props.recognizedAmount;
    this.props.recognizedPercentage = 100;
    this.props.recognizedAmount = this.props.totalContractPrice;

    return incrementalAmount;
  }
}
