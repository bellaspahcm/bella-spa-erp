const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');

const DEMO_MARKER = 'STUDENT_TRAINING_DEMO_TEST';
const EMAIL_SUFFIX_DOMAIN = '@bellaspa.test';

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const [key, ...valueParts] = line.split('=');
    const rawValue = valueParts.join('=').trim();
    env[key.trim()] = rawValue.replace(/^['"]|['"]$/g, '');
  }
  return env;
}

function getEnv() {
  return {
    ...readEnvFile('.env.local'),
    ...process.env,
  };
}

function getSupabaseCredentials(env = getEnv()) {
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  const missing = [];

  if (!supabaseUrl) missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceRoleKey) missing.push('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY');

  return {
    supabaseUrl,
    serviceRoleKey,
    missing,
    isConfigured: missing.length === 0,
  };
}

function createSupabaseAdmin(credentials = getSupabaseCredentials()) {
  if (!credentials.isConfigured) {
    throw new Error(`Missing Supabase admin config: ${credentials.missing.join(', ')}.`);
  }
  return createClient(credentials.supabaseUrl, credentials.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findAuthUserByEmail(client, email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`[auth.listUsers] ${error.message}`);
    const found = data?.users?.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (!data?.users || data.users.length < 1000) break;
  }
  return null;
}

async function getDemoStudentStatus(client) {
  // Query users from public.users with student role and email containing student.demo
  const { data: users, error } = await client
    .from('users')
    .select('id, email, full_name, role, tenant_id')
    .eq('role', 'student')
    .like('email', '%student.demo.%');

  if (error) throw new Error(`[users.select] ${error.message}`);

  const demoStudents = [];
  const details = {};

  for (const user of users || []) {
    // Check auth metadata or email format
    const authUser = await findAuthUserByEmail(client, user.email);
    const hasMarker = authUser?.user_metadata?.demo_marker === DEMO_MARKER || user.email.includes('student.demo.');
    if (hasMarker) {
      demoStudents.push(user);
      
      // Count dependent records
      const tables = ['students', 'student_lesson_progress'];
      const counts = {};
      for (const table of tables) {
        const { count, error: countErr } = await client
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id); // for students/student_lesson_progress
        
        // Wait, the table 'students' has 'user_id'. Let's verify 'student_lesson_progress' table structure
        // 'student_lesson_progress' uses 'student_id' (which is the id from students enrollment row) or 'user_id'?
        // In training-actions.ts, it was: student_id: enrollmentId. Let's count students row first
        counts[table] = countErr ? 0 : (count || 0);
      }
      details[user.email] = {
        fullName: user.full_name,
        userId: user.id,
        tenantId: user.tenant_id,
        enrollments: counts['students']
      };
    }
  }

  return {
    count: demoStudents.length,
    students: demoStudents,
    details
  };
}

async function cleanupTrainingDemoStudents(client, options = {}) {
  if (!options.confirm) {
    throw new Error('Cleanup requires --confirm to prevent accidental data deletion.');
  }

  const { students } = await getDemoStudentStatus(client);
  if (students.length === 0) {
    console.log('No training demo student accounts found.');
    return { deletedCount: 0 };
  }

  console.log(`Found ${students.length} training demo student accounts to delete...`);

  let deletedCount = 0;
  for (const student of students) {
    // 1. Get enrollments for this student user to clean up lesson progress
    const { data: enrollments } = await client
      .from('students')
      .select('id')
      .eq('user_id', student.id);

    const enrollmentIds = (enrollments || []).map(e => e.id);

    if (enrollmentIds.length > 0) {
      // 1.1 Delete student_lesson_progress
      const { error: progressErr } = await client
        .from('student_lesson_progress')
        .delete()
        .in('student_id', enrollmentIds);
      if (progressErr) console.error(`[student_lesson_progress.delete] Error: ${progressErr.message}`);
    }

    // 2. Delete students enrollments
    const { error: enrollmentErr } = await client
      .from('students')
      .delete()
      .eq('user_id', student.id);
    if (enrollmentErr) console.error(`[students.delete] Error: ${enrollmentErr.message}`);

    // 3. Delete from public.users
    const { error: userErr } = await client
      .from('users')
      .delete()
      .eq('id', student.id);
    if (userErr) console.error(`[users.delete] Error: ${userErr.message}`);

    // 4. Delete from auth.users
    const authUser = await findAuthUserByEmail(client, student.email);
    if (authUser?.id) {
      const { error: authErr } = await client.auth.admin.deleteUser(authUser.id);
      if (authErr) {
        console.error(`[auth.deleteUser ${student.email}] Error: ${authErr.message}`);
      } else {
        console.log(`Deleted auth user for ${student.email}`);
      }
    }

    deletedCount++;
  }

  return { deletedCount };
}

async function main(argv = process.argv.slice(2)) {
  const command = argv[0] || 'status';
  const client = createSupabaseAdmin();

  if (command === 'status') {
    const status = await getDemoStudentStatus(client);
    console.log(`=== Training Demo Students Status ===`);
    console.log(`Total demo student users: ${status.count}`);
    if (status.count > 0) {
      console.log('List of demo accounts:');
      for (const student of status.students) {
        const detail = status.details[student.email];
        console.log(`- ${student.full_name} (${student.email}) | ID: ${student.id} | Tenant: ${student.tenant_id} | Enrollments: ${detail.enrollments}`);
      }
      console.log('\nTo clean up these accounts, run:\n  node scripts/cleanup-training-demo.cjs cleanup --confirm');
    }
    return;
  }

  if (command === 'cleanup') {
    const result = await cleanupTrainingDemoStudents(client, { confirm: argv.includes('--confirm') });
    console.log(`\nCleanup completed: Deleted ${result.deletedCount} demo student accounts.`);
    return;
  }

  throw new Error(`Unknown command "${command}". Use: status | cleanup --confirm`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  DEMO_MARKER,
  cleanupTrainingDemoStudents,
  getDemoStudentStatus
};
