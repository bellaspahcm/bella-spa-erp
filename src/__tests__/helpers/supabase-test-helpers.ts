/**
 * Supabase Test Helpers
 * 
 * Simplifies test setup by providing common mock scenarios
 */

/**
 * Create a mock for a successful query that returns data
 */
export function mockSuccessfulQuery(data: any, count?: number) {
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
export function createChainableMock(finalData: any, finalError: any = null) {
  const chainMethods = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    eq: jest.fn(),
    neq: jest.fn(),
    in: jest.fn(),
    gt: jest.fn(),
    gte: jest.fn(),
    lt: jest.fn(),
    lte: jest.fn(),
    like: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    range: jest.fn(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
  };

  // Make all methods return the same object for chaining
  Object.keys(chainMethods).forEach((key) => {
    if (key === 'single' || key === 'maybeSingle') {
      chainMethods[key].mockResolvedValue({ data: finalData, error: finalError });
    } else {
      chainMethods[key].mockReturnValue(chainMethods);
    }
  });

  // For queries that don't use .single(), resolve the promise
  (chainMethods as any).then = (callback: any) => {
    return Promise.resolve({ data: finalData, error: finalError, count: Array.isArray(finalData) ? finalData.length : null }).then(callback);
  };

  return chainMethods;
}

/**
 * Setup mock for addToWaitlist success scenario
 */
export function mockAddToWaitlistSuccess(mockSupabase: any, customer: any, packageData: any, tier: string, entry: any) {
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
      (mock as any).then = (callback: any) => {
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
export function mockAddToWaitlistDuplicate(mockSupabase: any, existingEntry: any) {
  mockSupabase.from.mockImplementation(() => {
    return createChainableMock([existingEntry]);
  });
}

/**
 * Setup mock for capacity full scenario
 */
export function mockAddToWaitlistCapacityFull(mockSupabase: any, customer: any, packageData: any, tier: string) {
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
      (mock as any).then = (callback: any) => {
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
export function mockProcessSlotSuccess(mockSupabase: any, entries: any[]) {
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
export function mockExpireEntriesSuccess(mockSupabase: any, expiredEntries: any[]) {
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
export function mockGetWaitlistEntriesSuccess(mockSupabase: any, entries: any[], total: number) {
  mockSupabase.from.mockImplementation(() => {
    const mock = createChainableMock(entries);
    // Override the promise to include count
    (mock as any).then = (callback: any) => {
      return Promise.resolve({ data: entries, error: null, count: total }).then(callback);
    };
    return mock;
  });
}
