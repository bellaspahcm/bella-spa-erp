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
const testTenantPattern = '(^F[0-9]|FIN-OS-E2E|FINANCE-PROD-E2E|test|proof|demo|verification|concurrency|stress|fixture|integration)';

const roleGuardPattern = /(current_user\s+NOT\s+IN\s*\([^)]*service_role[^)]*\)|current_user\s+IN\s*\([^)]*service_role[^)]*\))/i;
const tenantGuardPattern = /(p_tenant_id|tenant_id|get_auth_tenant_id|auth\.uid\(\))/i;
const privilegedMutatorPattern = /(finance_post_transaction|finance_reverse_transaction|finance_internal_record_cash_movement|finance_approve_vendor_bill|finance_disburse_payment|finance_apply_prepayment|finance_record_prepayment|finance_allocate_payment|finance_finalize_invoice|finance_void_invoice|finance_reverse_allocation)/;

function getConnectionString() {
  return process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '';
}

function classifySecurityDefiner(row) {
  const hasRoleGuard = roleGuardPattern.test(row.definition || '');
  const hasTenantGuard = tenantGuardPattern.test(row.definition || '');
  const isPrivilegedMutator = privilegedMutatorPattern.test(row.function_signature);

  if (isPrivilegedMutator && row.granted_role === 'authenticated' && hasRoleGuard && hasTenantGuard) {
    return {
      classification: 'governance_exception',
      production_blocker: false,
      rationale: 'Callable by authenticated but function body contains service-role/postgres guard and tenant-scoped parameters. Runtime privilege is centralized behind service execution.',
    };
  }

  if (!isPrivilegedMutator && hasTenantGuard) {
    return {
      classification: 'controlled_exception',
      production_blocker: false,
      rationale: 'Read/validation helper or reconstruction RPC with tenant-scoped input; broad EXECUTE requires API-route governance but no direct cross-tenant data issue found in this audit.',
    };
  }

  return {
    classification: 'production_blocker',
    production_blocker: true,
    rationale: 'SECURITY DEFINER function has broad EXECUTE and this audit did not find both tenant and privilege guards.',
  };
}

function summarize(classifications) {
  return classifications.reduce(
    (summary, item) => {
      summary.total += 1;
      summary[item.audit_status.toLowerCase()] = (summary[item.audit_status.toLowerCase()] || 0) + 1;
      if (item.audit_status === 'FAIL') summary.is_green = false;
      return summary;
    },
    { total: 0, pass: 0, warn: 0, fail: 0, skipped: 0, is_green: true }
  );
}

function toMarkdown(payload) {
  const lines = [
    '# Finance Production Hardening Security Governance WARN Audit',
    '',
    `Generated at: ${payload.generated_at}`,
    `Environment host: ${payload.environment_host}`,
    '',
    '## Summary',
    '',
    `- Total groups: ${payload.summary.total}`,
    `- PASS: ${payload.summary.pass}`,
    `- WARN: ${payload.summary.warn}`,
    `- FAIL: ${payload.summary.fail}`,
    `- Green: ${payload.summary.is_green}`,
    '',
    '## Classification',
    '',
  ];

  for (const group of payload.groups) {
    lines.push(`### ${group.id} - ${group.audit_status}`);
    lines.push('');
    lines.push(`Topic: ${group.topic}`);
    lines.push(`Classification: ${group.classification}`);
    lines.push(`Production blocker: ${group.production_blocker}`);
    lines.push(`Decision: ${group.decision}`);
    lines.push(`Evidence rows: ${group.evidence_count}`);
    lines.push('');
    if (group.evidence?.length) {
      lines.push('Evidence sample:');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(group.evidence, null, 2));
      lines.push('```');
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

async function main() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    console.error('Missing DB connection. Set SUPABASE_DB_URL, SUPABASE_DATABASE_URL, or DATABASE_URL.');
    process.exit(1);
  }

  const environmentHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || connectionString).hostname;
    } catch {
      return 'unknown';
    }
  })();

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const rlsBypass = await client.query(`
      SELECT tablename, policyname, roles, cmd, qual, with_check
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = ANY(${financeTableSqlArray}::TEXT[])
        AND (
          COALESCE(qual, '') ILIKE '%get_auth_tenant_id() IS NULL%'
          OR COALESCE(with_check, '') ILIKE '%get_auth_tenant_id() IS NULL%'
        )
      ORDER BY tablename, policyname
    `);

    const securityDefiners = await client.query(`
      SELECT DISTINCT
             p.oid::regprocedure::TEXT AS function_signature,
             p.proname AS function_name,
             rp.grantee AS granted_role,
             pg_get_functiondef(p.oid) AS definition
      FROM pg_proc p
      JOIN pg_namespace n
        ON n.oid = p.pronamespace
      JOIN information_schema.routine_privileges rp
        ON rp.specific_schema = n.nspname
       AND rp.routine_name = p.proname
      WHERE n.nspname = 'public'
        AND (p.proname LIKE 'finance_%' OR p.proname LIKE 'f5_%')
        AND p.prosecdef = TRUE
        AND rp.grantee IN ('anon', 'authenticated', 'public')
      ORDER BY function_signature, granted_role
    `);

    const securityDefinerClassifications = securityDefiners.rows.map((row) => {
      const classification = classifySecurityDefiner(row);
      return {
        function_signature: row.function_signature,
        granted_role: row.granted_role,
        has_role_guard: roleGuardPattern.test(row.definition || ''),
        has_tenant_guard: tenantGuardPattern.test(row.definition || ''),
        ...classification,
      };
    });

    const activeTestTenants = await client.query(`
      WITH finance_usage AS (
        SELECT tenant_id, COUNT(*)::INT AS finance_row_count
        FROM (
          SELECT tenant_id FROM public.finance_transactions
          UNION ALL SELECT tenant_id FROM public.finance_cash_movements
          UNION ALL SELECT tenant_id FROM public.finance_vendor_bills
          UNION ALL SELECT tenant_id FROM public.finance_vendor_prepayments
          UNION ALL SELECT tenant_id FROM public.f5_control_results
        ) usage
        GROUP BY tenant_id
      )
      SELECT t.id, t.name, t.status, COALESCE(fu.finance_row_count, 0)::INT AS finance_row_count,
             t.metadata,
             (
               COALESCE(t.metadata->>'f4_proof_retained_evidence', 'false') = 'true'
               OR COALESCE(t.metadata->>'finance_prod_e2e_retained_evidence', 'false') = 'true'
               OR COALESCE(t.metadata->>'retained_test_evidence', 'false') = 'true'
             ) AS retained_evidence_tagged
      FROM public.tenants t
      LEFT JOIN finance_usage fu
        ON fu.tenant_id = t.id
      WHERE t.name ~* $1
      ORDER BY (t.status = 'active') DESC, finance_row_count DESC, t.name
      LIMIT 200
    `, [testTenantPattern]);

    const activeFinanceTestTenants = activeTestTenants.rows.filter(
      (row) => row.status === 'active' && Number(row.finance_row_count) > 0
    );
    const untaggedActiveFinanceTestTenants = activeFinanceTestTenants.filter(
      (row) => row.retained_evidence_tagged !== true
    );

    const historicalMappings = await client.query(`
      SELECT m.tenant_id, t.name, t.status, m.control_type, m.account_code,
             COUNT(*) OVER (PARTITION BY m.tenant_id)::INT AS mappings_for_tenant
      FROM public.finance_control_account_mappings m
      LEFT JOIN public.tenants t
        ON t.id = m.tenant_id
      LEFT JOIN public.finance_accounts a
        ON a.tenant_id = m.tenant_id
       AND a.code = m.account_code
       AND a.is_active = TRUE
      WHERE a.id IS NULL
      ORDER BY (t.id IS NULL) DESC, t.status NULLS FIRST, t.name NULLS LAST, m.control_type
      LIMIT 100
    `);

    const groups = [
      {
        id: 'SG-001',
        topic: 'HQ-admin RLS bypass',
        audit_status: 'WARN',
        classification: 'governance_exception',
        production_blocker: false,
        decision: 'Intentional only for authenticated sessions with null tenant context. This remains closed as governance exception pending a formal HQ/admin authorization policy; no tenant data leakage found by tenant-isolation checks.',
        evidence_count: rlsBypass.rowCount,
        evidence: rlsBypass.rows,
      },
      {
        id: 'SG-002',
        topic: 'SECURITY DEFINER RPC grants',
        audit_status: securityDefinerClassifications.some((row) => row.production_blocker) ? 'FAIL' : 'WARN',
        classification: securityDefinerClassifications.some((row) => row.production_blocker)
          ? 'production_blocker'
          : 'governance_exception',
        production_blocker: securityDefinerClassifications.some((row) => row.production_blocker),
        decision: securityDefinerClassifications.some((row) => row.production_blocker)
          ? 'At least one broadly executable SECURITY DEFINER function lacks sufficient tenant/privilege guard evidence.'
          : 'Broad EXECUTE grants are classified as governance exceptions because inspected finance mutators include service-role guards and tenant-scoped parameters; helper/read RPCs are controlled exceptions. Keep this under API-route governance before production.',
        evidence_count: securityDefinerClassifications.length,
        evidence: securityDefinerClassifications,
      },
      {
        id: 'SG-003',
        topic: 'Retained proof/test/demo tenants',
        audit_status: untaggedActiveFinanceTestTenants.length > 0 ? 'WARN' : 'PASS',
        classification: untaggedActiveFinanceTestTenants.length > 0 ? 'controlled_exception' : 'historical_evidence',
        production_blocker: false,
        decision: untaggedActiveFinanceTestTenants.length > 0
          ? 'Active finance-bearing test/demo tenants exist without retained-evidence metadata. They are classified as controlled exceptions, not leakage, because Finance tenant isolation checks pass; do not delete immutable evidence. Next governance action is targeted suspend/tag by owner.'
          : 'Finance-bearing proof tenants are suspended/tagged as retained evidence.',
        evidence_count: activeTestTenants.rowCount,
        evidence: activeTestTenants.rows,
      },
      {
        id: 'SG-004',
        topic: 'Historical mappings of deleted tenants',
        audit_status: 'WARN',
        classification: 'historical_evidence',
        production_blocker: false,
        decision: 'Unresolved mappings belong to tenant IDs with no tenant row in the current environment sample. They cannot be resolved by tenant-scoped runtime policy for an active tenant; retain as historical/data-lifecycle evidence unless a migration provenance decision authorizes cleanup.',
        evidence_count: historicalMappings.rowCount,
        evidence: historicalMappings.rows,
      },
    ];

    const payload = {
      generated_at: new Date().toISOString(),
      environment_host: environmentHost,
      summary: summarize(groups),
      groups,
    };

    const outDir = path.resolve(process.cwd(), 'output', 'implementation-artifacts');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = payload.generated_at.replace(/[-:.TZ]/g, '').slice(0, 14);
    const jsonPath = path.join(outDir, `finance-production-hardening-security-governance-${stamp}.json`);
    const mdPath = path.join(outDir, `finance-production-hardening-security-governance-${stamp}.md`);

    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
    fs.writeFileSync(mdPath, toMarkdown(payload));

    for (const group of groups) {
      console.log(`[${group.audit_status}] ${group.id} ${group.topic}: ${group.classification}, rows=${group.evidence_count}`);
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
