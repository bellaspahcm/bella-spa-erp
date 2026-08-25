/**
 * G9: Contract Verification
 * 
 * Verifies platform contract compliance:
 * - Finance OS contracts
 * - Healthcare OS contracts (H1-H12)
 * - Logistics OS contracts (E7)
 * - No Kernel modifications
 * - Public Contract usage enforced
 */

import type { Migration, ContractVerification } from '../types';
import type { Pool } from 'pg';

export async function verifyContracts(
  migration: Migration,
  db: Pool
): Promise<ContractVerification> {
  
  const financeOS = await verifyFinanceOSContract(migration, db);
  const healthcareOS = await verifyHealthcareOSContract(migration, db);
  const logisticsOS = await verifyLogisticsOSContract(migration, db);
  
  const pass = financeOS && healthcareOS && logisticsOS;
  
  return {
    pass,
    financeOS,
    healthcareOS,
    logisticsOS
  };
}

async function verifyFinanceOSContract(migration: Migration, db: Pool): Promise<boolean> {
  // Check 1: No direct modification to fin_* Kernel tables
  const financeKernelTables = [
    'fin_accounts',
    'fin_transactions',
    'fin_journal_entries',
    'fin_ledger'
  ];
  
  for (const table of financeKernelTables) {
    const modifyPattern = new RegExp(
      `(ALTER\\s+TABLE\\s+${table}|DROP\\s+TABLE\\s+${table}|UPDATE\\s+${table}|DELETE\\s+FROM\\s+${table})`,
      'gi'
    );
    
    if (modifyPattern.test(migration.sql)) {
      console.error(`⚠️  Finance OS Kernel violation: Direct modification to '${table}'`);
      console.error(`   Product Verticals MUST use Public Contracts`);
      return false;
    }
  }
  
  // Check 2: Finance OS tables follow naming convention
  const createTablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+)/gi;
  let match;
  
  while ((match = createTablePattern.exec(migration.sql)) !== null) {
    const tableName = match[1];
    
    // If table name starts with fin_, it must be in allowed list
    if (tableName.startsWith('fin_') && !financeKernelTables.includes(tableName)) {
      // This is a new Finance table - check if it follows Product Vertical pattern
      const productPattern = /^fin_pv_[a-z_]+$/;
      if (!productPattern.test(tableName)) {
        console.error(`⚠️  Finance OS naming violation: '${tableName}'`);
        console.error(`   Product Vertical tables MUST use pattern: fin_pv_<vertical>_<entity>`);
        return false;
      }
    }
  }
  
  return true;
}

async function verifyHealthcareOSContract(migration: Migration, db: Pool): Promise<boolean> {
  // Check 1: No modification to Healthcare Kernel (H1-H12)
  const healthcareKernelTables = [
    'hc_patients',
    'hc_doctors',
    'hc_encounters',
    'hc_observations',
    'hc_medications',
    'hc_procedures',
    'hc_care_plans',
    'hc_clinical_notes',
    'hc_diagnoses',
    'hc_allergies',
    'hc_immunizations',
    'hc_lab_results'
  ];
  
  for (const table of healthcareKernelTables) {
    const modifyPattern = new RegExp(
      `(ALTER\\s+TABLE\\s+${table}|DROP\\s+TABLE\\s+${table}|UPDATE\\s+${table}|DELETE\\s+FROM\\s+${table})`,
      'gi'
    );
    
    if (modifyPattern.test(migration.sql)) {
      console.error(`⚠️  Healthcare OS Kernel violation: Direct modification to '${table}'`);
      console.error(`   Healthcare Kernel (H1-H12) is FROZEN`);
      console.error(`   Product Verticals MUST use Public Contracts`);
      return false;
    }
  }
  
  // Check 2: Healthcare Product Vertical tables follow naming
  const createTablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+)/gi;
  let match;
  
  while ((match = createTablePattern.exec(migration.sql)) !== null) {
    const tableName = match[1];
    
    if (tableName.startsWith('hc_') && !healthcareKernelTables.includes(tableName)) {
      const productPattern = /^hc_pv_[a-z_]+$/;
      if (!productPattern.test(tableName)) {
        console.error(`⚠️  Healthcare OS naming violation: '${tableName}'`);
        console.error(`   Product Vertical tables MUST use pattern: hc_pv_<vertical>_<entity>`);
        return false;
      }
    }
  }
  
  return true;
}

async function verifyLogisticsOSContract(migration: Migration, db: Pool): Promise<boolean> {
  // Check 1: No modification to Logistics Kernel (E7)
  const logisticsKernelTables = [
    'inventory_items',
    'inventory_movements',
    'warehouses',
    'locations',
    'movement_rules',
    'movement_validations',
    'inventory_snapshots',
    'stock_levels'
  ];
  
  for (const table of logisticsKernelTables) {
    const modifyPattern = new RegExp(
      `(ALTER\\s+TABLE\\s+${table}|DROP\\s+TABLE\\s+${table}|UPDATE\\s+${table}|DELETE\\s+FROM\\s+${table})`,
      'gi'
    );
    
    if (modifyPattern.test(migration.sql)) {
      console.error(`⚠️  Logistics OS Kernel violation: Direct modification to '${table}'`);
      console.error(`   Logistics Kernel (E7) is FROZEN`);
      console.error(`   Product Verticals MUST use Public Contracts`);
      return false;
    }
  }
  
  // Check 2: E7 baseline integrity
  const e7Count = await db.query(`
    SELECT COUNT(*) as count
    FROM supabase_migrations.schema_migrations
    WHERE version <= '20260823010000'
  `);
  
  const expectedE7Count = 23;
  if (parseInt(e7Count.rows[0].count) !== expectedE7Count) {
    console.error(`⚠️  E7 baseline integrity violation`);
    console.error(`   Expected ${expectedE7Count} migrations, found ${e7Count.rows[0].count}`);
    return false;
  }
  
  return true;
}
