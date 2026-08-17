// H1.2 Reconciliation
// Constitution: v1.3 FROZEN (O10, C3)
// Purpose: Detect discrepancies between outbox and ledger (detect-only, no auto-correction)

import { Pool } from 'pg';
import { getReadonlyPool } from './db-connection';
import { Discrepancy, ReconciliationReport } from './types/outbox.types';

// ============================================================================
// Detect Discrepancies (O10, C3)
// ============================================================================

export async function reconcileOutboxLedger(
  tenantId: string,
  db?: Pool
): Promise<Discrepancy[]> {
  // C3: Connect with readonly role (h1_2_reconciliation_readonly)
  const pool = db || getReadonlyPool();
  
  const result = await pool.query<Discrepancy>(`
    SELECT 
      o.event_id,
      o.status AS outbox_status,
      o.tenant_id,
      o.idempotency_key,
      j.id AS journal_id,
      j.status AS journal_status,
      CASE 
        WHEN o.status = 'PROCESSED' AND j.id IS NULL THEN 'MISSING_JOURNAL'
        WHEN o.status IN ('PENDING', 'FAILED') AND j.id IS NOT NULL THEN 'ORPHANED_JOURNAL'
        WHEN o.tenant_id != j.tenant_id THEN 'TENANT_MISMATCH'
        ELSE 'CONSISTENT'
      END AS discrepancy_type
    FROM finance_outbox_events o
    LEFT JOIN finance_transactions ft ON ft.idempotency_key = o.idempotency_key
    LEFT JOIN journal_entries j ON j.transaction_id = ft.id
    WHERE o.tenant_id = $1
      AND o.status IN ('PROCESSED', 'PENDING', 'FAILED')
  `, [tenantId]);
  
  // Filter out consistent entries
  return result.rows.filter(r => r.discrepancy_type !== 'CONSISTENT');
}

// O10: DETECT + FLAG only, NO auto-correction
// C3: Uses readonly connection (SELECT only, cannot mutate ledger)

// ============================================================================
// Generate Reconciliation Report (O10)
// ============================================================================

export async function generateReconciliationReport(
  tenantId: string,
  db?: Pool
): Promise<ReconciliationReport> {
  const discrepancies = await reconcileOutboxLedger(tenantId, db);
  
  const byType = {
    missing_journal: 0,
    orphaned_journal: 0,
    tenant_mismatch: 0,
    duplicate_journal: 0,
  };
  
  discrepancies.forEach(d => {
    if (d.discrepancy_type === 'MISSING_JOURNAL') {
      byType.missing_journal++;
    } else if (d.discrepancy_type === 'ORPHANED_JOURNAL') {
      byType.orphaned_journal++;
    } else if (d.discrepancy_type === 'TENANT_MISMATCH') {
      byType.tenant_mismatch++;
    } else if (d.discrepancy_type === 'DUPLICATE_JOURNAL') {
      byType.duplicate_journal++;
    }
  });
  
  return {
    tenant_id: tenantId,
    generated_at: new Date(),
    total_discrepancies: discrepancies.length,
    discrepancies_by_type: byType,
    discrepancies: discrepancies,
    resolution_guidance: {
      MISSING_JOURNAL: 'Replay event (if Finance idempotency safe) OR manually create journal with evidence',
      ORPHANED_JOURNAL: 'Mark outbox PROCESSED (Finance already succeeded)',
      TENANT_MISMATCH: 'Data corruption detected — escalate to security team',
      DUPLICATE_JOURNAL: 'Archive duplicate, investigate idempotency bug',
    },
  };
}

// Resolution requires operator approval and evidence
// NO automatic ledger correction

// ============================================================================
// Detect Duplicate Journals (O10)
// ============================================================================

export async function detectDuplicateJournals(
  tenantId: string,
  db?: Pool
): Promise<Discrepancy[]> {
  const pool = db || getReadonlyPool();
  
  const result = await pool.query<Discrepancy>(`
    SELECT 
      o.event_id,
      o.status AS outbox_status,
      o.tenant_id,
      o.idempotency_key,
      NULL::text AS journal_id,
      NULL::text AS journal_status,
      'DUPLICATE_JOURNAL' AS discrepancy_type
    FROM finance_outbox_events o
    WHERE o.tenant_id = $1
      AND o.idempotency_key IN (
        SELECT idempotency_key
        FROM finance_transactions
        WHERE tenant_id = $1
        GROUP BY idempotency_key
        HAVING COUNT(*) > 1
      )
  `, [tenantId]);
  
  return result.rows;
}

// Duplicate detection: One idempotency_key → Multiple transactions (violates I1)
