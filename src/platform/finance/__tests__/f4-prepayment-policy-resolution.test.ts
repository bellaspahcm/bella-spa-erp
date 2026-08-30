import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260818000000_finance_ap_engine_v1.sql',
);

function readMigration(): string {
  return fs.readFileSync(migrationPath, 'utf8');
}

function extractFunction(sql: string, functionName: string): string {
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${functionName}\\([\\s\\S]*?\\r?\\nEND;\\r?\\n\\$\\$;`,
    'm',
  );
  const match = sql.match(pattern);
  if (!match) {
    throw new Error(`Could not find SQL function ${functionName}`);
  }

  return match[0];
}

function extractBetween(sql: string, startMarker: string, endMarker: string): string {
  const start = sql.indexOf(startMarker);
  const end = sql.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error(`Could not extract SQL block from ${startMarker} to ${endMarker}`);
  }

  return sql.slice(start, end);
}

describe('F4 prepayment policy resolution boundary', () => {
  it('defines a tenant and effective-date scoped lifecycle policy mapping contract', () => {
    const sql = readMigration();
    const policyMappingBlock = extractBetween(
      sql,
      'CREATE TABLE public.finance_prepayment_posting_policy_mappings',
      '-- 3.6 Vendor Prepayments',
    );

    expect(sql).toContain('CREATE TABLE public.finance_prepayment_posting_policy_mappings');
    expect(sql).toContain('event_type');
    expect(sql).toContain('valid_from');
    expect(sql).toContain('valid_to');
    expect(sql).toContain('finance_prevent_prepayment_policy_overlap');
    expect(sql).toContain('trg_prevent_prepayment_policy_overlap');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.finance_resolve_prepayment_posting_accounts');
    expect(policyMappingBlock).not.toContain(
      'public.get_auth_tenant_id() IS NULL OR tenant_id = public.get_auth_tenant_id()',
    );
  });

  it('routes prepayment record/apply posting through policy resolution instead of account literals', () => {
    const sql = readMigration();
    const recordFn = extractFunction(sql, 'finance_record_prepayment');
    const applyFn = extractFunction(sql, 'finance_apply_prepayment');

    expect(recordFn).toContain('finance_resolve_prepayment_posting_accounts');
    expect(recordFn).toContain('VENDOR_PREPAYMENT_RECORDED');
    expect(recordFn).toContain('F4_PREPAYMENT_POLICY_RECORDED_CREDIT_UNSUPPORTED');
    expect(recordFn).not.toContain("'PREPAYMENT_ASSET'");

    expect(applyFn).toContain('finance_resolve_prepayment_posting_accounts');
    expect(applyFn).toContain('VENDOR_PREPAYMENT_APPLIED');
    expect(applyFn).not.toContain("'PREPAYMENT_ASSET'");
    expect(applyFn).not.toContain("jsonb_build_object('account_code', '331'");
  });

  it('does not rewrite the F5.6 prepayment reconciliation migration', () => {
    const f56Path = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '20260820010000_f5_prepayment_reconciliation.sql',
    );

    const f56Sql = fs.readFileSync(f56Path, 'utf8');
    expect(f56Sql).toContain("DEFAULT 'F4_PREPAYMENT:v1'");
    expect(f56Sql).toContain('f5_reconstruct_prepayment_position');
    expect(f56Sql).toContain('PREPAYMENT_GL_BALANCE');
  });
});
