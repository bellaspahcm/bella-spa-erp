/**
 * F5.6 C7-H1 Finance OS — Finance Event API Endpoint
 * 
 * HTTP endpoint for receiving finance events from Vertical OS
 * 
 * Route: POST /api/finance/v1/events
 * Body: FinanceEventEnvelope
 * Response: FinanceEventResult
 * 
 * Architecture:
 * ```
 * Vertical OS (Hospital, Beauty, etc.)
 *     ↓ HTTP POST
 * Finance OS API (THIS)
 *     ↓
 * Finance Event Handler
 *     ↓
 * F1-F4 Kernel
 * ```
 * 
 * Security:
 * - Tenant ID validation (header matches body)
 * - Rate limiting (TODO)
 * - Authentication (TODO)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { createFinanceEventHandlerForTesting } from '@/platform/finance/finance-event-handler.factory';
import type { FinanceEventEnvelope } from '@/platform/integration-hub/finance-event-contract.types';

/**
 * POST /api/finance/v1/events
 * 
 * Receives finance events from Vertical OS
 */
export async function POST(request: NextRequest) {
  // N1 TEST ONLY: Finance failure injection (env var OR header)
  const financeFailureInjection = 
    process.env.FINANCE_FAILURE_INJECTION === 'true' ||
    request.headers.get('X-Test-Failure-Injection') === 'true';
    
  if (financeFailureInjection) {
    console.log('[Finance OS API] FAILURE INJECTION ACTIVE — Returning 503');
    return NextResponse.json(
      { error: 'Service temporarily unavailable (N1 test injection)' },
      { status: 503 }
    );
  }
  
  try {
    // 1. Parse request body
    const envelope = await request.json() as FinanceEventEnvelope;
    
    // 2. Validate tenant ID (P0 Gate)
    const tenantIdHeader = request.headers.get('X-Tenant-ID');
    if (!tenantIdHeader) {
      return NextResponse.json(
        { error: 'Missing X-Tenant-ID header' },
        { status: 400 }
      );
    }
    
    if (tenantIdHeader !== envelope.tenant_id) {
      return NextResponse.json(
        { error: 'Tenant ID mismatch (header vs body)' },
        { status: 403 }
      );
    }
    
    // 3. Initialize Supabase client (service role for Finance OS operations)
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    
    // 4. Create Finance Event Handler
    const handler = createFinanceEventHandlerForTesting(supabase);
    
    // 5. Handle event
    console.log('[Finance OS API] Received event:', {
      event_id: envelope.event_id,
      event_type: envelope.event_type,
      tenant_id: envelope.tenant_id,
      source_system: envelope.source_system,
      amount: envelope.amount,
      currency: envelope.currency,
    });
    
    const result = await handler.handle(envelope);
    
    // 6. Log result
    console.log('[Finance OS API] Event processed:', {
      event_id: result.event_id,
      status: result.status,
      transaction_id: result.transaction_id,
    });
    
    // 7. Return result
    return NextResponse.json(result, {
      status: result.status === 'CREATED' ? 201 : 200,
    });
    
  } catch (error) {
    // Error handling
    console.error('[Finance OS API] Error processing event:', error);
    
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/finance/v1/events
 * 
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Finance OS Event API',
    version: 'v1.0',
    endpoints: {
      post: '/api/finance/v1/events - Receive finance events',
    },
  });
}
