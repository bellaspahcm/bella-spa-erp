import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from .env.local
const envFile = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(line => line.includes('='))
    .map(line => {
      const [key, ...value] = line.split('=');
      return [key.trim(), value.join('=').trim()];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const tenantId = 'c1e19d70-36ab-4a5f-a36c-92f7e7f6e05d'; // Bella Dental Clinic

async function run() {
  console.log('Starting seed for Bella Dental Clinic (healthcare)...');

  // 1. Seed Chart of Accounts (COA)
  console.log('Seeding Chart of Accounts...');
  const { error: seedError } = await supabase.rpc('seed_default_coa', {
    p_tenant_id: tenantId,
  });
  if (seedError) {
    console.error('Error seeding default COA:', seedError);
    process.exit(1);
  }

  // 2. Fetch and map accounting accounts
  const { data: accounts, error: accError } = await supabase
    .from('accounting_accounts')
    .select('id, account_code')
    .eq('tenant_id', tenantId);

  if (accError || !accounts) {
    console.error('Error fetching accounts:', accError);
    process.exit(1);
  }

  const accountMap = new Map();
  accounts.forEach(acc => {
    accountMap.set(acc.account_code, acc.id);
  });
  console.log(`Mapped ${accountMap.size} accounts for tenant.`);

  // 3. Clear existing test data to ensure idempotency
  console.log('Cleaning up existing demo data for tenant...');
  
  // Delete lines first due to FK constraints
  const { data: existingEntries } = await supabase
    .from('journal_entries')
    .select('id')
    .eq('tenant_id', tenantId);
  const entryIds = existingEntries?.map(e => e.id) || [];
  if (entryIds.length > 0) {
    await supabase.from('journal_lines').delete().in('entry_id', entryIds);
    await supabase.from('journal_entries').delete().in('id', entryIds);
  }

  await supabase.from('expenses').delete().eq('tenant_id', tenantId);
  await supabase.from('salary_records').delete().eq('tenant_id', tenantId);
  
  // Delete users that were created by previous seed runs
  await supabase
    .from('users')
    .delete()
    .eq('tenant_id', tenantId)
    .neq('role', 'admin'); // Do not delete the main admin

  // 4. Seed staff (doctors and nurses)
  console.log('Seeding staff...');
  const doctorsData = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'datasets/healthcare-demo/doctors.json'), 'utf8'));
  
  const staffToInsert = doctorsData.map(doc => ({
    email: doc.email,
    full_name: doc.full_name,
    role: doc.role,
    position_tier: doc.position_tier,
    hire_date: doc.hire_date,
    status: 'active',
    tenant_id: tenantId,
  }));

  const { data: insertedStaff, error: staffError } = await supabase
    .from('users')
    .insert(staffToInsert)
    .select();

  if (staffError || !insertedStaff) {
    console.error('Error inserting staff:', staffError);
    process.exit(1);
  }
  console.log(`Seeded ${insertedStaff.length} doctors and nurses.`);

  // 5. Seed expenses
  console.log('Seeding expenses...');
  const expensesData = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'datasets/healthcare-demo/expenses.json'), 'utf8'));
  const expensesToInsert = expensesData.map(exp => ({
    ...exp,
    tenant_id: tenantId,
  }));

  const { error: expInsertError } = await supabase
    .from('expenses')
    .insert(expensesToInsert);

  if (expInsertError) {
    console.error('Error inserting expenses:', expInsertError);
    process.exit(1);
  }
  console.log(`Seeded ${expensesToInsert.length} expenses.`);

  // 6. Seed journal entries
  console.log('Seeding journal entries...');
  const accountingData = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'datasets/healthcare-demo/accounting.json'), 'utf8'));

  for (const entry of accountingData) {
    const { data: header, error: headerError } = await supabase
      .from('journal_entries')
      .insert({
        tenant_id: tenantId,
        description: entry.description,
        entry_date: entry.entry_date,
        status: entry.status,
        reference_type: entry.reference_type,
        reference_id: crypto.randomUUID(), // Dummy reference id
      })
      .select('id')
      .single();

    if (headerError || !header) {
      console.error('Error creating journal header:', headerError);
      process.exit(1);
    }

    const linesToInsert = entry.lines.map(line => {
      const accountId = accountMap.get(line.account_code);
      if (!accountId) {
        console.error(`Account code ${line.account_code} not found in tenant COA!`);
        process.exit(1);
      }
      return {
        entry_id: header.id,
        account_id: accountId,
        debit_amount: line.debit_amount,
        credit_amount: line.credit_amount,
      };
    });

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(linesToInsert);

    if (linesError) {
      console.error('Error inserting journal lines:', linesError);
      process.exit(1);
    }
  }
  console.log(`Seeded ${accountingData.length} journal entries.`);

  // 7. Seed salary records
  console.log('Seeding salary records...');
  const salaries = [
    { name: 'BS. Lê Minh', base: 15000000, bonus: 13000000 },
    { name: 'BS. Trần Thảo', base: 15000000, bonus: 10000000 },
    { name: 'BS. Nguyễn An', base: 12000000, bonus: 6000000 },
    { name: 'Điều dưỡng Lê Mai', base: 8000000, bonus: 2000000 },
    { name: 'Trợ lý nha khoa Vy', base: 6000000, bonus: 1000000 },
  ];

  const salaryRecordsToInsert = salaries.map(sal => {
    const staffMember = insertedStaff.find(s => s.full_name === sal.name);
    if (!staffMember) {
      console.warn(`Staff member ${sal.name} not found, skipping salary seed.`);
      return null;
    }
    return {
      ktv_id: staffMember.id,
      month_year: '2026-07-01',
      base_salary: sal.base,
      service_percentage_bonus: sal.bonus,
      kpi_bonus: 0,
      total_salary: sal.base + sal.bonus,
      status: 'published',
      tenant_id: tenantId,
    };
  }).filter(Boolean);

  const { error: salInsertError } = await supabase
    .from('salary_records')
    .insert(salaryRecordsToInsert);

  if (salInsertError) {
    console.error('Error inserting salary records:', salInsertError);
    process.exit(1);
  }
  console.log(`Seeded ${salaryRecordsToInsert.length} salary records.`);

  console.log('=== SEED COMPLETED SUCCESSFULLY ===');
}

run().catch(console.error);
