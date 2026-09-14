import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

function runCase(preflightResult, extraEnv = {}) {
  return spawnSync(process.execPath, ['scripts/ci-run-education-conformance.mjs'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      CI_EDUCATION_CONFORMANCE_PREFLIGHT_RESULT: preflightResult,
      ...extraEnv,
    },
  });
}

const missingSchema = runCase('missing-schema');
assert.equal(missingSchema.status, 0);
assert.match(missingSchema.stdout, /ALLOW_WITH_INFRASTRUCTURE_ATTRIBUTION/);
console.log('PASS EDUCATION CONFORMANCE MISSING SCHEMA = ALLOW INFRASTRUCTURE');

const schemaAvailable = runCase('ok', {
  CI_EDUCATION_CONFORMANCE_SKIP_JEST: '1',
});
assert.equal(schemaAvailable.status, 0);
assert.match(schemaAvailable.stdout, /RUN_CONFORMANCE_SKIPPED_BY_SELF_TEST/);
console.log('PASS EDUCATION CONFORMANCE SCHEMA OK = RUN TESTS');

const unknownError = runCase('unknown-error');
assert.equal(unknownError.status, 1);
assert.match(unknownError.stderr, /BLOCK_UNKNOWN/);
console.log('PASS EDUCATION CONFORMANCE UNKNOWN PREFLIGHT = BLOCK');
