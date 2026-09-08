/**
 * Apply GRANT via Supabase Management API or direct SQL execution
 * Minimal approach: Just grant SELECT to anon
 */

const https = require('https');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  
  const text = readFileSync(filePath, 'utf8');
  const vars = {};
  
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    
    const key = match[1];
    const rawValue = match[2].trim();
    const value = (
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
    ) ? rawValue.slice(1, -1) : rawValue;
    
    vars[key] = value;
  }
  
  return vars;
}

async function main() {
  console.log('🔧 Bella Land E2E - Privilege Fix\n');
  console.log('Unable to apply migration automatically due to connection restrictions.');
  console.log('');
  console.log('=== MANUAL STEPS REQUIRED ===\n');
  console.log('Please execute the following SQL in Supabase Dashboard:\n');
  console.log('1. Go to: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/editor');
  console.log('2. Open SQL Editor');
  console.log('3. Execute this SQL:\n');
  console.log('─'.repeat(60));
  console.log(`-- Fix real_estate_projects privilege for E2E tests
GRANT SELECT ON TABLE public.real_estate_projects TO anon;

-- Verify (should return TRUE)
SELECT relrowsecurity 
FROM pg_class 
WHERE relname = 'real_estate_projects' 
  AND relnamespace = 'public'::regnamespace;`);
  console.log('─'.repeat(60));
  console.log('');
  console.log('4. Verify output shows: relrowsecurity = true');
  console.log('5. Rerun E2E tests: npm run e2e -- e2e/tests/bella-land-real-estate.spec.ts');
  console.log('');
  console.log('SECURITY NOTE:');
  console.log('- Only SELECT privilege granted (read-only for E2E)');
  console.log('- RLS policies remain enabled and enforce tenant isolation');
  console.log('- This matches canonical Bella pattern (bookings, customers)');
  console.log('');
  console.log('After applying, E2E tests should change from 15/17 to 17/17 PASS');
}

main();
