/**
 * Test getDefaultTenantModuleKey with education tenant
 */

import { getDefaultTenantModuleKey } from '../src/lib/business-rules/tenant-modules';

// Simulate tenant with bella_education: true
const tenantModules = {
  bella_education: true,
  babycare: false,
  beauty_spa: false,
  student_training: false,
  industrial_cleaning: false,
  real_estate: false,
  bella_auto: false,
  bella_healthcare: false,
};

console.log('Testing getDefaultTenantModuleKey...\n');
console.log('Input modules:', JSON.stringify(tenantModules, null, 2));

const result = getDefaultTenantModuleKey(tenantModules, 'Preschool Test');

console.log('\n✅ Result:', result);
console.log('Expected: bella_education');

if (result === 'bella_education') {
  console.log('\n✅ TEST PASSED!');
} else {
  console.log(`\n❌ TEST FAILED! Got: ${result}, expected: bella_education`);
  process.exit(1);
}
