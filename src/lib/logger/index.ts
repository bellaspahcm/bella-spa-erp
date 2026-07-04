/**
 * Logger Module
 * 
 * Simple logger abstraction for Decision Engine Platform.
 */

export type { ILogger, LogLevel, LogMetadata } from './ILogger';
export { ConsoleLogger, NoOpLogger } from './ILogger';
