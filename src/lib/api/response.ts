/**
 * API Response Utilities
 * 
 * Standardized response format for all API endpoints.
 * Ensures consistent structure, error handling, and metadata.
 * 
 * Features:
 * - Success/error response builders
 * - Pagination support
 * - Metadata (request ID, timestamp, version)
 * - Rate limit headers integration
 * - Deprecation warnings
 * - HATEOAS links (optional)
 * 
 * @module lib/api/response
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Standard API response metadata
 */
export interface APIResponseMeta {
  request_id: string;
  timestamp: string;
  version: string;
  rate_limit?: {
    limit: string;
    remaining: string;
    reset: string;
    mode?: string;
  };
  deprecation?: {
    message: string;
    sunset_date?: string;
    replacement_endpoint?: string;
    documentation_url?: string;
  };
  links?: {
    self?: string;
    next?: string;
    prev?: string;
    related?: Record<string, string>;
  };
}

/**
 * Success response structure
 */
export interface APISuccessResponse<T = any> {
  success: true;
  data: T;
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
  meta: APIResponseMeta;
}

/**
 * Error response structure
 */
export interface APIErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    field_errors?: Array<{
      field: string;
      message: string;
      code?: string;
    }>;
  };
  meta: APIResponseMeta;
}

/**
 * Response options
 */
export interface ResponseOptions {
  status?: number;
  headers?: Record<string, string>;
  deprecation?: {
    message: string;
    sunset_date?: string;
    replacement_endpoint?: string;
    documentation_url?: string;
  };
  links?: {
    self?: string;
    next?: string;
    prev?: string;
    related?: Record<string, string>;
  };
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  per_page: number;
  total: number;
}

// ============================================================================
// RESPONSE BUILDERS
// ============================================================================

/**
 * Build metadata for API response
 */
function buildMeta(
  req: NextRequest,
  options?: ResponseOptions
): APIResponseMeta {
  const meta: APIResponseMeta = {
    request_id: req.headers.get('x-request-id') || crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    version: 'v1',
  };

  // Add rate limit info if available
  const rateLimitHeaders = (req as any).rateLimitHeaders;
  if (rateLimitHeaders) {
    meta.rate_limit = {
      limit: rateLimitHeaders['X-RateLimit-Limit'],
      remaining: rateLimitHeaders['X-RateLimit-Remaining'],
      reset: rateLimitHeaders['X-RateLimit-Reset'],
      mode: rateLimitHeaders['X-RateLimit-Mode'],
    };
  }

  // Add deprecation warning if specified
  if (options?.deprecation) {
    meta.deprecation = options.deprecation;
  }

  // Add HATEOAS links if specified
  if (options?.links) {
    meta.links = options.links;
  }

  return meta;
}

/**
 * Build standard headers for API response
 */
function buildHeaders(
  req: NextRequest,
  options?: ResponseOptions
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    ...options?.headers,
  };

  // Add rate limit headers if available
  const rateLimitHeaders = (req as any).rateLimitHeaders;
  if (rateLimitHeaders) {
    Object.assign(headers, rateLimitHeaders);
  }

  // Add deprecation header if specified
  if (options?.deprecation) {
    headers['Deprecation'] = 'true';
    if (options.deprecation.sunset_date) {
      headers['Sunset'] = options.deprecation.sunset_date;
    }
    if (options.deprecation.replacement_endpoint) {
      headers['Link'] = `<${options.deprecation.replacement_endpoint}>; rel="successor-version"`;
    }
  }

  return headers;
}

/**
 * Create success response
 * 
 * @param req - Next.js request
 * @param data - Response data
 * @param options - Response options
 * @returns Next.js response
 * 
 * @example
 * ```typescript
 * return success(req, { id: '123', name: 'Order #123' });
 * ```
 */
export function success<T = any>(
  req: NextRequest,
  data: T,
  options?: ResponseOptions
): NextResponse<APISuccessResponse<T>> {
  const response: APISuccessResponse<T> = {
    success: true,
    data,
    meta: buildMeta(req, options),
  };

  return NextResponse.json(response, {
    status: options?.status || 200,
    headers: buildHeaders(req, options),
  });
}

/**
 * Create success response with pagination
 * 
 * @param req - Next.js request
 * @param data - Response data array
 * @param pagination - Pagination info
 * @param options - Response options
 * @returns Next.js response
 * 
 * @example
 * ```typescript
 * return paginated(req, orders, {
 *   page: 1,
 *   per_page: 20,
 *   total: 150,
 * });
 * ```
 */
export function paginated<T = any>(
  req: NextRequest,
  data: T[],
  pagination: PaginationOptions,
  options?: ResponseOptions
): NextResponse<APISuccessResponse<T[]>> {
  const total_pages = Math.ceil(pagination.total / pagination.per_page);
  
  // Build pagination links
  const url = new URL(req.url);
  const links: NonNullable<ResponseOptions['links']> = {
    self: req.url,
  };

  if (pagination.page < total_pages) {
    url.searchParams.set('page', (pagination.page + 1).toString());
    links.next = url.toString();
  }

  if (pagination.page > 1) {
    url.searchParams.set('page', (pagination.page - 1).toString());
    links.prev = url.toString();
  }

  const response: APISuccessResponse<T[]> = {
    success: true,
    data,
    pagination: {
      ...pagination,
      total_pages,
    },
    meta: buildMeta(req, { ...options, links: { ...options?.links, ...links } }),
  };

  return NextResponse.json(response, {
    status: options?.status || 200,
    headers: buildHeaders(req, options),
  });
}

/**
 * Create created response (201)
 * 
 * @param req - Next.js request
 * @param data - Created resource data
 * @param location - Location header (resource URL)
 * @param options - Response options
 * @returns Next.js response
 * 
 * @example
 * ```typescript
 * return created(req, newOrder, '/api/v1/orders/123');
 * ```
 */
export function created<T = any>(
  req: NextRequest,
  data: T,
  location?: string,
  options?: ResponseOptions
): NextResponse<APISuccessResponse<T>> {
  const headers: Record<string, string> = {};
  if (location) {
    headers['Location'] = location;
  }

  return success(req, data, {
    ...options,
    status: 201,
    headers: { ...headers, ...options?.headers },
  });
}

/**
 * Create no content response (204)
 * 
 * @param req - Next.js request
 * @returns Next.js response
 * 
 * @example
 * ```typescript
 * return noContent(req); // DELETE successful
 * ```
 */
export function noContent(req: NextRequest): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: buildHeaders(req),
  });
}

/**
 * Create accepted response (202)
 * Used for async operations
 * 
 * @param req - Next.js request
 * @param data - Response data (e.g., job ID)
 * @param options - Response options
 * @returns Next.js response
 * 
 * @example
 * ```typescript
 * return accepted(req, { job_id: 'job_123', status: 'processing' });
 * ```
 */
export function accepted<T = any>(
  req: NextRequest,
  data: T,
  options?: ResponseOptions
): NextResponse<APISuccessResponse<T>> {
  return success(req, data, {
    ...options,
    status: 202,
  });
}


// ============================================================================
// ERROR RESPONSES
// ============================================================================

/**
 * Create error response
 * 
 * @param req - Next.js request
 * @param code - Error code
 * @param message - Error message
 * @param status - HTTP status code
 * @param details - Additional error details
 * @returns Next.js response
 * 
 * @example
 * ```typescript
 * return error(req, 'INVALID_INPUT', 'Validation failed', 400, {
 *   field_errors: [{ field: 'email', message: 'Invalid email format' }]
 * });
 * ```
 */
export function error(
  req: NextRequest,
  code: string,
  message: string,
  status: number = 500,
  details?: any
): NextResponse<APIErrorResponse> {
  const response: APIErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
    },
    meta: buildMeta(req),
  };

  return NextResponse.json(response, {
    status,
    headers: buildHeaders(req),
  });
}

/**
 * Create bad request response (400)
 */
export function badRequest(
  req: NextRequest,
  message: string = 'Bad request',
  details?: any
): NextResponse<APIErrorResponse> {
  return error(req, 'INVALID_INPUT', message, 400, details);
}

/**
 * Create unauthorized response (401)
 */
export function unauthorized(
  req: NextRequest,
  message: string = 'Unauthorized',
  details?: any
): NextResponse<APIErrorResponse> {
  return error(req, 'UNAUTHORIZED', message, 401, details);
}

/**
 * Create forbidden response (403)
 */
export function forbidden(
  req: NextRequest,
  message: string = 'Forbidden',
  details?: any
): NextResponse<APIErrorResponse> {
  return error(req, 'FORBIDDEN', message, 403, details);
}

/**
 * Create not found response (404)
 */
export function notFound(
  req: NextRequest,
  resource: string = 'Resource',
  details?: any
): NextResponse<APIErrorResponse> {
  return error(req, 'NOT_FOUND', `${resource} not found`, 404, details);
}

/**
 * Create conflict response (409)
 */
export function conflict(
  req: NextRequest,
  message: string = 'Resource conflict',
  details?: any
): NextResponse<APIErrorResponse> {
  return error(req, 'CONFLICT', message, 409, details);
}

/**
 * Create unprocessable entity response (422)
 */
export function unprocessableEntity(
  req: NextRequest,
  message: string = 'Validation failed',
  fieldErrors?: Array<{ field: string; message: string; code?: string }>
): NextResponse<APIErrorResponse> {
  return error(req, 'VALIDATION_ERROR', message, 422, {
    field_errors: fieldErrors,
  });
}

/**
 * Create rate limit exceeded response (429)
 */
export function rateLimitExceeded(
  req: NextRequest,
  retryAfter: number,
  details?: any
): NextResponse<APIErrorResponse> {
  const headers: Record<string, string> = {
    'Retry-After': retryAfter.toString(),
  };

  const response: APIErrorResponse = {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Rate limit exceeded. Please retry after ${retryAfter} seconds.`,
      details: {
        retry_after: retryAfter,
        ...details,
      },
    },
    meta: buildMeta(req),
  };

  return NextResponse.json(response, {
    status: 429,
    headers: { ...buildHeaders(req), ...headers },
  });
}

/**
 * Create internal server error response (500)
 */
export function internalError(
  req: NextRequest,
  message: string = 'Internal server error',
  details?: any
): NextResponse<APIErrorResponse> {
  // Log internal errors
  console.error('Internal server error:', {
    message,
    details,
    request_id: req.headers.get('x-request-id'),
    url: req.url,
    method: req.method,
  });

  return error(req, 'INTERNAL_ERROR', message, 500, details);
}

/**
 * Create service unavailable response (503)
 */
export function serviceUnavailable(
  req: NextRequest,
  message: string = 'Service temporarily unavailable',
  retryAfter?: number
): NextResponse<APIErrorResponse> {
  const headers: Record<string, string> = {};
  if (retryAfter) {
    headers['Retry-After'] = retryAfter.toString();
  }

  const response: APIErrorResponse = {
    success: false,
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message,
      ...(retryAfter && { details: { retry_after: retryAfter } }),
    },
    meta: buildMeta(req),
  };

  return NextResponse.json(response, {
    status: 503,
    headers: { ...buildHeaders(req), ...headers },
  });
}

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Convert APIError to NextResponse
 * Integrates with our APIError class
 */
export function fromAPIError(
  req: NextRequest,
  apiError: any
): NextResponse<APIErrorResponse> {
  return error(
    req,
    apiError.code || 'INTERNAL_ERROR',
    apiError.message || 'An error occurred',
    apiError.statusCode || 500,
    apiError.details
  );
}

/**
 * Handle unknown errors gracefully
 */
export function fromUnknownError(
  req: NextRequest,
  err: unknown
): NextResponse<APIErrorResponse> {
  console.error('Unknown error:', err);
  
  if (err instanceof Error) {
    return internalError(req, err.message);
  }
  
  return internalError(req, 'An unexpected error occurred');
}

// ============================================================================
// RESPONSE WRAPPER FOR ROUTE HANDLERS
// ============================================================================

/**
 * Wrap route handler with automatic error handling and response formatting
 * 
 * @param handler - Route handler function
 * @returns Wrapped handler with error handling
 * 
 * @example
 * ```typescript
 * export const GET = withErrorHandling(async (req) => {
 *   const data = await fetchOrders();
 *   return success(req, data);
 * });
 * ```
 */
export function withErrorHandling(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      return await handler(req, context);
    } catch (err: any) {
      // Handle APIError instances
      if (err.name === 'APIError' || err.code) {
        return fromAPIError(req, err);
      }
      
      // Handle unknown errors
      return fromUnknownError(req, err);
    }
  };
}

/**
 * Wrap route handler with full middleware stack
 * Includes auth, rate limiting, validation, and error handling
 * 
 * @example
 * ```typescript
 * export const POST = withAPIMiddleware(async (req, { validated }) => {
 *   const order = await createOrder(validated.body);
 *   return created(req, order, `/api/v1/orders/${order.id}`);
 * }, {
 *   bodySchema: createOrderSchema,
 *   scope: 'order:write',
 * });
 * ```
 */
export function withAPIMiddleware<
  TBody = any,
  TQuery = any
>(
  handler: (
    req: NextRequest,
    context: {
      validated: {
        body: TBody;
        query: TQuery;
      };
      partner: any;
    }
  ) => Promise<NextResponse>,
  options: {
    bodySchema?: any;
    querySchema?: any;
    scope?: string | string[];
    skipAuth?: boolean;
    skipRateLimit?: boolean;
  } = {}
) {
  return withErrorHandling(async (req: NextRequest) => {
    // Import middleware dynamically to avoid circular dependencies
    const { withAPIKey } = await import('@/lib/middleware/api-key.middleware');
    const { requireScope, requireAnyScope } = await import('@/lib/middleware/scope.middleware');
    const { rateLimitMiddleware } = await import('@/lib/middleware/rate-limit.middleware');
    const { validate } = await import('@/lib/middleware/validation.middleware');

    // Step 1: Authentication
    if (!options.skipAuth) {
      await withAPIKey(req);
    }

    // Step 2: Rate Limiting
    if (!options.skipRateLimit) {
      await rateLimitMiddleware(req);
    }

    // Step 3: Authorization (Scope check)
    if (options.scope) {
      if (Array.isArray(options.scope)) {
        requireAnyScope(req, options.scope);
      } else {
        requireScope(req, options.scope);
      }
    }

    // Step 4: Validation
    const validated = await validate(req, {
      bodySchema: options.bodySchema,
      querySchema: options.querySchema,
    });

    // Step 5: Business Logic
    return await handler(req, {
      validated: validated as any,
      partner: (req as any).partner,
    });
  });
}
