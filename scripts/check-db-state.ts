/**
 * Check current database state
 * Verify which Retail OS tables already exist
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const dbUrl = process.env.DATABASE_EXECUTOR_URL;

if (!dbUrl) {
  console.error('❌ No DATABASE_EXECUTOR_URL in .env');
  process.exit(1);
}

async function checkDBState() {
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Check retail tables
    const tables = ['retail_products', 'retail_inventory_movements', 'retail_product_variants', 'retail_product_batches'];
    
    console.log('📊 Checking Retail OS tables:\n');
    
    for (const table of tables) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM pg_tables 
          WHERE schemaname = 'public' AND tablename = $1
        )`,
        [table]
      );
      
      const exists = result.rows[0].exists;
      console.log(`   ${exists ? '✅' : '❌'} ${table}`);
    }
    
    console.log('');
    
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkDBState();
