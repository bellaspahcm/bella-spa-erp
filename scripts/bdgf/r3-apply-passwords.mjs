#!/usr/bin/env node
/**
 * R3: Apply passwords to bella_developer and bella_migration_executor
 */

import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function applyPasswords() {
  console.log('🔐 R3: Applying passwords to database roles\n');
  
  // Read the generated SQL file
  const sqlFile = 'scripts/bdgf/r3-set-passwords-generated.sql';
  
  if (!fs.existsSync(sqlFile)) {
    console.log('❌ SQL file not found:', sqlFile);
    console.log('   Please generate passwords first');
    process.exit(1);
  }
  
  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  // Extract passwords from SQL
  const devMatch = sql.match(/ALTER ROLE bella_developer WITH PASSWORD '([^']+)'/);
  const execMatch = sql.match(/ALTER ROLE bella_migration_executor WITH PASSWORD '([^']+)'/);
  
  if (!devMatch || !execMatch) {
    console.log('❌ Could not extract passwords from SQL file');
    process.exit(1);
  }
  
  const devPassword = devMatch[1];
  const execPassword = execMatch[1];
  
  console.log('📋 Passwords extracted from SQL file');
  console.log(`   bella_developer: ${devPassword.substring(0, 8)}...`);
  console.log(`   bella_migration_executor: ${execPassword.substring(0, 8)}...\n`);
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Set bella_developer password
    console.log('Setting bella_developer password...');
    await client.query(`ALTER ROLE bella_developer WITH PASSWORD '${devPassword}'`);
    console.log('✅ bella_developer password set\n');
    
    // Set bella_migration_executor password
    console.log('Setting bella_migration_executor password...');
    await client.query(`ALTER ROLE bella_migration_executor WITH PASSWORD '${execPassword}'`);
    console.log('✅ bella_migration_executor password set\n');
    
    // Verify
    console.log('Verifying roles...');
    const result = await client.query(`
      SELECT rolname, rolcanlogin 
      FROM pg_roles 
      WHERE rolname IN ('bella_developer', 'bella_migration_executor')
      ORDER BY rolname
    `);
    
    console.log('Roles:');
    result.rows.forEach(row => {
      console.log(`  - ${row.rolname}: ${row.rolcanlogin ? 'CAN LOGIN ✅' : 'NO LOGIN ❌'}`);
    });
    
    console.log('\n🎉 Passwords applied successfully!\n');
    console.log('📝 Next steps:');
    console.log('   1. Save these passwords to your password manager');
    console.log('   2. Update .env file (Step 2-3)');
    console.log('   3. Run verification tests (Step 4)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyPasswords();
