const requiredRealDbEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

const missingRealDbEnv = requiredRealDbEnv.filter((key) => !process.env[key]);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const fallbackRealDbEnv = [
  supabaseUrl === 'https://mock.supabase.co' ? 'NEXT_PUBLIC_SUPABASE_URL=mock.supabase.co' : '',
  serviceRoleKey === 'mock-service-role-key' ? 'SUPABASE_SERVICE_ROLE_KEY=mock-service-role-key' : '',
].filter(Boolean);

if (
  missingRealDbEnv.length > 0
  || fallbackRealDbEnv.length > 0
) {
  throw new Error(
    [
      'Missing required Supabase environment for real-DB integration test.',
      `Missing: ${missingRealDbEnv.join(', ') || 'none'}.`,
      `Fallback/mock values: ${fallbackRealDbEnv.join(', ') || 'none'}.`,
      'Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to real E2E credentials.',
    ].join(' ')
  );
}
