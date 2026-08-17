import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  // Get CHECK constraint definition
  const result = await pool.query(`
    SELECT 
      conname as constraint_name,
      pg_get_constraintdef(oid) as constraint_definition
    FROM pg_constraint
    WHERE conrelid = 'finance_outbox_events'::regclass
      AND contype = 'c'
      AND conname LIKE '%status%'
  `);
  
  console.log('=== Status CHECK Constraints ===');
  if (result.rows.length === 0) {
    console.log('No status CHECK constraints found.');
  } else {
    result.rows.forEach(row => {
      console.log(`\nConstraint: ${row.constraint_name}`);
      console.log(`Definition: ${row.constraint_definition}`);
    });
  }
  
  // Also check column definition
  const colResult = await pool.query(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_name = 'finance_outbox_events'
      AND column_name = 'status'
  `);
  
  console.log('\n=== Status Column Definition ===');
  if (colResult.rows.length > 0) {
    const col = colResult.rows[0];
    console.log(`Type: ${col.data_type}`);
    console.log(`Nullable: ${col.is_nullable}`);
    console.log(`Default: ${col.column_default || 'NONE'}`);
  }
  
  await pool.end();
})().catch(console.error);
