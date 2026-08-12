/**
 * Common Core — Bella Meta-Platform Infrastructure
 * 
 * Domain-agnostic primitives and platform abstractions shared across Healthcare OS and Education OS.
 * Strictly 1-way dependency graph: Core imports ZERO domain or host dependencies.
 * 
 * @module platform/core
 */

export * from './events';
export * from './contracts';
export * from './tenant';
export * from './errors';
export * from './repository';
export * from './idempotency';
export * from './audit';
