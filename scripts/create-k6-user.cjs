const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Read .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (match) {
    let value = match[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    env[match[1].trim()] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function run() {
  const email = 'admin@bellaspa.com.vn';
  const password = 'password123';
  const tenantId = '0e66365b-42b0-420e-acca-f7d7692e125e'; // Bella Spa Headquarter

  console.log(`Checking if auth user ${email} exists...`);
  
  // List users to find by email
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.error('Error listing users:', listError);
    process.exit(1);
  }

  let authUser = users.find(u => u.email === email);
  let authUserId;

  if (authUser) {
    console.log(`Auth user found with ID: ${authUser.id}. Updating credentials...`);
    authUserId = authUser.id;
    const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, {
      password: password,
      email_confirm: true
    });
    if (updateError) {
      console.error('Error updating user credentials:', updateError);
      process.exit(1);
    }
    console.log('Password updated successfully.');
  } else {
    console.log(`Auth user not found. Creating user ${email}...`);
    const { data: { user }, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'K6 Admin Test' }
    });
    if (createError) {
      console.error('Error creating user:', createError);
      process.exit(1);
    }
    authUser = user;
    authUserId = user.id;
    console.log(`Created auth user with ID: ${authUserId}`);
  }

  // Ensure row in public.users exists
  console.log(`Ensuring user profile exists in public.users...`);
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUserId)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('Error checking profile:', profileError);
    process.exit(1);
  }

  if (profile) {
    console.log(`Profile already exists. Updating details...`);
    const { error: updateProfileError } = await supabase
      .from('users')
      .update({
        email,
        full_name: 'K6 Admin Test',
        role: 'admin',
        tenant_id: tenantId,
        status: 'active'
      })
      .eq('id', authUserId);
    if (updateProfileError) {
      console.error('Error updating profile:', updateProfileError);
      process.exit(1);
    }
    console.log('Profile updated successfully.');
  } else {
    console.log(`Profile does not exist. Creating profile...`);
    const { error: insertProfileError } = await supabase
      .from('users')
      .insert({
        id: authUserId,
        email,
        full_name: 'K6 Admin Test',
        role: 'admin',
        tenant_id: tenantId,
        status: 'active'
      });
    if (insertProfileError) {
      console.error('Error creating profile:', insertProfileError);
      process.exit(1);
    }
    console.log('Profile created successfully.');
  }

  console.log('All set! User admin@bellaspa.com.vn is ready for K6 tests.');
}

run().catch(console.error);
