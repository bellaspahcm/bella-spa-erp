#!/usr/bin/env node
import { readFileSync } from 'fs';
import pg from 'pg';

const env = readFileSync('.env.local', 'utf-8');
const url = env.match(/SUPABASE_DB_URL=(.+)/)[1].trim();
const client = new pg.Client({connectionString: url, ssl: {rejectUnauthorized: false}});

await client.connect();

const res = await client.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'bookings' 
    AND table_schema = 'public'
  ORDER BY ordinal_position
`);

console.log('bookings columns:');
res.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));

await client.end();
