#!/usr/bin/env node
import { readFileSync } from 'fs';
import pg from 'pg';

const env = readFileSync('.env.local', 'utf-8');
const url = env.match(/SUPABASE_DB_URL=(.+)/)[1].trim();
const client = new pg.Client({connectionString: url, ssl: {rejectUnauthorized: false}});

await client.connect();

console.log('========================================');
console.log('🔍 Checking Actual Database Schema');
console.log('========================================\n');

// Check session_logs columns
console.log('📊 session_logs columns:');
const sessionLogsCols = await client.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'session_logs' 
    AND table_schema = 'public'
  ORDER BY ordinal_position
`);
sessionLogsCols.rows.forEach(row => console.log(`  - ${row.column_name} (${row.data_type})`));

// Check if products table exists
console.log('\n📊 Checking products table:');
const products = await client.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_name = 'products' 
    AND table_schema = 'public'
`);
if (products.rows.length > 0) {
  console.log('  ✓ products table exists');
  const productsCols = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'products' 
      AND table_schema = 'public'
    ORDER BY ordinal_position
  `);
  productsCols.rows.forEach(row => console.log(`    - ${row.column_name} (${row.data_type})`));
} else {
  console.log('  ✗ products table DOES NOT exist');
  console.log('  Checking inventory_items instead...');
  const inventoryItems = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_name = 'inventory_items' 
      AND table_schema = 'public'
  `);
  if (inventoryItems.rows.length > 0) {
    console.log('  ✓ inventory_items table exists');
    const cols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'inventory_items' 
        AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    cols.rows.forEach(row => console.log(`    - ${row.column_name} (${row.data_type})`));
  }
}

await client.end();
