#!/usr/bin/env node
import { readFileSync } from 'fs';
import pg from 'pg';

const env = readFileSync('.env.local', 'utf-8');
const url = env.match(/SUPABASE_DB_URL=(.+)/)[1].trim();
const client = new pg.Client({connectionString: url, ssl: {rejectUnauthorized: false}});

await client.connect();

// Check for required tables
const res = await client.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema='public' 
    AND table_name IN ('tenants', 'user_tenant_access', 'users')
  ORDER BY table_name
`);

console.log('Existing tables:');
res.rows.forEach(row => console.log('  ✓', row.table_name));

if (res.rows.length === 0) {
  console.log('  (none found)');
}

await client.end();
