#!/usr/bin/env node

/**
 * Test E7.1 Frozen Boundary Enforcement
 * 
 * Verifies that enforcement mechanism correctly:
 * 1. Blocks frozen artifact modifications
 * 2. Allows non-frozen modifications
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing E7.1 Frozen Boundary Enforcement\n');

const testCases = [
  {
    name: 'Test 1: Block frozen domain file',
    toolCall: {
      tool: 'str_replace',
      parameters: {
        path: 'src/platform/logistics/domain/inventory.domain.ts'
      }
    },
    expectBlock: true
  },
  {
    name: 'Test 2: Block frozen contract file',
    toolCall: {
      tool: 'fs_write',
      parameters: {
        path: 'src/platform/logistics/contracts/item.contract.ts'
      }
    },
    expectBlock: true
  },
  {
    name: 'Test 3: Block frozen test file',
    toolCall: {
      tool: 'fs_append',
      parameters: {
        path: 'src/platform/logistics/domain/__tests__/inventory.domain.test.ts'
      }
    },
    expectBlock: true
  },
  {
    name: 'Test 4: Allow non-frozen E7.2 file',
    toolCall: {
      tool: 'str_replace',
      parameters: {
        path: 'src/platform/logistics/domain/__tests__/inventory-operations.test.ts'
      }
    },
    expectBlock: false
  },
  {
    name: 'Test 5: Allow new E7.2 domain file',
    toolCall: {
      tool: 'fs_write',
      parameters: {
        path: 'src/platform/logistics/domain/inventory-coordination.domain.ts'
      }
    },
    expectBlock: false
  }
];

let passed = 0;
let failed = 0;

for (const test of testCases) {
  process.stdout.write(`${test.name}... `);
  
  try {
    const input = JSON.stringify(test.toolCall);
    const result = execSync('node scripts/hooks/check-frozen-boundary.js', {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Exit 0 = allowed
    if (test.expectBlock) {
      console.log('❌ FAIL (expected block, got allow)');
      failed++;
    } else {
      console.log('✅ PASS (allowed as expected)');
      passed++;
    }
    
  } catch (error) {
    // Non-zero exit = blocked
    if (test.expectBlock) {
      console.log('✅ PASS (blocked as expected)');
      passed++;
    } else {
      console.log('❌ FAIL (expected allow, got block)');
      failed++;
    }
  }
}

console.log(`\n📊 Results: ${passed}/${testCases.length} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log('❌ Frozen boundary enforcement FAILED');
  process.exit(1);
} else {
  console.log('✅ Frozen boundary enforcement PASSED');
  process.exit(0);
}
