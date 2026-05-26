// scripts/db-reset.js
// Chạy: node scripts/db-reset.js
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false }
});

const HQ_TENANT_ID = '0e66365b-42b0-420e-acca-f7d7692e125e';
const HQ_ADMIN_EMAIL = 'admin@bellaspa.vn';

const tables = [
  'journal_lines',
  'journal_entries',
  'accounting_periods',
  'accounting_outbox',
  'ai_agent_logs',
  'audit_logs',
  'session_reviews',
  'session_logs',
  'shifts',
  'revenue',
  'expenses',
  'chat_messages',
  'chat_threads',
  'bookings',
  'membership_records',
  'customers',
  'attendance',
  'salary_records',
  'kpi_records',
  'staff_leaves',
  'ktv_schedule',
  'inventory_logs',
  'package_materials',
  'inventory_items',
  'inventory_transfer_orders',
  'inter_branch_clearing_records',
  'franchise_royalty_invoices',
  'subscription_invoices',
  'app_notifications'
];

async function getCounts() {
  const counts = {};
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    counts[table] = error ? 'Lỗi' : count;
  }
  
  // Count packages, tenants, users
  const { count: pkgCount } = await supabase.from('packages').select('*', { count: 'exact', head: true });
  counts['packages'] = pkgCount;
  
  const { count: tenantCount } = await supabase.from('tenants').select('*', { count: 'exact', head: true });
  counts['tenants'] = tenantCount;

  const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });
  counts['users'] = userCount;

  return counts;
}

async function run() {
  console.log('--- KHỞI ĐỘNG TIẾN TRÌNH RESET DATABASE CHO PRODUCTION ---');
  
  try {
    // 1. Đếm số lượng trước khi reset
    console.log('Đang thống kê dữ liệu hiện tại...');
    const beforeCounts = await getCounts();

    // 2. Xóa sạch tài khoản auth.users của KTV và chi nhánh test
    console.log('\n--- 1. BẮT ĐẦU XÓA TÀI KHOẢN TRONG SUPABASE AUTH ---');
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) {
      throw new Error(`Không thể lấy danh sách auth users: ${authError.message}`);
    }

    console.log(`Tìm thấy ${users.length} tài khoản trong hệ thống xác thực.`);
    for (const user of users) {
      if (user.email === HQ_ADMIN_EMAIL) {
        console.log(`👉 GIỮ LẠI Admin Trụ sở: ${user.email} (ID: ${user.id})`);
        continue;
      }

      console.log(`❌ Đang xóa tài khoản Auth: ${user.email} (ID: ${user.id})...`);
      const { error: delErr } = await supabase.auth.admin.deleteUser(user.id);
      if (delErr) {
        console.error(` ❌ Lỗi khi xóa auth user ${user.email}:`, delErr.message);
      } else {
        console.log(`  ✓ Đã xóa auth user: ${user.email}`);
      }
    }

    // 3. Xóa dữ liệu các bảng nghiệp vụ theo trình tự khóa ngoại
    console.log('\n--- 2. BẮT ĐẦU XÓA DỮ LIỆU CÁC BẢNG GIAO DỊCH NGHIỆP VỤ ---');
    for (const table of tables) {
      console.log(`🧹 Đang làm sạch bảng: ${table}...`);
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Xóa tất cả bản ghi có ID hợp lệ
      
      if (error) {
        throw new Error(`Lỗi khi làm sạch bảng ${table}: ${error.message}`);
      }
    }
    console.log('✓ Hoàn tất làm sạch các bảng giao dịch nghiệp vụ.');

    // 4. Xóa gói dịch vụ của các chi nhánh con
    console.log('\n--- 3. LỌC GÓI DỊCH VỤ MASTER DATA ---');
    console.log('🧹 Đang xóa các gói dịch vụ thuộc về chi nhánh con...');
    const { error: pkgErr } = await supabase
      .from('packages')
      .delete()
      .neq('tenant_id', HQ_TENANT_ID);
    
    if (pkgErr) {
      throw new Error(`Lỗi khi xóa gói dịch vụ chi nhánh con: ${pkgErr.message}`);
    }
    console.log('✓ Hoàn tất giữ lại 12 gói dịch vụ chuẩn của Trụ sở.');

    // 5. Xóa thông tin nhân viên test trong public.users
    console.log('\n--- 4. LỌC THÔNG TIN NHÂN SỰ ---');
    console.log('🧹 Đang xóa nhân sự chi nhánh con...');
    const { error: userErr1 } = await supabase
      .from('users')
      .delete()
      .neq('tenant_id', HQ_TENANT_ID);
    
    if (userErr1) {
      throw new Error(`Lỗi khi xóa nhân sự chi nhánh con: ${userErr1.message}`);
    }

    console.log('🧹 Đang xóa KTV/KTV Lead thuộc Trụ sở...');
    const { error: userErr2 } = await supabase
      .from('users')
      .delete()
      .eq('tenant_id', HQ_TENANT_ID)
      .in('role', ['ktv', 'ktv_lead']);
    
    if (userErr2) {
      throw new Error(`Lỗi khi xóa KTV Trụ sở: ${userErr2.message}`);
    }
    console.log('✓ Hoàn tất lọc nhân sự, chỉ giữ lại Admin Trụ sở.');

    // 6. Xóa chi nhánh con trong tenants
    console.log('\n--- 5. LỌC DANH SÁCH CHI NHÁNH (TENANTS) ---');
    console.log('🧹 Đang xóa chi nhánh nhượng quyền test...');
    const { error: tenantErr } = await supabase
      .from('tenants')
      .delete()
      .neq('id', HQ_TENANT_ID);
    
    if (tenantErr) {
      throw new Error(`Lỗi khi xóa chi nhánh con: ${tenantErr.message}`);
    }
    console.log('✓ Hoàn tất dọn dẹp chi nhánh con, chỉ giữ lại Bella Spa Headquarter.');

    // 7. Thống kê số lượng sau khi reset
    console.log('\n--- 6. XÁC THỰC SỐ LƯỢNG BẢN GHI SAU KHI RESET ---');
    const afterCounts = await getCounts();

    console.log('\nBẢNG ĐỐI CHIẾU SỐ LƯỢNG BẢN GHI (BEFORE vs AFTER):');
    console.log('----------------------------------------------------');
    console.log('| Tên Bảng                       | Trước | Sau     |');
    console.log('----------------------------------------------------');
    for (const table of [...tables, 'packages', 'tenants', 'users']) {
      const paddedTable = table.padEnd(30, ' ');
      const paddedBefore = String(beforeCounts[table]).padStart(5, ' ');
      const paddedAfter = String(afterCounts[table]).padStart(7, ' ');
      console.log(`| ${paddedTable} | ${paddedBefore} | ${paddedAfter} |`);
    }
    console.log('----------------------------------------------------');

    console.log('\n🎉 THÀNH CÔNG: Đã reset sạch sẽ dữ liệu cho Production!');

  } catch (err) {
    console.error('\n❌ TIẾN TRÌNH THẤT BẠI:', err.message);
    process.exit(1);
  }
}

run();
