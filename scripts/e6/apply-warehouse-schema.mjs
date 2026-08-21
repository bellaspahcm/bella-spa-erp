// E6 Warehouse Schema Migration Applier
// Apply warehouse schema to Supabase using direct SQL execution via Postgres API

import { readFileSync } from 'fs';
import pg from 'pg';

const { Client } = pg;

// Parse connection string from Supabase URL
const supabaseUrl = process.env.SUPABASE_URL || 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.match(/https:\/\/(.+?)\.supabase\.co/)?.[1];
if (!projectRef) {
  console.error('❌ Invalid SUPABASE_URL format');
  process.exit(1);
}

// Construct Postgres connection string
// Format: postgres://postgres.[project-ref]:[password]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
const connectionString = `postgresql://postgres.${projectRef}:${supabaseKey}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;

async function applySchemaMigration() {
  console.log('🚀 E6: Applying Warehouse Schema Migration...');
  console.log('📦 Database:', supabaseUrl);
  console.log('🔌 Connecting via Postgres...\n');
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    const sql = readFileSync('migrations/logistics/20260821_warehouse_schema.sql', 'utf8');
    
    // Execute entire migration as one transaction
    console.log('📝 Executing migration SQL...\n');
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    console.log('✅ Migration applied successfully\n');
    console.log('📊 Tables created:');
    console.log('   - logistics_warehouse_skus');
    console.log('   - logistics_warehouse_bins');
    console.log('   - logistics_warehouse_receipts');
    console.log('   - logistics_warehouse_receipt_line_items');
    console.log('   - logistics_warehouse_inventory_on_hand');
    console.log('   - logistics_warehouse_movements');
    
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applySchemaMigration();
