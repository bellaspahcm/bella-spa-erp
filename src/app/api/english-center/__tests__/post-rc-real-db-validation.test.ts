import { Client } from 'pg';

type TableExpectation = {
  readonly tableName: string;
  readonly requiresBranchScope: boolean;
};

type RlsRow = {
  readonly table_name: string;
  readonly rls_enabled: boolean;
  readonly tenant_column_count: string;
  readonly branch_column_count: string;
  readonly policy_count: string;
};

const dbUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  '';

function isRunnableDbUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.hostname && parsed.hostname !== 'base');
  } catch {
    return false;
  }
}

const hasRunnableDbUrl = isRunnableDbUrl(dbUrl);
const describeIfDb = hasRunnableDbUrl ? describe : describe.skip;

const tableExpectations: readonly TableExpectation[] = [
  { tableName: 'english_center_enrollments', requiresBranchScope: true },
  { tableName: 'english_center_programs', requiresBranchScope: true },
  { tableName: 'english_center_courses', requiresBranchScope: false },
  { tableName: 'english_center_classes', requiresBranchScope: true },
  { tableName: 'english_center_rooms', requiresBranchScope: true },
  { tableName: 'english_center_class_sessions', requiresBranchScope: true },
  { tableName: 'english_center_session_attendance', requiresBranchScope: true },
  { tableName: 'english_center_learning_progress', requiresBranchScope: true },
  { tableName: 'english_center_tuition_plans', requiresBranchScope: true },
  { tableName: 'english_center_tuition_assignments', requiresBranchScope: true },
  { tableName: 'english_center_tuition_invoices', requiresBranchScope: true },
  { tableName: 'english_center_tuition_invoice_lines', requiresBranchScope: false },
  { tableName: 'english_center_tuition_payments', requiresBranchScope: true },
  { tableName: 'english_center_tuition_payment_allocations', requiresBranchScope: false },
  { tableName: 'english_center_engagement_templates', requiresBranchScope: true },
  { tableName: 'english_center_engagement_messages', requiresBranchScope: true },
  { tableName: 'english_center_engagement_recipients', requiresBranchScope: true },
  { tableName: 'english_center_engagement_responses', requiresBranchScope: true },
];

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

describeIfDb('English Center Post-RC real database validation', () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({
      connectionString: dbUrl,
      ssl: sslConfig(),
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.end();
  });

  it('keeps all RC product tables present with RLS policies and tenant scope', async () => {
    const tableNames = tableExpectations.map((item) => item.tableName);
    const result = await client.query<RlsRow>(
      `
        SELECT
          c.relname AS table_name,
          c.relrowsecurity AS rls_enabled,
          COUNT(*) FILTER (WHERE a.attname = 'tenant_id')::text AS tenant_column_count,
          COUNT(*) FILTER (WHERE a.attname = 'branch_id')::text AS branch_column_count,
          COUNT(DISTINCT p.policyname)::text AS policy_count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        LEFT JOIN pg_attribute a
          ON a.attrelid = c.oid
          AND a.attnum > 0
          AND NOT a.attisdropped
        LEFT JOIN pg_policies p
          ON p.schemaname = n.nspname
          AND p.tablename = c.relname
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relname = ANY($1)
        GROUP BY c.relname, c.relrowsecurity
        ORDER BY c.relname;
      `,
      [tableNames],
    );

    const byTable = new Map(result.rows.map((row) => [row.table_name, row]));

    expect([...byTable.keys()].sort()).toEqual([...tableNames].sort());

    for (const expectation of tableExpectations) {
      const row = byTable.get(expectation.tableName);
      expect(row, `${expectation.tableName} should exist in public schema`).toBeDefined();
      if (!row) continue;

      expect(row.rls_enabled, `${expectation.tableName} should have RLS enabled`).toBe(true);
      expect(Number(row.tenant_column_count), `${expectation.tableName} should expose tenant_id`).toBe(1);
      expect(Number(row.policy_count), `${expectation.tableName} should have at least one RLS policy`).toBeGreaterThan(0);

      if (expectation.requiresBranchScope) {
        expect(Number(row.branch_column_count), `${expectation.tableName} should expose branch_id`).toBe(1);
      }
    }
  });
});

if (!hasRunnableDbUrl) {
  // Jest reports this suite as skipped. Keep the reason close to the gate so a
  // missing DB URL is not confused with a real database PASS.
  console.warn(
    'Skipping English Center Post-RC real database validation: no runnable DATABASE_URL, SUPABASE_DATABASE_URL, or SUPABASE_DB_URL is configured.',
  );
}
