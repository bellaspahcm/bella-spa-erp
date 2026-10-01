import { commandBus, Command } from './command-bus';

describe('CommandBus', () => {
  const cleanupHandlers: Array<() => void> = [];

  interface CreateProductPayload {
    sku: string;
    price: number;
  }

  const createProductCommand: Command<CreateProductPayload> = {
    name: 'product.create',
    payload: { sku: 'PROD-100', price: 50000 },
  };

  afterEach(() => {
    while (cleanupHandlers.length > 0) {
      cleanupHandlers.pop()?.();
    }
  });

  it('should register handler and execute command successfully', async () => {
    const mockHandler = jest.fn().mockResolvedValue({ id: 'new-prod-id' });
    const unsubscribe = commandBus.register('product.create', mockHandler);
    cleanupHandlers.push(unsubscribe);

    const result = await commandBus.execute(createProductCommand);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(createProductCommand);
    expect(result).toEqual({ id: 'new-prod-id' });

    unsubscribe();
  });

  it('should throw error when registering duplicate handler', () => {
    cleanupHandlers.push(commandBus.register('product.create', async () => {}));
    expect(() => {
      commandBus.register('product.create', async () => {});
    }).toThrow('[CommandBus] Duplicate handler registered for command: "product.create"');
  });

  it('should throw error if executing unregistered command', async () => {
    await expect(commandBus.execute(createProductCommand)).rejects.toThrow(
      '[CommandBus] No handler registered for command: "product.create"'
    );
  });

  it('should propagate handler execution exceptions', async () => {
    const errorThrowingHandler = jest.fn().mockRejectedValue(new Error('DB connection failed'));
    const unsubscribe = commandBus.register('product.create', errorThrowingHandler);
    cleanupHandlers.push(unsubscribe);

    await expect(commandBus.execute(createProductCommand)).rejects.toThrow('DB connection failed');

    unsubscribe();
  });
});
