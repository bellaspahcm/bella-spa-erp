export const SUPABASE_PUBLIC_URL_ENV_LABEL = 'NEXT_PUBLIC_SUPABASE_URL';
export const SUPABASE_PUBLIC_KEY_ENV_LABEL =
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY';

export function getSupabasePublicUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
}

export function getSupabasePublicKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ''
  );
}

export function requireSupabasePublicEnv(): { url: string; publicKey: string } {
  const url = getSupabasePublicUrl();
  const publicKey = getSupabasePublicKey();

  if (!url || !publicKey) {
    throw new Error(
      `Missing Supabase credentials (${SUPABASE_PUBLIC_URL_ENV_LABEL} and ${SUPABASE_PUBLIC_KEY_ENV_LABEL}).`,
    );
  }

  return { url, publicKey };
}
