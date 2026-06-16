"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvoiceBalance = getInvoiceBalance;
exports.isInvoiceOverdue = isInvoiceOverdue;
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
function getInvoiceBalance(invoice) {
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
function isInvoiceOverdue(invoice) {
    if (invoice.status === 'paid' || invoice.status === 'cancelled')
        return false;
    return new Date(invoice.dueDate) < new Date();
}
