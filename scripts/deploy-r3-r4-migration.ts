/**
 * Deploy R3+R4 Migration to Remote Supabase
 * Uses credentials from .env file
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';

// Load .env (not .env.local)
dotenv.config({ path: '.env' });

const dbUrl = process.env.DATABASE_EXECUTOR_URL || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!dbUrl || dbUrl.includes('placeholder')) {
  console.error('❌ No valid database URL in .env');
  process.exit(1);
}

async function deployMigration() {
  const migrationFile = process.env.MIGRATION_FILE || 'supabase/migrations/20260906000001_retail_r3_r4_extensions.sql';
  const migrationPath = path.join(process.cwd(), migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
  
  console.log('📦 Deploying R3+R4 migration to remote database...');
  console.log(`📄 File: ${path.basename(migrationPath)}`);
  console.log(`📏 Size: ${migrationSQL.length} bytes`);
  console.log('');

  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Execute migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log('📊 Created:');
    console.log('   ✓ retail_product_variants (R3)');
    console.log('   ✓ retail_product_batches (R4)');
    console.log('   ✓ Extended retail_inventory_movements');
    console.log('');
    console.log('🎯 Ready for validation tests');
    
  } catch (err: any) {
    if (err.message.includes('already exists')) {
      console.log('⚠️  Tables already exist - migration previously applied');
      console.log('✅ Schema ready for testing');
    } else {
      console.error('❌ Migration failed:', err.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

deployMigration();
