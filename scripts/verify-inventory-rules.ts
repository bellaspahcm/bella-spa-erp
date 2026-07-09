/**
 * Inventory Rules Verification Script
 * 
 * Verifies all 12 inventory rules are properly defined and exported.
 * 
 * Run: npx tsx scripts/verify-inventory-rules.ts
 */

import {
  allInventoryRules,
  inventoryRulesByCategory,
  INVENTORY_RULE_STATS,
  inventoryRulesMetadata,
} from '../src/lib/decision-engine/providers/inventory';

console.log('🔍 Verifying Inventory Provider Rules...\n');

// 1. Verify all rules loaded
console.log(`✅ Total rules: ${allInventoryRules.length}`);
console.log(`   Target: 12 rules`);
console.log(`   Status: ${allInventoryRules.length === 12 ? '✅ PASS' : '❌ FAIL'}\n`);

// 2. Verify rule categories
console.log('📦 Rules by Category:');
console.log(`   Reorder: ${inventoryRulesByCategory.reorder.length} rules`);
console.log(`   Allocation: ${inventoryRulesByCategory.allocation.length} rules`);
console.log(`   Expiry: ${inventoryRulesByCategory.expiry.length} rules\n`);

// 3. Verify priority ranges
console.log('🎯 Priority Ranges:');
const priorities = allInventoryRules.map(r => r.priority).sort((a, b) => a - b);
console.log(`   Min: ${priorities[0]}`);
console.log(`   Max: ${priorities[priorities.length - 1]}`);
console.log(`   Expected: 400-510`);
console.log(`   Status: ${priorities[0] === 400 && priorities[priorities.length - 1] === 510 ? '✅ PASS' : '❌ FAIL'}\n`);

// 4. Verify no duplicate IDs
const ruleIds = allInventoryRules.map(r => r.id);
const uniqueIds = new Set(ruleIds);
console.log(`🆔 Rule IDs:`);
console.log(`   Total: ${ruleIds.length}`);
console.log(`   Unique: ${uniqueIds.size}`);
console.log(`   Status: ${ruleIds.length === uniqueIds.size ? '✅ PASS (no duplicates)' : '❌ FAIL (duplicates found)'}\n`);

// 5. Verify all rules enabled
const enabledCount = allInventoryRules.filter(r => r.enabled).length;
console.log(`⚡ Rule Status:`);
console.log(`   Enabled: ${enabledCount}`);
console.log(`   Disabled: ${allInventoryRules.length - enabledCount}`);
console.log(`   Status: ${enabledCount === 12 ? '✅ ALL ENABLED' : '⚠️ SOME DISABLED'}\n`);

// 6. Verify rule structure
console.log('🏗️ Rule Structure Validation:');
let structureErrors = 0;

for (const rule of allInventoryRules) {
  const errors: string[] = [];
  
  if (!rule.id) errors.push('missing id');
  if (!rule.name) errors.push('missing name');
  if (!rule.priority) errors.push('missing priority');
  if (rule.enabled === undefined) errors.push('missing enabled');
  if (!rule.version) errors.push('missing version');
  if (!rule.condition) errors.push('missing condition');
  if (!rule.action) errors.push('missing action');
  
  if (errors.length > 0) {
    console.log(`   ❌ ${rule.id || 'unknown'}: ${errors.join(', ')}`);
    structureErrors++;
  }
}

if (structureErrors === 0) {
  console.log(`   ✅ All 12 rules have valid structure\n`);
} else {
  console.log(`   ❌ ${structureErrors} rules have structure errors\n`);
}

// 7. List all rules
console.log('📋 All Inventory Rules:\n');
console.log('Reorder Rules (Priority 400-440):');
inventoryRulesByCategory.reorder.forEach(r => {
  console.log(`   ${r.priority} - ${r.name} [${r.enabled ? 'enabled' : 'disabled'}]`);
});

console.log('\nAllocation Rules (Priority 450-480):');
inventoryRulesByCategory.allocation.forEach(r => {
  console.log(`   ${r.priority} - ${r.name} [${r.enabled ? 'enabled' : 'disabled'}]`);
});

console.log('\nExpiry Rules (Priority 490-510):');
inventoryRulesByCategory.expiry.forEach(r => {
  console.log(`   ${r.priority} - ${r.name} [${r.enabled ? 'enabled' : 'disabled'}]`);
});

// 8. Stats summary
console.log('\n📊 Statistics:');
console.log(JSON.stringify(INVENTORY_RULE_STATS, null, 2));

// 9. Metadata
console.log('\n📝 Metadata:');
console.log(`   Description: ${inventoryRulesMetadata.description}`);
console.log(`   Version: ${inventoryRulesMetadata.version}`);
console.log(`   Last Updated: ${inventoryRulesMetadata.lastUpdated}`);
console.log(`   Business Domains: ${inventoryRulesMetadata.businessDomains.join(', ')}`);
console.log(`   Integrations: ${inventoryRulesMetadata.integrations.length} integrations`);
console.log(`   Capabilities: ${inventoryRulesMetadata.capabilities.length} capabilities`);

// Final verdict
console.log('\n' + '='.repeat(60));
const allPassed = 
  allInventoryRules.length === 12 &&
  ruleIds.length === uniqueIds.size &&
  priorities[0] === 400 &&
  priorities[priorities.length - 1] === 510 &&
  structureErrors === 0;

if (allPassed) {
  console.log('✅ ALL CHECKS PASSED - Inventory Rules Ready!');
} else {
  console.log('❌ SOME CHECKS FAILED - Review errors above');
  process.exit(1);
}
console.log('='.repeat(60));

