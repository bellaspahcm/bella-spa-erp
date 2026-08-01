import { StateMachine, Transition, TransitionContext } from '@/platform/state-machine/state-machine';

export type AssetType = 'vehicle' | 'showroom' | 'equipment';
export type AssetStatus = 'available' | 'allocated' | 'maintenance';
export type AssetEvent = 'ALLOCATE' | 'RELEASE' | 'SEND_TO_MAINTENANCE';

export interface AssetProps {
  readonly id: string;
  readonly tenantId: string;
  readonly assetName: string;
  readonly assetType: AssetType;
  status: AssetStatus;
  allocatedTo?: string;
  allocatedAt?: Date;
}

export class AssetAllocation {
  private readonly fsm: StateMachine<AssetStatus, AssetEvent>;

  private static transitions: Transition<AssetStatus, AssetEvent>[] = [
    { from: 'available', event: 'ALLOCATE', to: 'allocated' },
    { from: 'allocated', event: 'RELEASE', to: 'available' },
    { from: ['available', 'allocated'], event: 'SEND_TO_MAINTENANCE', to: 'maintenance' },
    { from: 'maintenance', event: 'RELEASE', to: 'available' },
  ];

  constructor(private readonly props: AssetProps) {
    if (!props.id) throw new Error('Asset ID is required');
    if (!props.tenantId) throw new Error('Tenant ID is required');
    if (!props.assetName) throw new Error('Asset name is required');

    this.fsm = new StateMachine<AssetStatus, AssetEvent>(props.status, AssetAllocation.transitions);
  }

  public get id(): string {
    return this.props.id;
  }

  public get tenantId(): string {
    return this.props.tenantId;
  }

  public get assetName(): string {
    return this.props.assetName;
  }

  public get assetType(): AssetType {
    return this.props.assetType;
  }

  public get status(): AssetStatus {
    return this.fsm.getState();
  }

  public get allocatedTo(): string | undefined {
    return this.props.allocatedTo;
  }

  public get allocatedAt(): Date | undefined {
    return this.props.allocatedAt;
  }

  /**
   * Allocate asset to a lead or user
   */
  public async allocate(targetId: string, context: TransitionContext): Promise<void> {
    const { newState } = await this.fsm.transition('ALLOCATE', context);
    this.props.status = newState;
    this.props.allocatedTo = targetId;
    this.props.allocatedAt = new Date();
  }

  /**
   * Release asset back to available status
   */
  public async release(context: TransitionContext): Promise<void> {
    const { newState } = await this.fsm.transition('RELEASE', context);
    this.props.status = newState;
    this.props.allocatedTo = undefined;
    this.props.allocatedAt = undefined;
  }

  /**
   * Put asset in maintenance status
   */
  public async sendToMaintenance(context: TransitionContext): Promise<void> {
    const { newState } = await this.fsm.transition('SEND_TO_MAINTENANCE', context);
    this.props.status = newState;
    this.props.allocatedTo = undefined;
    this.props.allocatedAt = undefined;
  }
}
