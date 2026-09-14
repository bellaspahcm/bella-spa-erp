import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ quiet: true });

const requiredSchema = [
  {
    table: 'edu_courses',
    columns: [
      'id',
      'tenant_id',
      'course_code',
      'title',
      'status',
      'max_students',
      'current_enrollment',
      'prerequisite_course_codes',
    ],
  },
  {
    table: 'platform_business_rules',
    columns: [
      'id',
      'tenant_id',
      'rule_key',
      'version',
      'domain',
      'name',
      'status',
      'severity',
      'conditions',
      'action_type',
      'action_params',
      'effective_from',
      'effective_to',
    ],
  },
  {
    table: 'courses',
    columns: ['course_id', 'tenant_id', 'course_code', 'course_name', 'credits', 'status'],
  },
];

function isMissingSchemaError(error) {
  const code = String(error?.code ?? '');
  const message = String(error?.message ?? '');

  return (
    code === 'PGRST204' ||
    code === 'PGRST205' ||
    /Could not find (the )?(table|column)/i.test(message) ||
    /schema cache/i.test(message)
  );
}

function classifyPreflightError(error, table) {
  if (isMissingSchemaError(error)) {
    return {
      status: 'ALLOW_INFRASTRUCTURE_SCHEMA_MISSING',
      reason: `${table}: ${error.message}`,
    };
  }

  return {
    status: 'BLOCK_UNKNOWN_PREFLIGHT_ERROR',
    reason: `${table}: ${error?.message ?? String(error)}`,
  };
}

async function runPreflight() {
  const mocked = process.env.CI_EDUCATION_CONFORMANCE_PREFLIGHT_RESULT;
  if (mocked === 'ok') {
    return { status: 'RUN_CONFORMANCE', reason: 'mocked schema available' };
  }
  if (mocked === 'missing-schema') {
    return {
      status: 'ALLOW_INFRASTRUCTURE_SCHEMA_MISSING',
      reason: 'mocked missing Education OS schema',
    };
  }
  if (mocked === 'unknown-error') {
    return {
      status: 'BLOCK_UNKNOWN_PREFLIGHT_ERROR',
      reason: 'mocked unknown preflight error',
    };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return {
      status: 'ALLOW_INFRASTRUCTURE_ENV_MISSING',
      reason: 'Supabase URL or service role key is unavailable in CI',
    };
  }

  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  for (const check of requiredSchema) {
    const { error } = await supabase
      .from(check.table)
      .select(check.columns.join(','))
      .limit(1);

    if (error) {
      return classifyPreflightError(error, check.table);
    }
  }

  return { status: 'RUN_CONFORMANCE', reason: 'Education OS schema is available' };
}

function runConformanceTests() {
  if (process.env.CI_EDUCATION_CONFORMANCE_SKIP_JEST === '1') {
    console.log('Education conformance CI policy: RUN_CONFORMANCE_SKIPPED_BY_SELF_TEST');
    return 0;
  }

  const result = spawnSync(
    process.execPath,
    [
      'node_modules/jest/bin/jest.js',
      'src/products/bella-education/__tests__/bella-education-conformance.integration.test.ts',
      'src/platform/education/__tests__/',
      '--runInBand',
    ],
    {
      stdio: 'inherit',
    }
  );

  return result.status ?? 1;
}

const preflight = await runPreflight();
console.log(`Education conformance CI preflight: ${preflight.status}`);
console.log(`Education conformance CI reason: ${preflight.reason}`);

if (preflight.status === 'RUN_CONFORMANCE') {
  process.exit(runConformanceTests());
}

if (preflight.status.startsWith('ALLOW_INFRASTRUCTURE_')) {
  console.log('Education conformance CI policy: ALLOW_WITH_INFRASTRUCTURE_ATTRIBUTION');
  process.exit(0);
}

console.error('Education conformance CI policy: BLOCK_UNKNOWN');
process.exit(1);
