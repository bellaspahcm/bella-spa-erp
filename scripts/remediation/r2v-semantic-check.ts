/**
 * E0.1A-R2V — Semantic Verification (Complete)
 * 
 * Purpose: Verify semantic field preservation and data handling
 * Prerequisites: R2V structural checks passed
 * 
 * Usage: tsx scripts/remediation/r2v-semantic-check.ts
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL,
});

interface SemanticCheck {
  name: string;
  total: number;
  passed: number;
  failed: number;
  result: 'PASS' | 'FAIL';
}

async function main() {
  console.log('🔍 R2V SEMANTIC VERIFICATION\n');
  console.log('═'.repeat(80));
  
  const checks: SemanticCheck[] = [];
  
  // Check 1: Display Name Conversion
  console.log('\n📊 1. Display Name Conversion...');
  const displayNameResult = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE pp.display_name IS NOT NULL AND pp.display_name != '') as valid,
      COUNT(*) FILTER (WHERE pp.display_name IS NULL OR pp.display_name = '') as invalid
    FROM identity_migration_mapping m
    JOIN party_parties pp ON m.party_id = pp.id
    WHERE m.status = 'party_created'
  `);
  const dnCheck = displayNameResult.rows[0];
  checks.push({
    name: 'Display Name Valid',
    total: parseInt(dnCheck.total),
    passed: parseInt(dnCheck.valid),
    failed: parseInt(dnCheck.invalid),
    result: dnCheck.invalid === '0' ? 'PASS' : 'FAIL'
  });
  console.log(`   Total: ${dnCheck.total}, Valid: ${dnCheck.valid}, Invalid: ${dnCheck.invalid}`);
  console.log(`   Result: ${dnCheck.invalid === '0' ? '✅ PASS' : '❌ FAIL'}`);
  
  // Check 2: DOB Preservation
  console.log('\n📊 2. DOB Preservation...');
  const dobResult = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE p.date_of_birth IS NOT NULL AND pp.dob IS NOT NULL AND p.date_of_birth = pp.dob) as match,
      COUNT(*) FILTER (WHERE p.date_of_birth IS NOT NULL AND (pp.dob IS NULL OR p.date_of_birth != pp.dob)) as mismatch,
      COUNT(*) FILTER (WHERE p.date_of_birth IS NULL) as source_null
    FROM identity_migration_mapping m
    JOIN persons p ON m.person_id = p.id
    JOIN party_parties pp ON m.party_id = pp.id
    WHERE m.status = 'party_created'
  `);
  const dobCheck = dobResult.rows[0];
  checks.push({
    name: 'DOB Preserved',
    total: parseInt(dobCheck.total),
    passed: parseInt(dobCheck.match),
    failed: parseInt(dobCheck.mismatch),
    result: dobCheck.mismatch === '0' ? 'PASS' : 'FAIL'
  });
  console.log(`   Total: ${dobCheck.total}, Match: ${dobCheck.match}, Mismatch: ${dobCheck.mismatch}, Source NULL: ${dobCheck.source_null}`);
  console.log(`   Result: ${dobCheck.mismatch === '0' ? '✅ PASS' : '❌ FAIL'}`);
  
  // Check 3: Gender Preservation
  console.log('\n📊 3. Gender Preservation...');
  const genderResult = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE p.gender IS NOT NULL AND pp.gender IS NOT NULL AND p.gender = pp.gender) as match,
      COUNT(*) FILTER (WHERE p.gender IS NOT NULL AND (pp.gender IS NULL OR p.gender != pp.gender)) as mismatch,
      COUNT(*) FILTER (WHERE p.gender IS NULL) as source_null
    FROM identity_migration_mapping m
    JOIN persons p ON m.person_id = p.id
    JOIN party_parties pp ON m.party_id = pp.id
    WHERE m.status = 'party_created'
  `);
  const genderCheck = genderResult.rows[0];
  checks.push({
    name: 'Gender Preserved',
    total: parseInt(genderCheck.total),
    passed: parseInt(genderCheck.match),
    failed: parseInt(genderCheck.mismatch),
    result: genderCheck.mismatch === '0' ? 'PASS' : 'FAIL'
  });
  console.log(`   Total: ${genderCheck.total}, Match: ${genderCheck.match}, Mismatch: ${genderCheck.mismatch}, Source NULL: ${genderCheck.source_null}`);
  console.log(`   Result: ${genderCheck.mismatch === '0' ? '✅ PASS' : '❌ FAIL'}`);
  
  // Check 4: Created_At Preservation
  console.log('\n📊 4. Created_At Preservation...');
  const createdAtResult = await pool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE p.created_at = pp.created_at) as match,
      COUNT(*) FILTER (WHERE p.created_at != pp.created_at) as mismatch
    FROM identity_migration_mapping m
    JOIN persons p ON m.person_id = p.id
    JOIN party_parties pp ON m.party_id = pp.id
    WHERE m.status = 'party_created'
  `);
  const createdAtCheck = createdAtResult.rows[0];
  checks.push({
    name: 'Created_At Preserved',
    total: parseInt(createdAtCheck.total),
    passed: parseInt(createdAtCheck.match),
    failed: parseInt(createdAtCheck.mismatch),
    result: createdAtCheck.mismatch === '0' ? 'PASS' : 'FAIL'
  });
  console.log(`   Total: ${createdAtCheck.total}, Match: ${createdAtCheck.match}, Mismatch: ${createdAtCheck.mismatch}`);
  console.log(`   Result: ${createdAtCheck.mismatch === '0' ? '✅ PASS' : '❌ FAIL'}`);
  
  // Complex Field Handling Analysis
  console.log('\n📊 5. Complex Field Handling...');
  
  // Identifiers
  const identifiersResult = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE identifiers IS NOT NULL AND identifiers != '[]'::jsonb) as with_identifiers,
      COUNT(*) FILTER (WHERE identifiers IS NULL OR identifiers = '[]'::jsonb) as without_identifiers
    FROM persons
  `);
  const idResult = identifiersResult.rows[0];
  console.log(`   Identifiers: ${idResult.with_identifiers} persons with data, ${idResult.without_identifiers} without`);
  console.log(`   Verdict: ${idResult.with_identifiers === '0' ? 'NOT_APPLICABLE' : 'RETAINED_LEGACY (requires party_identifiers subtable)'}`);
  
  // Contacts
  const contactsResult = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE contacts IS NOT NULL AND contacts != '[]'::jsonb) as with_contacts,
      COUNT(*) FILTER (WHERE contacts IS NULL OR contacts = '[]'::jsonb) as without_contacts
    FROM persons
  `);
  const contactResult = contactsResult.rows[0];
  console.log(`   Contacts: ${contactResult.with_contacts} persons with data, ${contactResult.without_contacts} without`);
  console.log(`   Verdict: ${contactResult.with_contacts === '0' ? 'NOT_APPLICABLE' : 'RETAINED_LEGACY (requires party_contacts subtable)'}`);
  
  // Addresses
  const addressesResult = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE addresses IS NOT NULL AND addresses != '[]'::jsonb) as with_addresses,
      COUNT(*) FILTER (WHERE addresses IS NULL OR addresses = '[]'::jsonb) as without_addresses
    FROM persons
  `);
  const addressResult = addressesResult.rows[0];
  console.log(`   Addresses: ${addressResult.with_addresses} persons with data, ${addressResult.without_addresses} without`);
  console.log(`   Verdict: ${addressResult.with_addresses === '0' ? 'NOT_APPLICABLE' : 'RETAINED_LEGACY (requires party_addresses subtable)'}`);
  
  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('\n📋 R2V SEMANTIC VERIFICATION SUMMARY\n');
  
  const allPassed = checks.every(c => c.result === 'PASS');
  
  checks.forEach(check => {
    const icon = check.result === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${check.name}: ${check.passed}/${check.total} (${check.failed} failed)`);
  });
  
  console.log('\n' + '═'.repeat(80));
  
  if (allPassed) {
    console.log('\n🎉 R2V SEMANTIC VERIFICATION: ✅ PASS');
    console.log('\n📊 Core Identity Fields: 100% preserved');
    console.log('📊 Complex Fields: Properly classified (RETAINED_LEGACY)');
    console.log('\n🔒 Ready for R2 Evidence Seal\n');
  } else {
    console.log('\n❌ R2V SEMANTIC VERIFICATION: 🔴 FAIL');
    console.log('\n⚠️  Cannot seal R2 evidence until all checks pass\n');
  }
  
  await pool.end();
  
  return {
    passed: allPassed,
    checks,
    complexFields: {
      identifiers: idResult.with_identifiers === '0' ? 'NOT_APPLICABLE' : 'RETAINED_LEGACY',
      contacts: contactResult.with_contacts === '0' ? 'NOT_APPLICABLE' : 'RETAINED_LEGACY',
      addresses: addressResult.with_addresses === '0' ? 'NOT_APPLICABLE' : 'RETAINED_LEGACY',
    }
  };
}

main().then(result => {
  process.exit(result.passed ? 0 : 1);
}).catch(error => {
  console.error('❌ Semantic verification failed:', error);
  process.exit(1);
});
