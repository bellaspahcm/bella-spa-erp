/**
 * Spa Services Module
 * 
 * Central export point for all spa-specific services.
 * These services act as facades/wrappers around existing implementations,
 * establishing module boundaries per Phase 3 architecture.
 * 
 * @module spa/services
 */

// Session management
export * from './session';
export { SpaSessionService } from './session';

// Salary calculation
export * from './salary';
export { SpaSalaryService } from './salary';

// KTV performance tracking
export * from './ktvPerformance';
export { SpaKtvPerformanceService } from './ktvPerformance';

// Package management
export * from './package';
export { SpaPackageService } from './package';
