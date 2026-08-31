const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { loadLocalEnv } = require('./load-local-env.cjs');

loadLocalEnv();

const financeTables = [
  'finance_accounts',
  'finance_accounting_periods',
  'finance_control_account_mappings',
  'finance_prepayment_posting_policy_mappings',
  'finance_transactions',
  'finance_transaction_lines',
  'finance_cash_movements',
  'finance_receivable_allocations',
  'finance_invoices',
  'finance_payable_ledger',
  'finance_payable_allocations',
  'finance_vendor_bills',
  'finance_vendor_prepayments',
  'f5_control_results',
  'f5_control_cases',
];

const financeTableSqlArray = `ARRAY[${financeTables.map((tableName) => `'${tableName}'`).join(',')}]`;

function getConnectionString() {
  return process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '';
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = $1
     ) AS exists`,
    [tableName]
  );
  return Boolean(result.rows[0]?.exists);
}

async function runCheck(client, check) {
  const missing = [];
  for (const tableName of check.tables || []) {
    if (!(await tableExists(client, tableName))) missing.push(tableName);
  }

  if (missing.length > 0) {
    return {
      id: check.id,
      category: check.category,
      severity: 'SKIPPED',
      status: 'SKIPPED',
      description: check.description,
      missing_tables: missing,
      row_count: null,
      sample: [],
    };
  }

  const result = await client.query(check.sql, check.params || []);
  const rowCount = result.rows.length;
  const productionRiskCount = check.productionRiskColumn
    ? result.rows.filter((row) => row[check.productionRiskColumn] === true).length
    : null;
  const status = rowCount === 0
    ? 'PASS'
    : productionRiskCount === 0 && check.productionRiskColumn
      ? 'WARN'
      : check.nonZeroStatus || 'FAIL';

  return {
    id: check.id,
    category: check.category,
    severity: check.severity,
    status,
    description: check.description,
    row_count: rowCount,
    production_risk_count: productionRiskCount,
    sample: result.rows.slice(0, 10),
  };
}

function summarize(results) {
  return results.reduce(
    (summary, result) => {
      summary.total += 1;
      summary[result.status.toLowerCase()] = (summary[result.status.toLowerCase()] || 0) + 1;
      if (result.status === 'FAIL') summary.is_green = false;
      return summary;
    },
    { total: 0, pass: 0, warn: 0, fail: 0, skipped: 0, is_green: true }
  );
}

function toMarkdown(payload) {
  const lines = [
    '# Finance Production Hardening Tenant Isolation Audit',
    '',
    `Generated at: ${payload.generated_at}`,
    `Environment host: ${payload.environment_host}`,
    '',
    '## Summary',
    '',
    `- Total checks: ${payload.summary.total}`,
    `- PASS: ${payload.summary.pass}`,
    `- WARN: ${payload.summary.warn}`,
    `- FAIL: ${payload.summary.fail}`,
    `- SKIPPED: ${payload.summary.skipped}`,
    `- Green: ${payload.summary.is_green}`,
    '',
    '## Checks',
    '',
  ];

  for (const result of payload.results) {
    lines.push(`### ${result.id} - ${result.status}`);
    lines.push('');
    lines.push(`Category: ${result.category}`);
    lines.push(`Severity: ${result.severity}`);
    lines.push(`Description: ${result.description}`);
    if (result.missing_tables?.length) {
      lines.push(`Missing tables: ${result.missing_tables.join(', ')}`);
    } else {
      lines.push(`Rows: ${result.row_count}`);
      if (result.production_risk_count !== null) {
        lines.push(`Production-risk rows: ${result.production_risk_count}`);
      }
    }
    if (result.sample?.length) {
      lines.push('');
      lines.push('Sample:');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(result.sample, null, 2));
      lines.push('```');
    }
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

const testTenantPattern = '(^F[0-9]|FIN-OS-E2E|test|proof|demo|verification|concurrency|stress|fixture|integration)';

const checks = [
  {
    id: 'SI-001',
    category: 'RLS Coverage',
    severity: 'P0',
    description: 'Finance/F5 tenant-scoped tables must have RLS enabled and at least one policy.',
    sql: `
      SELECT target.table_name,
             COALESCE(c.relrowsecurity, false) AS rls_enabled,
             COUNT(p.polname)::INT AS policy_count
      FROM unnest(${financeTableSqlArray}::TEXT[]) AS target(table_name)
      LEFT JOIN pg_class c
        ON c.relname = target.table_name
       AND c.relnamespace = 'public'::regnamespace
      LEFT JOIN pg_policy p
        ON p.polrelid = c.oid
      GROUP BY target.table_name, c.relrowsecurity
      HAVING COALESCE(c.relrowsecurity, false) = false
          OR COUNT(p.polname) = 0
      ORDER BY target.table_name
    `,
  },
  {
    id: 'SI-002',
    category: 'RLS Policy Shape',
    severity: 'P1',
    nonZeroStatus: 'WARN',
    description: 'RLS policies using get_auth_tenant_id() IS NULL are HQ-admin bypass candidates and require explicit review.',
    sql: `
      SELECT tablename, policyname, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY(${financeTableSqlArray}::TEXT[])
        AND (
          COALESCE(qual, '') ILIKE '%get_auth_tenant_id() IS NULL%'
          OR COALESCE(with_check, '') ILIKE '%get_auth_tenant_id() IS NULL%'
        )
      ORDER BY tablename, policyname
    `,
  },
  {
    id: 'SI-003',
    category: 'Accounting Config Isolation',
    severity: 'P0',
    description: 'Control account mappings must resolve to an active same-tenant account.',
    tables: ['finance_control_account_mappings', 'finance_accounts'],
    productionRiskColumn: 'production_risk',
    sql: `
      SELECT
        m.tenant_id,
        ten.name AS tenant_name,
        ten.status AS tenant_status,
        (
          ten.id IS NOT NULL
          AND ten.status = 'active'
          AND ten.name !~* '${testTenantPattern}'
        ) AS production_risk,
        m.control_type,
        m.account_code
      FROM public.finance_control_account_mappings m
      LEFT JOIN public.finance_accounts a
        ON a.tenant_id = m.tenant_id
       AND a.code = m.account_code
       AND a.is_active = TRUE
      LEFT JOIN public.tenants ten
        ON ten.id = m.tenant_id
      WHERE a.id IS NULL
      ORDER BY production_risk DESC, tenant_name NULLS LAST, m.control_type
      LIMIT 50
    `,
  },
  {
    id: 'SI-004',
    category: 'Accounting Config Isolation',
    severity: 'P0',
    description: 'Prepayment posting policy mappings must resolve debit/credit accounts within the same tenant only.',
    tables: ['finance_prepayment_posting_policy_mappings', 'finance_accounts'],
    sql: `
      SELECT m.tenant_id, ten.name AS tenant_name, m.event_type, m.debit_account_code, m.credit_account_code
      FROM public.finance_prepayment_posting_policy_mappings m
      LEFT JOIN public.finance_accounts da
        ON da.tenant_id = m.tenant_id
       AND da.code = m.debit_account_code
       AND da.is_active = TRUE
      LEFT JOIN public.finance_accounts ca
        ON ca.tenant_id = m.tenant_id
       AND ca.code = m.credit_account_code
       AND ca.is_active = TRUE
      LEFT JOIN public.tenants ten
        ON ten.id = m.tenant_id
      WHERE da.id IS NULL
         OR (m.credit_account_code IS NOT NULL AND ca.id IS NULL)
      LIMIT 50
    `,
  },
  {
    id: 'SI-005',
    category: 'F1 Tenant Isolation',
    severity: 'P0',
    description: 'F1 transaction lines must point to same-tenant accounts.',
    tables: ['finance_transaction_lines', 'finance_accounts'],
    sql: `
      SELECT l.tenant_id, ten.name AS tenant_name, l.transaction_id, l.account_id, a.tenant_id AS account_tenant_id
      FROM public.finance_transaction_lines l
      JOIN public.finance_accounts a
        ON a.id = l.account_id
      LEFT JOIN public.tenants ten
        ON ten.id = l.tenant_id
      WHERE a.tenant_id <> l.tenant_id
      LIMIT 50
    `,
  },
  {
    id: 'SI-006',
    category: 'F2 Tenant Isolation',
    severity: 'P0',
    description: 'F2 cash movements must point to same-tenant bank accounts.',
    tables: ['finance_cash_movements', 'finance_bank_accounts'],
    sql: `
      SELECT cm.tenant_id, ten.name AS tenant_name, cm.id AS cash_movement_id,
             cm.bank_account_id, ba.tenant_id AS bank_account_tenant_id
      FROM public.finance_cash_movements cm
      JOIN public.finance_bank_accounts ba
        ON ba.id = cm.bank_account_id
      LEFT JOIN public.tenants ten
        ON ten.id = cm.tenant_id
      WHERE ba.tenant_id <> cm.tenant_id
      LIMIT 50
    `,
  },
  {
    id: 'SI-007',
    category: 'F3 Tenant Isolation',
    severity: 'P0',
    description: 'F3 receivable allocations must link invoice and cash movement inside the same tenant.',
    tables: ['finance_receivable_allocations', 'finance_invoices', 'finance_cash_movements'],
    productionRiskColumn: 'production_risk',
    sql: `
      SELECT
        ra.tenant_id,
        ten.name AS tenant_name,
        ten.status AS tenant_status,
        (
          ten.id IS NOT NULL
          AND ten.status = 'active'
          AND ten.name !~* '${testTenantPattern}'
        ) AS production_risk,
        ra.id AS allocation_id,
        i.tenant_id AS invoice_tenant_id,
        cm.tenant_id AS cash_movement_tenant_id
      FROM public.finance_receivable_allocations ra
      LEFT JOIN public.finance_invoices i
        ON i.id = ra.invoice_id
      LEFT JOIN public.finance_cash_movements cm
        ON cm.id = ra.cash_movement_id
      LEFT JOIN public.tenants ten
        ON ten.id = ra.tenant_id
      WHERE i.tenant_id IS DISTINCT FROM ra.tenant_id
         OR cm.tenant_id IS DISTINCT FROM ra.tenant_id
      ORDER BY production_risk DESC, tenant_name NULLS LAST
      LIMIT 50
    `,
  },
  {
    id: 'SI-008',
    category: 'F4 Tenant Isolation',
    severity: 'P0',
    description: 'F4 payable allocations must link vendor bills and cash movements inside the same tenant.',
    tables: ['finance_payable_allocations', 'finance_vendor_bills', 'finance_cash_movements'],
    sql: `
      SELECT pa.tenant_id, ten.name AS tenant_name, pa.id AS allocation_id,
             b.tenant_id AS bill_tenant_id, cm.tenant_id AS cash_movement_tenant_id
      FROM public.finance_payable_allocations pa
      LEFT JOIN public.finance_vendor_bills b
        ON b.id = pa.vendor_bill_id
      LEFT JOIN public.finance_cash_movements cm
        ON cm.id = pa.cash_outflow_id
      LEFT JOIN public.tenants ten
        ON ten.id = pa.tenant_id
      WHERE b.tenant_id IS DISTINCT FROM pa.tenant_id
         OR cm.tenant_id IS DISTINCT FROM pa.tenant_id
      LIMIT 50
    `,
  },
  {
    id: 'SI-009',
    category: 'F4 Tenant Isolation',
    severity: 'P0',
    description: 'F4 prepayment facts matched to bills must reference same-tenant bills.',
    tables: ['finance_vendor_prepayments', 'finance_vendor_bills'],
    sql: `
      SELECT p.tenant_id, ten.name AS tenant_name, p.id AS prepayment_fact_id,
             p.matched_vendor_bill_id, b.tenant_id AS bill_tenant_id
      FROM public.finance_vendor_prepayments p
      LEFT JOIN public.finance_vendor_bills b
        ON b.id = p.matched_vendor_bill_id
      LEFT JOIN public.tenants ten
        ON ten.id = p.tenant_id
      WHERE p.matched_vendor_bill_id IS NOT NULL
        AND b.tenant_id IS DISTINCT FROM p.tenant_id
      LIMIT 50
    `,
  },
  {
    id: 'SI-010',
    category: 'F5 Tenant Isolation',
    severity: 'P0',
    description: 'F5 control cases must reference same-tenant F5 control results.',
    tables: ['f5_control_cases', 'f5_control_results'],
    sql: `
      SELECT c.tenant_id, ten.name AS tenant_name, c.case_id, c.result_id, r.tenant_id AS result_tenant_id
      FROM public.f5_control_cases c
      LEFT JOIN public.f5_control_results r
        ON r.result_id = c.result_id
      LEFT JOIN public.tenants ten
        ON ten.id = c.tenant_id
      WHERE r.tenant_id IS DISTINCT FROM c.tenant_id
      LIMIT 50
    `,
  },
  {
    id: 'SI-011',
    category: 'RPC Boundary',
    severity: 'P1',
    nonZeroStatus: 'WARN',
    description: 'Finance SECURITY DEFINER RPCs executable by anon/public/authenticated should be reviewed for explicit tenant and role guards.',
    sql: `
      SELECT n.nspname AS schema_name,
             p.oid::regprocedure::TEXT AS function_signature,
             p.prosecdef AS security_definer,
             r.rolname AS granted_role
      FROM pg_proc p
      JOIN pg_namespace n
        ON n.oid = p.pronamespace
      JOIN information_schema.routine_privileges rp
        ON rp.specific_schema = n.nspname
       AND rp.routine_name = p.proname
      JOIN pg_roles r
        ON r.rolname = rp.grantee
      WHERE n.nspname = 'public'
        AND (p.proname LIKE 'finance_%' OR p.proname LIKE 'f5_%')
        AND r.rolname IN ('anon', 'authenticated', 'public')
        AND p.prosecdef = TRUE
      ORDER BY function_signature, granted_role
      LIMIT 100
    `,
  },
  {
    id: 'SI-012',
    category: 'Retained Evidence Boundary',
    severity: 'INFO',
    nonZeroStatus: 'WARN',
    description: 'Active test/proof Finance tenants should be marked as retained evidence or suspended to avoid production confusion.',
    productionRiskColumn: 'production_risk',
    tables: ['tenants'],
    sql: `
      SELECT id, name, status,
             metadata->>'f4_proof_retained_evidence' AS f4_proof_retained_evidence,
             (
               status = 'active'
               AND name ~* '${testTenantPattern}'
               AND COALESCE(metadata->>'f4_proof_retained_evidence', 'false') <> 'true'
             ) AS production_risk
      FROM public.tenants
      WHERE status = 'active'
        AND name ~* '${testTenantPattern}'
      ORDER BY name
      LIMIT 100
    `,
  },
];

async function main() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    console.error('Missing DB connection. Set SUPABASE_DB_URL, SUPABASE_DATABASE_URL, or DATABASE_URL.');
    process.exit(1);
  }

  const environmentHost = (() => {
    try {
      return new URL(connectionString).hostname;
    } catch {
      return 'unknown';
    }
  })();

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const results = [];
    for (const check of checks) {
      results.push(await runCheck(client, check));
    }

    const payload = {
      generated_at: new Date().toISOString(),
      environment_host: environmentHost,
      summary: summarize(results),
      results,
    };

    const outDir = path.resolve(process.cwd(), 'output', 'implementation-artifacts');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = payload.generated_at.replace(/[-:.TZ]/g, '').slice(0, 14);
    const jsonPath = path.join(outDir, `finance-production-hardening-tenant-isolation-${stamp}.json`);
    const mdPath = path.join(outDir, `finance-production-hardening-tenant-isolation-${stamp}.md`);

    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
    fs.writeFileSync(mdPath, toMarkdown(payload));

    for (const result of results) {
      console.log(`[${result.status}] ${result.id} ${result.category}: ${result.row_count ?? 'n/a'} rows`);
    }
    console.log(`Evidence JSON: ${jsonPath}`);
    console.log(`Evidence MD: ${mdPath}`);

    if (!payload.summary.is_green) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  checks,
  financeTables,
  runCheck,
  summarize,
};
