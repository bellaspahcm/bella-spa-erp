#!/usr/bin/env tsx
/**
 * Test single scope to verify deterministic behavior
 */

import { execSync } from 'child_process';

const tsconfigPath = process.argv[2] || 'tsconfig.app-routes-workforce-management.json';

console.log(`🔍 Testing scope: ${tsconfigPath}\n`);
console.log('Running tsc with --noEmit...\n');

try {
  const output = execSync(
    `npx tsc --project ${tsconfigPath} --noEmit`,
    {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 120000
    }
  );
  
  console.log('✅ PASS - No diagnostics\n');
  console.log(output || '(no output)');
} catch (error: any) {
  const output = error.stdout || error.stderr || '';
  const diagnosticCount = (output.match(/error TS\d+:/g) || []).length;
  
  console.log(`⚠️  HAS_DIAGNOSTICS - ${diagnosticCount} errors found\n`);
  console.log('First 30 lines of output:\n');
  console.log(output.split('\n').slice(0, 30).join('\n'));
}
