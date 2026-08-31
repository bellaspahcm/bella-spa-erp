const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
const { loadLocalEnv } = require('./load-local-env.cjs');

loadLocalEnv();

function getConnectionString() {
  return process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '';
}

function uuid() {
  return crypto.randomUUID();
}

function nowStamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

async function queryOne(client, sql, params = []) {
  const result = await client.query(sql, params);
  return result.rows[0] || null;
}

async function functionSignature(client, name) {
  const result = await client.query(
    `SELECT pg_get_function_identity_arguments(p.oid) AS args
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = $1
      ORDER BY args`,
    [name]
  );
  return result.rows.map((row) => row.args);
}

function statusFromStep(step) {
  if (step.status === 'FAIL') return 'FAIL';
  if (step.status === 'WARN') return 'WARN';
  if (step.status === 'SKIPPED') return 'SKIPPED';
  return 'PASS';
}

function normalizeAuditStatus(status) {
  return ['PASS', 'WARN', 'FAIL', 'SKIPPED'].includes(status) ? status : 'PASS';
}

async function captureStep(steps, id, description, fn) {
  const started = new Date();
  try {
    const evidence = await fn();
    steps.push({
      id,
      status: normalizeAuditStatus(evidence?.status || 'PASS'),
      description,
      started_at: started.toISOString(),
      completed_at: new Date().toISOString(),
      evidence: evidence || {},
    });
    return evidence;
  } catch (error) {
    steps.push({
      id,
      status: 'FAIL',
      description,
      started_at: started.toISOString(),
      completed_at: new Date().toISOString(),
      error: {
        message: error.message,
        code: error.code,
        detail: error.detail,
        hint: error.hint,
        where: error.where,
      },
    });
    return null;
  }
}

async function insertAccount(client, tenantId, code, name, type, normalBalance) {
  const row = await queryOne(
    client,
    `INSERT INTO public.finance_accounts
       (tenant_id, code, name, type, normal_balance, currency, is_active)
     VALUES ($1, $2, $3, $4, $5, 'VND', true)
     ON CONFLICT (tenant_id, code) DO UPDATE SET
       name = EXCLUDED.name,
       type = EXCLUDED.type,
       normal_balance = EXCLUDED.normal_balance,
       currency = EXCLUDED.currency,
       is_active = true,
       updated_at = NOW()
     RETURNING id, code, type`,
    [tenantId, code, name, type, normalBalance]
  );
  return row;
}

async function seedE2EFixture(client, stamp) {
  const tenantId = uuid();
  const vendorId = uuid();
  const actorId = uuid();
  const bankAccountId = uuid();
  const billId = uuid();
  const today = new Date();
  const periodStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  const periodEnd = new Date(Date.UTC(today.getUTCFullYear(), 11, 31, 23, 59, 59));

  await client.query(
    `INSERT INTO public.tenants (id, name, status, metadata)
     VALUES ($1, $2, 'active', $3::jsonb)`,
    [
      tenantId,
      `FINANCE-PROD-E2E-${stamp}`,
      JSON.stringify({
        finance_prod_e2e: true,
        retained_test_evidence: true,
        created_by: 'finance-production-hardening-e2e',
        created_at: new Date().toISOString(),
      }),
    ]
  );

  const accounts = {};
  for (const account of [
    ['EXPENSE', 'E2E Expense', 'EXPENSE', 'DEBIT'],
    ['331', 'E2E Accounts Payable Control', 'LIABILITY', 'CREDIT'],
    ['BANK', 'E2E Bank GL', 'ASSET', 'DEBIT'],
    ['242_E2E', 'E2E Vendor Prepayment Asset', 'ASSET', 'DEBIT'],
    ['PREPAY_APPLIED_E2E', 'E2E Prepayment Applied Clearing', 'LIABILITY', 'CREDIT'],
    ['CASH_CLEARING_E2E', 'E2E Cash Clearing', 'ASSET', 'DEBIT'],
  ]) {
    const [code, name, type, normalBalance] = account;
    accounts[code] = await insertAccount(client, tenantId, code, name, type, normalBalance);
  }

  await client.query(
    `INSERT INTO public.finance_accounting_periods
       (tenant_id, name, period_start, period_end, status)
     VALUES ($1, $2, $3, $4, 'OPEN')`,
    [tenantId, `E2E ${today.getUTCFullYear()}`, periodStart.toISOString(), periodEnd.toISOString()]
  );

  await client.query(
    `INSERT INTO public.finance_prepayment_posting_policy_mappings
       (tenant_id, event_type, debit_account_code, credit_account_code, valid_from, is_active)
     VALUES
       ($1, 'VENDOR_PREPAYMENT_RECORDED', '242_E2E', NULL, NOW() - INTERVAL '1 day', true),
       ($1, 'VENDOR_PREPAYMENT_APPLIED', '331', '242_E2E', NOW() - INTERVAL '1 day', true),
       ($1, 'VENDOR_PREPAYMENT_REFUNDED', 'BANK', '242_E2E', NOW() - INTERVAL '1 day', true)`,
    [tenantId]
  );

  await client.query(
    `INSERT INTO public.finance_control_account_mappings
       (tenant_id, control_type, account_code, effective_from, authority_version)
     VALUES
       ($1, 'PREPAYMENT_CONTROL', '242_E2E', CURRENT_DATE - INTERVAL '1 day', 'PROD_E2E_TEST:v1'),
       ($1, 'AP_CONTROL', '331', CURRENT_DATE - INTERVAL '1 day', 'PROD_E2E_TEST:v1'),
       ($1, 'CASH_CONTROL', 'BANK', CURRENT_DATE - INTERVAL '1 day', 'PROD_E2E_TEST:v1')
     ON CONFLICT DO NOTHING`,
    [tenantId]
  );

  await client.query(
    `INSERT INTO public.finance_bank_accounts
       (id, tenant_id, bank_name, account_number, account_name, currency, linked_finance_account_id, is_active, notes)
     VALUES ($1, $2, 'E2E Bank', $3, 'Finance Production E2E', 'VND', $4, true, 'Retained test evidence')`,
    [bankAccountId, tenantId, `E2E-${stamp}`, accounts.BANK.id]
  );

  await client.query(
    `INSERT INTO public.finance_vendor_bills
       (id, tenant_id, vendor_id, bill_number, bill_date, due_date, currency, total_amount_minor, status, description)
     VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '7 days', 'VND', 700000, 'RECEIVED', 'Finance production E2E vendor bill')`,
    [billId, tenantId, vendorId, `E2E-BILL-${stamp}`]
  );

  await client.query(
    `INSERT INTO public.finance_vendor_bill_lines
       (tenant_id, vendor_bill_id, expense_account_code, amount_minor, memo)
     VALUES ($1, $2, 'EXPENSE', 700000, 'Finance production E2E expense line')`,
    [tenantId, billId]
  );

  return { tenantId, vendorId, actorId, bankAccountId, bankFinanceAccountId: accounts.BANK.id, billId };
}

async function markEvidenceTenant(client, tenantId, payload) {
  await client.query(
    `UPDATE public.tenants
        SET status = 'suspended',
            metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
            updated_at = NOW()
      WHERE id = $1`,
    [
      tenantId,
      JSON.stringify({
        finance_prod_e2e_retained_evidence: true,
        finance_prod_e2e_completed_at: new Date().toISOString(),
        finance_prod_e2e_green: payload.summary?.is_green === true,
      }),
    ]
  );
}

async function run() {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('Missing SUPABASE_DB_URL, SUPABASE_DATABASE_URL, or DATABASE_URL');
  }

  const stamp = nowStamp();
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const steps = [];
  const context = { stamp };

  try {
    await captureStep(steps, 'E2E-001', 'Preflight confirms active production E2E RPC signatures.', async () => {
      const signatures = {};
      for (const name of [
        'finance_post_transaction',
        'finance_reverse_transaction',
        'finance_approve_vendor_bill',
        'finance_disburse_payment',
        'finance_record_prepayment',
        'finance_apply_prepayment',
        'f5_run_reconciliation',
      ]) {
        signatures[name] = await functionSignature(client, name);
      }
      return { signatures };
    });

    const fixture = await captureStep(steps, 'E2E-002', 'Seed an isolated retained-evidence tenant and finance fixture.', async () => {
      const seeded = await seedE2EFixture(client, stamp);
      Object.assign(context, seeded);
      return seeded;
    });

    if (fixture) {
      const prepayment = await captureStep(steps, 'E2E-003', 'Record vendor prepayment through F4 policy-resolution RPC.', async () => {
        const row = await queryOne(
          client,
          `SELECT public.finance_record_prepayment($1, $2, 200000, $3, $4, 'FINANCE_PROD_E2E', $5) AS result`,
          [context.tenantId, context.vendorId, context.bankFinanceAccountId, uuid(), `PREPAY-${stamp}`]
        );
        const result = row.result;
        context.prepaymentFactId = result.prepayment_fact_id;
        context.prepaymentRecordTxId = result.transaction_id;
        return result;
      });

      const approval = await captureStep(steps, 'E2E-004', 'Approve AP vendor bill through F4 AP lifecycle RPC.', async () => {
        const row = await queryOne(
          client,
          `SELECT public.finance_approve_vendor_bill($1, $2, $3, $4) AS result`,
          [context.tenantId, context.billId, context.actorId, uuid()]
        );
        const result = row.result;
        context.billApprovalTxId = result.transaction_id;
        return result;
      });

      if (prepayment && approval) {
        await captureStep(steps, 'E2E-005', 'Apply prepayment to approved AP bill through F4 lifecycle RPC.', async () => {
          const row = await queryOne(
            client,
            `SELECT public.finance_apply_prepayment($1, $2, $3, 200000, $4) AS result`,
            [context.tenantId, context.billId, context.prepaymentFactId, uuid()]
          );
          const result = row.result;
          context.prepaymentApplyTxId = result.transaction_id;
          return result;
        });
      }

      if (approval) {
        const cashTx = await captureStep(steps, 'E2E-006', 'Create F1 cash outflow transaction for AP disbursement setup.', async () => {
          const lines = [
            {
              account_code: 'CASH_CLEARING_E2E',
              debit_amount_minor: 500000,
              debit_currency: 'VND',
              credit_amount_minor: 0,
              credit_currency: 'VND',
              debit_functional_amount: 500000,
              debit_functional_currency: 'VND',
              credit_functional_amount: 0,
              credit_functional_currency: 'VND',
              memo: 'E2E cash clearing debit',
            },
            {
              account_code: 'BANK',
              debit_amount_minor: 0,
              debit_currency: 'VND',
              credit_amount_minor: 500000,
              credit_currency: 'VND',
              debit_functional_amount: 0,
              debit_functional_currency: 'VND',
              credit_functional_amount: 500000,
              credit_functional_currency: 'VND',
              memo: 'E2E bank credit',
            },
          ];
          const row = await queryOne(
            client,
            `SELECT public.finance_post_transaction(
               $1, $2, md5($3::text)::varchar, 'FINANCE_PROD_E2E_CASH', $4, 'CASH', NOW(),
               'VND', 'VND', 1, 'IDENTITY', 'VND', NOW(),
               'Finance production E2E cash outflow setup',
               'FINANCE_PROD_E2E_CASH', $4, $3::jsonb, CURRENT_DATE
             ) AS result`,
            [context.tenantId, `E2E-CASH-F1-${stamp}`, JSON.stringify(lines), `CASH-${stamp}`]
          );
          const result = row.result;
          context.cashOutflowF1TxId = result.transaction_id;
          return result;
        });

        if (cashTx) {
          const movement = await captureStep(steps, 'E2E-007', 'Project the F1 cash leg into F2 cash movement.', async () => {
            const row = await queryOne(
              client,
              `SELECT public.finance_internal_record_cash_movement(
                 $1, $2, $3, 'OUTFLOW', 500000, 'VND', 500000, 'VND', 1,
                 $4, 'E2E-BANK-CREDIT', 'FINANCE_PROD_E2E_CASH', $5,
                 'Finance production E2E AP cash outflow'
               ) AS result`,
              [context.tenantId, context.bankAccountId, `E2E-CASH-MOVE-${stamp}`, context.cashOutflowF1TxId, `CASH-${stamp}`]
            );
            const result = row.result;
            context.cashMovementId = result.movement_id;
            return result;
          });

          if (movement) {
            const disbursement = await captureStep(steps, 'E2E-008', 'Disburse AP payment by allocating F2 cash outflow to vendor bill.', async () => {
              const row = await queryOne(
                client,
                `SELECT public.finance_disburse_payment($1, $2, $3, 500000, 500000, 1, 'SYSTEM', NOW(), $4) AS result`,
                [context.tenantId, context.billId, context.cashMovementId, uuid()]
              );
              const result = row.result;
              context.disbursementAllocationId = result.allocation_id;
              context.disbursementTxId = result.transaction_id;
              return result;
            });

            if (disbursement) {
              await captureStep(steps, 'E2E-009', 'Reverse AP disbursement through append-only F4 reversal RPC.', async () => {
                const row = await queryOne(
                  client,
                  `SELECT public.finance_reverse_disbursement($1, $2, $3) AS result`,
                  [context.tenantId, context.disbursementAllocationId, uuid()]
                );
                const result = row.result;
                context.disbursementReversalTxId = result.transaction_id;
                return result;
              });
            }
          }
        }
      }

      await captureStep(steps, 'E2E-010', 'Run F5.6 prepayment reconciliation for the E2E tenant.', async () => {
        const row = await queryOne(
          client,
          `SELECT public.f5_run_reconciliation($1, 'PREPAYMENT', 'PREPAYMENT_GL_BALANCE', $2, 'F4_PREPAYMENT_GL_MAP:v1', NOW()) AS result`,
          [context.tenantId, context.prepaymentFactId]
        );
        const result = row.result;
        return {
          status: Number(result?.variances || 0) === 0 ? 'PASS' : 'FAIL',
          result,
        };
      });

      await captureStep(steps, 'E2E-011', 'Verify E2E tenant remains isolated in generated financial evidence.', async () => {
        const row = await queryOne(
          client,
          `SELECT
             COUNT(*) FILTER (WHERE t.id IS NOT NULL)::int AS same_tenant_transactions,
             COUNT(*) FILTER (WHERE t.id IS NULL)::int AS orphan_transactions,
             COUNT(*) FILTER (WHERE a.tenant_id IS DISTINCT FROM l.tenant_id)::int AS cross_tenant_lines
           FROM public.finance_transaction_lines l
           LEFT JOIN public.finance_transactions t
             ON t.id = l.transaction_id AND t.tenant_id = l.tenant_id
           LEFT JOIN public.finance_accounts a
             ON a.id = l.account_id
           WHERE l.tenant_id = $1`,
          [context.tenantId]
        );
        return {
          status: row.orphan_transactions === 0 && row.cross_tenant_lines === 0 ? 'PASS' : 'FAIL',
          ...row,
        };
      });
    }

    const summary = steps.reduce(
      (acc, step) => {
        acc.total += 1;
        acc[statusFromStep(step).toLowerCase()] += 1;
        if (step.status === 'FAIL') acc.is_green = false;
        return acc;
      },
      { total: 0, pass: 0, warn: 0, fail: 0, skipped: 0, is_green: true }
    );

    const payload = {
      generated_at: new Date().toISOString(),
      environment_host: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://unknown.invalid').host,
      retained_evidence_tenant_id: context.tenantId || null,
      summary,
      context,
      steps,
    };

    if (context.tenantId) {
      await markEvidenceTenant(client, context.tenantId, payload);
    }

    const outDir = path.join(process.cwd(), 'output', 'implementation-artifacts');
    fs.mkdirSync(outDir, { recursive: true });
    const base = `finance-production-hardening-e2e-${stamp}`;
    fs.writeFileSync(path.join(outDir, `${base}.json`), JSON.stringify(payload, null, 2));
    fs.writeFileSync(path.join(outDir, `${base}.md`), toMarkdown(payload));

    console.log(JSON.stringify({
      green: summary.is_green,
      summary,
      evidence: path.join(outDir, `${base}.md`),
      tenant_id: context.tenantId || null,
    }, null, 2));

    if (!summary.is_green) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

function toMarkdown(payload) {
  const lines = [
    '# Finance Production Hardening Production E2E Audit',
    '',
    `Generated at: ${payload.generated_at}`,
    `Environment host: ${payload.environment_host}`,
    `Retained evidence tenant: ${payload.retained_evidence_tenant_id || 'none'}`,
    '',
    '## Summary',
    '',
    `- Total steps: ${payload.summary.total}`,
    `- PASS: ${payload.summary.pass}`,
    `- WARN: ${payload.summary.warn}`,
    `- FAIL: ${payload.summary.fail}`,
    `- Green: ${payload.summary.is_green}`,
    '',
    '## Steps',
    '',
  ];

  for (const step of payload.steps) {
    lines.push(`### ${step.id} - ${step.status}`);
    lines.push('');
    lines.push(step.description);
    lines.push('');
    if (step.error) {
      lines.push('Error:');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(step.error, null, 2));
      lines.push('```');
      lines.push('');
    }
    if (step.evidence && Object.keys(step.evidence).length > 0) {
      lines.push('Evidence:');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(step.evidence, null, 2));
      lines.push('```');
      lines.push('');
    }
  }

  return `${lines.join('\n')}\n`;
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
