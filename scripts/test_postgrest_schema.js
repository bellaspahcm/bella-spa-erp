/**
 * Test PostgREST Schema Cache
 * 
 * This script directly calls PostgREST API to check if it can see
 * the courses and enrollments tables.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function testPostgRESTSchema() {
  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable not set');
    console.error('   Run: export SUPABASE_SERVICE_ROLE_KEY=your_key');
    process.exit(1);
  }
  
  console.log('🔍 Testing PostgREST Schema Cache...\n');
  
  // Test 1: Query courses table (should fail if schema cache not refreshed)
  console.log('1. Testing courses table visibility...');
  try {
    const coursesResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/courses?select=id&limit=0`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    
    if (coursesResponse.ok) {
      console.log('   ✅ courses table is visible to PostgREST');
    } else {
      const error = await coursesResponse.json();
      console.log('   ❌ courses table NOT visible:');
      console.log('   ', error.message || JSON.stringify(error));
    }
  } catch (err) {
    console.log('   ❌ Error querying courses:', err.message);
  }
  
  console.log('');
  
  // Test 2: Query enrollments table
  console.log('2. Testing enrollments table visibility...');
  try {
    const enrollmentsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/enrollments?select=id&limit=0`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    
    if (enrollmentsResponse.ok) {
      console.log('   ✅ enrollments table is visible to PostgREST');
    } else {
      const error = await enrollmentsResponse.json();
      console.log('   ❌ enrollments table NOT visible:');
      console.log('   ', error.message || JSON.stringify(error));
    }
  } catch (err) {
    console.log('   ❌ Error querying enrollments:', err.message);
  }
  
  console.log('');
  
  // Test 3: Check students table (known to exist)
  console.log('3. Testing students table (control - should work)...');
  try {
    const studentsResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/students?select=id&limit=0`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    
    if (studentsResponse.ok) {
      console.log('   ✅ students table is visible (control test passed)');
    } else {
      const error = await studentsResponse.json();
      console.log('   ⚠️  students table query failed:');
      console.log('   ', error.message || JSON.stringify(error));
    }
  } catch (err) {
    console.log('   ❌ Error querying students:', err.message);
  }
  
  console.log('\n📊 Summary:');
  console.log('   If courses/enrollments show ❌ but students shows ✅,');
  console.log('   then PostgREST schema cache has NOT refreshed yet.');
  console.log('   Migration applied to DB but API layer not aware.');
}

testPostgRESTSchema();
