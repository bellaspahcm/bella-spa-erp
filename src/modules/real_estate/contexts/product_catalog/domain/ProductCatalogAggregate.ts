export type ProductType = 'apartment' | 'townhouse' | 'shophouse' | 'villa';

export interface ProductCatalogProps {
  readonly id?: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly productCode: string;
  readonly productType: ProductType;
  readonly floor: string;
  readonly block: string;
  readonly area: number;
  readonly unitPrice: number;
  readonly floorNumber: number;
  readonly unitCode: string;
  readonly areaM2: number;
  readonly direction: string;
  readonly basePrice: number;
  readonly floorPrice: number;
  readonly metadata?: Record<string, unknown>;
}

export class ProductCatalogAggregate {
  private constructor(private readonly props: ProductCatalogProps) {
    if (!props.tenantId) throw new Error('Tenant ID is required for Product Catalog');
    if (!props.projectId) throw new Error('Project ID is required for Product Catalog');
    if (!props.productCode) throw new Error('Product code is required');
    if (props.area <= 0) throw new Error('Area must be greater than zero');
    if (props.basePrice < 0) throw new Error('Base price cannot be negative');
    if (props.floorPrice < 0) throw new Error('Floor price cannot be negative');
    if (props.floorPrice > props.basePrice) {
      throw new Error('Floor price cannot exceed base price');
    }
  }

  public static create(props: ProductCatalogProps): ProductCatalogAggregate {
    return new ProductCatalogAggregate(props);
  }

  public getProps(): ProductCatalogProps {
    return { ...this.props };
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

  public get productCode(): string {
    return this.props.productCode;
  }

  public get productType(): ProductType {
    return this.props.productType;
  }

  public get basePrice(): number {
    return this.props.basePrice;
  }

  public get floorPrice(): number {
    return this.props.floorPrice;
  }

  public get metadata(): Record<string, unknown> | undefined {
    return this.props.metadata;
  }
}
