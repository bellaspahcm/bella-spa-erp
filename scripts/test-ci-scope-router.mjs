import assert from 'node:assert/strict';
import { classifyFiles } from './ci-scope-router.mjs';

function route(files) {
  return classifyFiles(files);
}

function assertIncludes(actual, expected, message) {
  assert.ok(actual.includes(expected), `${message}: expected ${actual.join(',')} to include ${expected}`);
}

const cases = [
  {
    name: 'ALLOW product-only English Center change',
    files: ['src/products/bella-english-center/services/enrollment.service.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'product');
      assert.deepEqual(result.products, ['english_center']);
      assert.equal(result.typecheck_mode, 'changed');
      assert.equal(result.needs_migration_gates, false);
      assert.equal(result.needs_dependency_security_deep, false);
      assert.equal(result.needs_security_lightweight, true);
    },
  },
  {
    name: 'ALLOW Education OS change and expand affected products',
    files: ['src/platform/education/contracts/enrollment.contract.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'os');
      assert.deepEqual(result.os, ['education']);
      assertIncludes(result.affected_products, 'education_preschool', 'preschool should be affected by Education OS');
      assertIncludes(result.affected_products, 'english_center', 'English Center should be affected by Education OS');
      assert.equal(result.typecheck_mode, 'affected');
    },
  },
  {
    name: 'ALLOW platform change and require full evidence',
    files: ['src/core/runtime/tenant-context.ts'],
    expect(result) {
      assert.equal(result.scope_status, 'ALLOW');
      assert.equal(result.scope_level, 'platform');
      assert.equal(result.typecheck_mode, 'full');
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.needs_build, true);
    },
  },
  {
    name: 'SKIP migration gates when no migration changed',
    files: ['src/products/bella-english-center/types/class.types.ts'],
    expect(result) {
      assert.equal(result.needs_migration_gates, false);
    },
  },
  {
    name: 'RUN migration gates when migration changed',
    files: ['supabase/migrations/202609140001_add_english_center_table.sql'],
    expect(result) {
      assert.equal(result.needs_migration_gates, true);
      assert.equal(result.needs_build, false);
      assert.equal(result.needs_real_db_e2e, true);
      assert.equal(result.typecheck_mode, 'skip');
    },
  },
  {
    name: 'SKIP API docs when no API/docs surface changed',
    files: ['src/products/bella-english-center/services/teacher.service.ts'],
    expect(result) {
      assert.equal(result.needs_api_docs, false);
    },
  },
  {
    name: 'RUN API docs when API surface changed',
    files: ['src/app/api/english-center/classes/route.ts'],
    expect(result) {
      assert.equal(result.needs_api_docs, true);
    },
  },
  {
    name: 'RUN dependency deep security on dependency file change',
    files: ['package-lock.json'],
    expect(result) {
      assert.equal(result.scope_level, 'platform');
      assert.equal(result.dependencies_changed, true);
      assert.equal(result.needs_dependency_security_deep, true);
      assert.equal(result.needs_real_db_e2e, false);
      assert.equal(result.typecheck_mode, 'full');
    },
  },
  {
    name: 'BLOCK multi-product product-only contamination',
    files: [
      'src/products/bella-english-center/services/class.service.ts',
      'src/products/bella-land/services/reservation.service.ts',
    ],
    expect(result) {
      assert.equal(result.scope_status, 'BLOCK');
      assert.equal(result.scope_level, 'product');
    },
  },
];

for (const testCase of cases) {
  const result = route(testCase.files);
  testCase.expect(result);
  console.log(`PASS ${testCase.name}`);
}
