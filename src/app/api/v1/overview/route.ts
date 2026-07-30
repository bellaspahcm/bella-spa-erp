/**
 * Overview API - v1
 * 
 * Health check & Partner integration overview endpoint.
 * Validates API key, records request in api_request_logs, and returns system status.
 * 
 * @module api/v1/overview
 */

import { success } from '@/lib/api/response';
import { withSandbox } from '@/lib/middleware/sandbox.middleware';

/**
 * GET /api/v1/overview
 * Overview & connection test endpoint for authenticated partner
 */
export const GET = withSandbox(
  async (req, { partner, sandbox }) => {
    return success(req, {
      status: 'active',
      partner_id: partner.partner_id,
      partner_name: partner.partner_name,
      tenant_id: partner.tenant_id,
      environment: sandbox.environment,
      allowed_scopes: partner.allowed_scopes,
      timestamp: new Date().toISOString(),
    });
  }
);

/**
 * POST /api/v1/overview
 * Connection ping endpoint (supports POST requests)
 */
export const POST = withSandbox(
  async (req, { partner, sandbox }) => {
    return success(req, {
      status: 'active',
      partner_id: partner.partner_id,
      partner_name: partner.partner_name,
      tenant_id: partner.tenant_id,
      environment: sandbox.environment,
      allowed_scopes: partner.allowed_scopes,
      timestamp: new Date().toISOString(),
    });
  }
);
