const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { loadLocalEnv } = require('./load-local-env.cjs');

loadLocalEnv();

function getConnectionString() {
  return (
    process.env.SUPABASE_DB_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.DATABASE_URL ||
    ''
  );
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
    if (!(await tableExists(client, tableName))) {
      missing.push(tableName);
    }
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

  const result = await client.query(check.sql);
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
    '# Finance Production Hardening Data Integrity Audit',
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
    lines.push(`### ${result.id} — ${result.status}`);
    lines.push('');
    lines.push(`Category: ${result.category}`);
    lines.push(`Severity: ${result.severity}`);
    lines.push(`Description: ${result.description}`);
    if (result.missing_tables?.length) {
      lines.push(`Missing tables: ${result.missing_tables.join(', ')}`);
    } else {
      lines.push(`Rows: ${result.row_count}`);
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

const checks = [
  {
    id: 'DI-001',
    category: 'Orphan GL',
    severity: 'P0',
    description: 'F1 transaction lines must always have a same-tenant transaction header.',
    tables: ['finance_transaction_lines', 'finance_transactions'],
    sql: `
      SELECT l.tenant_id, l.transaction_id, COUNT(*)::INT AS orphan_line_count
      FROM public.finance_transaction_lines l
      LEFT JOIN public.finance_transactions t
        ON t.id = l.transaction_id
       AND t.tenant_id = l.tenant_id
      WHERE t.id IS NULL
      GROUP BY l.tenant_id, l.transaction_id
      ORDER BY orphan_line_count DESC
      LIMIT 50
    `,
  },
  {
    id: 'DI-002',
    category: 'Orphan GL',
    severity: 'P0',
    description: 'Posted F1 transactions must have at least one line.',
    tables: ['finance_transactions', 'finance_transaction_lines'],
    sql: `
      SELECT t.tenant_id, t.id AS transaction_id, t.status, t.source_type, t.source_id
      FROM public.finance_transactions t
      LEFT JOIN public.finance_transaction_lines l
        ON l.transaction_id = t.id
       AND l.tenant_id = t.tenant_id
      WHERE t.status = 'POSTED'
      GROUP BY t.tenant_id, t.id, t.status, t.source_type, t.source_id
      HAVING COUNT(l.id) = 0
      LIMIT 50
    `,
  },
  {
    id: 'DI-003',
    category: 'Double Entry',
    severity: 'P0',
    description: 'Posted F1 transactions must balance on functional debit and credit amounts.',
    tables: ['finance_transactions', 'finance_transaction_lines'],
    sql: `
      SELECT
        t.tenant_id,
        t.id AS transaction_id,
        t.source_type,
        t.source_id,
        SUM(l.debit_functional_amount - l.credit_functional_amount)::NUMERIC(20,4) AS imbalance
      FROM public.finance_transactions t
      JOIN public.finance_transaction_lines l
        ON l.transaction_id = t.id
       AND l.tenant_id = t.tenant_id
      WHERE t.status = 'POSTED'
      GROUP BY t.tenant_id, t.id, t.source_type, t.source_id
      HAVING SUM(l.debit_functional_amount - l.credit_functional_amount) <> 0
      LIMIT 50
    `,
  },
  {
    id: 'DI-004',
    category: 'Orphan Financial Facts',
    severity: 'P0',
    description: 'F2 cash movements must reference an existing same-tenant F1 transaction.',
    tables: ['finance_cash_movements', 'finance_transactions'],
    productionRiskColumn: 'production_risk',
    sql: `
      SELECT
        cm.tenant_id,
        ten.name AS tenant_name,
        ten.status AS tenant_status,
        (
          ten.id IS NOT NULL
          AND ten.status = 'active'
          AND ten.name !~* '(^F[0-9]|FIN-OS-E2E|test|proof|demo|verification|concurrency|stress|fixture|integration)'
        ) AS production_risk,
        cm.id AS cash_movement_id,
        cm.f1_transaction_id
      FROM public.finance_cash_movements cm
      LEFT JOIN public.finance_transactions t
        ON t.id = cm.f1_transaction_id
       AND t.tenant_id = cm.tenant_id
      LEFT JOIN public.tenants ten
        ON ten.id = cm.tenant_id
      WHERE t.id IS NULL
      ORDER BY production_risk DESC, tenant_name NULLS LAST
      LIMIT 50
    `,
  },
  {
    id: 'DI-005',
    category: 'Orphan Financial Facts',
    severity: 'P0',
    description: 'F4 payable ledger rows must reference an existing same-tenant F1 transaction.',
    tables: ['finance_payable_ledger', 'finance_transactions'],
    sql: `
      SELECT pl.tenant_id, pl.id AS payable_ledger_id, pl.f1_transaction_id
      FROM public.finance_payable_ledger pl
      LEFT JOIN public.finance_transactions t
        ON t.id = pl.f1_transaction_id
       AND t.tenant_id = pl.tenant_id
      WHERE t.id IS NULL
      LIMIT 50
    `,
  },
  {
    id: 'DI-006',
    category: 'Orphan Financial Facts',
    severity: 'P0',
    description: 'F4 vendor prepayment facts must reference an existing same-tenant F1 transaction.',
    tables: ['finance_vendor_prepayments', 'finance_transactions'],
    productionRiskColumn: 'production_risk',
    sql: `
      SELECT
        p.tenant_id,
        ten.name AS tenant_name,
        ten.status AS tenant_status,
        (
          ten.id IS NOT NULL
          AND ten.status = 'active'
          AND ten.name !~* '(^F[0-9]|FIN-OS-E2E|test|proof|demo|verification|concurrency|stress|fixture|integration)'
        ) AS production_risk,
        p.id AS prepayment_fact_id,
        p.f1_transaction_id
      FROM public.finance_vendor_prepayments p
      LEFT JOIN public.finance_transactions t
        ON t.id = p.f1_transaction_id
       AND t.tenant_id = p.tenant_id
      LEFT JOIN public.tenants ten
        ON ten.id = p.tenant_id
      WHERE t.id IS NULL
      ORDER BY production_risk DESC, tenant_name NULLS LAST
      LIMIT 50
    `,
  },
  {
    id: 'DI-007',
    category: 'FX / Source Currency',
    severity: 'P1',
    description: 'F1 line currencies should be internally consistent with their transaction functional currency.',
    tables: ['finance_transactions', 'finance_transaction_lines'],
    sql: `
      SELECT
        t.tenant_id,
        t.id AS transaction_id,
        t.functional_currency AS transaction_functional_currency,
        l.debit_functional_currency,
        l.credit_functional_currency
      FROM public.finance_transactions t
      JOIN public.finance_transaction_lines l
        ON l.transaction_id = t.id
       AND l.tenant_id = t.tenant_id
      WHERE l.debit_functional_currency <> t.functional_currency
         OR l.credit_functional_currency <> t.functional_currency
      LIMIT 50
    `,
  },
  {
    id: 'DI-008',
    category: 'FX / Source Currency',
    severity: 'P1',
    description: 'Same-currency transactions should use identity FX semantics.',
    tables: ['finance_transactions'],
    sql: `
      SELECT tenant_id, id AS transaction_id, transaction_currency, functional_currency,
             exchange_rate_rate, exchange_rate_source, exchange_rate_target
      FROM public.finance_transactions
      WHERE transaction_currency = functional_currency
        AND exchange_rate_rate <> 1
      LIMIT 50
    `,
  },
  {
    id: 'DI-009',
    category: 'FX / Source Currency',
    severity: 'P1',
    description: 'F2 cash movement functional amount should equal amount * valuation_rate within rounding tolerance.',
    tables: ['finance_cash_movements'],
    sql: `
      SELECT tenant_id, id AS cash_movement_id, amount_minor, valuation_rate,
             functional_amount_minor,
             (amount_minor * valuation_rate) AS expected_functional_amount
      FROM public.finance_cash_movements
      WHERE ABS(functional_amount_minor - (amount_minor * valuation_rate)) > 1
      LIMIT 50
    `,
  },
  {
    id: 'DI-010',
    category: 'Duplicate Effect',
    severity: 'P0',
    description: 'F1 idempotency keys must be unique per tenant.',
    tables: ['finance_transactions'],
    sql: `
      SELECT tenant_id, idempotency_key, COUNT(*)::INT AS transaction_count
      FROM public.finance_transactions
      GROUP BY tenant_id, idempotency_key
      HAVING COUNT(*) > 1
      LIMIT 50
    `,
  },
  {
    id: 'DI-011',
    category: 'Duplicate Effect',
    severity: 'P1',
    description: 'Posted transactions with the same source identity may represent duplicate business effects unless they are intentional reversals.',
    tables: ['finance_transactions'],
    nonZeroStatus: 'WARN',
    productionRiskColumn: 'production_risk',
    sql: `
      SELECT
        ft.tenant_id,
        ten.name AS tenant_name,
        ten.status AS tenant_status,
        (
          ten.id IS NOT NULL
          AND ten.status = 'active'
          AND ten.name !~* '(^F[0-9]|FIN-OS-E2E|test|proof|demo|verification|concurrency|stress|fixture|integration)'
        ) AS production_risk,
        ft.source_type,
        ft.source_id,
        COUNT(*)::INT AS posted_count,
             COUNT(*) FILTER (WHERE reversal_of IS NOT NULL)::INT AS reversal_count
      FROM public.finance_transactions ft
      LEFT JOIN public.tenants ten
        ON ten.id = ft.tenant_id
      WHERE ft.status = 'POSTED'
      GROUP BY ft.tenant_id, ten.id, ten.name, ten.status, ft.source_type, ft.source_id
      HAVING COUNT(*) > 1
      ORDER BY production_risk DESC, posted_count DESC
      LIMIT 50
    `,
  },
  {
    id: 'DI-012',
    category: 'Document-Date Provenance',
    severity: 'P1',
    description: 'F1 transactions should carry document_date provenance.',
    tables: ['finance_transactions'],
    productionRiskColumn: 'production_risk',
    sql: `
      SELECT
        ft.tenant_id,
        ten.name AS tenant_name,
        ten.status AS tenant_status,
        (
          ten.id IS NOT NULL
          AND ten.status = 'active'
          AND ten.name !~* '(^F[0-9]|FIN-OS-E2E|test|proof|demo|verification|concurrency|stress|fixture|integration)'
        ) AS production_risk,
        ft.id AS transaction_id,
        ft.source_type,
        ft.source_id,
        ft.posted_at
      FROM public.finance_transactions ft
      LEFT JOIN public.tenants ten
        ON ten.id = ft.tenant_id
      WHERE ft.document_date IS NULL
      ORDER BY production_risk DESC, ten.name NULLS LAST, ft.created_at DESC
      LIMIT 50
    `,
  },
  {
    id: 'DI-013',
    category: 'Document-Date Provenance',
    severity: 'P1',
    description: 'Vendor bill F1 transaction document_date should match the bill date.',
    tables: ['finance_vendor_bills', 'finance_transactions'],
    sql: `
      SELECT b.tenant_id, b.id AS bill_id, b.bill_date::DATE AS bill_date, t.document_date
      FROM public.finance_vendor_bills b
      JOIN public.finance_transactions t
        ON t.id = b.f1_transaction_id
       AND t.tenant_id = b.tenant_id
      WHERE b.f1_transaction_id IS NOT NULL
        AND t.document_date IS DISTINCT FROM b.bill_date::DATE
      LIMIT 50
    `,
  },
  {
    id: 'DI-014',
    category: 'Document-Date Provenance',
    severity: 'P1',
    description: 'Invoice F1 transaction document_date should match the invoice issue date.',
    tables: ['finance_invoices', 'finance_transactions'],
    productionRiskColumn: 'production_risk',
    sql: `
      SELECT
        i.tenant_id,
        ten.name AS tenant_name,
        ten.status AS tenant_status,
        (
          ten.id IS NOT NULL
          AND ten.status = 'active'
          AND ten.name !~* '(^F[0-9]|FIN-OS-E2E|test|proof|demo|verification|concurrency|stress|fixture|integration)'
        ) AS production_risk,
        i.id AS invoice_id,
        i.issue_date,
        t.document_date
      FROM public.finance_invoices i
      JOIN public.finance_transactions t
        ON t.id = i.f1_transaction_id
       AND t.tenant_id = i.tenant_id
      LEFT JOIN public.tenants ten
        ON ten.id = i.tenant_id
      WHERE i.f1_transaction_id IS NOT NULL
        AND t.document_date IS DISTINCT FROM i.issue_date
      ORDER BY production_risk DESC, ten.name NULLS LAST
      LIMIT 50
    `,
  },
  {
    id: 'DI-015',
    category: 'Historical Evidence',
    severity: 'INFO',
    nonZeroStatus: 'WARN',
    description: 'Retained test evidence tenants should stay explicitly marked so they are not confused with production data.',
    tables: ['tenants'],
    sql: `
      SELECT id, name, status, metadata->>'f4_proof_retained_evidence' AS retained_evidence
      FROM public.tenants
      WHERE name LIKE 'F4-PREPAYMENT-PROOF-%'
        AND (
          status <> 'suspended'
          OR COALESCE(metadata->>'f4_proof_retained_evidence', 'false') <> 'true'
        )
      LIMIT 50
    `,
  },
];

async function main() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    console.error('Missing DB connection. Set SUPABASE_DB_URL, SUPABASE_DATABASE_URL, or DATABASE_URL.');
    process.exit(1);
  }

  const host = (() => {
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
      environment_host: host,
      summary: summarize(results),
      results,
    };

    const outDir = path.resolve(process.cwd(), 'output', 'implementation-artifacts');
    fs.mkdirSync(outDir, { recursive: true });
    const stamp = payload.generated_at.replace(/[-:.TZ]/g, '').slice(0, 14);
    const jsonPath = path.join(outDir, `finance-production-hardening-data-integrity-${stamp}.json`);
    const mdPath = path.join(outDir, `finance-production-hardening-data-integrity-${stamp}.md`);

    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
    fs.writeFileSync(mdPath, toMarkdown(payload));

    for (const result of results) {
      console.log(`[${result.status}] ${result.id} ${result.category}: ${result.row_count ?? 'n/a'} rows`);
    }

    console.log(`Evidence JSON: ${jsonPath}`);
    console.log(`Evidence MD: ${mdPath}`);

    if (!payload.summary.is_green) {
      process.exitCode = 1;
    }
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
  runCheck,
  summarize,
};
