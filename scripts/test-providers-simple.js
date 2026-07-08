// SIMPLE VERSION - Copy this code into browser console
// Open: localhost:3000/dashboard/salary
// Press F12 -> Console tab -> Paste this code -> Press Enter

async function testProviders() {
  console.log('🚀 PROVIDER ACTIVATION TEST\n');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Get tenant ID
    console.log('📡 Step 1: Getting tenant ID...');
    const tenant = await fetch('/api/tenant/context').then(r => r.json());
    const tenantId = tenant.tenant_id || tenant.tenantId;
    
    if (!tenantId) {
      console.error('❌ ERROR: Could not get tenant ID');
      console.log('Response:', tenant);
      return;
    }
    console.log('✅ Tenant ID:', tenantId);
    
    // Step 2: Get first KTV from table (simplified - just get first row)
    console.log('\n📡 Step 2: Getting KTV from salary table...');
    const tableRows = document.querySelectorAll('table tbody tr');
    
    if (tableRows.length === 0) {
      console.error('❌ ERROR: No rows found in salary table');
      console.log('Make sure you are on /dashboard/salary page');
      return;
    }
    
    console.log(`✅ Found ${tableRows.length} KTVs in table`);
    
    // Manual employee ID input (safest method)
    console.log('\n📋 Step 3: Please provide Employee ID manually');
    console.log('Options:');
    console.log('1. Look at the table and find a KTV name');
    console.log('2. Click "Xem chi tiết" (Eye icon) button for that KTV');
    console.log('3. Copy the UUID from URL: /employees/[THIS-IS-THE-ID]/detail');
    console.log('4. Paste it below:\n');
    
    // Prompt user for employee ID
    const employeeId = prompt('Enter Employee ID (UUID from URL):');
    
    if (!employeeId || employeeId.length < 30) {
      console.error('❌ ERROR: Invalid Employee ID');
      console.log('Employee ID should be a UUID like: ccb36cf7-3e3c-4af8-a5a4-e83d78c0a2f7');
      return;
    }
    
    console.log('✅ Employee ID:', employeeId);
    
    // Step 4: Trigger recalculation
    console.log('\n' + '='.repeat(60));
    console.log('⏳ TRIGGERING SALARY RECALCULATION...');
    console.log('='.repeat(60));
    console.log('\n🔍 IMPORTANT: Check npm run dev terminal for logs!');
    console.log('   Looking for: [PHASE_2_ACTIVE] markers\n');
    
    const result = await fetch('/api/test/recalculate-salary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId,
        tenantId,
        month: '2026-06'
      })
    }).then(r => r.json());
    
    console.log('='.repeat(60));
    console.log('📊 RESULT');
    console.log('='.repeat(60) + '\n');
    
    if (result.success) {
      console.log('%c✅ SUCCESS!', 'color: green; font-weight: bold; font-size: 16px');
      console.log('\n💰 Salary Details:');
      console.log('   Employee:', result.data.employeeName);
      console.log('   Total Salary:', result.data.totalSalary.toLocaleString('vi-VN'), 'VNĐ');
      console.log('   Base Salary:', result.data.baseSalary.toLocaleString('vi-VN'), 'VNĐ');
      console.log('   Session Bonus:', result.data.sessionBonus.toLocaleString('vi-VN'), 'VNĐ');
      console.log('   KPI Bonus:', result.data.kpiBonus.toLocaleString('vi-VN'), 'VNĐ');
      console.log('   Rating Bonus:', result.data.ratingBonus.toLocaleString('vi-VN'), 'VNĐ');
      console.log('   Deductions:', result.data.deductions.toLocaleString('vi-VN'), 'VNĐ');
      console.log('   Status:', result.data.status);
      
      console.log('\n' + '='.repeat(60));
      console.log('🔍 VALIDATION CHECKLIST');
      console.log('='.repeat(60));
      console.log('\n1. Check npm run dev terminal NOW');
      console.log('2. Look for these 3 log markers:');
      console.log('   ✓ [PHASE_2_ACTIVE] Using provider-calculated KPI bonus: XXX');
      console.log('   ✓ [PHASE_2_ACTIVE] Using provider-calculated attendance deduction: -XXX');
      console.log('   ✓ [PHASE_2_ACTIVE] Using provider-calculated rating bonus: XXX');
      console.log('\n3. If you see [PROVIDER_INTEGRATION] instead:');
      console.log('   ❌ Providers are in comparison mode (flag is OFF)');
      console.log('   ✅ Set USE_CONFIG_PROVIDERS=true in .env.local and restart dev server');
      console.log('\n4. USE_CONFIG_PROVIDERS flag:', result.testInfo.useConfigProviders ? 'TRUE ✅' : 'FALSE ❌');
      
    } else {
      console.log('%c❌ FAILED!', 'color: red; font-weight: bold; font-size: 16px');
      console.error('\nError:', result.error);
      if (result.stack) {
        console.error('Stack:', result.stack);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('Test completed. Check terminal for provider logs!');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ EXCEPTION:', error);
    console.log('\nMake sure:');
    console.log('  1. Dev server is running (npm run dev)');
    console.log('  2. You are on /dashboard/salary page');
    console.log('  3. You are logged in');
  }
}

testProviders();
