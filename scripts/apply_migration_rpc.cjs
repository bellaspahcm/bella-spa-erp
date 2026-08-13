const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load env
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('SUPABASE_DB_URL not found in .env.local');
  process.exit(1);
}

const migrationFilePath = path.resolve(
  __dirname,
  '../supabase/migrations/20260813000040_create_enrollment_transaction_rpc.sql'
);

const sql = fs.readFileSync(migrationFilePath, 'utf8');

async function main() {
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to database, applying migration...');
    
    // Execute SQL
    await client.query(sql);
    
    // Also record it in schema_migrations table so supabase CLI knows it was applied
    await client.query(`
      INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
      VALUES ('20260813000040', 'create_enrollment_transaction_rpc', '{}')
      ON CONFLICT (version) DO NOTHING;
    `);

    await client.query('COMMIT;');
    console.log('Migration successfully applied and registered!');
  } catch (err) {
    console.error('Error applying migration:', err);
    try {
      await client.query('ROLLBACK;');
    } catch (rbErr) {
      console.error('Error rolling back transaction:', rbErr);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
