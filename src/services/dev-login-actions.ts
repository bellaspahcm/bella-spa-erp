'use server';

import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

type DevelopmentLoginBypassResult = {
  ok: boolean;
  redirectTo?: '/dashboard' | '/dashboard/hospital';
};

const HOSPITAL_DEMO_EMAILS = new Set([
  'bellaspa.testadmin@gmail.com',
  'admin@medical.vn',
  'admin@healthcare.vn',
]);

export async function validateDevelopmentLoginBypassEmail(
  email: string,
): Promise<DevelopmentLoginBypassResult> {
  if (process.env.NODE_ENV !== 'development') {
    return { ok: false };
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false };
  }

  if (HOSPITAL_DEMO_EMAILS.has(normalizedEmail)) {
    return { ok: true, redirectTo: '/dashboard/hospital' };
  }

  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  if (!adminUrl || !adminKey) {
    return { ok: false };
  }

  const admin = createClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from('users')
    .select('email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate development login email: ${error.message}`);
  }

  return data?.email ? { ok: true, redirectTo: '/dashboard' } : { ok: false };
}
