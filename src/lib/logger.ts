/**
 * Structured Logger using Pino
 * 
 * Usage:
 *   import { logger, reLogger } from '@/lib/logger';
 *   
 *   logger.info('Application started');
 *   logger.error({ err: error }, 'Failed to process request');
 *   
 *   reLogger.info({ productId: 'abc-123' }, 'Product reserved');
 */

// Fallback logger for environments where pino is not available
class ConsoleLogger {
  private module?: string;

  constructor(module?: string) {
    this.module = module;
  }

  private formatMessage(level: string, obj: unknown, msg?: string) {
    const timestamp = new Date().toISOString();
    const moduleStr = this.module ? ` [${this.module}]` : '';
    const objStr = obj && typeof obj === 'object' ? ` ${JSON.stringify(obj)}` : '';
    return `${timestamp} ${level.toUpperCase()}${moduleStr}: ${msg || ''}${objStr}`;
  }

  info(obj: unknown, msg?: string) {
    if (typeof obj === 'string') {
      console.log(this.formatMessage('info', null, obj));
    } else {
      console.log(this.formatMessage('info', obj, msg));
    }
  }

  error(obj: unknown, msg?: string) {
    if (typeof obj === 'string') {
      console.error(this.formatMessage('error', null, obj));
    } else {
      console.error(this.formatMessage('error', obj, msg));
    }
  }

  warn(obj: unknown, msg?: string) {
    if (typeof obj === 'string') {
      console.warn(this.formatMessage('warn', null, obj));
    } else {
      console.warn(this.formatMessage('warn', obj, msg));
    }
  }

  debug(obj: unknown, msg?: string) {
    if (process.env.NODE_ENV === 'development') {
      if (typeof obj === 'string') {
        console.debug(this.formatMessage('debug', null, obj));
      } else {
        console.debug(this.formatMessage('debug', obj, msg));
      }
    }
  }

  child(bindings: { module: string }) {
    return new ConsoleLogger(bindings.module);
  }
}

// Export console-based logger as fallback
export const logger = new ConsoleLogger();

export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

// Module-specific loggers
export const reLogger = createModuleLogger('real_estate');
export const crmLogger = createModuleLogger('crm');
export const salesLogger = createModuleLogger('sales');
export const bookingLogger = createModuleLogger('booking');
export const financeLogger = createModuleLogger('finance');
export const dbLogger = createModuleLogger('database');
export const apiLogger = createModuleLogger('api');
export const authLogger = createModuleLogger('auth');

// Note: To enable full Pino logger with better performance and features:
// 1. Install: npm install pino pino-pretty
// 2. Uncomment the pino implementation below and comment out ConsoleLogger

/*
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

export const createModuleLogger = (module: string) => {
  return logger.child({ module });
};

// Module-specific loggers
export const reLogger = createModuleLogger('real_estate');
export const crmLogger = createModuleLogger('crm');
export const salesLogger = createModuleLogger('sales');
export const bookingLogger = createModuleLogger('booking');
export const financeLogger = createModuleLogger('finance');
export const dbLogger = createModuleLogger('database');
export const apiLogger = createModuleLogger('api');
export const authLogger = createModuleLogger('auth');
*/
