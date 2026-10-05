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

import {
  claimEvent,
  processEvent,
  type FinanceApiClient,
} from './finance-outbox-worker';
import { closeAllConnections } from './db-connection';
import type { FinanceApiResponse } from './types/outbox.types';

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

const batchSize = parseInt(process.env.WORKER_BATCH_SIZE || '10');
const pollIntervalMs = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '5000');
let shouldStop = false;

const financeApiClient: FinanceApiClient = {
  async post(endpoint, payload): Promise<FinanceApiResponse> {
    const response = await fetch(`${FINANCE_OS_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const body: unknown = await response.json().catch(() => ({}));
    const responseBody = body && typeof body === 'object'
      ? body as Record<string, unknown>
      : {};

    if (response.ok) {
      const transactionId = responseBody.transaction_id;
      return {
        status: response.status === 409 ? 'ALREADY_PROCESSED' : 'SUCCESS',
        transaction_id: typeof transactionId === 'string' ? transactionId : undefined,
        http_status: response.status,
      };
    }

    return {
      status: 'ERROR',
      error: typeof responseBody.error === 'string' ? responseBody.error : response.statusText,
      http_status: response.status,
    };
  },
};

async function processBatch(): Promise<number> {
  let processed = 0;

  for (let index = 0; index < batchSize; index++) {
    const event = await claimEvent();
    if (!event) {
      break;
    }

    await processEvent(event, financeApiClient);
    processed++;
  }

  return processed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Handle graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}, stopping worker...`);
  shouldStop = true;
  await closeAllConnections();
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

// Start worker
console.log('🚀 Starting Finance Outbox Worker');
console.log(`   Finance OS: ${FINANCE_OS_URL}`);
console.log(`   Worker ID: worker-${process.pid}`);

async function main(): Promise<void> {
  while (!shouldStop) {
    const processed = await processBatch();
    if (process.env.WORKER_VERBOSE === 'true') {
      console.log(`Processed ${processed} outbox event(s)`);
    }
    await sleep(pollIntervalMs);
  }
}

main().catch((error: unknown) => {
  console.error('❌ Worker crashed:', error);
  process.exit(1);
});
