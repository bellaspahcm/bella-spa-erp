/**
 * POST /api/admin/partners/[id]/test-webhook
 * 
 * Test webhook endpoint by sending a sample payload
 * 
 * Auth: Required (admin/owner only)
 * Security: Tenant isolation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { getPartnerById } from '@/services/api-gateway/partner.service';
import type { APIErrorCode } from '@/types/api-gateway';

interface TestWebhookRequest {
  webhook_url: string;
  webhook_secret?: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

function isSafeWebhookUrl(urlStr: string): boolean {
  try {
    const parsedUrl = new URL(urlStr);
    if (parsedUrl.protocol !== 'https:') return false;

    const hostname = parsedUrl.hostname.toLowerCase();

    // Block localhost, local subnets, and local domain suffixes
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '[::1]' ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.lan') ||
      hostname.endsWith('.test')
    ) {
      return false;
    }

    // Block IPv4 private address spaces
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16, 0.0.0.0/8
    const ipv4Pattern = /^(10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+|0\.\d+\.\d+\.\d+)$/;
    if (ipv4Pattern.test(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  context: RouteParams
): Promise<NextResponse> {
  try {
    const params = await context.params;
    const partnerId = params.id;

    // Auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Unauthorized',
            code: 'AUTH_001' as APIErrorCode,
          },
        },
        { status: 401 }
      );
    }

    // Get user's tenant
    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id, role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'User profile not found',
            code: 'AUTH_002' as APIErrorCode,
          },
        },
        { status: 404 }
      );
    }

    // Role check
    if (profile.role !== 'admin' && profile.role !== 'owner') {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Forbidden: Admin or Owner role required',
            code: 'AUTHZ_001' as APIErrorCode,
          },
        },
        { status: 403 }
      );
    }

    // Verify partner belongs to user's tenant
    const partner = await getPartnerById(partnerId, profile.tenant_id || undefined);

    if (!partner) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Partner not found or access denied',
            code: 'VAL_001' as APIErrorCode,
          },
        },
        { status: 404 }
      );
    }

    // Parse request body
    const body: TestWebhookRequest = await request.json();

    // Validate webhook URL
    if (!body.webhook_url) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'webhook_url is required',
            code: 'VAL_001' as APIErrorCode,
          },
        },
        { status: 400 }
      );
    }

    if (!isSafeWebhookUrl(body.webhook_url)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Webhook URL must use HTTPS and point to a safe public host',
            code: 'VAL_001' as APIErrorCode,
          },
        },
        { status: 400 }
      );
    }

    // Build test payload
    const testPayload = {
      event: 'test.webhook',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from Bella ERP Admin',
        partner_id: partnerId,
        partner_name: partner.partner_name,
        test: true,
      },
      metadata: {
        tenant_id: profile.tenant_id,
        test_by: user.email,
      },
    };

    // Generate signature if secret provided
    let signature: string | undefined;
    if (body.webhook_secret) {
      const crypto = await import('crypto');
      const hmac = crypto.createHmac('sha256', body.webhook_secret);
      hmac.update(JSON.stringify(testPayload));
      signature = `sha256=${hmac.digest('hex')}`;
    }

    // Send test webhook
    const startTime = Date.now();

    try {
      const webhookResponse = await fetch(body.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BellaERP-Webhook/1.0',
          ...(signature && { 'X-Webhook-Signature': signature }),
        },
        body: JSON.stringify(testPayload),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      const responseTime = Date.now() - startTime;

      // Try to get response body
      let responseBody: unknown = null;
      const contentType = webhookResponse.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        try {
          responseBody = await webhookResponse.json();
        } catch {
          // Ignore JSON parse errors
        }
      } else {
        try {
          const text = await webhookResponse.text();
          responseBody = text.substring(0, 500); // Limit text length
        } catch {
          // Ignore text parse errors
        }
      }

      // Consider 2xx status codes as success
      const isSuccess = webhookResponse.status >= 200 && webhookResponse.status < 300;

      return NextResponse.json({
        success: true,
        data: {
          test_successful: isSuccess,
          status_code: webhookResponse.status,
          response_time_ms: responseTime,
          response_body: responseBody,
          message: isSuccess
            ? 'Webhook endpoint responded successfully'
            : `Webhook endpoint returned status ${webhookResponse.status}`,
        },
      });
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;

      // Handle timeout
      if (error && typeof error === 'object' && 'name' in error && 
          (error.name === 'AbortError' || error.name === 'TimeoutError')) {
        return NextResponse.json({
          success: false,
          error: {
            message: 'Webhook endpoint timeout (5 seconds)',
            code: 'SERVER_002' as APIErrorCode,
            details: {
              response_time_ms: responseTime,
            },
          },
        });
      }

      // Handle connection errors
      return NextResponse.json({
        success: false,
        error: {
          message: `Failed to connect to webhook endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'SERVER_002' as APIErrorCode,
          details: {
            error_type: error && typeof error === 'object' && 'name' in error ? (error as { name: string }).name : 'UnknownError',
            response_time_ms: responseTime,
          },
        },
      });
    }
  } catch (error: unknown) {
    console.error('Test webhook error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          message: 'Internal server error',
          code: 'SERVER_001' as APIErrorCode,
          details: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      },
      { status: 500 }
    );
  }
}
