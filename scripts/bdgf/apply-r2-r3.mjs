#!/usr/bin/env node
import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    console.log('Connected\n');
    
    const r2SQL = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260820100000_migration_governance_approvals.sql'), 'utf8');
    const r3SQL = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20260820110000_database_role_separation.sql'), 'utf8');
    
    console.log('Applying R2...\n');
    await client.query(r2SQL);
    await client.query("INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES('20260820100000', 'migration_governance_approvals', ARRAY['R2']) ON CONFLICT DO NOTHING");
    console.log('R2 done\n');
    
    console.log('Applying R3...\n');
    await client.query(r3SQL);
    await client.query("INSERT INTO supabase_migrations.schema_migrations(version, name, statements) VALUES('20260820110000', 'database_role_separation', ARRAY['R3']) ON CONFLICT DO NOTHING");
    console.log('R3 done\n');
    
    const roles = await client.query("SELECT rolname FROM pg_roles WHERE rolname LIKE 'bella_%' ORDER BY rolname");
    console.log('Roles created:');
    roles.rows.forEach(r => console.log(`  - ${r.rolname}`));
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
