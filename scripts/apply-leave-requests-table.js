#!/usr/bin/env node
/**
 * Apply leave_requests table directly via SQL
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function applyMigration() {
  console.log('🔧 Applying leave_requests table...\n');

  const sql = `
-- Create leave_requests table
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('annual', 'sick', 'unpaid', 'maternity', 'paternity')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days INTEGER NOT NULL CHECK (days > 0),
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approval_reason TEXT,
  approved_at TIMESTAMPTZ,
  decision_id TEXT,
  decision_confidence NUMERIC(3,2),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_tenant ON leave_requests(tenant_id, created_at DESC);

COMMENT ON TABLE leave_requests IS 'Temporary table for Decision Engine Gate 1 validation';
`;

  try {
    // Execute SQL directly via RPC or manual query
    // Since Supabase client doesn't support DDL directly, we'll check if table exists first
    const { data: tableExists, error: checkError } = await supabase
      .from('leave_requests')
      .select('id')
      .limit(1);

    if (!checkError || checkError.code !== '42P01') {
      console.log('✅ Table leave_requests already exists');
      return;
    }

    console.log('⚠️  Table does not exist. Please run this SQL manually in Supabase SQL Editor:');
    console.log('\n' + '='.repeat(80));
    console.log(sql);
    console.log('='.repeat(80) + '\n');
    console.log('Or use: npx supabase db push (after syncing migration history)');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

applyMigration()
  .then(() => {
    console.log('\n📝 Next steps:');
    console.log('1. Apply the SQL above in Supabase SQL Editor');
    console.log('2. Run: node scripts/seed-gate1-data.js');
    console.log('3. Run Gate 1 validation tests');
    process.exit(0);
  })
  .catch(() => process.exit(1));
