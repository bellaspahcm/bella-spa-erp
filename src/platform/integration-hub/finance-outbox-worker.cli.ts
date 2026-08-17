#!/usr/bin/env node
/**
 * N1 Failure Isolation — Finance Outbox Worker CLI
 * 
 * Standalone process for running finance outbox worker
 * 
 * Usage:
 * ```bash
 * # Run worker continuously
 * node src/platform/integration-hub/finance-outbox-worker.cli.ts
 * 
 * # Or via npm script
 * npm run worker:finance-outbox
 * ```
 * 
 * Environment Variables:
 * - FINANCE_OS_URL: Finance OS endpoint (required)
 * - SUPABASE_URL: Supabase URL (required)
 * - SUPABASE_SERVICE_KEY: Supabase service role key (required)
 * - WORKER_BATCH_SIZE: Batch size (default: 10)
 * - WORKER_POLL_INTERVAL_MS: Poll interval (default: 5000)
 * - WORKER_VERBOSE: Enable verbose logging (default: false)
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { FinanceOutboxWorker } from './finance-outbox-worker';

// Validate environment
const FINANCE_OS_URL = process.env.FINANCE_OS_URL || process.env.NEXT_PUBLIC_FINANCE_OS_URL;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!FINANCE_OS_URL) {
  console.error('❌ FINANCE_OS_URL or NEXT_PUBLIC_FINANCE_OS_URL is required');
  process.exit(1);
}

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is required');
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required');
  process.exit(1);
}

// Create Supabase client (service role for worker)
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Create worker
const worker = new FinanceOutboxWorker(supabase, {
  financeOsEndpoint: FINANCE_OS_URL,
  workerId: `worker-${process.pid}`,
  batchSize: parseInt(process.env.WORKER_BATCH_SIZE || '10'),
  pollIntervalMs: parseInt(process.env.WORKER_POLL_INTERVAL_MS || '5000'),
  verbose: process.env.WORKER_VERBOSE === 'true',
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, stopping worker...');
  worker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, stopping worker...');
  worker.stop();
  process.exit(0);
});

// Start worker
console.log('🚀 Starting Finance Outbox Worker');
console.log(`   Finance OS: ${FINANCE_OS_URL}`);
console.log(`   Worker ID: worker-${process.pid}`);

worker.start().catch((error) => {
  console.error('❌ Worker crashed:', error);
  process.exit(1);
});
