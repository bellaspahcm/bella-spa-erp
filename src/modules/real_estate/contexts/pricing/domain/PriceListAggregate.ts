export type PriceListStatus = 'draft' | 'pending_approval' | 'published' | 'expired' | 'rolled_back';

export interface PriceItem {
  readonly productId: string;
  readonly basePrice: number;
  readonly pricePerM2: number;
  readonly floorPrice: number;
  readonly maxDiscountRate: number; // percentage (0-100)
}

export interface PriceListProps {
  readonly id?: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly name: string;
  readonly version: number;
  readonly effectiveFrom: Date;
  readonly effectiveTo?: Date;
  status: PriceListStatus;
  readonly items: Map<string, PriceItem>; // Key: productId
  approvedBy?: string;
  approvedAt?: Date;
}

export class PriceListAggregate {
  private constructor(private readonly props: PriceListProps) {
    if (!props.tenantId) throw new Error('Tenant ID is required for PriceList');
    if (!props.projectId) throw new Error('Project ID is required for PriceList');
    if (!props.name) throw new Error('Price list name is required');
    if (props.version <= 0) throw new Error('Version must be greater than zero');
    if (!props.effectiveFrom) throw new Error('Effective date is required');
  }

  public static create(props: PriceListProps): PriceListAggregate {
    return new PriceListAggregate(props);
  }

  public get id(): string | undefined {
    return this.props.id;
  }

  public get tenantId(): string {
    return this.props.tenantId;
  }

  public get projectId(): string {
    return this.props.projectId;
  }

  public get version(): number {
    return this.props.version;
  }

  public get status(): PriceListStatus {
    return this.props.status;
  }

  public get items(): Map<string, PriceItem> {
    return new Map(this.props.items);
  }

  /**
   * Submit price list for approval
   */
  public submitForApproval(): void {
    if (this.props.status !== 'draft') {
      throw new Error(`Cannot submit price list for approval from status "${this.props.status}"`);
    }
    this.props.status = 'pending_approval';
  }

  /**
   * Approve and publish price list
   */
  public approve(approverId: string): void {
    if (this.props.status !== 'pending_approval') {
      throw new Error(`Cannot approve price list from status "${this.props.status}"`);
    }
    this.props.status = 'published';
    this.props.approvedBy = approverId;
    this.props.approvedAt = new Date();
  }

  /**
   * Rollback a published price list
   */
  public rollback(): void {
    if (this.props.status !== 'published') {
      throw new Error(`Cannot rollback price list from status "${this.props.status}"`);
    }
    this.props.status = 'rolled_back';
  }
}
