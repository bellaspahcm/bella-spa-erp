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
    
    // Check what exists
    const schemaCheck = await client.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'migration_governance'");
    const r2Exists = schemaCheck.rows.length > 0;
    
    const roleCheck = await client.query("SELECT COUNT(*) as count FROM pg_roles WHERE rolname LIKE 'bella_%'");
    const r3Exists = parseInt(roleCheck.rows[0].count) > 0;
    
    console.log(`R2 migration_governance schema: ${r2Exists ? 'EXISTS (skip)' : 'MISSING (apply)'}`);
    console.log(`R3 bella roles: ${r3Exists ? 'EXISTS (skip)' : 'MISSING (apply)'}\n`);
    
    if (!r2Exists) {
      console.log('Applying R2...\n');
      const r2SQL = fs.readFileSync('supabase/migrations/20260820100000_migration_governance_approvals.sql', 'utf8');
      await client.query(r2SQL);
      await client.query("INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES('20260820100000', 'migration_governance_approvals', ARRAY['R2']) ON CONFLICT DO NOTHING");
      console.log('✅ R2 applied\n');
    }
    
    if (!r3Exists) {
      console.log('Applying R3...\n');
      const r3SQL = fs.readFileSync('supabase/migrations/20260820110000_database_role_separation.sql', 'utf8');
      await client.query(r3SQL);
      await client.query("INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES('20260820110000', 'database_role_separation', ARRAY['R3']) ON CONFLICT DO NOTHING");
      console.log('✅ R3 applied\n');
    }
    
    // Final verification
    const roles = await client.query("SELECT rolname FROM pg_roles WHERE rolname LIKE 'bella_%' ORDER BY rolname");
    console.log('✅ Roles:');
    roles.rows.forEach(r => console.log(`  - ${r.rolname}`));
    
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'migration_governance'");
    console.log('\n✅ Migration Governance Tables:');
    tables.rows.forEach(t => console.log(`  - ${t.table_name}`));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
