/**
 * Payment method types.
 * 
 * @remarks
 * Supported payment methods for collecting customer payments:
 * - `cash`: Physical cash payment at location
 * - `bank_transfer`: Direct bank transfer (manual reconciliation required)
 * - `credit_card`: Credit/debit card payment (may integrate with payment gateway)
 * - `e_wallet`: Digital wallet (Momo, ZaloPay, VNPay, etc.)
 * - `other`: Custom payment methods specific to tenant
 */
export type PaymentMethod = 'cash' | 'bank_transfer' | 'credit_card' | 'e_wallet' | 'other';

/**
 * Payment intent status.
 * 
 * @remarks
 * Tracks payment processing lifecycle:
 * - `pending`: Payment created but not yet initiated
 * - `processing`: Payment being processed by payment provider
 * - `succeeded`: Payment successfully completed
 * - `failed`: Payment failed (insufficient funds, declined, etc.)
 * - `cancelled`: Payment cancelled before completion
 */
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';

/**
 * Payment intent representing an intent to collect payment from a customer.
 * 
 * @remarks
 * Used for tracking payment attempts, partial payments, and payment processing.
 * 
 * @example
 * ```typescript
 * const payment: PaymentIntent = {
 *   id: 'payment-uuid',
 *   tenantId: 'tenant-uuid',
 *   customerId: 'customer-uuid',
 *   bookingOrderId: 'booking-uuid',
 *   amount: 5000000,
 *   currency: 'VND',
 *   method: 'bank_transfer',
 *   status: 'succeeded',
 *   metadata: {
 *     transactionId: 'bank-tx-12345',
 *     bankName: 'Vietcombank',
 *     transferNote: 'Thanh toán gói dịch vụ',
 *   },
 * };
 * ```
 */
export interface PaymentIntent {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Tenant this payment belongs to */
  tenantId: string;
  
  /** Customer making the payment */
  customerId: string;
  
  /** Booking order this payment is for */
  bookingOrderId: string;
  
  /** Payment amount */
  amount: number;
  
  /** ISO 4217 currency code */
  currency: string;
  
  /** Payment method used */
  method: PaymentMethod;
  
  /** Current payment status */
  status: PaymentStatus;
  
  /** 
   * Additional payment details (transaction IDs, receipt URLs, etc.).
   * 
   * @remarks
   * Store payment-method-specific details here for reconciliation and audit.
   * 
   * **Common fields**:
   * - `transactionId: string` - External payment provider transaction ID
   * - `receiptUrl: string` - URL to payment receipt/proof
   * - `processedAt: string` - ISO timestamp when payment was processed
   * 
   * **Bank transfer specific**:
   * - `bankName: string` - Name of bank
   * - `accountNumber: string` - Last 4 digits of account (masked)
   * - `transferNote: string` - Transfer memo/reference
   * 
   * **E-wallet specific**:
   * - `walletProvider: string` - Momo, ZaloPay, VNPay, etc.
   * - `walletPhoneNumber: string` - Masked phone number
   * 
   * **Credit card specific**:
   * - `cardLast4: string` - Last 4 digits of card
   * - `cardBrand: string` - Visa, Mastercard, etc.
   * - `authorizationCode: string` - Payment gateway auth code
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
}

/**
 * Invoice status.
 * 
 * @remarks
 * Tracks invoice lifecycle for accounting compliance:
 * - `draft`: Invoice created but not yet issued to customer
 * - `issued`: Invoice sent to customer, payment pending
 * - `paid`: Invoice fully paid
 * - `overdue`: Invoice past due date and unpaid
 * - `cancelled`: Invoice voided/cancelled
 */
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';

/**
 * Invoice line item.
 * 
 * @remarks
 * Represents a single line item on an invoice. Multiple line items
 * can represent different services, products, or charges within one invoice.
 */
export interface InvoiceLineItem {
  /** Line item description */
  description: string;
  
  /** Quantity */
  quantity: number;
  
  /** Price per unit */
  unitPrice: number;
  
  /** Total amount (quantity * unitPrice) */
  amount: number;
  
  /** 
   * Optional metadata (service ID, package details, etc.).
   * 
   * @remarks
   * Store references to the service/product for reconciliation:
   * - `serviceItemId: string` - Reference to CoreServiceCatalogItem
   * - `bookingId: string` - Reference to booking (if applicable)
   * - `taxRate: number` - Tax rate applied (if applicable)
   * - `discountApplied: number` - Discount amount (if applicable)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

/**
 * Invoice document representing a financial record of goods/services rendered.
 * 
 * @remarks
 * Used for customer billing, revenue recognition, and accounting compliance.
 * 
 * @example
 * ```typescript
 * const invoice: Invoice = {
 *   id: 'invoice-uuid',
 *   tenantId: 'tenant-uuid',
 *   customerId: 'customer-uuid',
 *   bookingOrderId: 'booking-uuid',
 *   invoiceNumber: 'INV-2025-001',
 *   issueDate: '2025-06-01',
 *   dueDate: '2025-06-15',
 *   totalAmount: 15000000,
 *   paidAmount: 5000000,
 *   status: 'issued',
 *   lineItems: [
 *     {
 *       description: 'Combo Mẹ & Bé VIP - 20 sessions',
 *       quantity: 1,
 *       unitPrice: 15000000,
 *       amount: 15000000,
 *     },
 *   ],
 * };
 * ```
 */
export interface Invoice {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Tenant this invoice belongs to */
  tenantId: string;
  
  /** Customer being invoiced */
  customerId: string;
  
  /** Booking order this invoice is for */
  bookingOrderId: string;
  
  /** Human-readable invoice number (e.g., 'INV-2025-001') */
  invoiceNumber: string;
  
  /** Date invoice was issued (ISO 8601 date) */
  issueDate: string;
  
  /** Date payment is due (ISO 8601 date) */
  dueDate: string;
  
  /** Total invoice amount */
  totalAmount: number;
  
  /** Amount already paid */
  paidAmount: number;
  
  /** Current invoice status */
  status: InvoiceStatus;
  
  /** Line items detailing services/products */
  lineItems: InvoiceLineItem[];
}

/**
 * Calculate invoice balance due.
 * 
 * @param invoice - Invoice to calculate balance for
 * @returns Remaining unpaid amount (never negative)
 * 
 * @remarks
 * Use this to determine outstanding balance for collection.
 * Returns 0 if invoice is fully paid or overpaid.
 * 
 * @example
 * ```typescript
 * const balance = getInvoiceBalance(invoice);
 * if (balance > 0) {
 *   console.log(`Outstanding balance: ${balance} ${invoice.currency}`);
 * }
 * ```
 */
export function getInvoiceBalance(invoice: Invoice): number {
  return Math.max(0, invoice.totalAmount - invoice.paidAmount);
}

/**
 * Check if invoice is overdue.
 * 
 * @param invoice - Invoice to check
 * @returns True if invoice is past due date and unpaid
 * 
 * @remarks
 * Returns false for paid or cancelled invoices regardless of due date.
 * Use this to identify invoices requiring follow-up or late fees.
 * 
 * @example
 * ```typescript
 * const overdueInvoices = allInvoices.filter(isInvoiceOverdue);
 * console.log(`${overdueInvoices.length} invoices are overdue`);
 * ```
 */
export function isInvoiceOverdue(invoice: Invoice): boolean {
  if (invoice.status === 'paid' || invoice.status === 'cancelled') return false;
  return new Date(invoice.dueDate) < new Date();
}
