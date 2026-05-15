/**
 * Fix Packages Table Permissions
 * 
 * Lỗi: "permission denied for table packages" - bảng packages tồn tại nhưng
 * thiếu GRANT cho role anon/authenticated và RLS đang enabled.
 * 
 * Chạy script này: node scratch/fix_packages_permissions.js
 * Yêu cầu: SUPABASE_SERVICE_ROLE_KEY trong .env.local
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

// Use service role if available, otherwise anon
const key = SERVICE_ROLE_KEY || ANON_KEY;
const supabase = createClient(SUPABASE_URL, key);

async function run() {
  console.log('=== Bella Spa: Fix Packages Table ===');
  console.log('Using key type:', SERVICE_ROLE_KEY ? 'SERVICE_ROLE' : 'ANON (limited)');
  console.log('URL:', SUPABASE_URL);
  
  // Test 1: Check table existence
  console.log('\n1. Checking packages table...');
  const { data: testData, error: testError } = await supabase
    .from('packages')
    .select('id, name')
    .limit(3);
  
  if (testError) {
    console.log('   ERROR:', testError.code, testError.message);
    console.log('   Hint:', testError.hint);
    
    if (testError.code === '42P01') {
      console.log('\n   => Bảng packages KHÔNG TỒN TẠI. Cần chạy migration SQL thủ công.');
      console.log('   => Vào Supabase Dashboard > SQL Editor và chạy file:');
      console.log('      supabase/migrations/20260515040000_create_packages_table.sql');
    } else if (testError.code === '42501') {
      console.log('\n   => Bảng packages TỒN TẠI nhưng bị từ chối quyền truy cập.');
      console.log('   => Cần Service Role Key để cấp quyền.');
      console.log('   => Vào Supabase Dashboard > SQL Editor và chạy:');
      console.log('      GRANT ALL ON public.packages TO anon, authenticated;');
      console.log('      ALTER TABLE public.packages DISABLE ROW LEVEL SECURITY;');
    }
  } else {
    console.log('   OK - Packages table accessible! Rows found:', testData.length);
    testData.forEach(p => console.log('     -', p.name));
    
    // Test 2: Try insert
    console.log('\n2. Testing insert...');
    const { data: insertData, error: insertError } = await supabase
      .from('packages')
      .insert([{
        name: 'TEST - Xóa sau khi kiểm tra',
        price: 100000,
        duration: '60 phút/buổi',
        total_sessions: 5,
        details: ['Test detail'],
        offer: 'Test offer',
        ktv_commission: 50000,
        status: 'inactive'
      }])
      .select()
      .single();
    
    if (insertError) {
      console.log('   INSERT ERROR:', insertError.code, insertError.message);
    } else {
      console.log('   INSERT OK - ID:', insertData.id);
      
      // Cleanup test record
      await supabase.from('packages').delete().eq('id', insertData.id);
      console.log('   Cleanup done - test record deleted');
    }
  }
  
  console.log('\n=== DONE ===');
  console.log('\nNếu vẫn có lỗi, cần chạy SQL sau trong Supabase Dashboard > SQL Editor:');
  console.log('---');
  console.log('GRANT ALL ON public.packages TO anon, authenticated;');
  console.log('ALTER TABLE public.packages DISABLE ROW LEVEL SECURITY;');
  console.log('---');
}

run().catch(console.error);
