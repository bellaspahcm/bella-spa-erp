type RunnableSupabaseEnv = {
  readonly supabaseUrl: string;
  readonly supabaseKey: string;
};

const MOCK_SUPABASE_URL = 'https://mock.supabase.co';
const MOCK_SERVICE_ROLE_KEY = 'mock-service-role-key';

function isRunnableSupabaseUrl(value: string): boolean {
  if (!value.trim()) return false;

  try {
    const parsed = new URL(value);
    return Boolean(
      parsed.protocol.startsWith('http') &&
      parsed.hostname &&
      parsed.hostname !== 'mock.supabase.co' &&
      parsed.hostname !== 'base'
    );
  } catch {
    return false;
  }
}

export function requireRunnableSupabaseEnv(scope: string): RunnableSupabaseEnv {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const issues: string[] = [];

  if (!isRunnableSupabaseUrl(supabaseUrl)) {
    issues.push(
      supabaseUrl === MOCK_SUPABASE_URL
        ? 'NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL is mock.supabase.co.'
        : 'NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL is missing or not runnable.'
    );
  }

  if (!supabaseKey.trim() || supabaseKey === MOCK_SERVICE_ROLE_KEY) {
    issues.push(
      supabaseKey === MOCK_SERVICE_ROLE_KEY
        ? 'SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY is the Jest mock fallback.'
        : 'SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY is missing.'
    );
  }

  if (issues.length > 0) {
    throw new Error(
      [
        `REAL_DB_ENV_REQUIRED: ${scope} requires a real Supabase environment.`,
        ...issues,
        'Mock Supabase is not accepted as Bella English Go-Live evidence.',
      ].join(' ')
    );
  }

  return { supabaseUrl, supabaseKey };
}
