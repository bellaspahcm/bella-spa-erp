import { supabase } from '@/lib/supabase';
import { salesOutboxService } from '../infrastructure/SalesOutboxService';

describe('SalesOutboxService', () => {
  const tenantId = 'tenant-abc';
  const productId = 'prod-123';
  const customerId = 'cust-456';
  const referenceId = 'ref-789';

  let spyRpc: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    spyRpc = jest.spyOn(supabase as any, 'rpc');
  });

  afterEach(() => {
    spyRpc.mockRestore();
  });

  it('should format payload and invoke enqueue_accounting_event RPC', async () => {
    spyRpc.mockResolvedValueOnce({
      data: 'outbox-id-111',
      error: null,
    });

    const outboxId = await salesOutboxService.enqueueSalesEvent({
      tenantId,
      saleType: 'RE_BOOKING_FEE',
      referenceType: 'BOOKING',
      referenceId,
      amount: 50000000,
      productId,
      customerId,
    });

    expect(spyRpc).toHaveBeenCalledWith('enqueue_accounting_event', {
      p_tenant_id: tenantId,
      p_event_type: 'PACKAGE_SALE',
      p_reference_type: 'BOOKING',
      p_reference_id: referenceId,
      p_payload: expect.objectContaining({
        saleType: 'RE_BOOKING_FEE',
        amount: 50000000,
        productId,
        customerId,
      }),
    });

    expect(outboxId).toBe('outbox-id-111');
  });

  it('should propagate connection errors to halt transactions', async () => {
    spyRpc.mockResolvedValueOnce({
      data: null,
      error: new Error('Network error during outbox write'),
    });

    await expect(
      salesOutboxService.enqueueSalesEvent({
        tenantId,
        saleType: 'RE_DEPOSIT_RECEIVED',
        referenceType: 'DEPOSIT',
        referenceId,
        amount: 100000000,
        productId,
        customerId,
      })
    ).rejects.toThrow('Network error during outbox write');
  });
});
