const mockCreateServerClient = jest.fn(() => ({
  auth: {
    getUser: jest.fn(),
  },
}));

jest.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => mockCreateServerClient(...args),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
  })),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(async () => ({
    get: jest.fn(),
    set: jest.fn(),
  })),
  headers: jest.fn(async () => ({
    get: jest.fn(() => null),
  })),
}));

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

const originalEnv = ENV_KEYS.reduce<Record<(typeof ENV_KEYS)[number], string | undefined>>((acc, key) => {
  acc[key] = process.env[key];
  return acc;
}, {} as Record<(typeof ENV_KEYS)[number], string | undefined>);

function restoreEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
    const value = originalEnv[key];
    if (value !== undefined) process.env[key] = value;
  }
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
}

describe('Supabase server client env contract', () => {
  beforeEach(() => {
    jest.resetModules();
    mockCreateServerClient.mockClear();
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.NODE_ENV = 'production';
  });

  afterAll(restoreEnv);

  it('uses the canonical publishable key fallback for production SSR clients', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://production.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-key';

    const { createClient } = await import('../lib/supabase-server');
    await createClient();

    expect(mockCreateServerClient).toHaveBeenCalledWith(
      'https://production.supabase.co',
      'publishable-key',
      expect.objectContaining({
        cookies: expect.any(Object),
      }),
    );
  });
});
