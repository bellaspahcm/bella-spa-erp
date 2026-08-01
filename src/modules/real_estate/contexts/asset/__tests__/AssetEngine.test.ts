import { AssetAllocation } from '../domain/AssetAllocation';
import { TransitionContext } from '@/platform/state-machine/state-machine';

describe('Asset Management Bounded Context', () => {
  const tenantId = 'tenant-abc';
  const mockContext: TransitionContext = {
    tenantId,
    correlationId: 'corr-600',
    actor: { userId: 'agent-1' },
  };

  it('should initialize and execute asset allocation and release lifecycles', async () => {
    const asset = new AssetAllocation({
      id: 'vehicle-1',
      tenantId,
      assetName: 'Mercedes Benz GLC 300',
      assetType: 'vehicle',
      status: 'available',
    });

    expect(asset.status).toBe('available');

    // 1. Allocate to Lead 999
    await asset.allocate('lead-999', mockContext);
    expect(asset.status).toBe('allocated');
    expect(asset.allocatedTo).toBe('lead-999');

    // 2. Release asset
    await asset.release(mockContext);
    expect(asset.status).toBe('available');
    expect(asset.allocatedTo).toBeUndefined();

    // 3. Send to maintenance
    await asset.sendToMaintenance(mockContext);
    expect(asset.status).toBe('maintenance');

    // 4. Return to available from maintenance
    await asset.release(mockContext);
    expect(asset.status).toBe('available');
  });
});
