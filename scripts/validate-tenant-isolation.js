/**
 * VALIDATION: Tenant Isolation Guard
 * 
 * Ensures demo/test data is ONLY in Test Beauty Spa, never in Bella Spa (production)
 * 
 * Run before deployment to catch accidental pollution
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

// Tenant IDs
const BELLA_SPA_TENANT_ID = 'f2d7c8e0-8b3a-4f1e-9d6c-5a4b3c2d1e0f'; // Production - MUST BE CLEAN
const TEST_BEAUTY_SPA_TENANT_ID = '11111111-1111-1111-1111-111111111111'; // Test - Can have demo data

// Demo/Test patterns (should NEVER be in Bella Spa)
const FORBIDDEN_PATTERNS = [
  { field: 'full_name', pattern: 'KTV Demo%', description: 'Demo KTV names' },
  { field: 'full_name', pattern: '%Demo Facial%', description: 'Demo service names' },
  { field: 'full_name', pattern: '%Demo Body%', description: 'Demo service names' },
  { field: 'full_name', pattern: 'Employee High Balance%', description: 'Test user names' },
  { field: 'full_name', pattern: 'Gate2 Test%', description: 'Gate 2 test users' },
  { field: 'email', pattern: '%@test.bellaspa.local', description: 'Test email addresses' },
  { field: 'email', pattern: '%gate2-%', description: 'Gate 2 email patterns' },
];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log('🛡️  Tenant Isolation Validation\n');
  console.log('Checking: Bella Spa (production) is clean from demo data\n');
  
  let hasViolations = false;
  let totalViolations = 0;
  
  // Check each forbidden pattern
  for (const { field, pattern, description } of FORBIDDEN_PATTERNS) {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, created_at')
      .eq('tenant_id', BELLA_SPA_TENANT_ID)
      .like(field, pattern);
    
    if (error) {
      console.error(`❌ Query failed for pattern "${pattern}":`, error.message);
      hasViolations = true;
      continue;
    }
    
    if (data && data.length > 0) {
      hasViolations = true;
      totalViolations += data.length;
      
      console.log(`❌ VIOLATION: ${description}`);
      console.log(`   Pattern: ${field} LIKE "${pattern}"`);
      console.log(`   Found: ${data.length} users in Bella Spa (FORBIDDEN)\n`);
      
      data.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.full_name} (${user.email})`);
        console.log(`      ID: ${user.id}`);
        console.log(`      Created: ${new Date(user.created_at).toLocaleString('vi-VN')}\n`);
      });
    } else {
      console.log(`✅ ${description}: Clean`);
    }
  }
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (hasViolations) {
    console.log('❌ VALIDATION FAILED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log(`Found ${totalViolations} demo/test users in Bella Spa (production)`);
    console.log('');
    console.log('🚨 CRITICAL: Demo data leaked into production tenant!');
    console.log('');
    console.log('To fix:');
    console.log('  1. Run cleanup script:');
    console.log('     node scripts/cleanup-demo-ktvs-from-bella-spa.js');
    console.log('');
    console.log('  2. Verify cleanup:');
    console.log('     node scripts/validate-tenant-isolation.js');
    console.log('');
    console.log('  3. Update seeding scripts to use Test Beauty Spa only');
    console.log('');
    process.exit(1);
  } else {
    console.log('✅ VALIDATION PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Bella Spa (production) is clean ✨');
    console.log('  - No demo users found');
    console.log('  - No test email patterns found');
    console.log('  - Tenant isolation intact');
    console.log('');
    console.log('✅ Safe to deploy');
    console.log('');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});

