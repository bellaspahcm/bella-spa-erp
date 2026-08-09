import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export interface APIError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

/**
 * Standard API error handler
 * 
 * Usage in API route:
 *   import { handleAPIError } from '@/middleware/error-handler';
 *   
 *   export async function POST(request: Request) {
 *     try {
 *       // ... your logic
 *       return NextResponse.json({ success: true });
 *     } catch (error) {
 *       return handleAPIError(error, 'POST /api/real-estate/reserve');
 *     }
 *   }
 */
export function handleAPIError(error: unknown, context?: string): NextResponse {
  const apiError = error as APIError;
  
  // Determine status code
  const statusCode = apiError.statusCode || 500;
  
  // Log error with appropriate level
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  
  logger[logLevel](
    {
      error: apiError.message,
      stack: apiError.stack,
      statusCode,
      code: apiError.code,
      context,
      details: apiError.details,
    },
    `API ${logLevel}: ${context || 'Unknown endpoint'}`
  );
  
  // Report to Sentry (only 500 errors)
  if (statusCode >= 500 && typeof window !== 'undefined' && (window as unknown).Sentry) {
    (window as unknown).Sentry.captureException(error, {
      tags: {
        context: context || 'api',
        statusCode,
      },
    });
  }
  
  // Return user-friendly error response
  return NextResponse.json(
    {
      error: {
        message: apiError.message || 'An unexpected error occurred',
        code: apiError.code || 'INTERNAL_ERROR',
        ...(process.env.NODE_ENV === 'development' && {
          details: apiError.details,
          stack: apiError.stack,
        }),
      },
    },
    {
      status: statusCode,
    }
  );
}

/**
 * Create typed API error
 */
export function createAPIError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: unknown
): APIError {
  const error = new Error(message) as APIError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Common API errors
 */
export const APIErrors = {
  NotFound: (resource: string) =>
    createAPIError(`${resource} not found`, 404, 'NOT_FOUND'),
  
  Unauthorized: (message = 'Unauthorized') =>
    createAPIError(message, 401, 'UNAUTHORIZED'),
  
  Forbidden: (message = 'Forbidden') =>
    createAPIError(message, 403, 'FORBIDDEN'),
  
  BadRequest: (message: string, details?: unknown) =>
    createAPIError(message, 400, 'BAD_REQUEST', details),
  
  Conflict: (message: string, details?: unknown) =>
    createAPIError(message, 409, 'CONFLICT', details),
  
  ValidationError: (message: string, details?: unknown) =>
    createAPIError(message, 422, 'VALIDATION_ERROR', details),
  
  InternalError: (message = 'Internal server error') =>
    createAPIError(message, 500, 'INTERNAL_ERROR'),
  
  ServiceUnavailable: (message = 'Service temporarily unavailable') =>
    createAPIError(message, 503, 'SERVICE_UNAVAILABLE'),
};
