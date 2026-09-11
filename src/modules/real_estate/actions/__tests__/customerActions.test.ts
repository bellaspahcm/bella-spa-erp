/**
 * Bella Land - Customer Actions Integration Tests
 * 
 * Tests customer CRUD operations with real database
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createCustomerAction, fetchCustomersAction, updateCustomerAction, deleteCustomerAction } from '../customerActions';

// Note: These tests require:
// 1. Valid Supabase credentials in .env.local
// 2. Authenticated user session
// 3. Database with re_customers table

describe('Customer Actions - Integration Tests', () => {
  let createdCustomerId: string | undefined;

  it('should create a new customer', async () => {
    const result = await createCustomerAction({
      name: 'Test Customer Integration',
      phone: '0901234567',
      email: 'test@example.com'
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.name).toBe('Test Customer Integration');
    expect(result.data?.phone).toBe('0901234567');
    expect(result.data?.email).toBe('test@example.com');
    expect(result.data?.tenant_id).toBeDefined();

    createdCustomerId = result.data?.id;
    console.log('✅ Customer created:', createdCustomerId);
  });

  it('should fetch all customers', async () => {
    const result = await fetchCustomersAction();

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data || []).length).toBeGreaterThan(0);
    
    console.log(`✅ Fetched ${(result.data || []).length} customers`);
  });

  it('should update customer information', async () => {
    if (!createdCustomerId) {
      console.log('⏭️  Skipping update test (no customer created)');
      return;
    }

    const result = await updateCustomerAction(createdCustomerId, {
      name: 'Test Customer Updated',
      email: 'updated@example.com'
    });

    expect(result.success).toBe(true);
    expect(result.data?.name).toBe('Test Customer Updated');
    expect(result.data?.email).toBe('updated@example.com');
    
    console.log('✅ Customer updated');
  });

  it('should soft delete customer', async () => {
    if (!createdCustomerId) {
      console.log('⏭️  Skipping delete test (no customer created)');
      return;
    }

    const result = await deleteCustomerAction(createdCustomerId);

    expect(result.success).toBe(true);
    expect(result.data?.deleted_at).toBeDefined();
    
    console.log('✅ Customer soft deleted');
  });

  it('should reject duplicate phone number', async () => {
    // Create first customer
    const first = await createCustomerAction({
      name: 'First Customer',
      phone: '0909999999'
    });

    if (!first.success) {
      console.log('⚠️  First customer creation failed, skipping duplicate test');
      return;
    }

    // Try to create duplicate
    const duplicate = await createCustomerAction({
      name: 'Duplicate Customer',
      phone: '0909999999' // Same phone
    });

    expect(duplicate.success).toBe(false);
    expect(duplicate.error).toMatch(/phone.*already exists|unique/i);

    // Cleanup
    if (first.data?.id) {
      await deleteCustomerAction(first.data.id);
    }
    
    console.log('✅ Duplicate phone validation works');
  });

  it('should reject empty name', async () => {
    const result = await createCustomerAction({
      name: '',
      phone: '0901111111'
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/name.*required/i);
    
    console.log('✅ Empty name validation works');
  });

  it('should reject empty phone', async () => {
    const result = await createCustomerAction({
      name: 'Valid Name',
      phone: ''
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/phone.*required/i);
    
    console.log('✅ Empty phone validation works');
  });
});

/**
 * Usage:
 * 
 * Run integration tests (requires auth):
 * npm run test:integration -- customerActions.test
 * 
 * Or manual verification via script:
 * npx tsx -e "
 *   import { createCustomerAction } from './src/modules/real_estate/actions/customerActions';
 *   const result = await createCustomerAction({ name: 'Test', phone: '0901234567' });
 *   console.log(result);
 * "
 */
