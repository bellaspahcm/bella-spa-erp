#!/usr/bin/env node
/**
 * Gate 1 SQL Setup - Automated
 * Runs SQL scripts to set up test data for Gate 1 validation
 */

const { Client } = require('pg');

async function runSetup() {
  // Parse database URL from .env.local
  const dbUrl = process.env.SUPABASE_DB_URL;
  
  if (!dbUrl) {
    console.error('❌ SUPABASE_DB_URL not found in environment');
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });

  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected');

    // Step 1: Add leave_balance column
    console.log('\n📋 Step 1: Adding leave_balance column...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS leave_balance INTEGER DEFAULT 12;
    `);
    console.log('✅ Column added (or already exists)');

    // Verify column exists
    const { rows: columns } = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'leave_balance';
    `);
    console.log(`✅ Verified: leave_balance column ${columns.length > 0 ? 'exists' : 'MISSING!'}`);

    // Step 2: Insert test users
    console.log('\n📋 Step 2: Inserting test users...');
    await client.query(`
      INSERT INTO users (
        id, email, full_name, role, tenant_id, leave_balance, created_at, updated_at
      )
      VALUES 
        ('23a9da64-a8c6-4250-8268-37c965e70fd7', 'manager-gate1@bellaspa.local', 'Gate1 Test Manager', 'ktv_lead', '26c2d467-7c12-4e77-bb67-0e9e43fd7594', 12, NOW(), NOW()),
        ('a3a4f261-506e-4fb7-bd38-d245a3a1fea7', 'employee-high-balance@bellaspa.local', 'Employee High Balance', 'ktv', '26c2d467-7c12-4e77-bb67-0e9e43fd7594', 12, NOW(), NOW()),
        ('f3e5e94b-8683-4832-ad39-383c8804751c', 'employee-low-balance@bellaspa.local', 'Employee Low Balance', 'ktv', '26c2d467-7c12-4e77-bb67-0e9e43fd7594', 3, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        tenant_id = EXCLUDED.tenant_id,
        leave_balance = EXCLUDED.leave_balance,
        updated_at = NOW();
    `);
    console.log('✅ Users inserted/updated');

    // Verify users
    const { rows: users } = await client.query(`
      SELECT id, email, full_name, leave_balance 
      FROM users 
      WHERE email LIKE '%gate1%' OR email LIKE '%balance%'
      ORDER BY full_name;
    `);
    console.log(`✅ Verified: ${users.length} test users exist`);
    users.forEach(u => console.log(`   - ${u.full_name} (${u.email}): ${u.leave_balance} days`));

    console.log('\n🎉 Gate 1 SQL setup complete!');
    console.log('\n📝 Next: Run Gate 1 validation:');
    console.log('   npm run test:gate1');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSetup();
