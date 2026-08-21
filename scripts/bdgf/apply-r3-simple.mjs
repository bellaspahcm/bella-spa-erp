#!/usr/bin/env node
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Connected\n');
    
    // Check if roles already exist
    const roleCheck = await client.query("SELECT COUNT(*) as count FROM pg_roles WHERE rolname LIKE 'bella_%'");
    const r3Exists = parseInt(roleCheck.rows[0].count) > 0;
    
    if (r3Exists) {
      console.log('✅ R3 already applied (bella roles exist)\n');
    } else {
      console.log('Applying R3 (simplified version)...\n');
      const r3SQL = fs.readFileSync('supabase/migrations/20260820110000_database_role_separation_v2.sql', 'utf8');
      await client.query(r3SQL);
      await client.query("INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES('20260820110000', 'database_role_separation', ARRAY['R3']) ON CONFLICT DO NOTHING");
      console.log('✅ R3 applied\n');
    }
    
    // Verify
    const roles = await client.query("SELECT rolname, rolsuper, rolcreatedb FROM pg_roles WHERE rolname LIKE 'bella_%' ORDER BY rolname");
    console.log('✅ Bella Roles:');
    roles.rows.forEach(r => console.log(`  - ${r.rolname} (superuser: ${r.rolsuper}, createdb: ${r.rolcreatedb})`));
    
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'migration_governance' ORDER BY table_name");
    console.log('\n✅ Migration Governance Tables:');
    tables.rows.forEach(t => console.log(`  - ${t.table_name}`));
    
    console.log('\n✅ R2 + R3 DEPLOYMENT COMPLETE\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
