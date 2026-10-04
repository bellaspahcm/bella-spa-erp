import { getHealthRuntimeEnvironment } from '../runtime-environment';

describe('health runtime environment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.DEPLOYMENT_ENV;
    delete process.env.VERCEL_ENV;
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('prefers explicit deployment environment', () => {
    process.env.DEPLOYMENT_ENV = 'production-candidate';
    process.env.VERCEL_ENV = 'production';
    process.env.NODE_ENV = 'production';

    expect(getHealthRuntimeEnvironment()).toBe('production-candidate');
  });

  it('uses Vercel runtime environment when DEPLOYMENT_ENV is not set', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.NODE_ENV = 'production';

    expect(getHealthRuntimeEnvironment()).toBe('production');
  });

  it('uses Node runtime environment before falling back to development', () => {
    process.env.NODE_ENV = 'production';

    expect(getHealthRuntimeEnvironment()).toBe('production');
  });

  it('falls back to development only when no runtime environment is available', () => {
    expect(getHealthRuntimeEnvironment()).toBe('development');
  });
});
