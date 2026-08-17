import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  console.log('Executing constraint fix...');
  console.log('Step 1: Drop old constraint');
  
  await pool.query(`
    ALTER TABLE finance_outbox_events 
    DROP CONSTRAINT IF EXISTS finance_outbox_events_status_check
  `);
  
  console.log('✅ Old constraint dropped');
  console.log('Step 2: Add new constraint with QUARANTINED');
  
  await pool.query(`
    ALTER TABLE finance_outbox_events 
    ADD CONSTRAINT finance_outbox_events_status_check 
    CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'QUARANTINED', 'DISPATCHED'))
  `);
  
  console.log('✅ New constraint added');
  console.log('\nVerifying...');
  
  // Verify constraint
  const result = await pool.query(`
    SELECT 
      conname as constraint_name,
      pg_get_constraintdef(oid) as constraint_definition
    FROM pg_constraint
    WHERE conrelid = 'finance_outbox_events'::regclass
      AND contype = 'c'
      AND conname LIKE '%status%'
  `);
  
  console.log('\n=== Current Status Constraint ===');
  console.log(result.rows[0].constraint_definition);
  
  if (result.rows[0].constraint_definition.includes('QUARANTINED')) {
    console.log('\n✅ QUARANTINED successfully added to constraint');
  } else {
    console.log('\n❌ QUARANTINED not found in constraint');
  }
  
  await pool.end();
})().catch(err => {
  console.error('❌ Error:', err);
  pool.end();
  process.exit(1);
});
