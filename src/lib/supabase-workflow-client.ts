/**
 * Workflow Supabase Client
 *
 * An untyped Supabase client (no Database generic) for workflow operations that
 * access tables not yet reflected in the auto-generated `database.types.ts`.
 *
 * When to use this:
 *   - `inventory_reservations` table (pending migration + type regen)
 *   - Any RPC not yet in the type definitions
 *
 * When NOT to use this:
 *   - All standard CRUD on known tables → use createClient() from supabase-server.ts
 *
 * TODO: Remove this file once the pending migration has been applied and types
 *       regenerated with `npx supabase gen types typescript`.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a service-role Supabase client without Database generic constraints.
 * This allows querying tables that are not yet in database.types.ts.
 *
 * ⚠️ NEVER use this for standard business operations — use the typed server
 *    client instead. This client bypasses RLS.
 */
export function createWorkflowAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      '[WorkflowAdminClient] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
