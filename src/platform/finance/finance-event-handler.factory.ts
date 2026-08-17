/**
 * F5.6 C7-H1 Finance OS — Finance Event Handler Factory
 * 
 * Wires up all Finance OS components for event processing
 * 
 * Components:
 * - Semantic Resolver (C.2)
 * - Intent Generator (C.2)
 * - Policy Context Resolver (A.4)
 * - COA Resolver (C.3)
 * - Finance Kernel Client (F1-F4)
 * - Idempotency Store
 * 
 * Usage:
 * ```typescript
 * const handler = createFinanceEventHandler(supabase);
 * const result = await handler.handle(financeEvent);
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { FinanceEventHandler } from './finance-event-handler';
import { DefaultSemanticResolver } from './resolvers/semantic-resolver.service';
import { DefaultIntentGenerator } from './resolvers/intent-generator.service';
import { DefaultPolicyContextResolver } from './resolvers/policy-context-resolver.service';
import { DefaultCOAResolver } from './resolvers/coa-resolver.service';
import { DefaultFinanceKernelClient } from './resolvers/kernel-client.service';
import { InMemoryIdempotencyStore, DatabaseIdempotencyStore } from './resolvers/idempotency-store.service';

/**
 * Factory Configuration
 */
export interface FinanceEventHandlerConfig {
  /** Supabase client (for Kernel and database operations) */
  supabase: SupabaseClient<Database>;
  
  /** Use in-memory idempotency store (for testing) */
  useInMemoryIdempotency?: boolean;
}

/**
 * Create Finance Event Handler
 * 
 * Wires up all Finance OS components with dependencies
 * 
 * @param config Configuration
 * @returns Fully-configured Finance Event Handler
 */
export function createFinanceEventHandler(
  config: FinanceEventHandlerConfig
): FinanceEventHandler {
  // Initialize components
  const semanticResolver = new DefaultSemanticResolver();
  const intentGenerator = new DefaultIntentGenerator();
  const policyContextResolver = new DefaultPolicyContextResolver();
  const coaResolver = new DefaultCOAResolver();
  const kernelClient = new DefaultFinanceKernelClient(config.supabase);
  
  // Idempotency store (in-memory for testing, database for production)
  const idempotencyStore = config.useInMemoryIdempotency
    ? new InMemoryIdempotencyStore()
    : new DatabaseIdempotencyStore(config.supabase);
  
  // Wire up Finance Event Handler
  return new FinanceEventHandler(
    semanticResolver,
    intentGenerator,
    policyContextResolver,
    coaResolver,
    kernelClient,
    idempotencyStore
  );
}

/**
 * Create Finance Event Handler (simplified - uses database idempotency)
 * 
 * For H1 E2E testing (production-ready idempotency)
 */
export function createFinanceEventHandlerForTesting(
  supabase: SupabaseClient<Database>
): FinanceEventHandler {
  // Initialize components
  const semanticResolver = new DefaultSemanticResolver();
  const intentGenerator = new DefaultIntentGenerator();
  const policyContextResolver = new DefaultPolicyContextResolver();
  const coaResolver = new DefaultCOAResolver();
  const kernelClient = new DefaultFinanceKernelClient(supabase);
  const idempotencyStore = new DatabaseIdempotencyStore(supabase); // Database-backed for production correctness
  
  // Wire up Finance Event Handler
  return new FinanceEventHandler(
    semanticResolver,
    intentGenerator,
    policyContextResolver,
    coaResolver,
    kernelClient,
    idempotencyStore
  );
}

/**
 * Create Finance Event Handler (production)
 * 
 * Uses database-backed idempotency store
 */
export function createFinanceEventHandlerForProduction(
  supabase: SupabaseClient<Database>
): FinanceEventHandler {
  return createFinanceEventHandler({
    supabase,
    useInMemoryIdempotency: false, // Database for production
  });
}
