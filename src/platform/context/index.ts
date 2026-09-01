/**
 * @fileoverview Context Engine — Platform Execution Context
 *
 * Provides a unified execution context injected into every engine,
 * API handler, workflow task, and AI agent operating within the platform.
 *
 * This is a First-class Platform Core Service (NOT infrastructure).
 * Every operation across all verticals MUST use PlatformContext.
 *
 * @module platform/context
 */

import crypto from 'crypto';
import type { VerticalManifest } from '../registry/vertical-registry';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type UserRole =
  | 'platform_admin'
  | 'tenant_owner'
  | 'branch_manager'
  | 'doctor'
  | 'nurse'
  | 'receptionist'
  | 'technician'
  | 'accountant'
  | 'ktv'
  | 'salesperson'
  | string;

export interface BranchInfo {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly locale: string;
  readonly address?: string;
}

export interface TenantInfo {
  readonly id: string;
  readonly name: string;
  readonly plan: 'starter' | 'professional' | 'enterprise';
  readonly vertical: string;
}

/**
 * PlatformContext — The canonical execution context for the Bella Platform.
 *
 * Encapsulates all runtime information needed to:
 * - Enforce multi-tenant RLS
 * - Check active capabilities and feature flags
 * - Provide locale/timezone for i18n
 * - Power AI context-awareness
 */
export interface PlatformContext {
  /** Tenant executing this operation */
  readonly tenant: TenantInfo;
  /** Active branch (optional for platform-level ops) */
  readonly branch?: BranchInfo;
  /** Current authenticated user ID (party_id) */
  readonly userId: string;
  /** Roles assigned to the current user */
  readonly roles: ReadonlyArray<UserRole>;
  /** Capabilities currently enabled for this tenant */
  readonly activeCapabilities: ReadonlySet<string>;
  /** Feature flags for graduated rollouts */
  readonly featureFlags: Readonly<Record<string, boolean>>;
  /** IANA timezone identifier, e.g. 'Asia/Ho_Chi_Minh' */
  readonly timezone: string;
  /** BCP 47 locale tag, e.g. 'vi-VN' */
  readonly locale: string;
  /** Correlation ID for distributed tracing */
  readonly correlationId: string;
  /** Vertical-specific manifest (for capability checks) */
  readonly manifest?: VerticalManifest;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT BUILDER
// ═══════════════════════════════════════════════════════════════════════════

export class ContextBuilder {
  private data: { -readonly [K in keyof PlatformContext]?: PlatformContext[K] } & { activeCapabilities?: Set<string> } = {};

  withTenant(tenant: TenantInfo): this {
    this.data.tenant = tenant;
    return this;
  }

  withBranch(branch: BranchInfo): this {
    this.data.branch = branch;
    return this;
  }

  withUser(userId: string, roles: UserRole[]): this {
    this.data.userId = userId;
    this.data.roles = roles;
    return this;
  }

  withCapabilities(capabilities: string[]): this {
    this.data.activeCapabilities = new Set(capabilities);
    return this;
  }

  withFeatureFlags(flags: Record<string, boolean>): this {
    this.data.featureFlags = flags;
    return this;
  }

  withLocale(timezone: string, locale: string): this {
    this.data.timezone = timezone;
    this.data.locale = locale;
    return this;
  }

  withCorrelationId(correlationId: string): this {
    this.data.correlationId = correlationId;
    return this;
  }

  withManifest(manifest: VerticalManifest): this {
    this.data.manifest = manifest;
    return this;
  }

  build(): PlatformContext {
    if (!this.data.tenant) throw new Error('[ContextEngine] tenant is required');
    if (!this.data.userId) throw new Error('[ContextEngine] userId is required');

    return {
      tenant: this.data.tenant,
      branch: this.data.branch,
      userId: this.data.userId,
      roles: this.data.roles ?? [],
      activeCapabilities: this.data.activeCapabilities ?? new Set(),
      featureFlags: this.data.featureFlags ?? {},
      timezone: this.data.timezone ?? this.data.branch?.timezone ?? 'Asia/Ho_Chi_Minh',
      locale: this.data.locale ?? this.data.branch?.locale ?? 'vi-VN',
      correlationId: this.data.correlationId ?? crypto.randomUUID(),
      manifest: this.data.manifest,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT GUARDS — Capability & Role Checks
// ═══════════════════════════════════════════════════════════════════════════

export function hasCapability(ctx: PlatformContext, capability: string): boolean {
  return ctx.activeCapabilities.has(capability);
}

export function hasRole(ctx: PlatformContext, role: UserRole): boolean {
  return ctx.roles.includes(role);
}

export function hasAnyRole(ctx: PlatformContext, roles: UserRole[]): boolean {
  return roles.some((r) => ctx.roles.includes(r));
}

export function isFeatureEnabled(ctx: PlatformContext, flag: string): boolean {
  return ctx.featureFlags[flag] === true;
}

/**
 * Asserts a capability is active. Throws if not enabled.
 * Use in server actions and API routes to gate access.
 */
export function requireCapability(ctx: PlatformContext, capability: string): void {
  if (!hasCapability(ctx, capability)) {
    throw new Error(
      `[ContextEngine] Capability "${capability}" is not enabled for tenant "${ctx.tenant.id}"`
    );
  }
}

/**
 * Asserts a role. Throws if user does not have the required role.
 */
export function requireRole(ctx: PlatformContext, role: UserRole): void {
  if (!hasRole(ctx, role)) {
    throw new Error(
      `[ContextEngine] Role "${role}" is required. User "${ctx.userId}" does not have it.`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXT ENGINE — Singleton Facade
// ═══════════════════════════════════════════════════════════════════════════

class ContextEngine {
  /**
   * Creates a new ContextBuilder for fluent context construction.
   */
  builder(): ContextBuilder {
    return new ContextBuilder();
  }

  /**
   * Derives a new context from an existing one with overrides.
   * Useful for impersonation and system-level sub-operations.
   */
  derive(base: PlatformContext, overrides: Partial<PlatformContext>): PlatformContext {
    return { ...base, ...overrides };
  }

  /**
   * Creates a minimal system-level context for background jobs and migrations.
   * No user, no branch, all capabilities enabled.
   */
  systemContext(tenantId: string, tenantName: string, vertical: string): PlatformContext {
    return new ContextBuilder()
      .withTenant({ id: tenantId, name: tenantName, plan: 'enterprise', vertical })
      .withUser('system', ['platform_admin'])
      .withCapabilities(['*'])
      .withCorrelationId(crypto.randomUUID())
      .build();
  }
}

export const contextEngine = new ContextEngine();
