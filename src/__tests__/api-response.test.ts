/**
 * API Response Utilities Tests
 * 
 * Test suite for standardized API response builders.
 * 
 * @group unit
 * @group api
 */

import { NextRequest } from 'next/server';
import {
  success,
  paginated,
  created,
  noContent,
  accepted,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessableEntity,
  rateLimitExceeded,
  internalError,
  serviceUnavailable,
  fromAPIError,
  fromUnknownError,
  withErrorHandling,
} from '@/lib/api/response';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create mock NextRequest
 */
function createMockRequest(options: {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  rateLimitHeaders?: Record<string, string>;
} = {}): NextRequest {
  const url = options.url || 'https://api.bella.vn/v1/orders';
  const method = options.method || 'GET';
  
  const req = new NextRequest(url, {
    method,
    headers: new Headers(options.headers || {}),
  });

  // Attach rate limit headers if provided
  if (options.rateLimitHeaders) {
    (req as any).rateLimitHeaders = options.rateLimitHeaders;
  }

  return req;
}

// ============================================================================
// SUCCESS RESPONSES
// ============================================================================

describe('Success Response Builders', () => {
  describe('success()', () => {
    it('should create success response with data', async () => {
      const req = createMockRequest();
      const data = { id: '123', name: 'Test Order' };
      
      const response = success(req, data);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toMatchObject({
        success: true,
        data,
        meta: {
          request_id: expect.any(String),
          timestamp: expect.any(String),
          version: 'v1',
        },
      });
    });

    it('should include request_id from header if provided', async () => {
      const req = createMockRequest({
        headers: { 'x-request-id': 'req_abc123' },
      });
      
      const response = success(req, { id: '123' });
      const json = await response.json();

      expect(json.meta.request_id).toBe('req_abc123');
    });

    it('should include rate limit headers in metadata', async () => {
      const req = createMockRequest({
        rateLimitHeaders: {
          'X-RateLimit-Limit': '300',
          'X-RateLimit-Remaining': '250',
          'X-RateLimit-Reset': '1718611200',
          'X-RateLimit-Mode': 'normal',
        },
      });
      
      const response = success(req, { id: '123' });
      const json = await response.json();

      expect(json.meta.rate_limit).toEqual({
        limit: '300',
        remaining: '250',
        reset: '1718611200',
        mode: 'normal',
      });
    });

    it('should include deprecation warning in metadata', async () => {
      const req = createMockRequest();
      
      const response = success(req, { id: '123' }, {
        deprecation: {
          message: 'This endpoint is deprecated',
          sunset_date: '2027-01-01',
          replacement_endpoint: '/api/v2/orders',
          documentation_url: 'https://docs.bella.vn/migration',
        },
      });
      
      const json = await response.json();

      expect(json.meta.deprecation).toEqual({
        message: 'This endpoint is deprecated',
        sunset_date: '2027-01-01',
        replacement_endpoint: '/api/v2/orders',
        documentation_url: 'https://docs.bella.vn/migration',
      });

      // Check deprecation headers
      expect(response.headers.get('Deprecation')).toBe('true');
      expect(response.headers.get('Sunset')).toBe('2027-01-01');
      expect(response.headers.get('Link')).toBe('</api/v2/orders>; rel="successor-version"');
    });

    it('should include HATEOAS links in metadata', async () => {
      const req = createMockRequest();
      
      const response = success(req, { id: '123' }, {
        links: {
          self: '/api/v1/orders/123',
          related: {
            customer: '/api/v1/customers/456',
            payments: '/api/v1/orders/123/payments',
          },
        },
      });
      
      const json = await response.json();

      expect(json.meta.links).toEqual({
        self: '/api/v1/orders/123',
        related: {
          customer: '/api/v1/customers/456',
          payments: '/api/v1/orders/123/payments',
        },
      });
    });

    it('should include security headers', () => {
      const req = createMockRequest();
      const response = success(req, { id: '123' });

      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });

    it('should allow custom headers', () => {
      const req = createMockRequest();
      const response = success(req, { id: '123' }, {
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });

      expect(response.headers.get('X-Custom-Header')).toBe('custom-value');
    });
  });

  describe('paginated()', () => {
    it('should create paginated success response', async () => {
      const req = createMockRequest({ url: 'https://api.bella.vn/v1/orders?page=1&per_page=20' });
      const data = [
        { id: '1', name: 'Order 1' },
        { id: '2', name: 'Order 2' },
      ];
      
      const response = paginated(req, data, {
        page: 1,
        per_page: 20,
        total: 150,
      });
      
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toMatchObject({
        success: true,
        data,
        pagination: {
          page: 1,
          per_page: 20,
          total: 150,
          total_pages: 8,
        },
        meta: {
          request_id: expect.any(String),
          timestamp: expect.any(String),
          version: 'v1',
        },
      });
    });

    it('should include next link when not on last page', async () => {
      const req = createMockRequest({ url: 'https://api.bella.vn/v1/orders?page=1&per_page=20' });
      
      const response = paginated(req, [], {
        page: 1,
        per_page: 20,
        total: 150,
      });
      
      const json = await response.json();

      expect(json.meta.links?.next).toContain('page=2');
    });

    it('should include prev link when not on first page', async () => {
      const req = createMockRequest({ url: 'https://api.bella.vn/v1/orders?page=2&per_page=20' });
      
      const response = paginated(req, [], {
        page: 2,
        per_page: 20,
        total: 150,
      });
      
      const json = await response.json();

      expect(json.meta.links?.prev).toContain('page=1');
    });

    it('should not include next link on last page', async () => {
      const req = createMockRequest({ url: 'https://api.bella.vn/v1/orders?page=8&per_page=20' });
      
      const response = paginated(req, [], {
        page: 8,
        per_page: 20,
        total: 150,
      });
      
      const json = await response.json();

      expect(json.meta.links?.next).toBeUndefined();
    });

    it('should not include prev link on first page', async () => {
      const req = createMockRequest({ url: 'https://api.bella.vn/v1/orders?page=1&per_page=20' });
      
      const response = paginated(req, [], {
        page: 1,
        per_page: 20,
        total: 150,
      });
      
      const json = await response.json();

      expect(json.meta.links?.prev).toBeUndefined();
    });

    it('should always include self link', async () => {
      const req = createMockRequest({ url: 'https://api.bella.vn/v1/orders?page=1&per_page=20' });
      
      const response = paginated(req, [], {
        page: 1,
        per_page: 20,
        total: 150,
      });
      
      const json = await response.json();

      expect(json.meta.links?.self).toBe('https://api.bella.vn/v1/orders?page=1&per_page=20');
    });
  });

  describe('created()', () => {
    it('should create 201 response with Location header', async () => {
      const req = createMockRequest({ method: 'POST' });
      const data = { id: '123', name: 'New Order' };
      
      const response = created(req, data, '/api/v1/orders/123');
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(response.headers.get('Location')).toBe('/api/v1/orders/123');
      expect(json).toMatchObject({
        success: true,
        data,
      });
    });

    it('should work without Location header', async () => {
      const req = createMockRequest({ method: 'POST' });
      const data = { id: '123', name: 'New Order' };
      
      const response = created(req, data);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(response.headers.get('Location')).toBeNull();
      expect(json).toMatchObject({
        success: true,
        data,
      });
    });
  });

  describe('noContent()', () => {
    it('should create 204 response with no body', async () => {
      const req = createMockRequest({ method: 'DELETE' });
      
      const response = noContent(req);

      expect(response.status).toBe(204);
      expect(response.body).toBeNull();
    });
  });

  describe('accepted()', () => {
    it('should create 202 response for async operations', async () => {
      const req = createMockRequest({ method: 'POST' });
      const data = { job_id: 'job_123', status: 'processing' };
      
      const response = accepted(req, data);
      const json = await response.json();

      expect(response.status).toBe(202);
      expect(json).toMatchObject({
        success: true,
        data,
      });
    });
  });
});

// ============================================================================
// ERROR RESPONSES
// ============================================================================

describe('Error Response Builders', () => {
  describe('error()', () => {
    it('should create error response with code and message', async () => {
      const req = createMockRequest();
      
      const response = error(req, 'INVALID_INPUT', 'Validation failed', 400);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Validation failed',
        },
        meta: {
          request_id: expect.any(String),
          timestamp: expect.any(String),
          version: 'v1',
        },
      });
    });

    it('should include error details if provided', async () => {
      const req = createMockRequest();
      
      const response = error(req, 'INVALID_INPUT', 'Validation failed', 400, {
        field_errors: [
          { field: 'email', message: 'Invalid email format' },
        ],
      });
      const json = await response.json();

      expect(json.error.details).toEqual({
        field_errors: [
          { field: 'email', message: 'Invalid email format' },
        ],
      });
    });

    it('should default to 500 if no status code provided', async () => {
      const req = createMockRequest();
      
      const response = error(req, 'INTERNAL_ERROR', 'Something went wrong');
      
      expect(response.status).toBe(500);
    });
  });

  describe('badRequest()', () => {
    it('should create 400 response', async () => {
      const req = createMockRequest();
      
      const response = badRequest(req, 'Invalid input');
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.code).toBe('INVALID_INPUT');
      expect(json.error.message).toBe('Invalid input');
    });
  });

  describe('unauthorized()', () => {
    it('should create 401 response', async () => {
      const req = createMockRequest();
      
      const response = unauthorized(req, 'Invalid API key');
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error.code).toBe('UNAUTHORIZED');
      expect(json.error.message).toBe('Invalid API key');
    });
  });

  describe('forbidden()', () => {
    it('should create 403 response', async () => {
      const req = createMockRequest();
      
      const response = forbidden(req, 'Insufficient permissions');
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error.code).toBe('FORBIDDEN');
      expect(json.error.message).toBe('Insufficient permissions');
    });
  });

  describe('notFound()', () => {
    it('should create 404 response', async () => {
      const req = createMockRequest();
      
      const response = notFound(req, 'Order');
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error.code).toBe('NOT_FOUND');
      expect(json.error.message).toBe('Order not found');
    });
  });

  describe('conflict()', () => {
    it('should create 409 response', async () => {
      const req = createMockRequest();
      
      const response = conflict(req, 'Duplicate idempotency key');
      const json = await response.json();

      expect(response.status).toBe(409);
      expect(json.error.code).toBe('CONFLICT');
      expect(json.error.message).toBe('Duplicate idempotency key');
    });
  });

  describe('unprocessableEntity()', () => {
    it('should create 422 response with field errors', async () => {
      const req = createMockRequest();
      
      const response = unprocessableEntity(req, 'Validation failed', [
        { field: 'email', message: 'Invalid email format' },
        { field: 'phone', message: 'Required field missing' },
      ]);
      const json = await response.json();

      expect(response.status).toBe(422);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.details.field_errors).toHaveLength(2);
    });
  });

  describe('rateLimitExceeded()', () => {
    it('should create 429 response with Retry-After header', async () => {
      const req = createMockRequest();
      
      const response = rateLimitExceeded(req, 60);
      const json = await response.json();

      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBe('60');
      expect(json.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(json.error.details.retry_after).toBe(60);
    });
  });

  describe('internalError()', () => {
    it('should create 500 response and log error', async () => {
      const req = createMockRequest();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const response = internalError(req, 'Database connection failed');
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error.code).toBe('INTERNAL_ERROR');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('serviceUnavailable()', () => {
    it('should create 503 response', async () => {
      const req = createMockRequest();
      
      const response = serviceUnavailable(req, 'Database maintenance', 300);
      const json = await response.json();

      expect(response.status).toBe(503);
      expect(response.headers.get('Retry-After')).toBe('300');
      expect(json.error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });
});

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

describe('Error Handling Utilities', () => {
  describe('fromAPIError()', () => {
    it('should convert APIError to NextResponse', async () => {
      const req = createMockRequest();
      const apiError = {
        name: 'APIError',
        code: 'TENANT_MISMATCH',
        message: 'Tenant injection detected',
        statusCode: 403,
        details: { attempted_tenant: 'other_tenant' },
      };
      
      const response = fromAPIError(req, apiError);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error.code).toBe('TENANT_MISMATCH');
      expect(json.error.message).toBe('Tenant injection detected');
      expect(json.error.details).toEqual({ attempted_tenant: 'other_tenant' });
    });

    it('should default to INTERNAL_ERROR if code missing', async () => {
      const req = createMockRequest();
      const apiError = {
        message: 'Unknown error',
      };
      
      const response = fromAPIError(req, apiError);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('fromUnknownError()', () => {
    it('should handle Error instances', async () => {
      const req = createMockRequest();
      const err = new Error('Something went wrong');
      
      const response = fromUnknownError(req, err);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error.code).toBe('INTERNAL_ERROR');
      expect(json.error.message).toBe('Something went wrong');
    });

    it('should handle non-Error values', async () => {
      const req = createMockRequest();
      const err = 'String error';
      
      const response = fromUnknownError(req, err);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error.code).toBe('INTERNAL_ERROR');
      expect(json.error.message).toBe('An unexpected error occurred');
    });
  });
});

// ============================================================================
// RESPONSE WRAPPERS
// ============================================================================

describe('Response Wrappers', () => {
  describe('withErrorHandling()', () => {
    it('should catch errors and return error response', async () => {
      const req = createMockRequest();
      
      const handler = withErrorHandling(async () => {
        throw new Error('Test error');
      });
      
      const response = await handler(req);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error.message).toBe('Test error');
    });

    it('should handle APIError instances', async () => {
      const req = createMockRequest();
      
      const handler = withErrorHandling(async () => {
        const err: any = new Error('API error');
        err.name = 'APIError';
        err.code = 'INVALID_INPUT';
        err.statusCode = 400;
        throw err;
      });
      
      const response = await handler(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error.code).toBe('INVALID_INPUT');
    });

    it('should pass through successful responses', async () => {
      const req = createMockRequest();
      
      const handler = withErrorHandling(async (req) => {
        return success(req, { id: '123' });
      });
      
      const response = await handler(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toEqual({ id: '123' });
    });
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration Tests', () => {
  it('should handle full success flow with all features', async () => {
    const req = createMockRequest({
      url: 'https://api.bella.vn/v1/orders?page=2&per_page=20',
      headers: { 'x-request-id': 'req_integration_test' },
      rateLimitHeaders: {
        'X-RateLimit-Limit': '1000',
        'X-RateLimit-Remaining': '900',
        'X-RateLimit-Reset': '1718611200',
        'X-RateLimit-Mode': 'normal',
      },
    });

    const orders = [
      { id: '1', name: 'Order 1' },
      { id: '2', name: 'Order 2' },
    ];

    const response = paginated(req, orders, {
      page: 2,
      per_page: 20,
      total: 150,
    }, {
      deprecation: {
        message: 'Migrate to v2',
        sunset_date: '2027-01-01',
        replacement_endpoint: '/api/v2/orders',
      },
      links: {
        related: {
          customers: '/api/v1/customers',
        },
      },
    });

    const json = await response.json();

    // Success response structure
    expect(json.success).toBe(true);
    expect(json.data).toEqual(orders);

    // Pagination
    expect(json.pagination).toEqual({
      page: 2,
      per_page: 20,
      total: 150,
      total_pages: 8,
    });

    // Metadata
    expect(json.meta.request_id).toBe('req_integration_test');
    expect(json.meta.version).toBe('v1');
    expect(json.meta.rate_limit).toEqual({
      limit: '1000',
      remaining: '900',
      reset: '1718611200',
      mode: 'normal',
    });
    expect(json.meta.deprecation).toBeDefined();

    // HATEOAS links
    expect(json.meta.links?.self).toBe('https://api.bella.vn/v1/orders?page=2&per_page=20');
    expect(json.meta.links?.next).toContain('page=3');
    expect(json.meta.links?.prev).toContain('page=1');
    expect(json.meta.links?.related?.customers).toBe('/api/v1/customers');

    // Security headers
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');

    // Rate limit headers
    expect(response.headers.get('X-RateLimit-Limit')).toBe('1000');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('900');
    expect(response.headers.get('X-RateLimit-Reset')).toBe('1718611200');
    expect(response.headers.get('X-RateLimit-Mode')).toBe('normal');

    // Deprecation headers
    expect(response.headers.get('Deprecation')).toBe('true');
    expect(response.headers.get('Sunset')).toBe('2027-01-01');
    expect(response.headers.get('Link')).toBe('</api/v2/orders>; rel="successor-version"');
  });

  it('should handle error flow with all features', async () => {
    const req = createMockRequest({
      headers: { 'x-request-id': 'req_error_test' },
      rateLimitHeaders: {
        'X-RateLimit-Limit': '60',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': '1718611200',
        'X-RateLimit-Mode': 'degraded',
      },
    });

    const response = rateLimitExceeded(req, 60);
    const json = await response.json();

    // Error response structure
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(json.error.message).toContain('Rate limit exceeded');
    expect(json.error.details.retry_after).toBe(60);

    // Metadata
    expect(json.meta.request_id).toBe('req_error_test');
    expect(json.meta.rate_limit?.mode).toBe('degraded');

    // HTTP status
    expect(response.status).toBe(429);

    // Retry-After header
    expect(response.headers.get('Retry-After')).toBe('60');

    // Security headers present even in errors
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });
});
