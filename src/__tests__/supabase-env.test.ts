import {
  getSupabasePublicKey,
  getSupabasePublicUrl,
  requireSupabasePublicEnv,
} from '@/lib/supabase-public-env';
import {
  getSupabaseAdminKey,
  getSupabaseAdminUrl,
  hasSupabaseAdminEnv,
  requireSupabaseAdminEnv,
} from '@/lib/supabase-admin-env';

const ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

const originalEnv = ENV_KEYS.reduce<Record<EnvKey, string | undefined>>((acc, key) => {
  acc[key] = process.env[key];
  return acc;
}, {} as Record<EnvKey, string | undefined>);

function clearSupabaseEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

function restoreSupabaseEnv() {
  clearSupabaseEnv();
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value !== undefined) process.env[key] = value;
  }
}

describe('Supabase env aliases', () => {
  beforeEach(clearSupabaseEnv);
  afterAll(restoreSupabaseEnv);

  it('prefers the new publishable key while keeping the legacy anon key as fallback', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://new.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_live';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon';

    expect(getSupabasePublicUrl()).toBe('https://new.supabase.co');
    expect(getSupabasePublicKey()).toBe('sb_publishable_live');
    expect(requireSupabasePublicEnv()).toEqual({
      url: 'https://new.supabase.co',
      publicKey: 'sb_publishable_live',
    });
  });

  it('falls back to the legacy anon key when the publishable key is not configured', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://legacy.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'legacy-anon';

    expect(requireSupabasePublicEnv()).toEqual({
      url: 'https://legacy.supabase.co',
      publicKey: 'legacy-anon',
    });
  });

  it('prefers the new secret key while keeping the legacy service role key as fallback', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://admin.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_live';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role';

    expect(getSupabaseAdminUrl()).toBe('https://admin.supabase.co');
    expect(getSupabaseAdminKey()).toBe('sb_secret_live');
    expect(hasSupabaseAdminEnv()).toBe(true);
    expect(requireSupabaseAdminEnv()).toEqual({
      url: 'https://admin.supabase.co',
      adminKey: 'sb_secret_live',
    });
  });

  it('supports SUPABASE_URL for server-only admin clients', () => {
    process.env.SUPABASE_URL = 'https://server-only.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'legacy-service-role';

    expect(requireSupabaseAdminEnv()).toEqual({
      url: 'https://server-only.supabase.co',
      adminKey: 'legacy-service-role',
    });
  });

  it('throws explicit errors when required Supabase env is missing', () => {
    expect(() => requireSupabasePublicEnv()).toThrow('Missing Supabase credentials');
    expect(() => requireSupabaseAdminEnv()).toThrow('must be set');
  });
});
