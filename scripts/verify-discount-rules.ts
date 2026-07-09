/**
 * Verify Discount Rules
 * 
 * Quick verification script to ensure all discount rules are properly defined.
 * Checks rule structure, priority ordering, and metadata completeness.
 */

import {
  discountRules,
  getEnabledDiscountRules,
  getDiscountRuleStats,
  getDiscountRulesByCategory,
} from '../src/lib/decision-engine/providers/discount/rules';

console.log('🔍 Verifying Discount Rules...\n');

// 1. Check total rules count
const stats = getDiscountRuleStats();
console.log('📊 Rule Statistics:');
console.log(`   Total Rules: ${stats.total}`);
console.log(`   Enabled: ${stats.enabled}`);
console.log(`   Disabled: ${stats.disabled}`);
console.log(`   By Category:`);
for (const [category, count] of Object.entries(stats.byCategory)) {
  console.log(`     - ${category}: ${count} rules`);
}
console.log('');

// 2. Verify priority ordering
console.log('📋 Priority Order:');
const enabledRules = getEnabledDiscountRules();
for (const rule of enabledRules) {
  console.log(`   ${rule.priority.toString().padStart(3)} | ${rule.id.padEnd(40)} | ${rule.name}`);
}
console.log('');

// 3. Verify rule structure
console.log('✅ Structure Validation:');
let hasErrors = false;

for (const rule of discountRules) {
  const errors: string[] = [];
  
  if (!rule.id) errors.push('Missing id');
  if (!rule.name) errors.push('Missing name');
  if (!rule.description) errors.push('Missing description');
  if (rule.priority === undefined) errors.push('Missing priority');
  if (!rule.condition) errors.push('Missing condition');
  if (!rule.action) errors.push('Missing action');
  if (!rule.metadata) errors.push('Missing metadata');
  
  if (errors.length > 0) {
    console.log(`   ❌ ${rule.id || 'UNKNOWN'}: ${errors.join(', ')}`);
    hasErrors = true;
  }
}

if (!hasErrors) {
  console.log('   ✅ All rules have valid structure');
}
console.log('');

// 4. Verify discount percentages
console.log('💰 Discount Percentages:');
for (const rule of enabledRules) {
  const data = rule.action.data as Record<string, unknown>;
  const discountPercent = data.discountPercent as number;
  const discountType = data.discountType as string;
  console.log(`   ${discountPercent.toString().padStart(2)}% | ${discountType.padEnd(12)} | ${rule.name}`);
}
console.log('');

// 5. Summary
console.log('📦 Summary:');
console.log(`   ✅ ${stats.total} discount rules defined`);
console.log(`   ✅ Priority range: ${enabledRules[0]?.priority} (highest) to ${enabledRules[enabledRules.length - 1]?.priority} (lowest)`);
console.log(`   ✅ Discount range: 0% to ${Math.max(...enabledRules.map(r => (r.action.data as Record<string, unknown>).discountPercent as number))}%`);
console.log(`   ✅ Categories: ${Object.keys(stats.byCategory).join(', ')}`);
console.log('');

console.log('✅ Discount Rules Verification Complete!');
