/**
 * @fileoverview Platform Template Engine
 *
 * Mustache-compatible lightweight template engine with:
 * - {{variable}} interpolation
 * - {{#if condition}}...{{/if}} conditionals
 * - {{#each items}}...{{/each}} iteration
 * - {{nested.field}} dot-notation access
 * - Tenant-scoped template registry
 *
 * @module platform/template-engine
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TemplateFormat = 'text' | 'html' | 'markdown' | 'json';

export interface TemplateDefinition {
  /** Unique key (e.g. 'notification.sla_warning', 'email.welcome') */
  key: string;
  /** Human-readable name */
  name: string;
  /** Category for organization */
  category: TemplateCategory;
  /** Template body with {{variable}} placeholders */
  body: string;
  /** Subject line (for email/notification templates) */
  subject?: string;
  /** Output format */
  format: TemplateFormat;
  /** Template schema version */
  version: string;
  /** Tenant-specific override (if null, applies to all tenants) */
  tenantId?: string | null;
}

export type TemplateCategory =
  | 'notification'
  | 'email'
  | 'sms'
  | 'document'
  | 'report'
  | 'contract'
  | 'receipt'
  | 'system';

export interface TemplateContext {
  /** Tenant data */
  tenant?: { id: string; name?: string; brandName?: string };
  /** Actor/user data */
  actor?: { name?: string; email?: string; role?: string };
  /** Runtime metadata */
  runtime?: { date?: string; time?: string; timestamp?: string };
  /** Arbitrary template data */
  data?: Record<string, unknown>;
  /** Flat variables (merged with data for lookup) */
  [key: string]: unknown;
}

export interface CompileResult {
  subject?: string;
  body: string;
  format: TemplateFormat;
  templateKey: string;
  compiledAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Compiler
// ─────────────────────────────────────────────────────────────────────────────

/** Resolve dot-notation path (e.g. 'tenant.name', 'data.amount') */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === 'object' && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** Flatten a TemplateContext into a single lookup map */
function flattenContext(ctx: TemplateContext): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  // Merge all top-level keys
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      for (const [subK, subV] of Object.entries(v as Record<string, unknown>)) {
        flat[`${k}.${subK}`] = subV;
        flat[subK] = subV; // shorthand access
      }
    }
    flat[k] = v;
  }
  return flat;
}

function compileTemplate(template: string, ctx: TemplateContext): string {
  const flat = flattenContext(ctx);

  let result = template;

  // 1. {{#each items}}...{{/each}}
  result = result.replace(/\{\{#each\s+(\S+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match, key, block) => {
    const items = resolvePath(flat, key) ?? resolvePath(ctx as Record<string, unknown>, key);
    if (!Array.isArray(items)) return '';
    return items
      .map((item, index) => {
        const itemCtx: TemplateContext = { ...ctx, this: item, index, ...(typeof item === 'object' ? item as Record<string, unknown> : { value: item }) };
        return compileTemplate(block, itemCtx);
      })
      .join('');
  });

  // 2. {{#if condition}}...{{/if}} (truthy check)
  result = result.replace(/\{\{#if\s+(\S+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, block) => {
    const value = resolvePath(flat, key) ?? resolvePath(ctx as Record<string, unknown>, key);
    return value ? compileTemplate(block, ctx) : '';
  });

  // 3. {{#unless condition}}...{{/unless}} (falsy check)
  result = result.replace(/\{\{#unless\s+(\S+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (_match, key, block) => {
    const value = resolvePath(flat, key) ?? resolvePath(ctx as Record<string, unknown>, key);
    return !value ? compileTemplate(block, ctx) : '';
  });

  // 4. {{variable}} interpolation (safe stringify)
  result = result.replace(/\{\{(\S+?)\}\}/g, (_match, key) => {
    const value = resolvePath(flat, key) ?? resolvePath(ctx as Record<string, unknown>, key);
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Template Engine
// ─────────────────────────────────────────────────────────────────────────────

class TemplateEngineClass {
  /** In-memory template registry: key → TemplateDefinition */
  private readonly registry = new Map<string, TemplateDefinition>();
  /** Tenant-level overrides: `tenantId:key` → TemplateDefinition */
  private readonly tenantOverrides = new Map<string, TemplateDefinition>();

  /**
   * Register a template (platform-wide or tenant-specific).
   * Tenant-specific templates override platform defaults at compile time.
   */
  register(template: TemplateDefinition): void {
    if (template.tenantId) {
      this.tenantOverrides.set(`${template.tenantId}:${template.key}`, template);
    } else {
      this.registry.set(template.key, template);
    }
  }

  /** Resolve template: tenant override first, then platform default */
  resolve(key: string, tenantId?: string): TemplateDefinition | undefined {
    if (tenantId) {
      const override = this.tenantOverrides.get(`${tenantId}:${key}`);
      if (override) return override;
    }
    return this.registry.get(key);
  }

  /**
   * Compile a registered template with context data.
   * @throws if template key is not found
   */
  compile(key: string, ctx: TemplateContext, tenantId?: string): CompileResult {
    const template = this.resolve(key, tenantId);
    if (!template) {
      throw new Error(`[TemplateEngine] Template not found: "${key}"`);
    }
    return {
      subject: template.subject ? compileTemplate(template.subject, ctx) : undefined,
      body: compileTemplate(template.body, ctx),
      format: template.format,
      templateKey: key,
      compiledAt: new Date().toISOString(),
    };
  }

  /**
   * Compile an inline template string (without registry lookup).
   */
  compileInline(body: string, ctx: TemplateContext, format: TemplateFormat = 'text'): CompileResult {
    return {
      body: compileTemplate(body, ctx),
      format,
      templateKey: '_inline_',
      compiledAt: new Date().toISOString(),
    };
  }

  /** List all registered template keys */
  listKeys(tenantId?: string): string[] {
    const keys = new Set<string>(this.registry.keys());
    if (tenantId) {
      for (const k of this.tenantOverrides.keys()) {
        if (k.startsWith(`${tenantId}:`)) keys.add(k.replace(`${tenantId}:`, ''));
      }
    }
    return Array.from(keys);
  }
}

export const templateEngine = new TemplateEngineClass();

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Platform Templates
// ─────────────────────────────────────────────────────────────────────────────

templateEngine.register({
  key: 'notification.sla_warning',
  name: 'SLA Warning Alert',
  category: 'notification',
  format: 'text',
  version: '1.0.0',
  subject: '⏰ Cảnh báo SLA: {{resourceLabel}}',
  body: 'Resource {{resourceId}} chỉ còn {{remainingMinutes}} phút trước khi trễ SLA.',
});

templateEngine.register({
  key: 'notification.resource_rotated',
  name: 'Resource Rotation Alert',
  category: 'notification',
  format: 'text',
  version: '1.0.0',
  subject: '🔄 Bạn nhận được {{resourceLabel}} mới!',
  body: 'Resource {{resourceId}} đã được hệ thống chuyển tự động từ {{previousOwnerName}} sang cho bạn chăm sóc.',
});

templateEngine.register({
  key: 'notification.sla_breached',
  name: 'SLA Breach Alert',
  category: 'notification',
  format: 'text',
  version: '1.0.0',
  subject: '🚨 SLA đã bị vi phạm: {{resourceLabel}}',
  body: 'Resource {{resourceId}} đã vượt quá thời hạn SLA tại stage {{stage}}. Thời hạn: {{deadlineTime}}.',
});

templateEngine.register({
  key: 'email.welcome_tenant',
  name: 'Tenant Welcome Email',
  category: 'email',
  format: 'html',
  version: '1.0.0',
  subject: 'Chào mừng {{tenant.brandName}} đến với Bella ERP!',
  body: `<h1>Xin chào {{actor.name}}!</h1>
<p>Tài khoản <strong>{{tenant.brandName}}</strong> đã được kích hoạt thành công.</p>
<p>Bắt đầu ngay tại <a href="{{loginUrl}}">Bella ERP Dashboard</a>.</p>`,
});
