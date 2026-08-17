import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  // Check all unique status values in actual data
  const result = await pool.query(`
    SELECT 
      status,
      COUNT(*) as count
    FROM finance_outbox_events
    GROUP BY status
    ORDER BY count DESC
  `);
  
  console.log('=== Status Values in Production Data ===');
  if (result.rows.length === 0) {
    console.log('No data in finance_outbox_events table.');
  } else {
    result.rows.forEach(row => {
      console.log(`${row.status}: ${row.count} events`);
    });
  }
  
  // Check if DISPATCHED exists
  const dispatchedCount = result.rows.find(r => r.status === 'DISPATCHED');
  console.log('\n=== DISPATCHED Status Analysis ===');
  if (dispatchedCount) {
    console.log(`⚠️ DISPATCHED is USED: ${dispatchedCount.count} events`);
    console.log('→ Must keep DISPATCHED in constraint (H1.1 compatibility)');
  } else {
    console.log('✓ DISPATCHED is NOT used in production data');
    console.log('→ Safe to keep for H1.1 compatibility or evaluate removal');
  }
  
  await pool.end();
})().catch(console.error);
