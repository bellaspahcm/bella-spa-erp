import { enqueueAccountingEvent } from '@/lib/accounting-outbox';

describe('accounting outbox helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const params = {
    tenantId: 'tenant-1',
    eventType: 'PACKAGE_SALE' as const,
    referenceType: 'REVENUE' as const,
    referenceId: 'revenue-1',
    payload: {
      totalAmount: 1000000,
      vatRate: 0,
      description: 'Webhook payment',
    },
  };

  it('enqueues an accounting event and returns true on success', async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: 'outbox-1', error: null }),
    };

    await expect(enqueueAccountingEvent(client, params)).resolves.toBe(true);

    expect(client.rpc).toHaveBeenCalledWith('enqueue_accounting_event', {
      p_tenant_id: 'tenant-1',
      p_event_type: 'PACKAGE_SALE',
      p_reference_type: 'REVENUE',
      p_reference_id: 'revenue-1',
      p_payload: params.payload,
    });
  });

  it('returns false when the enqueue RPC returns an error', async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'outbox unavailable' } }),
    };

    await expect(enqueueAccountingEvent(client, params)).resolves.toBe(false);
  });

  it('returns false when the enqueue RPC does not return an outbox id', async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    };

    await expect(enqueueAccountingEvent(client, params)).resolves.toBe(false);
  });

  it('returns false when the enqueue RPC throws', async () => {
    const client = {
      rpc: jest.fn().mockRejectedValue(new Error('connection dropped')),
    };

    await expect(enqueueAccountingEvent(client, params)).resolves.toBe(false);
  });
});
