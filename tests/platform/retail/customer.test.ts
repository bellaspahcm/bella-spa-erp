/**
 * Retail Customer Domain Tests
 * 
 * Behavioral verification of Customer entity correctness
 */

import { describe, it, expect } from 'vitest';
import { Customer } from '../../../src/platform/retail/domain/customer';

describe('Customer', () => {
  const tenantId = 'test-tenant-123';

  describe('create', () => {
    it('should create customer with email', () => {
      const customer = Customer.create({
        tenantId,
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(customer.tenantId).toBe(tenantId);
      expect(customer.email).toBe('john@example.com');
      expect(customer.firstName).toBe('John');
      expect(customer.lastName).toBe('Doe');
      expect(customer.fullName).toBe('John Doe');
      expect(customer.loyaltyPoints).toBe(0);
      expect(customer.loyaltyTier).toBe('BRONZE');
      expect(customer.status).toBe('ACTIVE');
      expect(customer.isActive).toBe(true);
    });

    it('should create customer with phone', () => {
      const customer = Customer.create({
        tenantId,
        phone: '+1234567890',
        firstName: 'Jane',
        lastName: 'Smith',
      });

      expect(customer.phone).toBe('+1234567890');
      expect(customer.email).toBeUndefined();
    });

    it('should create customer with both email and phone', () => {
      const customer = Customer.create({
        tenantId,
        email: 'contact@example.com',
        phone: '+1234567890',
        firstName: 'Contact',
        lastName: 'Person',
      });

      expect(customer.email).toBe('contact@example.com');
      expect(customer.phone).toBe('+1234567890');
    });

    it('should reject customer without email or phone', () => {
      expect(() => Customer.create({
        tenantId,
        firstName: 'No',
        lastName: 'Contact',
      })).toThrow('Customer must have either email or phone');
    });
  });

  describe('update', () => {
    it('should update customer details', () => {
      const customer = Customer.create({
        tenantId,
        email: 'old@example.com',
        firstName: 'Old',
        lastName: 'Name',
      });

      customer.update({
        email: 'new@example.com',
        firstName: 'New',
        lastName: 'Name',
      });

      expect(customer.email).toBe('new@example.com');
      expect(customer.firstName).toBe('New');
    });

    it('should allow partial updates without changing unspecified fields', () => {
      const customer = Customer.create({
        tenantId,
        email: 'test@example.com',
        phone: '+1234567890',
        firstName: 'Test',
        lastName: 'User',
      });

      // Updating firstName only should leave email/phone unchanged
      customer.update({ firstName: 'Updated' });
      
      expect(customer.firstName).toBe('Updated');
      expect(customer.email).toBe('test@example.com');
      expect(customer.phone).toBe('+1234567890');
    });
  });

  describe('loyalty points', () => {
    it('should add loyalty points and update tier', () => {
      const customer = Customer.create({
        tenantId,
        email: 'loyalty@example.com',
        firstName: 'Loyal',
        lastName: 'Customer',
      });

      expect(customer.loyaltyPoints).toBe(0);
      expect(customer.loyaltyTier).toBe('BRONZE');

      customer.addLoyaltyPoints(1500);

      expect(customer.loyaltyPoints).toBe(1500);
      expect(customer.loyaltyTier).toBe('SILVER');

      customer.addLoyaltyPoints(4000);

      expect(customer.loyaltyPoints).toBe(5500);
      expect(customer.loyaltyTier).toBe('GOLD');

      customer.addLoyaltyPoints(5000);

      expect(customer.loyaltyPoints).toBe(10500);
      expect(customer.loyaltyTier).toBe('PLATINUM');
    });

    it('should deduct loyalty points and downgrade tier', () => {
      const customer = Customer.create({
        tenantId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      });

      customer.addLoyaltyPoints(6000);
      expect(customer.loyaltyTier).toBe('GOLD');

      customer.deductLoyaltyPoints(2000);

      expect(customer.loyaltyPoints).toBe(4000);
      expect(customer.loyaltyTier).toBe('SILVER');
    });

    it('should reject adding zero or negative points', () => {
      const customer = Customer.create({
        tenantId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(() => customer.addLoyaltyPoints(0)).toThrow('Points to add must be positive');
      expect(() => customer.addLoyaltyPoints(-100)).toThrow('Points to add must be positive');
    });

    it('should reject deducting more points than available', () => {
      const customer = Customer.create({
        tenantId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      });

      customer.addLoyaltyPoints(100);

      expect(() => customer.deductLoyaltyPoints(200)).toThrow('Insufficient loyalty points');
    });
  });

  describe('block/unblock', () => {
    it('should block active customer', () => {
      const customer = Customer.create({
        tenantId,
        email: 'block@example.com',
        firstName: 'Block',
        lastName: 'Test',
      });

      customer.block('Fraudulent activity');

      expect(customer.status).toBe('BLOCKED');
      expect(customer.isBlocked).toBe(true);
      expect(customer.isActive).toBe(false);
    });

    it('should unblock blocked customer', () => {
      const customer = Customer.create({
        tenantId,
        email: 'unblock@example.com',
        firstName: 'Unblock',
        lastName: 'Test',
      });

      customer.block();
      customer.unblock();

      expect(customer.status).toBe('ACTIVE');
      expect(customer.isActive).toBe(true);
    });

    it('should reject unblocking non-blocked customer', () => {
      const customer = Customer.create({
        tenantId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
      });

      expect(() => customer.unblock()).toThrow('Customer is not blocked');
    });
  });

  describe('deactivate/reactivate', () => {
    it('should deactivate active customer', () => {
      const customer = Customer.create({
        tenantId,
        email: 'deactivate@example.com',
        firstName: 'Deactivate',
        lastName: 'Test',
      });

      customer.deactivate();

      expect(customer.status).toBe('INACTIVE');
    });

    it('should reactivate inactive customer', () => {
      const customer = Customer.create({
        tenantId,
        email: 'reactivate@example.com',
        firstName: 'Reactivate',
        lastName: 'Test',
      });

      customer.deactivate();
      customer.reactivate();

      expect(customer.status).toBe('ACTIVE');
    });

    it('should reject reactivating blocked customer', () => {
      const customer = Customer.create({
        tenantId,
        email: 'blocked@example.com',
        firstName: 'Blocked',
        lastName: 'User',
      });

      customer.block();

      expect(() => customer.reactivate()).toThrow('Cannot reactivate blocked customer - unblock first');
    });
  });

  describe('persistence round-trip', () => {
    it('should convert to and from persistence format correctly', () => {
      const customer = Customer.create({
        tenantId,
        email: 'persist@example.com',
        phone: '+1234567890',
        firstName: 'Persist',
        lastName: 'Test',
      });

      customer.addLoyaltyPoints(3000);

      const row = customer.toPersistence();
      const restored = Customer.fromPersistence(row);

      expect(restored.id).toBe(customer.id);
      expect(restored.tenantId).toBe(customer.tenantId);
      expect(restored.email).toBe(customer.email);
      expect(restored.phone).toBe(customer.phone);
      expect(restored.fullName).toBe(customer.fullName);
      expect(restored.loyaltyPoints).toBe(customer.loyaltyPoints);
      expect(restored.loyaltyTier).toBe(customer.loyaltyTier);
      expect(restored.status).toBe(customer.status);
    });
  });
});
