import {
  getSupabasePublicUrl,
  SUPABASE_PUBLIC_URL_ENV_LABEL,
} from '@/lib/supabase-public-env';

export const SUPABASE_ADMIN_URL_ENV_LABEL =
  `${SUPABASE_PUBLIC_URL_ENV_LABEL} or SUPABASE_URL`;
export const SUPABASE_ADMIN_KEY_ENV_LABEL =
  'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY';

export function getSupabaseAdminUrl(): string {
  return getSupabasePublicUrl() || process.env.SUPABASE_URL || '';
}

export function getSupabaseAdminKey(): string {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  // Ignore the local mock/test key if it was accidentally copied to production/staging env
  const isWrongTestKey = secretKey === 'sb_secret_Dmz5w0qvg_xw5lZ1jONptQ_dPLJbdYx';
  
  if (isWrongTestKey && process.env.NODE_ENV === 'production') {
    return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  }
  
  return secretKey ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

export function hasSupabaseAdminEnv(): boolean {
  return Boolean(getSupabaseAdminUrl() && getSupabaseAdminKey());
}

export function requireSupabaseAdminEnv(): { url: string; adminKey: string } {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  if (!url || !adminKey) {
    throw new Error(
      `${SUPABASE_ADMIN_URL_ENV_LABEL} and ${SUPABASE_ADMIN_KEY_ENV_LABEL} must be set.`,
    );
  }

  return { url, adminKey };
}
