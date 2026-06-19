const mockGetKTVUpcomingSessions = jest.fn();

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    get: jest.fn(),
  })),
}));

jest.mock('@/services/ktv-actions', () => ({
  getKTVUpcomingSessions: (...args: unknown[]) => mockGetKTVUpcomingSessions(...args),
}));

jest.mock('@/core/middleware/tenantContext', () => ({
  withTenantContext: (handler: (request: unknown) => unknown) => handler,
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/test-upcoming/route';

const originalNodeEnv = process.env.NODE_ENV;
const originalVercelEnv = process.env.VERCEL_ENV;
const originalTestUpcomingSecret = process.env.TEST_UPCOMING_SECRET;
const originalCronSecret = process.env.CRON_SECRET;

function setNodeEnv(value: string) {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value,
    configurable: true,
    writable: true,
  });
}

function requestFor(url: string, headers?: HeadersInit) {
  return new NextRequest(url, { headers });
}

describe('GET /api/test-upcoming diagnostic guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNodeEnv('test');
    delete process.env.VERCEL_ENV;
    delete process.env.TEST_UPCOMING_SECRET;
    delete process.env.CRON_SECRET;
    mockGetKTVUpcomingSessions.mockResolvedValue([{ id: 'session-1' }]);
  });

  afterAll(() => {
    setNodeEnv(originalNodeEnv || 'test');

    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }

    if (originalTestUpcomingSecret === undefined) {
      delete process.env.TEST_UPCOMING_SECRET;
    } else {
      process.env.TEST_UPCOMING_SECRET = originalTestUpcomingSecret;
    }

    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalCronSecret;
    }
  });

  it('returns 404 in production and does not query sessions', async () => {
    process.env.VERCEL_ENV = 'production';

    const response = await GET(requestFor('https://app.bellaspa.vn/api/test-upcoming'));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Not found.' });
    expect(mockGetKTVUpcomingSessions).not.toHaveBeenCalled();
  });

  it('allows local diagnostic calls without a secret', async () => {
    const response = await GET(requestFor('http://localhost/api/test-upcoming'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      count: 1,
      sessions: [{ id: 'session-1' }],
    });
    expect(mockGetKTVUpcomingSessions).toHaveBeenCalledTimes(1);
  });

  it('blocks non-local diagnostic calls when no secret is configured', async () => {
    const response = await GET(requestFor('https://preview.bellaspa.vn/api/test-upcoming'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'Diagnostic endpoint is restricted.',
    });
    expect(mockGetKTVUpcomingSessions).not.toHaveBeenCalled();
  });

  it('allows non-local diagnostic calls with TEST_UPCOMING_SECRET bearer auth', async () => {
    process.env.TEST_UPCOMING_SECRET = 'diagnostic-secret';

    const response = await GET(requestFor('https://preview.bellaspa.vn/api/test-upcoming', {
      authorization: 'Bearer diagnostic-secret',
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, count: 1 });
    expect(mockGetKTVUpcomingSessions).toHaveBeenCalledTimes(1);
  });

  it('allows non-local diagnostic calls with CRON_SECRET query auth fallback', async () => {
    process.env.CRON_SECRET = 'cron-secret';

    const response = await GET(requestFor('https://preview.bellaspa.vn/api/test-upcoming?secret=cron-secret'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true, count: 1 });
    expect(mockGetKTVUpcomingSessions).toHaveBeenCalledTimes(1);
  });

  it('blocks non-local diagnostic calls with a wrong secret', async () => {
    process.env.TEST_UPCOMING_SECRET = 'diagnostic-secret';

    const response = await GET(requestFor('https://preview.bellaspa.vn/api/test-upcoming', {
      authorization: 'Bearer wrong-secret',
    }));

    expect(response.status).toBe(403);
    expect(mockGetKTVUpcomingSessions).not.toHaveBeenCalled();
  });

  it('returns an explicit failure when the session query fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetKTVUpcomingSessions.mockRejectedValueOnce(new Error('session query failed'));

    const response = await GET(requestFor('http://127.0.0.1/api/test-upcoming'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: 'session query failed',
    });
    consoleErrorSpy.mockRestore();
  });
});
