import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_EXECUTOR_URL || process.env.DATABASE_URL,
});

async function main() {
  console.log('🔍 R2V Quick Verification\n');
  
  // Check 1: Mapping status
  const r1 = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'party_created') as created,
      COUNT(*) FILTER (WHERE status = 'planned') as pending,
      COUNT(*) as total
    FROM identity_migration_mapping
  `);
  console.log('✅ Mapping Status:', r1.rows[0]);
  
  // Check 2: Party existence
  const r2 = await pool.query(`
    SELECT COUNT(*) as missing
    FROM identity_migration_mapping m
    LEFT JOIN party_parties pp ON m.party_id = pp.id
    WHERE m.status = 'party_created' AND pp.id IS NULL
  `);
  console.log('✅ Missing Parties:', r2.rows[0]);
  
  // Check 3: Party type
  const r3 = await pool.query(`
    SELECT COUNT(*) as wrong_type
    FROM identity_migration_mapping m
    JOIN party_parties pp ON m.party_id = pp.id
    WHERE m.status = 'party_created' AND pp.party_type != 'person'
  `);
  console.log('✅ Wrong Type:', r3.rows[0]);
  
  // Check 4: Tenant consistency
  const r4 = await pool.query(`
    SELECT COUNT(*) as mismatch
    FROM identity_migration_mapping m
    JOIN persons p ON m.person_id = p.id
    JOIN party_parties pp ON m.party_id = pp.id
    WHERE m.status = 'party_created' AND p.tenant_id != pp.tenant_id
  `);
  console.log('✅ Tenant Mismatch:', r4.rows[0]);
  
  const allPass = 
    r1.rows[0].created === '848' &&
    r1.rows[0].pending === '0' &&
    r2.rows[0].missing === '0' &&
    r3.rows[0].wrong_type === '0' &&
    r4.rows[0].mismatch === '0';
  
  console.log('\n' + '═'.repeat(60));
  if (allPass) {
    console.log('🎉 R2V: ✅ PASS');
    console.log('🟢 R3 AUTHORIZED\n');
  } else {
    console.log('❌ R2V: 🔴 FAIL');
    console.log('🚫 R3 BLOCKED\n');
  }
  
  await pool.end();
  process.exit(allPass ? 0 : 1);
}

main();
