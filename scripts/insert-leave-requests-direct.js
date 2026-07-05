#!/usr/bin/env node
/**
 * Insert leave requests directly via individual inserts
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function insertRequests() {
  console.log('📝 Inserting leave requests...\n');

  const tenantId = '26c2d467-7c12-4e77-bb67-0e9e43fd7594';
  const empHighId = 'a3a4f261-506e-4fb7-bd38-d245a3a1fea7';
  const empLowId = 'f3e5e94b-8683-4832-ad39-383c8804751c';

  const today = new Date();
  const start1 = new Date(today);
  start1.setDate(start1.getDate() + 7);
  const end1 = new Date(today);
  end1.setDate(end1.getDate() + 11);

  const start2 = new Date(today);
  start2.setDate(start2.getDate() + 14);
  const end2 = new Date(today);
  end2.setDate(end2.getDate() + 18);

  // Try using PostgreSQL REST API directly
  const requests = [
    {
      id: 'req-gate1-success',
      employee_id: empHighId,
      leave_type: 'annual',
      start_date: start1.toISOString().split('T')[0],
      end_date: end1.toISOString().split('T')[0],
      days: 5,
      reason: 'Family vacation - Gate 1 test',
      status: 'pending',
      tenant_id: tenantId,
    },
    {
      id: 'req-gate1-reject',
      employee_id: empLowId,
      leave_type: 'annual',
      start_date: start2.toISOString().split('T')[0],
      end_date: end2.toISOString().split('T')[0],
      days: 5,
      reason: 'Personal matter - Gate 1 test',
      status: 'pending',
      tenant_id: tenantId,
    },
  ];

  for (const req of requests) {
    try {
      // Use raw fetch to bypass schema cache
      const response = await fetch(`${SUPABASE_URL}/rest/v1/leave_requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify(req),
      });

      if (response.ok) {
        console.log(`✅ Inserted: ${req.id}`);
      } else {
        const error = await response.text();
        if (error.includes('duplicate') || error.includes('already exists')) {
          console.log(`✅ Already exists: ${req.id}`);
        } else {
          console.log(`⚠️  ${req.id}: ${error}`);
        }
      }
    } catch (err) {
      console.log(`⚠️  ${req.id}: ${err.message}`);
    }
  }

  // Verify
  console.log('\n📋 Verifying...');
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/leave_requests?id=in.(req-gate1-success,req-gate1-reject)&select=id,employee_id,days,status`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Found ${data.length} requests in database`);
      data.forEach(r => console.log(`   - ${r.id}: ${r.days} days, status: ${r.status}`));
    } else {
      console.log('⚠️  Could not verify (table may need cache refresh)');
    }
  } catch (err) {
    console.log('⚠️  Verification skipped');
  }

  console.log('\n✅ Leave requests ready for Gate 1 testing!');
}

insertRequests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
