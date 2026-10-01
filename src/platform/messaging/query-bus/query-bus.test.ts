import { queryBus, Query } from './query-bus';

describe('QueryBus', () => {
  const cleanupHandlers: Array<() => void> = [];

  interface GetProductPayload {
    sku: string;
  }

  const getProductQuery: Query<GetProductPayload> = {
    name: 'product.get_details',
    payload: { sku: 'PROD-100' },
  };

  afterEach(() => {
    while (cleanupHandlers.length > 0) {
      cleanupHandlers.pop()?.();
    }
  });

  it('should register handler and return query results', async () => {
    const mockHandler = jest.fn().mockResolvedValue({ sku: 'PROD-100', stock: 12 });
    const unsubscribe = queryBus.register('product.get_details', mockHandler);
    cleanupHandlers.push(unsubscribe);

    const result = await queryBus.execute(getProductQuery);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(getProductQuery);
    expect(result).toEqual({ sku: 'PROD-100', stock: 12 });

    unsubscribe();
  });

  it('should throw error when registering duplicate query handler', () => {
    cleanupHandlers.push(queryBus.register('product.get_details', async () => {}));
    expect(() => {
      queryBus.register('product.get_details', async () => {});
    }).toThrow('[QueryBus] Duplicate handler registered for query: "product.get_details"');
  });

  it('should throw error if query has no handler registered', async () => {
    await expect(queryBus.execute(getProductQuery)).rejects.toThrow(
      '[QueryBus] No handler registered for query: "product.get_details"'
    );
  });
});
