const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const CRITICAL_RPC_GRANTS = [
  { name: 'get_chat_customers', args: [], roles: ['authenticated', 'service_role'] },
  { name: 'get_service_performance', args: ['UUID'], roles: ['authenticated', 'service_role'] },
  { name: 'get_monthly_pnl', args: ['UUID', 'DATE'], roles: ['authenticated', 'service_role'] },
  { name: 'lock_monthly_records', args: ['UUID', 'DATE'], roles: ['authenticated', 'service_role'] },
  { name: 'get_financial_anomalies', args: ['UUID'], roles: ['authenticated', 'service_role'] },

  { name: 'enqueue_accounting_event', args: ['UUID', 'TEXT', 'TEXT', 'UUID', 'JSONB'], roles: ['service_role'] },
  { name: 'claim_outbox_batch', args: ['INTEGER'], roles: ['service_role'] },
  { name: 'mark_outbox_completed', args: ['UUID', 'UUID'], roles: ['service_role'] },
  { name: 'mark_outbox_failed', args: ['UUID', 'TEXT'], roles: ['service_role'] },

  { name: 'ensure_open_period', args: ['UUID', 'DATE'], roles: ['authenticated', 'service_role'] },
  { name: 'preview_closing_entries', args: ['UUID'], roles: ['authenticated', 'service_role'] },
  { name: 'close_accounting_period', args: ['UUID'], roles: ['authenticated', 'service_role'] },
  { name: 'reopen_accounting_period', args: ['UUID'], roles: ['authenticated', 'service_role'] },

  { name: 'get_trial_balance', args: ['UUID', 'DATE'], roles: ['authenticated', 'service_role'] },
  { name: 'get_income_statement', args: ['UUID', 'DATE', 'DATE'], roles: ['authenticated', 'service_role'] },
  { name: 'get_balance_sheet', args: ['UUID', 'DATE'], roles: ['authenticated', 'service_role'] },
  { name: 'get_account_ledger', args: ['UUID', 'UUID', 'DATE', 'DATE'], roles: ['authenticated', 'service_role'] },
  { name: 'get_cash_flow_statement', args: ['UUID', 'DATE', 'DATE'], roles: ['authenticated', 'service_role'] },
  { name: 'get_reconciliation_report', args: ['UUID', 'DATE', 'DATE'], roles: ['authenticated', 'service_role'] },
  { name: 'get_consolidated_pnl', args: ['DATE', 'DATE'], roles: ['authenticated', 'service_role'] },

  { name: 'get_accounting_readiness', args: ['UUID'], roles: ['authenticated', 'service_role'] },
  { name: 'preview_legacy_ledger_sync', args: ['UUID'], roles: ['authenticated', 'service_role'] },
  { name: 'sync_legacy_to_ledger_atomic', args: ['UUID', 'UUID'], roles: ['authenticated', 'service_role'] },
  { name: 'resolve_accounting_review_item', args: ['UUID', 'TEXT'], roles: ['authenticated', 'service_role'] },
  { name: 'backfill_accounting_metadata', args: ['UUID', 'INTEGER'], roles: ['authenticated', 'service_role'] },
  {
    name: 'record_remaining_payment_atomic',
    args: ['UUID', 'NUMERIC', 'TEXT', 'DATE', 'TEXT', 'TEXT', 'TEXT', 'TEXT', 'UUID', 'TEXT', 'TEXT', 'JSONB', 'JSONB'],
    roles: ['authenticated', 'service_role'],
  },

  { name: 'calculate_ktv_salary_sheet', args: ['DATE'], roles: ['authenticated', 'service_role'] },
  { name: 'get_salary_reconciliation_report', args: ['UUID', 'DATE'], roles: ['authenticated', 'service_role'] },
  { name: 'get_salary_reconciliation', args: ['DATE'], roles: ['authenticated', 'service_role'] },
  { name: 'get_ai_attendance_kpis', args: ['DATE'], roles: ['authenticated', 'service_role'] },
  { name: 'get_ktv_leaderboard', args: ['UUID', 'DATE'], roles: ['authenticated', 'service_role'] },

  { name: 'get_effective_subscription_entitlements', args: ['UUID'], roles: ['authenticated', 'service_role'] },
  { name: 'get_tenant_sms_usage', args: ['UUID'], roles: ['authenticated', 'service_role'] },
  { name: 'renew_tenant_subscription', args: ['TEXT', 'TEXT'], roles: ['authenticated', 'service_role'] },
  { name: 'increment_tenant_sms', args: ['UUID'], roles: ['authenticated', 'service_role'] },
  { name: 'set_session_tenant', args: ['UUID'], roles: ['authenticated', 'service_role'] },
];

function normalizeArgType(arg) {
  return String(arg || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizeArgs(args) {
  if (Array.isArray(args)) {
    return args.map(normalizeArgType).join(', ');
  }

  return String(args || '')
    .split(',')
    .map(normalizeArgType)
    .filter(Boolean)
    .join(', ');
}

function normalizeRole(role) {
  return String(role || '').trim().replace(/[";]/g, '').toLowerCase();
}

function parseGrantExecuteStatements(sql) {
  const grants = [];
  const grantRegex = /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s+TO\s+([^;]+);/gims;

  for (const match of String(sql || '').matchAll(grantRegex)) {
    grants.push({
      name: match[1].toLowerCase(),
      args: normalizeArgs(match[2]),
      roles: match[3].split(',').map(normalizeRole).filter(Boolean),
    });
  }

  return grants;
}

function readMigrationSql(migrationsDir = join(process.cwd(), 'supabase', 'migrations')) {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => readFileSync(join(migrationsDir, name), 'utf8'))
    .join('\n');
}

function findMissingCriticalGrants(requiredGrants, parsedGrants) {
  return requiredGrants
    .map((required) => {
      const matchingGrants = parsedGrants.filter((grant) => (
        grant.name === required.name.toLowerCase()
        && grant.args === normalizeArgs(required.args)
      ));

      if (matchingGrants.length === 0) {
        return {
          ...required,
          missingRoles: required.roles,
          reason: 'missing grant',
        };
      }

      const grantedRoles = new Set(matchingGrants.flatMap((grant) => grant.roles));
      const missingRoles = required.roles.filter((role) => !grantedRoles.has(normalizeRole(role)));
      if (missingRoles.length === 0) {
        return null;
      }

      return {
        ...required,
        missingRoles,
        reason: 'missing required role',
      };
    })
    .filter(Boolean);
}

function formatGrantSignature(grant) {
  return `public.${grant.name}(${normalizeArgs(grant.args)})`;
}

function main() {
  const grants = parseGrantExecuteStatements(readMigrationSql());
  const missing = findMissingCriticalGrants(CRITICAL_RPC_GRANTS, grants);

  if (missing.length > 0) {
    console.error('Critical Supabase RPC grants are missing:');
    for (const grant of missing) {
      console.error(`- ${formatGrantSignature(grant)}: ${grant.reason}; missing roles: ${grant.missingRoles.join(', ')}`);
    }
    process.exit(1);
  }

  console.log(`Critical Supabase RPC grants are covered: ${CRITICAL_RPC_GRANTS.length}/${CRITICAL_RPC_GRANTS.length}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  CRITICAL_RPC_GRANTS,
  findMissingCriticalGrants,
  formatGrantSignature,
  normalizeArgs,
  parseGrantExecuteStatements,
};
