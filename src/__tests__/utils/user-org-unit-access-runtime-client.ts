import { Client } from 'pg';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database.types';

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

function getDbUrl() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL;
  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL or SUPABASE_DATABASE_URL is required for user_org_unit_access proof');
  }
  return dbUrl;
}

class UserOrgUnitAccessQuery {
  private filters = new Map<string, unknown>();

  constructor(private readonly context: { tenantId: string; userId: string }) {}

  select() {
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.set(field, value);
    return this;
  }

  async execute(): Promise<QueryResult> {
    const tenantId = String(this.filters.get('tenant_id') ?? this.context.tenantId);
    const userId = String(this.filters.get('user_id') ?? this.context.userId);
    const client = new Client({ connectionString: getDbUrl() });

    await client.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        "SELECT set_config('app.current_user_id', $1, true), set_config('app.current_tenant_id', $2, true)",
        [userId, tenantId],
      );
      const result = await client.query(
        `SELECT access_source, org_unit_id, root_org_unit_id, user_id
         FROM public.user_org_unit_access
         WHERE tenant_id = $1::uuid
           AND user_id = $2::uuid`,
        [tenantId, userId],
      );
      await client.query('COMMIT');
      return { data: result.rows, error: null };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : String(error) },
      };
    } finally {
      await client.end();
    }
  }

  then(
    onfulfilled?: ((value: QueryResult) => unknown) | null,
    onrejected?: ((reason: unknown) => unknown) | null,
  ) {
    return this.execute().then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

export function createUserOrgUnitAccessRuntimeClient(
  adminSupabase: SupabaseClient<Database>,
  context: { tenantId: string; userId: string },
): SupabaseClient<Database> {
  const client = {
    auth: adminSupabase.auth,
    from: (table: string) => (
      table === 'user_org_unit_access'
        ? new UserOrgUnitAccessQuery(context)
        : adminSupabase.from(table as keyof Database['public']['Tables'] & keyof Database['public']['Views'])
    ),
    rpc: (...args: Parameters<SupabaseClient<Database>['rpc']>) => adminSupabase.rpc(...args),
  };

  return client as unknown as SupabaseClient<Database>;
}
