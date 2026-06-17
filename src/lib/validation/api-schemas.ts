/**
 * API Request Validation Schemas
 * 
 * Zod schemas for validating all API endpoint inputs.
 * Provides type-safe validation with automatic TypeScript inference.
 * 
 * Features:
 * - Request body validation
 * - Query parameter validation
 * - Path parameter validation
 * - XSS prevention (sanitization)
 * - SQL injection prevention
 * - Type coercion and normalization
 * 
 * @module validation/api-schemas
 */

import { z } from 'zod';

// ============================================================================
// COMMON VALIDATORS
// ============================================================================

/**
 * UUID validator
 * Validates UUID v4 format
 */
export const uuidSchema = z.string().uuid({
  message: 'Invalid UUID format',
});

/**
 * Email validator
 * RFC 5322 compliant
 */
export const emailSchema = z.string().email({
  message: 'Invalid email address',
});

/**
 * Phone number validator
 * Vietnamese phone format (+84 or 0)
 */
export const phoneSchema = z.string().regex(
  /^(\+84|0)[0-9]{9,10}$/,
  'Invalid Vietnamese phone number format'
);

/**
 * Date string validator
 * ISO 8601 format
 */
export const dateStringSchema = z.string().datetime({
  message: 'Invalid ISO 8601 date format',
});

/**
 * Pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Idempotency key validator
 * Required for mutations to prevent duplicate operations
 */
export const idempotencyKeySchema = z.string().min(16).max(255);

// ============================================================================
// XSS PREVENTION
// ============================================================================

/**
 * Sanitize string to prevent XSS
 * Removes/escapes dangerous characters
 */
function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Safe string schema with XSS prevention
 */
export const safeStringSchema = z.string().transform(sanitizeString);

/**
 * Safe text schema (for longer content)
 * Max 10,000 characters
 */
export const safeTextSchema = z.string().max(10000).transform(sanitizeString);

// ============================================================================
// ORDER SCHEMAS
// ============================================================================

/**
 * Order status enum
 */
export const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
]);

/**
 * Order item schema
 */
export const orderItemSchema = z.object({
  product_id: uuidSchema,
  package_id: uuidSchema.optional(),
  quantity: z.number().int().positive().max(1000),
  unit_price: z.number().nonnegative(),
  discount_amount: z.number().nonnegative().optional(),
  notes: safeStringSchema.max(500).optional(),
});

/**
 * Create order request body
 */
export const createOrderSchema = z.object({
  customer_id: uuidSchema,
  items: z.array(orderItemSchema).min(1).max(50),
  notes: safeTextSchema.optional(),
  scheduled_date: dateStringSchema.optional(),
  idempotency_key: idempotencyKeySchema,
}).strict(); // Reject unknown fields

/**
 * Update order request body
 */
export const updateOrderSchema = z.object({
  status: orderStatusSchema.optional(),
  notes: safeTextSchema.optional(),
  scheduled_date: dateStringSchema.optional(),
}).strict();

/**
 * List orders query parameters
 */
export const listOrdersQuerySchema = paginationSchema.extend({
  status: orderStatusSchema.optional(),
  customer_id: uuidSchema.optional(),
  from_date: dateStringSchema.optional(),
  to_date: dateStringSchema.optional(),
  search: safeStringSchema.max(255).optional(),
});

// ============================================================================
// CUSTOMER SCHEMAS
// ============================================================================

/**
 * Create customer request body
 */
export const createCustomerSchema = z.object({
  name: safeStringSchema.min(1).max(255),
  phone: phoneSchema,
  email: emailSchema.optional(),
  date_of_birth: dateStringSchema.optional(),
  address: safeTextSchema.max(500).optional(),
  notes: safeTextSchema.optional(),
  idempotency_key: idempotencyKeySchema,
}).strict();

/**
 * Update customer request body
 */
export const updateCustomerSchema = z.object({
  name: safeStringSchema.min(1).max(255).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  date_of_birth: dateStringSchema.optional(),
  address: safeTextSchema.max(500).optional(),
  notes: safeTextSchema.optional(),
}).strict();

/**
 * List customers query parameters
 */
export const listCustomersQuerySchema = paginationSchema.extend({
  search: safeStringSchema.max(255).optional(),
  has_orders: z.coerce.boolean().optional(),
});

// ============================================================================
// PAYMENT SCHEMAS
// ============================================================================

/**
 * Payment method enum
 */
export const paymentMethodSchema = z.enum([
  'cash',
  'bank_transfer',
  'credit_card',
  'ewallet',
  'other',
]);

/**
 * Payment status enum
 */
export const paymentStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
]);

/**
 * Create payment request body
 */
export const createPaymentSchema = z.object({
  order_id: uuidSchema,
  amount: z.number().positive().max(1000000000), // Max 1 billion VND
  payment_method: paymentMethodSchema,
  notes: safeTextSchema.optional(),
  idempotency_key: idempotencyKeySchema,
}).strict();

/**
 * List payments query parameters
 */
export const listPaymentsQuerySchema = paginationSchema.extend({
  order_id: uuidSchema.optional(),
  status: paymentStatusSchema.optional(),
  from_date: dateStringSchema.optional(),
  to_date: dateStringSchema.optional(),
});

// ============================================================================
// WEBHOOK SCHEMAS
// ============================================================================

/**
 * Webhook event types
 */
export const webhookEventSchema = z.enum([
  'order.created',
  'order.updated',
  'order.completed',
  'order.cancelled',
  'payment.created',
  'payment.completed',
  'payment.failed',
  'customer.created',
  'customer.updated',
]);

/**
 * Subscribe to webhook request body
 */
export const subscribeWebhookSchema = z.object({
  url: z.string().url().max(2048),
  events: z.array(webhookEventSchema).min(1).max(20),
  secret: z.string().min(32).max(255).optional(),
}).strict();

/**
 * Update webhook subscription request body
 */
export const updateWebhookSchema = z.object({
  url: z.string().url().max(2048).optional(),
  events: z.array(webhookEventSchema).min(1).max(20).optional(),
  is_active: z.boolean().optional(),
}).strict();

// ============================================================================
// PARTNER API KEY SCHEMAS (Admin endpoints)
// ============================================================================

/**
 * Create API partner request body
 */
export const createAPIPartnerSchema = z.object({
  partner_name: safeStringSchema.min(1).max(255),
  partner_type: z.enum(['pos', 'payment', 'invoice', 'franchise', 'hr', 'analytics', 'mobile_app', 'other']),
  partner_description: safeTextSchema.optional(),
  contact_email: emailSchema.optional(),
  contact_phone: phoneSchema.optional(),
  allowed_scopes: z.array(z.string()).min(1).max(50),
  is_sandbox: z.boolean().default(false),
  rate_limit_tier: z.enum(['free', 'basic', 'pro', 'enterprise', 'unlimited']).default('free'),
  webhook_url: z.string().url().max(2048).optional(),
  notes: safeTextSchema.optional(),
}).strict();

/**
 * Update API partner request body
 */
export const updateAPIPartnerSchema = z.object({
  partner_name: safeStringSchema.min(1).max(255).optional(),
  partner_description: safeTextSchema.optional(),
  contact_email: emailSchema.optional(),
  contact_phone: phoneSchema.optional(),
  allowed_scopes: z.array(z.string()).min(1).max(50).optional(),
  is_active: z.boolean().optional(),
  rate_limit_tier: z.enum(['free', 'basic', 'pro', 'enterprise', 'unlimited']).optional(),
  webhook_url: z.string().url().max(2048).optional(),
  notes: safeTextSchema.optional(),
}).strict();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Type inference helpers
 * Use these to get TypeScript types from Zod schemas
 */
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;
export type SubscribeWebhookInput = z.infer<typeof subscribeWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;
export type CreateAPIPartnerInput = z.infer<typeof createAPIPartnerSchema>;
export type UpdateAPIPartnerInput = z.infer<typeof updateAPIPartnerSchema>;
