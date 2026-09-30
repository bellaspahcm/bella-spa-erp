/**
 * Supabase Test Helpers
 * 
 * Simplifies test setup by providing common mock scenarios
 */

type QueryError = { message: string } | null;
type QueryResult<T> = {
  data: T;
  error: QueryError;
  count: number | null;
};
type QueryCallback<T> = (value: QueryResult<T>) => unknown;
type ChainMethodName =
  | 'select'
  | 'insert'
  | 'update'
  | 'delete'
  | 'eq'
  | 'neq'
  | 'in'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'order'
  | 'limit'
  | 'range'
  | 'single'
  | 'maybeSingle';
type ChainableMock<T> = Record<ChainMethodName, jest.Mock> & {
  then: (callback: QueryCallback<T>) => Promise<unknown>;
};
type SupabaseFromMock = {
  from: jest.Mock;
};

/**
 * Create a mock for a successful query that returns data
 */
export function mockSuccessfulQuery<T>(data: T, count?: number) {
  return Promise.resolve({
    data,
    error: null,
    count: count ?? null,
  });
}

/**
 * Create a mock for a failed query
 */
export function mockFailedQuery(errorMessage: string) {
  return Promise.resolve({
    data: null,
    error: { message: errorMessage },
    count: null,
  });
}

/**
 * Create a chainable query builder mock that resolves with data
 * This handles the complex Supabase query chaining
 */
export function createChainableMock<T>(finalData: T, finalError: QueryError = null): ChainableMock<T> {
  const methodNames: ChainMethodName[] = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'in',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'order',
    'limit',
    'range',
    'single',
    'maybeSingle',
  ];
  const chainMethods = {} as Record<ChainMethodName, jest.Mock>;

  methodNames.forEach((key) => {
    chainMethods[key] = jest.fn();
  });

  // Make all methods return the same object for chaining
  methodNames.forEach((key) => {
    if (key === 'single' || key === 'maybeSingle') {
      chainMethods[key].mockResolvedValue({ data: finalData, error: finalError });
    } else {
      chainMethods[key].mockReturnValue(chainMethods);
    }
  });

  // For queries that don't use .single(), resolve the promise
  const chain = chainMethods as ChainableMock<T>;
  chain.then = (callback: QueryCallback<T>) => {
    return Promise.resolve({ data: finalData, error: finalError, count: Array.isArray(finalData) ? finalData.length : null }).then(callback);
  };

  return chain;
}

/**
 * Setup mock for addToWaitlist success scenario
 */
export function mockAddToWaitlistSuccess<TCustomer, TPackageData, TEntry>(
  mockSupabase: SupabaseFromMock,
  customer: TCustomer,
  packageData: TPackageData,
  tier: string,
  entry: TEntry
) {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'waitlist_entries') {
      const mock = createChainableMock([]);
      mock.insert = jest.fn().mockImplementation(() => createChainableMock(entry));
      return mock;
    }
    if (table === 'customers') {
      return createChainableMock(customer);
    }
    if (table === 'bookings') {
      const mock = createChainableMock([]);
      mock.then = (callback: QueryCallback<never[]>) => {
        return Promise.resolve({ data: [], error: null, count: 5 }).then(callback);
      };
      return mock;
    }
    if (table === 'membership_records') {
      return createChainableMock({ tier });
    }
    if (table === 'packages') {
      return createChainableMock(packageData);
    }
    if (table === 'users') {
      return createChainableMock({ full_name: 'KTV Senior' });
    }
    return createChainableMock(null);
  });
}

/**
 * Setup mock for duplicate entry scenario
 */
export function mockAddToWaitlistDuplicate<TEntry>(mockSupabase: SupabaseFromMock, existingEntry: TEntry) {
  mockSupabase.from.mockImplementation(() => {
    return createChainableMock([existingEntry]);
  });
}

/**
 * Setup mock for capacity full scenario
 */
export function mockAddToWaitlistCapacityFull<TCustomer, TPackageData>(
  mockSupabase: SupabaseFromMock,
  customer: TCustomer,
  packageData: TPackageData,
  tier: string
) {
  let waitlistCallCount = 0;
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'waitlist_entries') {
      waitlistCallCount++;
      if (waitlistCallCount === 1) {
        return createChainableMock([]);
      }
      const fullWaitlist = Array(10).fill({ id: 'entry-x' });
      return createChainableMock(fullWaitlist);
    }
    if (table === 'customers') {
      return createChainableMock(customer);
    }
    if (table === 'bookings') {
      const mock = createChainableMock([]);
      mock.then = (callback: QueryCallback<never[]>) => {
        return Promise.resolve({ data: [], error: null, count: 5 }).then(callback);
      };
      return mock;
    }
    if (table === 'membership_records') {
      return createChainableMock({ tier });
    }
    if (table === 'packages') {
      return createChainableMock(packageData);
    }
    return createChainableMock(null);
  });
}

/**
 * Setup mock for processSlotAvailable success
 */
export function mockProcessSlotSuccess<TEntry>(mockSupabase: SupabaseFromMock, entries: TEntry[]) {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'waitlist_entries') {
      return createChainableMock(entries);
    }
    if (table === 'tenants') {
      return createChainableMock({ contact_phone: '1900xxxx' });
    }
    return createChainableMock(null);
  });
}

/**
 * Setup mock for expireOldEntries success
 */
export function mockExpireEntriesSuccess<TEntry>(mockSupabase: SupabaseFromMock, expiredEntries: TEntry[]) {
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'waitlist_entries') {
      return createChainableMock(expiredEntries);
    }
    if (table === 'tenants') {
      return createChainableMock({ contact_phone: '1900xxxx' });
    }
    return createChainableMock(null);
  });
}

/**
 * Setup mock for getWaitlistEntries
 */
export function mockGetWaitlistEntriesSuccess<TEntry>(mockSupabase: SupabaseFromMock, entries: TEntry[], total: number) {
  mockSupabase.from.mockImplementation(() => {
    const mock = createChainableMock(entries);
    // Override the promise to include count
    mock.then = (callback: QueryCallback<TEntry[]>) => {
      return Promise.resolve({ data: entries, error: null, count: total }).then(callback);
    };
    return mock;
  });
}
