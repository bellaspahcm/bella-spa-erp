/**
 * Seed Preschool Test Tenant to Production Supabase
 * 
 * Creates:
 * - Tenant: "Preschool Test"
 * - User: admin@preschool-test.local / password: test
 * - Seed Data: 10 students, 5 guardians, 3 classrooms, enrollments, attendance
 * 
 * Usage: npx tsx scripts/seed-preschool-production.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('🚀 Starting Preschool Test Tenant Seed...\n');

  // Step 1: Create Tenant
  console.log('📦 Creating tenant...');
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      name: 'Preschool Test',
    })
    .select()
    .single();

  if (tenantError) {
    console.error('❌ Tenant creation failed:', tenantError);
    process.exit(1);
  }

  console.log(`✅ Tenant created: ${tenant.id}\n`);

  // Step 2: Create or Get Auth User
  console.log('👤 Creating admin user...');
  
  // Try to get existing user first
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  let authUser = existingUsers?.users?.find(u => u.email === 'admin@preschool-test.local');
  
  if (authUser) {
    console.log(`✅ User already exists: ${authUser.id}`);
  } else {
    const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
      email: 'admin@preschool-test.local',
      password: 'test',
      email_confirm: true,
      user_metadata: {
        name: 'Admin User',
        tenant_id: tenant.id,
      },
    });

    if (authError) {
      console.error('❌ User creation failed:', authError);
      process.exit(1);
    }
    
    authUser = newUser.user;
    console.log(`✅ User created: ${authUser.id}`);
  }
  
  console.log(`   Email: admin@preschool-test.local`);
  console.log(`   Password: test\n`);

  // Step 3: Create Person for Admin
  console.log('👤 Creating person record for admin...');
  const { data: adminPerson, error: personError } = await supabase
    .from('people_directory')
    .insert({
      tenant_id: tenant.id,
      user_id: authUser.id,
      person_type: 'employee',
      display_name: 'Admin User',
      is_active: true,
      metadata: {
        email: 'admin@preschool-test.local',
        phone: '+84901234567',
        role: 'admin',
      },
    })
    .select()
    .single();

  if (personError) {
    console.error('❌ Person creation failed:', personError);
    process.exit(1);
  }

  console.log(`✅ Person created: ${adminPerson.id}\n`);

  // Step 4: Create user record in users table (for legacy auth compatibility)
  console.log('👤 Creating user record in users table...');
  const { error: userRecordError } = await supabase.from('users').upsert({
    id: authUser.id,
    tenant_id: tenant.id,
    email: 'admin@preschool-test.local',
    full_name: 'Admin User',
    role: 'admin',
    status: 'active',
  });

  if (userRecordError) {
    console.error('❌ User record creation failed:', userRecordError);
    process.exit(1);
  }

  console.log('✅ User record created in users table\n');

  // Step 5: Auth user already linked via user_id in people_directory
  console.log('✅ Auth user linked to person via user_id\n');

  // Step 5: Create Classrooms
  console.log('🏫 Creating classrooms...');
  const classrooms = [
    { classroom_name: 'Lớp Chồi', capacity: 15, age_group: '2-3 tuổi' },
    { classroom_name: 'Lớp Lá', capacity: 20, age_group: '3-4 tuổi' },
    { classroom_name: 'Lớp Hoa', capacity: 20, age_group: '4-5 tuổi' },
  ];

  const { data: createdClassrooms, error: classroomError } = await supabase
    .from('preschool_classrooms')
    .insert(
      classrooms.map((c) => ({
        tenant_id: tenant.id,
        ...c,
        lead_teacher_id: null, // No teacher assigned yet (FK references users table)
        is_active: true,
      }))
    )
    .select();

  if (classroomError) {
    console.error('❌ Classroom creation failed:', classroomError);
    process.exit(1);
  }

  console.log(`✅ ${createdClassrooms!.length} classrooms created\n`);

  // Step 6: Create Guardians (in people_directory)
  console.log('👨‍👩‍👧 Creating guardians...');
  const guardians = [
    { name: 'Nguyễn Văn An', email: 'nguyen.van.an@example.com', phone: '+84901111111' },
    { name: 'Trần Thị Bình', email: 'tran.thi.binh@example.com', phone: '+84902222222' },
    { name: 'Lê Văn Cường', email: 'le.van.cuong@example.com', phone: '+84903333333' },
    { name: 'Phạm Thị Dung', email: 'pham.thi.dung@example.com', phone: '+84904444444' },
    { name: 'Hoàng Văn Em', email: 'hoang.van.em@example.com', phone: '+84905555555' },
  ];

  const { data: createdGuardians, error: guardianError } = await supabase
    .from('people_directory')
    .insert(
      guardians.map((g) => ({
        tenant_id: tenant.id,
        person_type: 'contractor', // Guardians as external contacts
        display_name: g.name,
        is_active: true,
        metadata: { email: g.email, phone: g.phone, role: 'guardian' },
      }))
    )
    .select();

  if (guardianError) {
    console.error('❌ Guardian creation failed:', guardianError);
    process.exit(1);
  }

  console.log(`✅ ${createdGuardians!.length} guardians created\n`);

  // Step 7: Create Students
  console.log('👶 Creating students...');
  const students = [
    { first_name: 'An', last_name: 'Nguyễn', dob: '2021-03-15', code: 'PS001', guardian_idx: 0 },
    { first_name: 'Bình', last_name: 'Trần', dob: '2021-05-20', code: 'PS002', guardian_idx: 1 },
    { first_name: 'Cường', last_name: 'Lê', dob: '2020-07-10', code: 'PS003', guardian_idx: 2 },
    { first_name: 'Dung', last_name: 'Phạm', dob: '2020-09-25', code: 'PS004', guardian_idx: 3 },
    { first_name: 'Em', last_name: 'Hoàng', dob: '2022-01-05', code: 'PS005', guardian_idx: 4 },
    { first_name: 'Phương', last_name: 'Nguyễn', dob: '2021-06-18', code: 'PS006', guardian_idx: 0 },
    { first_name: 'Giang', last_name: 'Trần', dob: '2020-11-30', code: 'PS007', guardian_idx: 1 },
    { first_name: 'Hà', last_name: 'Lê', dob: '2021-02-14', code: 'PS008', guardian_idx: 2 },
    { first_name: 'Hương', last_name: 'Phạm', dob: '2022-04-08', code: 'PS009', guardian_idx: 3 },
    { first_name: 'Khoa', last_name: 'Hoàng', dob: '2021-08-22', code: 'PS010', guardian_idx: 4 },
  ];

  const { data: createdStudents, error: studentError } = await supabase
    .from('preschool_students')
    .insert(
      students.map((s) => ({
        tenant_id: tenant.id,
        student_code: s.code,
        first_name: s.first_name,
        last_name: s.last_name,
        date_of_birth: s.dob,
        gender: 'other',
        enrollment_date: '2024-09-01',
        status: 'active',
      }))
    )
    .select();

  if (studentError) {
    console.error('❌ Student creation failed:', studentError);
    process.exit(1);
  }

  console.log(`✅ ${createdStudents!.length} students created\n`);

  // Step 7.5: Skip guardian linking (requires customers table, not people_directory)
  console.log('⚠️  Skipping guardian linking (schema requires customers table)\n');

  if (studentError) {
    console.error('❌ Student creation failed:', studentError);
    process.exit(1);
  }

  console.log(`✅ ${createdStudents!.length} students created\n`);

  // Step 8: Create Enrollments (distribute students across classrooms)
  console.log('📝 Creating enrollments...');
  const enrollments = createdStudents!.map((student, idx) => ({
    tenant_id: tenant.id,
    student_id: student.id,
    classroom_id: createdClassrooms![idx % 3].id, // Round-robin distribution
    enrollment_date: '2024-09-01',
    status: 'active',
  }));

  const { error: enrollmentError } = await supabase
    .from('preschool_enrollments')
    .insert(enrollments);

  if (enrollmentError) {
    console.error('❌ Enrollment creation failed:', enrollmentError);
    process.exit(1);
  }

  console.log(`✅ ${enrollments.length} enrollments created\n`);

  // Step 9: Create Attendance Records (today)
  console.log('📅 Creating attendance records for today...');
  const today = new Date().toISOString().split('T')[0];
  const attendanceRecords = createdStudents!.slice(0, 7).map((student, idx) => ({
    tenant_id: tenant.id,
    student_id: student.id,
    attendance_date: today,
    status: idx < 5 ? 'checked_in' : 'absent',
    check_in_time: idx < 5 ? `${today}T08:00:00Z` : null,
    check_out_time: idx < 5 && idx < 3 ? `${today}T16:30:00Z` : null,
    absence_reason: idx >= 5 ? 'Xin nghỉ ốm' : null,
    notes: idx >= 5 ? 'Phụ huynh xin nghỉ' : null,
  }));

  const { error: attendanceError } = await supabase
    .from('preschool_attendance')
    .insert(attendanceRecords);

  if (attendanceError) {
    console.error('❌ Attendance creation failed:', attendanceError);
    process.exit(1);
  }

  console.log(`✅ ${attendanceRecords.length} attendance records created\n`);

  // Summary
  console.log('✅ ========================================');
  console.log('✅  PRESCHOOL TEST TENANT SEED COMPLETE');
  console.log('✅ ========================================\n');
  console.log('📊 Summary:');
  console.log(`   Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`   Admin: admin@preschool-test.local / test`);
  console.log(`   Classrooms: ${createdClassrooms!.length}`);
  console.log(`   Guardians: ${createdGuardians!.length}`);
  console.log(`   Students: ${createdStudents!.length}`);
  console.log(`   Enrollments: ${enrollments.length}`);
  console.log(`   Attendance: ${attendanceRecords.length}\n`);
  console.log('🌐 Login URL: https://bella-spa-erp-git-p03-phase4b1-chan-55fba7-bella-spa-s-projects.vercel.app');
  console.log('📧 Email: admin@preschool-test.local');
  console.log('🔑 Password: test\n');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
