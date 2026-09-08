/**
 * Sale Domain Tests
 * 
 * Behavioral verification of Sale entity correctness
 */

import { describe, it, expect } from 'vitest';
import { Sale } from '../../../src/platform/retail/domain/sale';

describe('Sale', () => {
  const tenantId = 'test-tenant-123';

  describe('create', () => {
    it('should create draft sale with valid data', () => {
      const sale = Sale.create({
        tenantId,
        saleNumber: 'SALE-001',
        subtotal: 100.00,
        paymentMethod: 'CASH',
      });

      expect(sale.tenantId).toBe(tenantId);
      expect(sale.saleNumber).toBe('SALE-001');
      expect(sale.subtotal).toBe(100.00);
      expect(sale.taxAmount).toBe(0);
      expect(sale.discountAmount).toBe(0);
      expect(sale.totalAmount).toBe(100.00);
      expect(sale.paymentMethod).toBe('CASH');
      expect(sale.paymentStatus).toBe('PENDING');
      expect(sale.status).toBe('DRAFT');
      expect(sale.isDraft).toBe(true);
    });

    it('should calculate total correctly with tax and discount', () => {
      const sale = Sale.create({
        tenantId,
        saleNumber: 'SALE-002',
        subtotal: 100.00,
        taxAmount: 10.00,
        discountAmount: 5.00,
        paymentMethod: 'CARD',
      });

      expect(sale.totalAmount).toBe(105.00); // 100 + 10 - 5
    });

    it('should reject empty sale number', () => {
      expect(() => Sale.create({
        tenantId,
        saleNumber: '',
        subtotal: 100,
        paymentMethod: 'CASH',
      })).toThrow('Sale number is required');
    });

    it('should reject negative subtotal', () => {
      expect(() => Sale.create({
        tenantId,
        saleNumber: 'SALE-003',
        subtotal: -100,
        paymentMethod: 'CASH',
      })).toThrow('Subtotal cannot be negative');
    });

    it('should reject negative tax amount', () => {
      expect(() => Sale.create({
        tenantId,
        saleNumber: 'SALE-004',
        subtotal: 100,
        taxAmount: -10,
        paymentMethod: 'CASH',
      })).toThrow('Tax amount cannot be negative');
    });

    it('should reject negative discount amount', () => {
      expect(() => Sale.create({
        tenantId,
        saleNumber: 'SALE-005',
        subtotal: 100,
        discountAmount: -5,
        paymentMethod: 'CASH',
      })).toThrow('Discount amount cannot be negative');
    });

    it('should reject discount larger than subtotal + tax', () => {
      expect(() => Sale.create({
        tenantId,
        saleNumber: 'SALE-006',
        subtotal: 100,
        taxAmount: 10,
        discountAmount: 120,
        paymentMethod: 'CASH',
      })).toThrow('Total amount cannot be negative');
    });
  });

  describe('update', () => {
    it('should update draft sale amounts', () => {
      const sale = Sale.create({
        tenantId,
        saleNumber: 'SALE-010',
        subtotal: 100,
        paymentMethod: 'CASH',
      });

      sale.update({
        subtotal: 150,
        taxAmount: 15,
        discountAmount: 10,
      });

      expect(sale.subtotal).toBe(150);
      expect(sale.taxAmount).toBe(15);
      expect(sale.discountAmount).toBe(10);
      expect(sale.totalAmount).toBe(155); // 150 + 15 - 10
    });

    it('should reject updating completed sale', () => {
      const sale = Sale.create({
        tenantId,
        saleNumber: 'SALE-011',
        subtotal: 100,
        paymentMethod: 'CASH',
      });

      sale.complete();

      expect(() => sale.update({subtotal: 200})).toThrow('Cannot update completed');
    });

    it('should reject negative amounts on update', () => {
      const sale = Sale.create({
        tenantId,
        saleNumber: 'SALE-012',
        subtotal: 100,
        paymentMethod: 'CASH',
      });

      expect(() => sale.update({subtotal: -50})).toThrow('Subtotal cannot be negative');
      expect(() => sale.update({taxAmount: -5})).toThrow('Tax amount cannot be negative');
      expect(() => sale.update({discountAmount: -10})).toThrow('Discount amount cannot be negative');
    });
  });

  describe('complete', () => {
    it('should complete draft sale', () => {
      const sale = Sale.create({
        tenantId,
        saleNumber: 'SALE-020',
        subtotal: 100,
        paymentMethod: 'CASH',
      });

      sale.complete();

      expect(sale.status).toBe('COMPLETED');
      expect(sale.paymentStatus).toBe('COMPLETED');
      expect(sale.isCompleted).toBe(true);
      expect(sale.completedAt).toBeDefined();
    });

    it('should reject completing non-draft sale', () => {
      const sale = Sale.create({
        tenantId,
        saleNumber: 'SALE-021',
        subtotal: 100,
        paymentMethod: 'CASH',
      });

      sale.complete();

      expect(() => sale.complete()).toThrow('Can only complete DRAFT sales');
    });
  });

  describe('cancel', () => {
    it('should cancel draft sale', () => {
      const sale = Sale.create({
        tenantId,
        saleNumber: 'SALE-030',
        subtotal: 100,
        paymentMethod: 'CASH',
      });

      sale.cancel();

      expect(sale.status).toBe('CANCELLED');
      expect(sale.paymentStatus).toBe('FAILED');
      expect(sale.isCancelled).toBe(true);
    });

    it('should reject cancelling completed sale', () => {
      const sale = Sale.create({
        tenantId,
        saleNumber: 'SALE-031',
        subtotal: 100,
        paymentMethod: 'CASH',
      });

      sale.complete();

      expect(() => sale.cancel()).toThrow('Cannot cancel completed sale');
    });
  });

  describe('refund', () => {
    it('should refund completed sale', () => {
      const sale = Sale.create({
        tenantId,
        saleNumber: 'SALE-040',
        subtotal: 100,
        paymentMethod: 'CASH',
      });

      sale.complete();
      sale.refund();

      expect(sale.status).toBe('REFUNDED');
      expect(sale.paymentStatus).toBe('REFUNDED');
      expect(sale.isRefunded).toBe(true);
    });

    it('should reject refunding non-completed sale', () => {
      const sale = Sale.create({
        tenantId,
        saleNumber: 'SALE-041',
        subtotal: 100,
        paymentMethod: 'CASH',
      });

      expect(() => sale.refund()).toThrow('Can only refund COMPLETED sales');
    });
  });

  describe('persistence round-trip', () => {
    it('should convert to and from persistence format correctly', () => {
      const sale = Sale.create({
        tenantId,
        saleNumber: 'SALE-050',
        customerId: 'customer-123',
        subtotal: 100,
        taxAmount: 10,
        discountAmount: 5,
        paymentMethod: 'CARD',
        cashierId: 'cashier-456',
      });

      sale.complete();

      const row = sale.toPersistence();
      const restored = Sale.fromPersistence(row);

      expect(restored.id).toBe(sale.id);
      expect(restored.tenantId).toBe(sale.tenantId);
      expect(restored.saleNumber).toBe(sale.saleNumber);
      expect(restored.customerId).toBe(sale.customerId);
      expect(restored.totalAmount).toBe(sale.totalAmount);
      expect(restored.status).toBe(sale.status);
      expect(restored.isCompleted).toBe(true);
    });
  });
});
