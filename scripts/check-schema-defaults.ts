import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  // Check column default
  const colResult = await pool.query(`
    SELECT 
      column_name,
      column_default,
      is_nullable,
      data_type
    FROM information_schema.columns
    WHERE table_name = 'finance_outbox_events'
      AND column_name IN ('next_retry_at', 'retry_count', 'max_retry')
    ORDER BY column_name
  `);
  
  console.log('=== Column Definitions ===');
  colResult.rows.forEach(row => {
    console.log(`\n${row.column_name}:`);
    console.log(`  Type: ${row.data_type}`);
    console.log(`  Nullable: ${row.is_nullable}`);
    console.log(`  Default: ${row.column_default || 'NONE'}`);
  });
  
  // Check for triggers
  const triggerResult = await pool.query(`
    SELECT 
      trigger_name,
      event_manipulation,
      action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'finance_outbox_events'
  `);
  
  console.log('\n=== Triggers on finance_outbox_events ===');
  if (triggerResult.rows.length === 0) {
    console.log('No triggers found.');
  } else {
    triggerResult.rows.forEach(row => {
      console.log(`\nTrigger: ${row.trigger_name}`);
      console.log(`  Event: ${row.event_manipulation}`);
      console.log(`  Action: ${row.action_statement}`);
    });
  }
  
  await pool.end();
})().catch(console.error);
