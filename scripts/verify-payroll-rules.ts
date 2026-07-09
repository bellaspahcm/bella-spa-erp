/**
 * Verification Script: Payroll Rules Structure
 * 
 * Validates that all 17 payroll rules are properly defined:
 * - Required fields present (id, name, priority, enabled, condition, action)
 * - Priority ranges correct (200-350)
 * - No duplicate IDs
 * - Conditions and actions have valid structure
 * - Metadata includes required fields
 * 
 * Run: npx tsx scripts/verify-payroll-rules.ts
 */

import {
  allPayrollRules,
  payrollRulesByCategory,
  payrollRulesSummary,
} from '../src/lib/decision-engine/providers/payroll/rules';

function verifyRule(rule: any, index: number): boolean {
  const errors: string[] = [];

  if (!rule.id) errors.push('Missing id');
  if (!rule.name) errors.push('Missing name');
  if (typeof rule.priority !== 'number') errors.push('Missing or invalid priority');
  if (typeof rule.enabled !== 'boolean') errors.push('Missing or invalid enabled');
  if (typeof rule.version !== 'number') errors.push('Missing or invalid version');
  if (!rule.condition) errors.push('Missing condition');
  if (!rule.action) errors.push('Missing action');

  if (rule.condition) {
    if (!rule.condition.type) errors.push('Condition missing type');
    if (!['all', 'any', 'simple'].includes(rule.condition.type)) {
      errors.push(`Invalid condition type: ${rule.condition.type}`);
    }
  }

  if (rule.action) {
    if (!rule.action.type) errors.push('Action missing type');
    if (!['approve', 'reject', 'escalate', 'modify'].includes(rule.action.type)) {
      errors.push(`Invalid action type: ${rule.action.type}`);
    }
  }

  if (!rule.metadata) {
    errors.push('Missing metadata');
  } else {
    if (!rule.metadata.category) errors.push('Metadata missing category');
    if (!rule.metadata.createdAt) errors.push('Metadata missing createdAt');
    if (!rule.metadata.owner) errors.push('Metadata missing owner');
  }

  if (rule.priority < 200 || rule.priority > 350) {
    errors.push(`Priority out of range (200-350): ${rule.priority}`);
  }

  if (errors.length > 0) {
    console.error(`Rule ${index + 1} (${rule.id || 'NO-ID'}) - ${rule.name || 'NO-NAME'}:`);
    errors.forEach(err => console.error(`   - ${err}`));
    return false;
  }

  return true;
}

function verifyPayrollRules() {
  console.log('Verifying Payroll Rules Structure...\n');

  console.log('Rule Summary:');
  console.log(`   Total Rules: ${payrollRulesSummary.total}`);
  console.log(`   KPI Rules: ${payrollRulesSummary.byCategory.kpi}`);
  console.log(`   Attendance Rules: ${payrollRulesSummary.byCategory.attendance}`);
  console.log(`   Rating Rules: ${payrollRulesSummary.byCategory.rating}`);
  console.log(`   Commission Rules: ${payrollRulesSummary.byCategory.commission}`);
  console.log(`   Priority Range: ${payrollRulesSummary.priorityRange.min}-${payrollRulesSummary.priorityRange.max}\n`);

  const targetMin = 15;
  const targetMax = 20;
  if (payrollRulesSummary.total < targetMin || payrollRulesSummary.total > targetMax) {
    console.log(`Warning: Rule count (${payrollRulesSummary.total}) outside target range (${targetMin}-${targetMax})`);
  } else {
    console.log(`Rule count (${payrollRulesSummary.total}) within target range (${targetMin}-${targetMax})\n`);
  }

  let allValid = true;
  allPayrollRules.forEach((rule, index) => {
    if (!verifyRule(rule, index)) {
      allValid = false;
    }
  });

  if (!allValid) {
    console.log('\nSome rules have validation errors. See above.');
    process.exit(1);
  }

  const ids = allPayrollRules.map(r => r.id);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    console.error(`\nDuplicate rule IDs found: ${duplicates.join(', ')}`);
    allValid = false;
  }

  const priorities = allPayrollRules.map(r => r.priority);
  const duplicatePriorities = priorities.filter((p, index) => priorities.indexOf(p) !== index);
  if (duplicatePriorities.length > 0) {
    console.log(`\nWarning: Duplicate priorities found: ${duplicatePriorities.join(', ')}`);
    console.log('   (This is allowed, but may cause non-deterministic rule evaluation order)');
  }

  const enabledCount = allPayrollRules.filter(r => r.enabled).length;
  const disabledCount = allPayrollRules.length - enabledCount;
  console.log(`\nRule Status:`);
  console.log(`   Enabled: ${enabledCount}/${allPayrollRules.length}`);
  if (disabledCount > 0) {
    console.log(`   Disabled: ${disabledCount}`);
  }

  console.log(`\nRules by Category:`);
  Object.entries(payrollRulesByCategory).forEach(([category, rules]) => {
    console.log(`   ${category.toUpperCase()}:`);
    rules.forEach(rule => {
      const status = rule.enabled ? 'ENABLED' : 'DISABLED';
      console.log(`     [${status}] [P${rule.priority}] ${rule.name}`);
    });
  });

  if (allValid) {
    console.log('\nAll payroll rules are valid!');
    console.log('Ready for Step 2: Build Payroll Provider Integration');
  }
}

verifyPayrollRules();
