import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkSchema() {
  try {
    // Check if finance_outbox_events table exists
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'finance_outbox_events'
    `);
    
    console.log('=== Database Schema Check ===');
    console.log('Table finance_outbox_events exists:', tableCheck.rows.length > 0 ? 'YES' : 'NO');
    
    if (tableCheck.rows.length > 0) {
      // Check columns
      const columnsCheck = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'finance_outbox_events'
        ORDER BY ordinal_position
      `);
      
      console.log('\nColumns:');
      columnsCheck.rows.forEach((col: any) => {
        console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULLABLE' : 'NOT NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
      });
      
      // Check H1.2 columns specifically
      const h1_2_columns = ['retry_count', 'next_retry_at', 'failure_classification', 'quarantine_reason'];
      console.log('\nH1.2 Columns Status:');
      h1_2_columns.forEach(colName => {
        const exists = columnsCheck.rows.some((col: any) => col.column_name === colName);
        console.log(`  - ${colName}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
      });
    }
    
    await pool.end();
  } catch (error: any) {
    console.error('❌ Database error:', error.message);
    console.error('Connection string:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
    process.exit(1);
  }
}

checkSchema();
