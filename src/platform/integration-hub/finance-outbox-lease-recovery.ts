// H1.2 Lease Recovery
// Constitution: v1.3 FROZEN (O4)
// Purpose: Recover stuck PROCESSING events after lease expiration

import { Pool } from 'pg';
import { getWorkerPool } from './db-connection';

// ============================================================================
// Recover Stale Leases (O4)
// ============================================================================

export async function recoverStaleLeases(db?: Pool): Promise<number> {
  const pool = db || getWorkerPool();
  
  const result = await pool.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'PENDING',
      claimed_by = NULL,
      claimed_at = NULL,
      lease_expires_at = NULL
    WHERE status = 'PROCESSING'
      AND lease_expires_at < now()
    RETURNING event_id
  `);
  
  const recoveredCount = result.rowCount || 0;
  
  if (recoveredCount > 0) {
    console.log(`[H1.2-O4] Recovered ${recoveredCount} stale leases`);
  }
  
  return recoveredCount;
}

// ============================================================================
// Cron Job Entry Point
// ============================================================================

export async function runLeaseRecoveryCron(): Promise<void> {
  try {
    const recovered = await recoverStaleLeases();
    
    if (recovered > 0) {
      console.log(`[H1.2-O4] Lease recovery cron: ${recovered} events recovered`);
    }
  } catch (error) {
    console.error('[H1.2-O4] Lease recovery cron failed:', error);
    // Do not throw — cron should continue on next schedule
  }
}

// Deployment: Kubernetes CronJob or equivalent
// Schedule: Every 30 seconds (or configurable)
// Command: node -e "require('./finance-outbox-lease-recovery').runLeaseRecoveryCron()"
