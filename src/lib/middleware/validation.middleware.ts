/**
 * Request Validation Middleware
 * 
 * Validates API requests against Zod schemas before processing.
 * Provides type-safe validation with automatic error responses.
 * 
 * Features:
 * - Body validation (JSON)
 * - Query parameter validation
 * - Path parameter validation
 * - Content-Type enforcement
 * - Request size limits
 * - Detailed error messages
 * 
 * @module middleware/validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError, ZodSchema } from 'zod';
import { APIError } from '@/types/api-gateway';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Maximum request body size (10 MB)
 */
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Allowed content types for requests with body
 */
const ALLOWED_CONTENT_TYPES = [
  'application/json',
  'application/json; charset=utf-8',
];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate request body against schema
 * 
 * @param req - Next.js request
 * @param schema - Zod schema to validate against
 * @returns Validated and type-safe data
 * @throws APIError if validation fails
 */
export async function validateBody<T extends ZodSchema>(
  req: NextRequest,
  schema: T
): Promise<z.infer<T>> {
  // Check Content-Type
  const contentType = req.headers.get('content-type');
  if (!contentType || !ALLOWED_CONTENT_TYPES.some(ct => contentType.toLowerCase().startsWith(ct))) {
    throw new APIError(
      'VAL_001',
      'Invalid Content-Type. Expected application/json',
      { received: contentType },
      415
    );
  }

  // Parse JSON body
  let body: unknown;
  try {
    // Check body size (approximate, actual check happens during parsing)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
      throw new APIError(
        'VAL_001',
        `Request body too large. Maximum ${MAX_BODY_SIZE / 1024 / 1024}MB`,
        { size: parseInt(contentLength), max_size: MAX_BODY_SIZE },
        413
      );
    }

    body = await req.json();
  } catch (error) {
    if (error instanceof APIError) throw error;
    
    throw new APIError(
      'VAL_001',
      'Invalid JSON in request body',
      { details: error instanceof Error ? error.message : 'Unknown error' },
      400
    );
  }

  // Validate against schema
  try {
    return schema.parse(body);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new APIError(
        'VAL_001',
        'Validation failed',
        { errors: formatZodErrors(error) },
        400
      );
    }
    throw error;
  }
}

/**
 * Validate query parameters against schema
 * 
 * @param req - Next.js request
 * @param schema - Zod schema to validate against
 * @returns Validated and type-safe query parameters
 * @throws APIError if validation fails
 */
export function validateQuery<T extends ZodSchema>(
  req: NextRequest,
  schema: T
): z.infer<T> {
  const url = new URL(req.url);
  const params: Record<string, string | string[]> = {};

  // Convert URLSearchParams to plain object
  url.searchParams.forEach((value, key) => {
    if (params[key]) {
      // Multiple values for same key
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key] as string, value];
      }
    } else {
      params[key] = value;
    }
  });

  // Validate against schema
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new APIError(
        'VAL_001',
        'Invalid query parameters',
        { errors: formatZodErrors(error) },
        400
      );
    }
    throw error;
  }
}

/**
 * Validate path parameters against schema
 * 
 * @param params - Path parameters object
 * @param schema - Zod schema to validate against
 * @returns Validated and type-safe path parameters
 * @throws APIError if validation fails
 */
export function validateParams<T extends ZodSchema>(
  params: Record<string, string | string[]>,
  schema: T
): z.infer<T> {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new APIError(
        'VAL_001',
        'Invalid path parameters',
        { errors: formatZodErrors(error) },
        400
      );
    }
    throw error;
  }
}

/**
 * Format Zod errors into user-friendly format
 */
function formatZodErrors(error: ZodError): Array<{
  field: string;
  message: string;
  code: string;
}> {
  return error.issues.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

// ============================================================================
// SECURITY CHECKS
// ============================================================================

/**
 * Block tenant injection attempts in request body
 * 
 * @param body - Parsed request body
 * @throws APIError if tenant_id found in body
 */
export function blockTenantInjection(body: unknown): void {
  if (typeof body === 'object' && body !== null) {
    const keys = Object.keys(body);
    const suspiciousKeys = ['tenant_id', 'tenantId', 'tenant'];
    
    for (const key of keys) {
      if (suspiciousKeys.includes(key)) {
        throw new APIError(
          'AUTHZ_003',
          'tenant_id cannot be provided by client',
          { provided_field: key, provided_value: (body as Record<string, unknown>)[key] },
          403
        );
      }
    }
  }
}

/**
 * Block common SQL injection patterns
 * 
 * @param value - String value to check
 * @throws APIError if SQL injection pattern detected
 */
export function detectSQLInjection(value: string): void {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(--|;|\/\*|\*\/)/,
    /(\bOR\b|\bAND\b).*=.*=/, // OR 1=1, AND 1=1
    /(\bUNION\b.*\bSELECT\b)/i,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(value)) {
      throw new APIError('VAL_001', 'Potential SQL injection detected', { field: 'input' }, 400);
    }
  }
}

/**
 * Sanitize all string values in object recursively
 * 
 * @param obj - Object to sanitize
 * @returns Sanitized object
 */
export function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    // Basic XSS prevention
    return obj
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

// ============================================================================
// WRAPPER FUNCTIONS
// ============================================================================

/**
 * Validate request with automatic error handling
 * 
 * @param req - Next.js request
 * @param bodySchema - Schema for request body (optional)
 * @param querySchema - Schema for query parameters (optional)
 * @returns Validated data
 * 
 * @example
 * ```typescript
 * export async function POST(req: NextRequest) {
 *   const { body, query } = await validate(req, {
 *     bodySchema: createOrderSchema,
 *     querySchema: listOrdersQuerySchema,
 *   });
 *   
 *   // body and query are now type-safe and validated
 * }
 * ```
 */
export async function validate<
  TBody extends ZodSchema | undefined = undefined,
  TQuery extends ZodSchema | undefined = undefined
>(
  req: NextRequest,
  options: {
    bodySchema?: TBody;
    querySchema?: TQuery;
    checkTenantInjection?: boolean;
  } = {}
): Promise<{
  body: TBody extends ZodSchema ? z.infer<TBody> : undefined;
  query: TQuery extends ZodSchema ? z.infer<TQuery> : undefined;
}> {
  const { bodySchema, querySchema, checkTenantInjection = true } = options;

  let body: unknown = undefined;
  let query: unknown = undefined;

  // Validate body if schema provided
  if (bodySchema) {
    body = await validateBody(req, bodySchema);
    
    // Check for tenant injection
    if (checkTenantInjection) {
      blockTenantInjection(body);
    }
  }

  // Validate query if schema provided
  if (querySchema) {
    query = validateQuery(req, querySchema);
  }

  return { body, query } as {
    body: TBody extends ZodSchema ? z.infer<TBody> : undefined;
    query: TQuery extends ZodSchema ? z.infer<TQuery> : undefined;
  };
}

/**
 * Create validation middleware wrapper
 * Combines validation with other middleware (auth, rate limit)
 */
export function withValidation<
  TBody extends ZodSchema | undefined = undefined,
  TQuery extends ZodSchema | undefined = undefined
>(
  handler: (
    req: NextRequest,
    validated: {
      body: TBody extends ZodSchema ? z.infer<TBody> : undefined;
      query: TQuery extends ZodSchema ? z.infer<TQuery> : undefined;
    }
  ) => Promise<NextResponse>,
  options: {
    bodySchema?: TBody;
    querySchema?: TQuery;
    checkTenantInjection?: boolean;
  }
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Validate request
      const validated = await validate(req, options);
      
      // Call handler with validated data
      return await handler(req, validated);
    } catch (error) {
      // Handle validation errors
      if (error instanceof APIError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
            meta: {
              request_id: req.headers.get('x-request-id') || crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              version: 'v1',
            },
          },
          { status: error.statusCode }
        );
      }
      
      // Unexpected error
      console.error('Unexpected validation error:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_001',
            message: 'An unexpected error occurred',
          },
          meta: {
            request_id: req.headers.get('x-request-id') || crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            version: 'v1',
          },
        },
        { status: 500 }
      );
    }
  };
}
