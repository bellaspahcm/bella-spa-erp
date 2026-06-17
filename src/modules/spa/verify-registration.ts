/**
 * Verification Script for Spa Module Registration
 * 
 * This script verifies that the SpaModuleAdapter is correctly registered
 * with the module registry and can be retrieved by core services.
 * 
 * @remarks
 * Run this script to verify Task 14.4 completion:
 * ```bash
 * npx tsx src/modules/spa/verify-registration.ts
 * ```
 * 
 * **Expected Output**:
 * ```
 * [ModuleRegistry] Registered adapter: Bella Spa & Babycare (spa)
 * ✓ Spa module registered successfully
 * ✓ Adapter retrieved via get('spa')
 * ✓ Adapter retrieved via getRequired('spa')
 * ✓ Registry has spa module
 * ✓ Module ID: spa
 * ✓ Module Name: Bella Spa & Babycare
 * ✓ All verification checks passed!
 * ```
 */

import { moduleRegistry } from '@/core/adapters/registry';
import { registerSpaModule } from './register';

function verify() {
  console.log('\n=== Spa Module Registration Verification ===\n');

  try {
    // Step 1: Register the spa module
    console.log('Step 1: Registering spa module...');
    registerSpaModule();
    console.log('✓ Spa module registered successfully\n');

    // Step 2: Retrieve adapter using get() (graceful)
    console.log('Step 2: Retrieving adapter via get()...');
    const adapter1 = moduleRegistry.get('spa');
    if (!adapter1) {
      throw new Error('Adapter not found via get()');
    }
    console.log('✓ Adapter retrieved via get(\'spa\')\n');

    // Step 3: Retrieve adapter using getRequired() (strict)
    console.log('Step 3: Retrieving adapter via getRequired()...');
    const adapter2 = moduleRegistry.getRequired('spa');
    console.log('✓ Adapter retrieved via getRequired(\'spa\')\n');

    // Step 4: Check if adapter is registered
    console.log('Step 4: Checking if spa module is registered...');
    const hasSpa = moduleRegistry.has('spa');
    if (!hasSpa) {
      throw new Error('Registry reports spa module not registered');
    }
    console.log('✓ Registry has spa module\n');

    // Step 5: Verify adapter properties
    console.log('Step 5: Verifying adapter properties...');
    if (adapter2.moduleId !== 'spa') {
      throw new Error(`Expected moduleId 'spa', got '${adapter2.moduleId}'`);
    }
    console.log(`✓ Module ID: ${adapter2.moduleId}`);

    if (adapter2.moduleName !== 'Bella Spa & Babycare') {
      throw new Error(`Expected moduleName 'Bella Spa & Babycare', got '${adapter2.moduleName}'`);
    }
    console.log(`✓ Module Name: ${adapter2.moduleName}\n`);

    // Step 6: Verify adapter methods exist
    console.log('Step 6: Verifying adapter methods...');
    const requiredMethods = [
      'transformServiceItem',
      'transformBookingOrder',
      'validateBookingRules',
      'calculatePricing',
      'onBookingCompleted',
      'getModuleWidgets',
    ];

    for (const method of requiredMethods) {
      if (typeof (adapter2 as any)[method] !== 'function') {
        throw new Error(`Method ${method} is not a function`);
      }
      console.log(`  ✓ ${method}()`);
    }
    console.log('');

    // Step 7: Test duplicate registration prevention
    console.log('Step 7: Testing duplicate registration prevention...');
    try {
      registerSpaModule();
      throw new Error('Should have thrown DuplicateModuleError');
    } catch (error: any) {
      if (error.name === 'DuplicateModuleError') {
        console.log('✓ Duplicate registration correctly prevented\n');
      } else {
        throw error;
      }
    }

    // Success
    console.log('=== ✓ All verification checks passed! ===\n');
    process.exit(0);
  } catch (error) {
    console.error('\n=== ✗ Verification failed ===');
    console.error(error);
    process.exit(1);
  }
}

// Run verification
verify();
