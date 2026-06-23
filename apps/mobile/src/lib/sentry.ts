/**
 * Sentry Configuration for Bella Spa Mobile
 * 
 * Crash monitoring and error tracking setup.
 * Integrated as part of Pre-Week 4 Phase 1 requirements.
 * 
 * Setup Instructions:
 * 1. Create new project in Sentry: "Bella Mobile"
 * 2. Copy DSN from project settings
 * 3. Add to .env.local: EXPO_PUBLIC_SENTRY_DSN=https://...
 * 4. Restart Expo dev server
 */

import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

/**
 * Initialize Sentry with production-ready configuration
 */
export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  const environment = process.env.EXPO_PUBLIC_ENV || 'development';

  // Only initialize if DSN is provided
  if (!dsn) {
    console.warn('⚠️ Sentry DSN not configured. Error tracking disabled.');
    console.warn('Add EXPO_PUBLIC_SENTRY_DSN to .env.local to enable Sentry.');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    
    // Enable debug mode in development
    debug: environment === 'development',
    
    // Performance Monitoring
    tracesSampleRate: environment === 'production' ? 0.2 : 1.0, // 20% in prod, 100% in dev
    
    // Enable automatic session tracking
    enableAutoSessionTracking: true,
    
    // Session timeout (30 minutes)
    sessionTrackingIntervalMillis: 30000,
    
    // Enable native crash reporting
    enableNative: true,
    enableNativeCrashHandling: true,
    
    // Attach stacktraces to messages
    attachStacktrace: true,
    
    // Breadcrumbs (navigation, network, console logs)
    maxBreadcrumbs: 50,
    
    // Release versioning (for tracking which version has issues)
    release: `bella-mobile@${require('../../package.json').version}`,
    dist: Platform.OS, // 'ios' or 'android'
    
    // Integrations
    integrations: [
      // Automatically capture unhandled promise rejections
      new Sentry.ReactNativeTracing({
        routingInstrumentation: new Sentry.ReactNavigationInstrumentation(),
        enableStallTracking: true,
        enableAppStartTracking: true,
        enableNativeFramesTracking: true,
      }),
    ],
    
    // Before sending events, you can modify or filter them
    beforeSend(event, hint) {
      // Don't send events in development (optional - remove if you want dev errors too)
      if (environment === 'development') {
        console.log('🐛 Sentry Event (dev mode, not sent):', event);
        return null; // Don't send to Sentry in dev
      }
      
      // Filter out non-critical errors (optional)
      const error = hint.originalException as Error;
      if (error?.message?.includes('Network request failed')) {
        // Network errors are common, only log, don't report to Sentry
        console.warn('Network error (not reported to Sentry):', error.message);
        return null;
      }
      
      return event;
    },
    
    // Before sending breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filter out sensitive data from console logs
      if (breadcrumb.category === 'console' && breadcrumb.message) {
        // Remove potential sensitive data from console.log breadcrumbs
        if (breadcrumb.message.includes('password') || breadcrumb.message.includes('token')) {
          breadcrumb.message = '[REDACTED - sensitive data]';
        }
      }
      return breadcrumb;
    },
  });

  console.log('✅ Sentry initialized:', {
    environment,
    dsn: dsn.substring(0, 30) + '...',
    platform: Platform.OS,
  });
}

/**
 * Set user context (call after successful login)
 */
export function setSentryUser(user: {
  id: string;
  email?: string;
  role?: string;
  tenant_id?: string;
}) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    // Custom user properties
    role: user.role,
    tenant_id: user.tenant_id,
  });
  
  console.log('✅ Sentry user context set:', { id: user.id, role: user.role });
}

/**
 * Clear user context (call on logout)
 */
export function clearSentryUser() {
  Sentry.setUser(null);
  console.log('✅ Sentry user context cleared');
}

/**
 * Set custom context tags for filtering in Sentry dashboard
 */
export function setSentryTags(tags: Record<string, string>) {
  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value);
  });
}

/**
 * Add custom breadcrumb for debugging
 */
export function addSentryBreadcrumb(message: string, category: string, data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    category,
    level: 'info',
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Manually capture an exception
 */
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  });
}

/**
 * Manually capture a message
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Start a performance transaction
 * Example: const transaction = startTransaction('loadDashboard');
 */
export function startTransaction(name: string, op: string = 'navigation') {
  return Sentry.startTransaction({ name, op });
}

/**
 * Test Sentry integration (for verification)
 * Call this from a test button in the app
 */
export function testSentry() {
  try {
    console.log('🧪 Testing Sentry integration...');
    
    // Test breadcrumb
    addSentryBreadcrumb('Test breadcrumb', 'test', { foo: 'bar' });
    
    // Test message
    captureMessage('Sentry test message from Bella Mobile', 'info');
    
    // Test exception
    throw new Error('Sentry test exception - This is intentional for testing');
  } catch (error) {
    captureException(error as Error, { test: true });
  }
}

// Export Sentry instance for advanced usage
export { Sentry };
