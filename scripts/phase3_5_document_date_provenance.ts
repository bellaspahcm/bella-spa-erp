#!/usr/bin/env tsx
/**
 * Phase 3.5 Task 3: Document Date Provenance Classification
 * Executes SQL queries to classify document_date provenance
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeQuery(name: string, sql: string) {
  console.log(`\n🔍 ${name}`);
  console.log('─'.repeat(80));
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error(`❌ Error: ${error.message}`);
      return null;
    }
    
    if (data && data.length > 0) {
      console.table(data);
      return data;
    } else {
      console.log('No results');
      return [];
    }
  } catch (err) {
    console.error(`❌ Exception: ${err}`);
    return null;
  }
}

async function main() {
  console.log('🎯 Phase 3.5 Task 3: Document Date Provenance Classification');
  console.log('═'.repeat(80));

  // 1. F3_AR_INVOICE → PROVABLE
  await executeQuery(
    '1. F3_AR_INVOICE → PROVABLE (finance_invoices.issue_date)',
    `
    SELECT 
        'F3_AR_INVOICE' AS source_type,
        'PROVABLE' AS classification,
        'finance_invoices.issue_date' AS provenance_field,
        COUNT(*) AS record_count,
        MIN(f1.posted_at) AS earliest_transaction,
        MAX(f1.posted_at) AS latest_transaction
    FROM finance_transactions f1
    WHERE f1.lifecycle_state = 'POSTED'
      AND f1.source_type = 'F3_AR_INVOICE'
    GROUP BY source_type
    `
  );

  // 2. Sample F3_AR_INVOICE provenance verification
  await executeQuery(
    '2. F3_AR_INVOICE Sample: Verify issue_date exists',
    `
    SELECT 
        f1.id AS f1_id,
        f1.source_id,
        f1.posted_at AS f1_posted_at,
        fi.issue_date AS provable_document_date,
        fi.created_at AS fallback_timestamp
    FROM finance_transactions f1
    JOIN finance_invoices fi ON fi.id = f1.source_id::uuid
    WHERE f1.lifecycle_state = 'POSTED'
      AND f1.source_type = 'F3_AR_INVOICE'
    ORDER BY f1.created_at
    LIMIT 10
    `
  );

  // 3. SALES_ORDER → INFERABLE
  await executeQuery(
    '3. SALES_ORDER → INFERABLE (requires investigation)',
    `
    SELECT 
        'SALES_ORDER' AS source_type,
        'INFERABLE' AS classification_candidate,
        'Requires business table investigation' AS note,
        COUNT(*) AS record_count
    FROM finance_transactions f1
    WHERE f1.lifecycle_state = 'POSTED'
      AND f1.source_type = 'SALES_ORDER'
    `
  );

  // 4. SPA_BOOKING → INFERABLE
  await executeQuery(
    '4. SPA_BOOKING → INFERABLE (requires investigation)',
    `
    SELECT 
        'SPA_BOOKING' AS source_type,
        'INFERABLE' AS classification_candidate,
        'Requires spa_bookings table investigation' AS note,
        COUNT(*) AS record_count
    FROM finance_transactions f1
    WHERE f1.lifecycle_state = 'POSTED'
      AND f1.source_type = 'SPA_BOOKING'
    `
  );

  // 5. AP_PAYMENT → INFERABLE
  await executeQuery(
    '5. AP_PAYMENT → INFERABLE (requires investigation)',
    `
    SELECT 
        'AP_PAYMENT' AS source_type,
        'INFERABLE' AS classification_candidate,
        'Requires finance_payments schema investigation' AS note,
        COUNT(*) AS record_count
    FROM finance_transactions f1
    WHERE f1.lifecycle_state = 'POSTED'
      AND f1.source_type = 'AP_PAYMENT'
    `
  );

  // 6. F2_CASH → INFERABLE (from F2.effective_date)
  await executeQuery(
    '6. F2_CASH → INFERABLE (from F2.effective_date)',
    `
    SELECT 
        'F2_CASH' AS source_type,
        'INFERABLE' AS classification,
        'Use existing F2.effective_date' AS provenance_strategy,
        COUNT(*) AS record_count
    FROM finance_transactions f1
    WHERE f1.lifecycle_state = 'POSTED'
      AND f1.source_type = 'F2_CASH'
    `
  );

  // 7. F2_CASH Sample: Verify F2.effective_date
  await executeQuery(
    '7. F2_CASH Sample: Verify F2.effective_date distribution',
    `
    SELECT 
        f1.id AS f1_id,
        f1.posted_at AS f1_posted_at,
        f2.effective_date AS f2_effective_date,
        f2.created_at AS f2_created_at,
        (f1.posted_at::date = f2.effective_date::date) AS dates_match
    FROM finance_transactions f1
    JOIN finance_cash_movements f2 ON f2.transaction_id = f1.id
    WHERE f1.lifecycle_state = 'POSTED'
      AND f1.source_type = 'F2_CASH'
    ORDER BY f1.created_at
    LIMIT 20
    `
  );

  // 8. TEST DATA → UNKNOWABLE
  await executeQuery(
    '8. TEST DATA → UNKNOWABLE (no business provenance)',
    `
    SELECT 
        f1.source_type,
        'UNKNOWABLE' AS classification,
        'Test artifact - no business source document' AS reason,
        COUNT(*) AS record_count
    FROM finance_transactions f1
    WHERE f1.lifecycle_state = 'POSTED'
      AND f1.source_type IN (
          'CONCURRENCY_TEST',
          'VERIFICATION',
          'F2_REGRESSION',
          'test'
      )
    GROUP BY f1.source_type
    ORDER BY record_count DESC
    `
  );

  // 9. Other sources requiring investigation
  await executeQuery(
    '9. Other sources → REQUIRES_INVESTIGATION',
    `
    SELECT 
        f1.source_type,
        'REQUIRES_INVESTIGATION' AS classification,
        COUNT(*) AS record_count,
        MIN(f1.created_at) AS earliest,
        MAX(f1.created_at) AS latest
    FROM finance_transactions f1
    WHERE f1.lifecycle_state = 'POSTED'
      AND f1.source_type NOT IN (
          'F3_AR_INVOICE',
          'SALES_ORDER',
          'SPA_BOOKING',
          'AP_PAYMENT',
          'F2_CASH',
          'CONCURRENCY_TEST',
          'VERIFICATION',
          'F2_REGRESSION',
          'test'
      )
    GROUP BY f1.source_type
    ORDER BY record_count DESC
    `
  );

  // 10. SUMMARY: document_date Provenance Classification
  await executeQuery(
    '10. SUMMARY: document_date Provenance Classification',
    `
    SELECT 
        CASE 
            WHEN f1.source_type = 'F3_AR_INVOICE' THEN 'PROVABLE'
            WHEN f1.source_type IN ('SALES_ORDER', 'SPA_BOOKING', 'AP_PAYMENT', 'F2_CASH') THEN 'INFERABLE'
            WHEN f1.source_type IN ('CONCURRENCY_TEST', 'VERIFICATION', 'F2_REGRESSION', 'test') THEN 'UNKNOWABLE'
            ELSE 'REQUIRES_INVESTIGATION'
        END AS document_date_classification,
        COUNT(*) AS record_count,
        ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS percentage
    FROM finance_transactions f1
    WHERE f1.lifecycle_state = 'POSTED'
    GROUP BY document_date_classification
    ORDER BY record_count DESC
    `
  );

  console.log('\n✅ Phase 3.5 Task 3 Complete');
}

main().catch(console.error);
