#!/usr/bin/env node
import { readFileSync } from 'fs';
import pg from 'pg';

const env = readFileSync('.env.local', 'utf-8');
const url = env.match(/SUPABASE_DB_URL=(.+)/)[1].trim();
const client = new pg.Client({connectionString: url, ssl: {rejectUnauthorized: false}});

await client.connect();

console.log('Checking attendance table...\n');
const attendanceCols = await client.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'attendance' 
    AND table_schema = 'public'
  ORDER BY ordinal_position
`);
console.log('attendance columns:');
attendanceCols.rows.forEach(row => console.log(`  - ${row.column_name} (${row.data_type})`));

console.log('\n\nChecking packages table...\n');
const packagesCols = await client.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'packages' 
    AND table_schema = 'public'
  ORDER BY ordinal_position
`);
console.log('packages columns:');
packagesCols.rows.forEach(row => console.log(`  - ${row.column_name} (${row.data_type})`));

await client.end();
