import { rateLimit } from '../lib/rate-limit';

describe('Token Bucket Rate Limiting', () => {
  beforeEach(() => {
    // Reset/clear internal buckets map if possible, but since it's a module level variable,
    // we can use unique identifiers for each test case to avoid pollution.
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should allow requests within capacity', () => {
    const ip = 'ip_test_1';
    // Capacity 3, refill rate 1 token per second
    expect(rateLimit(ip, 3, 1)).toBe(true); // 3 -> 2
    expect(rateLimit(ip, 3, 1)).toBe(true); // 2 -> 1
    expect(rateLimit(ip, 3, 1)).toBe(true); // 1 -> 0
    expect(rateLimit(ip, 3, 1)).toBe(false); // 0 -> fails
  });

  it('should refill tokens over time', () => {
    const ip = 'ip_test_2';
    // Capacity 3, refill rate 1 token per second
    expect(rateLimit(ip, 3, 1)).toBe(true); // 3 -> 2
    expect(rateLimit(ip, 3, 1)).toBe(true); // 2 -> 1
    expect(rateLimit(ip, 3, 1)).toBe(true); // 1 -> 0
    expect(rateLimit(ip, 3, 1)).toBe(false); // fails

    // Advance time by 2 seconds (should refill 2 tokens)
    jest.advanceTimersByTime(2000);

    expect(rateLimit(ip, 3, 1)).toBe(true); // 2 -> 1
    expect(rateLimit(ip, 3, 1)).toBe(true); // 1 -> 0
    expect(rateLimit(ip, 3, 1)).toBe(false); // fails
  });

  it('should respect max capacity when refilled excessively', () => {
    const ip = 'ip_test_3';
    // Capacity 3, refill rate 1 token per second
    expect(rateLimit(ip, 3, 1)).toBe(true); // 3 -> 2
    expect(rateLimit(ip, 3, 1)).toBe(true); // 2 -> 1
    expect(rateLimit(ip, 3, 1)).toBe(true); // 1 -> 0

    // Advance time by 100 seconds (should refill but cap at capacity 3)
    jest.advanceTimersByTime(100000);

    expect(rateLimit(ip, 3, 1)).toBe(true); // 3 -> 2
    expect(rateLimit(ip, 3, 1)).toBe(true); // 2 -> 1
    expect(rateLimit(ip, 3, 1)).toBe(true); // 1 -> 0
    expect(rateLimit(ip, 3, 1)).toBe(false); // fails
  });

  it('should isolate different identifiers', () => {
    const ip1 = 'ip_test_4';
    const ip2 = 'ip_test_5';

    // Exhaust ip1
    expect(rateLimit(ip1, 2, 1)).toBe(true);
    expect(rateLimit(ip1, 2, 1)).toBe(true);
    expect(rateLimit(ip1, 2, 1)).toBe(false);

    // ip2 should still succeed
    expect(rateLimit(ip2, 2, 1)).toBe(true);
    expect(rateLimit(ip2, 2, 1)).toBe(true);
    expect(rateLimit(ip2, 2, 1)).toBe(false);
  });
});
