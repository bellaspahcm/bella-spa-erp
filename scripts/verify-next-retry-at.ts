import { Pool } from 'pg';
import { randomUUID } from 'crypto';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const tenantId = randomUUID();
  const eventId = randomUUID();
  
  // Create tenant
  await pool.query(`
    INSERT INTO tenants (id, name, created_at)
    VALUES ($1, 'Test Verify next_retry_at', now())
    ON CONFLICT (id) DO NOTHING
  `, [tenantId]);
  
  // Insert new event (H1.1 style - no H1.2 columns)
  await pool.query(`
    INSERT INTO finance_outbox_events (
      event_id, tenant_id, event_type, payload, status, created_at
    ) VALUES ($1, $2, $3, $4, $5, now())
  `, [eventId, tenantId, 'TEST_VERIFY', '{}', 'PENDING']);
  
  // Check actual DB values
  const result = await pool.query(`
    SELECT 
      event_id, 
      retry_count, 
      next_retry_at, 
      max_retry,
      next_retry_at IS NULL as is_null
    FROM finance_outbox_events 
    WHERE event_id = $1
  `, [eventId]);
  
  console.log('=== DB Actual Behavior: New Event ===');
  console.log('Event ID:', result.rows[0].event_id);
  console.log('retry_count:', result.rows[0].retry_count);
  console.log('next_retry_at:', result.rows[0].next_retry_at);
  console.log('next_retry_at IS NULL:', result.rows[0].is_null);
  console.log('max_retry:', result.rows[0].max_retry);
  
  // Cleanup
  await pool.query('DELETE FROM finance_outbox_events WHERE event_id = $1', [eventId]);
  await pool.end();
  
  console.log('\n=== Verification Result ===');
  if (result.rows[0].is_null === true) {
    console.log('✅ CORRECT: next_retry_at = NULL for new events');
  } else {
    console.log('❌ DEFECT: next_retry_at has value for new events:', result.rows[0].next_retry_at);
  }
})().catch(console.error);
