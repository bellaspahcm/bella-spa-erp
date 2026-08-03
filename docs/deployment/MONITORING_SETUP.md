# Monitoring & Logging Setup Guide

## 📋 Overview

Comprehensive monitoring and logging setup for Bella ERP production environment.

**What's Included:**
- ✅ Sentry error tracking (already installed)
- 🆕 Pino structured logging
- 🆕 Error boundaries for React components
- 🆕 Performance monitoring
- 🆕 Database query monitoring
- 🆕 Alert configurations

---

## 🎯 Monitoring Stack

### Current Setup
```
✅ @sentry/nextjs: ^10.53.1 (installed)
❌ pino: Not installed
❌ pino-pretty: Not installed
❌ Error boundaries: Not configured
```

### Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Production Application                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Frontend   │  │   Backend    │  │    Database     │  │
│  │  Components  │  │  API Routes  │  │   Supabase      │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                  │                    │           │
│         │                  │                    │           │
│  ┌──────▼──────────────────▼────────────────────▼────────┐ │
│  │             Error Boundaries & Logging                 │ │
│  │  • React Error Boundary                                │ │
│  │  • Global error handler                                │ │
│  │  • Structured logger (Pino)                            │ │
│  └──────┬─────────────────┬─────────────────────┬────────┘ │
│         │                 │                     │           │
└─────────┼─────────────────┼─────────────────────┼───────────┘
          │                 │                     │
          ▼                 ▼                     ▼
   ┌────────────┐    ┌────────────┐      ┌─────────────┐
   │   Sentry   │    │    Pino    │      │  Supabase   │
   │   Cloud    │    │   Logs     │      │   Metrics   │
   └────────────┘    └────────────┘      └─────────────┘
       (Errors)       (Structured)         (Database)
```

---

## 📦 Installation

### Step 1: Install Pino Logger

```bash
npm install pino pino-pretty --save
```

**Packages:**
- `pino`: Fast, low-overhead structured logger
- `pino-pretty`: Human-readable log formatter for development

### Step 2: Verify Sentry Installation

```bash
# Check if @sentry/nextjs is installed
npm list @sentry/nextjs
# Expected: @sentry/nextjs@10.53.1
```

✅ Sentry already installed - skip installation step.

---

## 🔧 Configuration

### 1. Sentry Configuration

#### Create: `sentry.client.config.ts`

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  // Environment
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',
  
  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  
  // Performance Monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Session Replay
  replaysSessionSampleRate: 0.1, // 10% of sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
  
  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  
  // Filtering
  beforeSend(event, hint) {
    // Filter out non-critical errors
    if (event.exception) {
      const error = hint.originalException;
      
      // Ignore network errors from ad blockers
      if (error && error.toString().includes('Failed to fetch')) {
        return null;
      }
      
      // Ignore ChunkLoadError (user navigated away during code split load)
      if (error && error.name === 'ChunkLoadError') {
        return null;
      }
    }
    
    return event;
  },
  
  // Ignore specific errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    // Random plugins/extensions
    'originalCreateNotification',
    'canvas.contentDocument',
    'MyApp_RemoveAllHighlights',
    // Facebook
    'fb_xd_fragment',
    // Network errors that user cannot control
    'NetworkError',
    'Non-Error promise rejection captured',
  ],
});
```

#### Create: `sentry.server.config.ts`

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  
  // Server-side sampling (higher than client)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  
  // Tag server errors
  initialScope: {
    tags: {
      runtime: 'nodejs',
    },
  },
  
  beforeSend(event) {
    // Filter out health check errors
    if (event.request?.url?.includes('/api/health')) {
      return null;
    }
    
    return event;
  },
});
```

#### Create: `sentry.edge.config.ts`

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
  
  initialScope: {
    tags: {
      runtime: 'edge',
    },
  },
});
```

#### Update: `next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config
  
  sentry: {
    hideSourceMaps: true,
    widenClientFileUpload: true,
    autoInstrumentServerFunctions: true,
    autoInstrumentMiddleware: true,
  },
};

module.exports = require('@sentry/nextjs').withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
```

### 2. Pino Logger Configuration

#### Create: `src/lib/logger.ts`

```typescript
import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  
  // Pretty print in development
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'HH:MM:ss Z',
          singleLine: false,
        },
      }
    : undefined,
  
  // Production configuration
  formatters: isProduction
    ? {
        level: (label) => {
          return { level: label };
        },
        bindings: (bindings) => {
          return {
            pid: bindings.pid,
            host: bindings.hostname,
            node_version: process.version,
          };
        },
      }
    : undefined,
  
  // Base fields
  base: {
    env: process.env.NODE_ENV,
    app: 'bella-erp',
  },
  
  // Timestamp
  timestamp: pino.stdTimeFunctions.isoTime,
  
  // Serializers
  serializers: {
    error: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

// Child loggers for different modules
export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

// Real Estate module logger
export const reLogger = createModuleLogger('real_estate');

// CRM module logger
export const crmLogger = createModuleLogger('crm');

// Sales module logger
export const salesLogger = createModuleLogger('sales');

// Booking engine logger
export const bookingLogger = createModuleLogger('booking');

// Finance logger
export const financeLogger = createModuleLogger('finance');

// Database logger
export const dbLogger = createModuleLogger('database');

// API logger
export const apiLogger = createModuleLogger('api');

// Auth logger
export const authLogger = createModuleLogger('auth');
```

#### Usage Example:

```typescript
import { logger, reLogger } from '@/lib/logger';

// Basic logging
logger.info('Application started');
logger.error({ err: error }, 'Failed to process request');

// Module-specific logging
reLogger.info({ productId: 'abc-123' }, 'Product reserved');
reLogger.error({ customerId: 'xyz-789', err: error }, 'Reservation failed');

// Structured data
logger.info({
  userId: 'user-123',
  action: 'create_booking',
  tenantId: 'tenant-abc',
  duration: 234,
}, 'Booking created successfully');

// Performance tracking
const start = Date.now();
// ... operation ...
logger.info({ duration: Date.now() - start }, 'Operation completed');
```

### 3. Error Boundary Components

#### Create: `src/components/error-boundary/ErrorBoundary.tsx`

```typescript
'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { context, onError } = this.props;
    
    // Log to console
    logger.error(
      {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        context,
      },
      'React Error Boundary caught error'
    );
    
    // Report to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      tags: {
        context: context || 'unknown',
        errorBoundary: true,
      },
    });
    
    // Custom error handler
    if (onError) {
      onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h3 className="mt-4 text-center text-lg font-medium text-gray-900">
              Đã xảy ra lỗi
            </h3>
            <p className="mt-2 text-center text-sm text-gray-500">
              Chúng tôi xin lỗi vì sự bất tiện này. Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-sm text-gray-700">
                <summary className="cursor-pointer font-medium">Chi tiết lỗi (Dev only)</summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-md hover:bg-rose-700 transition-colors"
              >
                Tải lại trang
              </button>
              <button
                onClick={() => window.history.back()}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Quay lại
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
```

#### Create: `src/components/error-boundary/ModuleErrorBoundary.tsx`

```typescript
'use client';

import React, { ReactNode } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  children: ReactNode;
  moduleName: string;
}

export function ModuleErrorBoundary({ children, moduleName }: Props) {
  return (
    <ErrorBoundary
      context={`module:${moduleName}`}
      fallback={
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="text-sm font-medium text-yellow-800">
            Lỗi trong module {moduleName}
          </h4>
          <p className="mt-1 text-sm text-yellow-700">
            Module này đang gặp sự cố. Các phần khác của ứng dụng vẫn hoạt động bình thường.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm font-medium text-yellow-800 underline hover:no-underline"
          >
            Tải lại trang
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
```

#### Usage in Real Estate Module:

```typescript
// src/app/dashboard/real-estate/layout.tsx
import { ModuleErrorBoundary } from '@/components/error-boundary/ModuleErrorBoundary';

export default function RealEstateLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleErrorBoundary moduleName="Real Estate">
      {children}
    </ModuleErrorBoundary>
  );
}
```

### 4. API Error Handling Middleware

#### Create: `src/middleware/error-handler.ts`

```typescript
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger';

export interface APIError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export function handleAPIError(error: unknown, context?: string): NextResponse {
  const apiError = error as APIError;
  
  // Log error
  logger.error(
    {
      error: apiError.message,
      stack: apiError.stack,
      statusCode: apiError.statusCode || 500,
      code: apiError.code,
      context,
    },
    'API Error occurred'
  );
  
  // Report to Sentry (only 500 errors)
  if (!apiError.statusCode || apiError.statusCode >= 500) {
    Sentry.captureException(error, {
      tags: {
        context: context || 'api',
        statusCode: apiError.statusCode || 500,
      },
    });
  }
  
  // Return user-friendly error
  return NextResponse.json(
    {
      error: {
        message: apiError.message || 'An unexpected error occurred',
        code: apiError.code || 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? apiError.details : undefined,
      },
    },
    {
      status: apiError.statusCode || 500,
    }
  );
}

// Usage in API route
export async function POST(request: Request) {
  try {
    // ... your API logic
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleAPIError(error, 'POST /api/real-estate/reserve');
  }
}
```

### 5. Database Query Monitoring

#### Create: `src/lib/db/query-monitor.ts`

```typescript
import { dbLogger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

interface QueryMetrics {
  query: string;
  duration: number;
  rowCount?: number;
  error?: Error;
}

const SLOW_QUERY_THRESHOLD = 1000; // 1 second

export function logQuery(metrics: QueryMetrics) {
  const { query, duration, rowCount, error } = metrics;
  
  if (error) {
    // Log error queries
    dbLogger.error(
      {
        query,
        duration,
        error: error.message,
      },
      'Database query failed'
    );
    
    Sentry.captureException(error, {
      tags: {
        type: 'database_query',
      },
      contexts: {
        query: {
          sql: query.substring(0, 200), // First 200 chars
          duration,
        },
      },
    });
  } else if (duration > SLOW_QUERY_THRESHOLD) {
    // Log slow queries
    dbLogger.warn(
      {
        query: query.substring(0, 200),
        duration,
        rowCount,
      },
      'Slow database query detected'
    );
    
    // Report to Sentry as breadcrumb
    Sentry.addBreadcrumb({
      category: 'database',
      message: 'Slow query',
      level: 'warning',
      data: {
        query: query.substring(0, 100),
        duration,
      },
    });
  } else {
    // Log successful queries (debug level)
    dbLogger.debug(
      {
        query: query.substring(0, 100),
        duration,
        rowCount,
      },
      'Database query executed'
    );
  }
}

// Wrapper for Supabase queries
export async function monitoredQuery<T>(
  queryFn: () => Promise<T>,
  queryName: string
): Promise<T> {
  const start = Date.now();
  
  try {
    const result = await queryFn();
    const duration = Date.now() - start;
    
    logQuery({
      query: queryName,
      duration,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    
    logQuery({
      query: queryName,
      duration,
      error: error as Error,
    });
    
    throw error;
  }
}

// Usage example
import { monitoredQuery } from '@/lib/db/query-monitor';

const products = await monitoredQuery(
  () => supabase
    .from('real_estate_products')
    .select('*')
    .eq('status', 'available'),
  'get_available_products'
);
```

---

## 🚨 Alert Configuration

### Sentry Alerts

Configure in Sentry Dashboard:

**1. Critical Error Alert**
- Condition: Error count > 10 in 1 hour
- Action: Email + Slack notification
- Recipients: Dev team, on-call engineer

**2. High Error Rate Alert**
- Condition: Error rate > 5% of requests
- Action: Slack notification
- Recipients: Dev team

**3. Performance Degradation Alert**
- Condition: P95 response time > 2 seconds
- Action: Email notification
- Recipients: DevOps team

**4. New Error Alert**
- Condition: First occurrence of new error
- Action: Slack notification
- Recipients: Dev team

### Database Monitoring

Create Supabase monitoring queries:

```sql
-- Slow queries (run every 5 minutes)
SELECT
  query,
  mean_exec_time,
  calls,
  total_exec_time
FROM pg_stat_statements
WHERE mean_exec_time > 1000 -- 1 second
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Table bloat (run daily)
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS external_size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

---

## 📊 Monitoring Dashboards

### Sentry Dashboard Widgets

**1. Error Overview**
- Total errors (24h)
- Error rate trend
- Most common errors (top 10)
- Affected users count

**2. Performance**
- P50, P75, P95, P99 response times
- Slow transactions (> 2s)
- Most time-consuming operations

**3. Real Estate Module**
- Errors by bounded context (CRM, Sales, Product Catalog)
- Reservation success rate
- Booking conversion funnel
- Contract generation errors

### Custom Metrics (Log-based)

Query Pino logs for custom metrics:

```bash
# Count errors by module (last hour)
cat logs/app.log | grep '"level":"error"' | grep -oP '"module":"[^"]*"' | sort | uniq -c

# Average response time by endpoint
cat logs/app.log | grep '"duration":' | grep -oP '"duration":\d+' | awk '{sum+=$2; count++} END {print sum/count}'

# Top slow queries
cat logs/app.log | grep '"duration":' | grep '"module":"database"' | sort -t: -k4 -rn | head -10
```

---

## ✅ Post-Setup Checklist

- [ ] Install pino and pino-pretty
- [ ] Create Sentry config files (client, server, edge)
- [ ] Create logger.ts with module loggers
- [ ] Create ErrorBoundary components
- [ ] Add ErrorBoundary to critical layouts
- [ ] Create error handling middleware
- [ ] Add database query monitoring
- [ ] Configure Sentry alerts
- [ ] Test error reporting (trigger test error)
- [ ] Verify logs are being written
- [ ] Setup log rotation (if self-hosted)
- [ ] Document runbook for on-call engineers

---

## 🔗 Related Documents

- **Deployment Runbook:** `docs/deployment/DEPLOYMENT_RUNBOOK.md`
- **Real Estate Analysis:** `docs/real-estate/REAL_ESTATE_MODULE_COMPREHENSIVE_ANALYSIS.md`
- **Migrations Guide:** `docs/real-estate/MIGRATIONS_GUIDE.md`

---

**Last Updated:** 2026-08-02  
**Version:** 1.0.0  
**Owner:** DevOps Team
