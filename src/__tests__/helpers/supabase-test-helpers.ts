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
  };

  // Make all methods return the same object for chaining
  Object.keys(chainMethods).forEach((key) => {
    if (key === 'single') {
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
  let callCount = 0;
  
  mockSupabase.from.mockImplementation((table: string) => {
    callCount++;
    
    // Call 1: Check for duplicates (empty)
    if (callCount === 1) {
      return createChainableMock([]);
    }
    
    // Call 2: Fetch customer
    if (callCount === 2) {
      return createChainableMock(customer);
    }
    
    // Call 3: Fetch membership tier
    if (callCount === 3) {
      return createChainableMock({ tier });
    }
    
    // Call 4: Fetch package
    if (callCount === 4) {
      return createChainableMock(packageData);
    }
    
    // Call 5: Fetch existing waitlist (empty)
    if (callCount === 5) {
      return createChainableMock([]);
    }
    
    // Call 6: Fetch preferred KTV (return mock KTV name)
    if (callCount === 6) {
      return createChainableMock({ full_name: 'KTV Senior' });
    }
    
    // Call 7: Insert new entry
    if (callCount === 7) {
      return createChainableMock(entry);
    }
    
    // Default
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
  let callCount = 0;
  
  mockSupabase.from.mockImplementation(() => {
    callCount++;
    
    // Call 1: Check for duplicates (empty)
    if (callCount === 1) {
      return createChainableMock([]);
    }
    
    // Call 2: Fetch customer
    if (callCount === 2) {
      return createChainableMock(customer);
    }
    
    // Call 3: Fetch membership tier
    if (callCount === 3) {
      return createChainableMock({ tier });
    }
    
    // Call 4: Fetch package
    if (callCount === 4) {
      return createChainableMock(packageData);
    }
    
    // Call 5: Fetch existing waitlist (full - 10 entries)
    if (callCount === 5) {
      const fullWaitlist = Array(10).fill({ id: 'entry-x' });
      return createChainableMock(fullWaitlist);
    }
    
    // Default
    return createChainableMock(null);
  });
}

/**
 * Setup mock for processSlotAvailable success
 */
export function mockProcessSlotSuccess(mockSupabase: any, entries: any[]) {
  let callCount = 0;
  
  mockSupabase.from.mockImplementation(() => {
    callCount++;
    
    // Call 1: Fetch matching entries
    if (callCount === 1) {
      return createChainableMock(entries);
    }
    
    // Subsequent calls: Update status (return null data, null error)
    return {
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
  });
}

/**
 * Setup mock for expireOldEntries success
 */
export function mockExpireEntriesSuccess(mockSupabase: any, expiredEntries: any[]) {
  let callCount = 0;
  
  mockSupabase.from.mockImplementation(() => {
    callCount++;
    
    // Call 1: Fetch expired entries
    if (callCount === 1) {
      return createChainableMock(expiredEntries);
    }
    
    // Call 2: Update status to expired
    return {
      update: jest.fn().mockReturnValue({
        in: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
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
